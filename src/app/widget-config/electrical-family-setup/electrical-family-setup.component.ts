import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormGroupDirective, ReactiveFormsModule, UntypedFormArray, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PathDiscoveryService, PathDiscoveryToken } from '../../core/services/path-discovery.service';
import { DataService } from '../../core/services/data.service';
import type { BmsBankConnectionMode, ElectricalGroupConfig, ElectricalTrackedDevice } from '../../core/interfaces/widgets-interface';

@Component({
  selector: 'electrical-family-setup',
  templateUrl: './electrical-family-setup.component.html',
  styleUrl: './electrical-family-setup.component.scss',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDividerModule,
    MatButtonModule,
    MatIconModule
  ]
})
export class ElectricalFamilySetupComponent implements OnInit, OnDestroy {
  protected readonly connectionModes: BmsBankConnectionMode[] = ['parallel', 'series'];

  readonly formGroupName = input.required<string>();
  readonly setupLabel = input.required<string>();
  readonly discoveryId = input.required<string>();
  readonly discoveryPattern = input.required<string>();
  readonly familyRegex = input.required<string>();
  readonly pathPrefix = input.required<string>();

  private readonly rootFormGroup = inject(FormGroupDirective);
  private readonly discovery = inject(PathDiscoveryService);
  private readonly data = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);

  private static readonly SOURCE_AWARE_FAMILIES = new Set(['charger', 'inverter', 'alternator', 'ac']);

  protected familyFormGroup!: UntypedFormGroup;
  protected trackedDevicesControl!: UntypedFormControl;
  protected groupsFormArray?: UntypedFormArray;
  protected readonly discoveredIds = signal<string[]>([]);
  protected readonly discoveredTrackedDevices = signal<ElectricalTrackedDevice[]>([]);
  protected readonly isSourceAwareFamily = computed(() => ElectricalFamilySetupComponent.SOURCE_AWARE_FAMILIES.has(this.formGroupName().trim()));
  protected readonly memberOptions = computed(() => {
    if (this.isSourceAwareFamily()) {
      return this.discoveredTrackedDevices().map(device => ({
        value: device.key,
        label: `${device.id} (${device.source})`
      }));
    }

    return this.discoveredIds().map(id => ({ value: id, label: id }));
  });
  protected readonly hasGroups = computed(() => this.groupsFormArray?.length > 0);
  protected readonly supportsGroups = computed(() => !!this.groupsFormArray);

  private discoveryToken?: PathDiscoveryToken;

  private static readonly FAMILY_CRITERIA: Record<string, { patterns: string[]; pathPrefixes: string[]; idRegex: RegExp }> = {
    charger: {
      patterns: ['self.electrical.charger*'],
      pathPrefixes: ['electrical.charger'],
      idRegex: /self\.electrical\.chargers?\.([^.]+)(?:\.|$)/
    },
    inverter: {
      patterns: ['self.electrical.inverter*'],
      pathPrefixes: ['electrical.inverter'],
      idRegex: /self\.electrical\.inverters?\.([^.]+)(?:\.|$)/
    },
    alternator: {
      patterns: ['self.electrical.alternator*'],
      pathPrefixes: ['electrical.alternator'],
      idRegex: /self\.electrical\.alternators?\.([^.]+)(?:\.|$)/
    },
    ac: {
      patterns: ['self.electrical.ac*'],
      pathPrefixes: ['electrical.ac.'],
      idRegex: /self\.electrical\.ac\.([^.]+)(?:\.|$)/
    }
  };

  ngOnInit(): void {
    this.familyFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormGroup;
    if (!this.familyFormGroup) {
      return;
    }

    this.ensureTrackedControl();
    this.ensureGroupsArray();
    this.initializeDiscovery();
  }

  ngOnDestroy(): void {
    if (this.discoveryToken) {
      this.discovery.unregister(this.discoveryToken);
    }
  }

  protected addGroup(): void {
    const slug = this.setupLabel().toLowerCase().replace(/\s+/g, '-');
    const nextGroup: ElectricalGroupConfig = {
      id: `${slug}-group-${Date.now()}`,
      name: `${this.setupLabel()} Group`,
      memberIds: [],
      connectionMode: 'parallel'
    };

    this.groupsFormArray.push(this.createGroup(nextGroup));
    this.groupsFormArray.markAsDirty();
  }

  protected removeGroup(index: number): void {
    this.groupsFormArray.removeAt(index);
    this.groupsFormArray.markAsDirty();
  }

  protected compareTrackedDevice(
    left: ElectricalTrackedDevice | null,
    right: ElectricalTrackedDevice | null
  ): boolean {
    if (!left && !right) {
      return true;
    }

    if (!left || !right) {
      return false;
    }

    return left.key === right.key;
  }

  private ensureTrackedControl(): void {
    const trackedControl = this.familyFormGroup.get('trackedDevices');
    if (trackedControl instanceof UntypedFormControl) {
      this.trackedDevicesControl = trackedControl;
      this.trackedDevicesControl.setValue(this.normalizeTrackedDeviceArray(this.trackedDevicesControl.value), { emitEvent: false });
      return;
    }

    this.trackedDevicesControl = new UntypedFormControl([]);
    this.familyFormGroup.addControl('trackedDevices', this.trackedDevicesControl);
    this.trackedDevicesControl.setValue(this.normalizeTrackedDeviceArray(this.trackedDevicesControl.value), { emitEvent: false });
  }

  private ensureGroupsArray(): void {
    const groupsControl = this.familyFormGroup.get('groups') ?? this.familyFormGroup.get('banks');
    if (!groupsControl) {
      return;
    }
    if (groupsControl instanceof FormArray || groupsControl instanceof UntypedFormArray) {
      this.groupsFormArray = groupsControl as UntypedFormArray;
      if (!this.familyFormGroup.get('groups')) {
        this.familyFormGroup.setControl('groups', this.groupsFormArray);
      }
      return;
    }

    const initialGroups = Array.isArray(groupsControl?.value) ? groupsControl.value as ElectricalGroupConfig[] : [];
    this.groupsFormArray = new UntypedFormArray(initialGroups.map(group => this.createGroup(group)));
    this.familyFormGroup.setControl('groups', this.groupsFormArray);
  }

  private createGroup(group: ElectricalGroupConfig): UntypedFormGroup {
    return new UntypedFormGroup({
      id: new UntypedFormControl(group.id, Validators.required),
      name: new UntypedFormControl(group.name, Validators.required),
      memberIds: new UntypedFormControl(group.memberIds ?? []),
      connectionMode: new UntypedFormControl(group.connectionMode ?? 'parallel', Validators.required)
    });
  }

  private initializeDiscovery(): void {
    const criteria = this.resolveCriteria();

    this.discoveryToken = this.discovery.register({
      id: this.discoveryId(),
      patterns: criteria.patterns,
      contextTypes: ['self'],
      pathPrefixes: criteria.pathPrefixes
    });

    this.updateDiscoveredIds();

    this.discovery.changes(this.discoveryToken)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateDiscoveredIds());

    if (this.isSourceAwareFamily()) {
      this.data.observePathUpdates()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(event => {
          if (event.kind !== 'data' || !this.matchesDiscoveryPath(event.fullPath)) {
            return;
          }

          this.updateDiscoveredIds();
        });
    }
  }

  private matchesDiscoveryPath(path: string | null | undefined): boolean {
    if (!path) {
      return false;
    }

    return this.resolveCriteria().idRegex.test(path);
  }

  private updateDiscoveredIds(): void {
    if (!this.discoveryToken) {
      return;
    }

    const idRegex = this.resolveCriteria().idRegex;
    const paths = new Set<string>([
      ...Array.from(this.discovery.activePaths(this.discoveryToken)),
      ...this.data.getCachedPaths(true)
    ]);

    const discoveredIds = new Set<string>();
    const sourcesById = new Map<string, Set<string>>();

    Array.from(paths).forEach(path => {
      const match = idRegex.exec(path);
      const id = match ? match[1] : null;
      if (!id) {
        return;
      }

      discoveredIds.add(id);

      if (!sourcesById.has(id)) {
        sourcesById.set(id, new Set<string>());
      }

      const pathObject = this.data.getPathObject(path);
      const sourceKeys = Object.keys(pathObject?.sources ?? {});
      const discoveredSources = sourcesById.get(id);
      if (!discoveredSources) {
        return;
      }

      sourceKeys.forEach(source => {
        const trimmedSource = source.trim();
        if (!trimmedSource) {
          return;
        }

        discoveredSources.add(trimmedSource);
      });
    });

    const sortedIds = [...discoveredIds].sort((left, right) => left.localeCompare(right));
    this.discoveredIds.set(sortedIds);

    if (this.isSourceAwareFamily()) {
      const discoveredDevices = new Map<string, ElectricalTrackedDevice>();
      sortedIds.forEach(id => {
        const sources = sourcesById.get(id);
        const normalizedSources = sources && sources.size > 0
          ? [...sources].sort((left, right) => left.localeCompare(right))
          : ['default'];

        normalizedSources.forEach(source => {
          const key = `${id}||${source}`;
          discoveredDevices.set(key, { id, source, key });
        });
      });

      this.discoveredTrackedDevices.set([...discoveredDevices.values()].sort((left, right) => left.key.localeCompare(right.key)));
      return;
    }

    this.discoveredTrackedDevices.set(sortedIds
      .map(id => ({ id, source: 'default', key: `${id}||default` }))
      .sort((left, right) => left.key.localeCompare(right.key)));
  }

  private normalizeTrackedDeviceArray(value: unknown): ElectricalTrackedDevice[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const devices = new Map<string, ElectricalTrackedDevice>();
    value.forEach(item => {
      if (typeof item === 'string') {
        const id = item.trim();
        if (!id) {
          return;
        }
        const key = `${id}||default`;
        devices.set(key, { id, source: 'default', key });
        return;
      }

      if (!item || typeof item !== 'object') {
        return;
      }

      const candidate = item as { id?: unknown; source?: unknown; key?: unknown };
      const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
      const source = typeof candidate.source === 'string' ? candidate.source.trim() : 'default';
      if (!id || !source) {
        return;
      }

      const key = typeof candidate.key === 'string' && candidate.key.trim().length > 0
        ? candidate.key.trim()
        : `${id}||${source}`;

      devices.set(key, { id, source, key });
    });

    return [...devices.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  private resolveCriteria(): { patterns: string[]; pathPrefixes: string[]; idRegex: RegExp } {
    const key = this.formGroupName().trim();
    const known = ElectricalFamilySetupComponent.FAMILY_CRITERIA[key];
    if (known) {
      return known;
    }

    // Fallback keeps backward compatibility for custom electrical family setups.
    return {
      patterns: [this.discoveryPattern()],
      pathPrefixes: [this.pathPrefix()],
      idRegex: new RegExp(this.familyRegex())
    };
  }
}
