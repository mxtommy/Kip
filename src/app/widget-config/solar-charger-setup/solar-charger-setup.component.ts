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
import type { ElectricalGroupConfig, SolarOptionConfig } from '../../widgets/widget-solar-charger/solar-charger.types';
import type { BmsBankConnectionMode, ElectricalTrackedDevice } from '../../core/interfaces/widgets-interface';
import { TitleCasePipe } from '@angular/common';
import { DataService } from '../../core/services/data.service';

@Component({
  selector: 'solar-charger-setup',
  templateUrl: './solar-charger-setup.component.html',
  styleUrl: './solar-charger-setup.component.scss',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDividerModule,
    MatButtonModule,
    MatIconModule,
    TitleCasePipe
  ]
})
export class SolarChargerSetupComponent implements OnInit, OnDestroy {
  protected readonly connectionModes: BmsBankConnectionMode[] = ['parallel', 'series'];

  readonly formGroupName = input.required<string>();

  private readonly rootFormGroup = inject(FormGroupDirective);
  private readonly discovery = inject(PathDiscoveryService);
  private readonly data = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);

  protected solarFormGroup!: UntypedFormGroup;
  protected trackedDevicesControl!: UntypedFormControl;
  protected groupsFormArray?: UntypedFormArray;
  protected optionsByIdGroup!: UntypedFormGroup;
  protected readonly discoveredSolarIds = signal<string[]>([]);
  protected readonly discoveredTrackedDevices = signal<ElectricalTrackedDevice[]>([]);
  protected readonly selectedTrackedDeviceIds = signal<string[]>([]);
  protected readonly hasGroups = computed(() => this.groupsFormArray?.length > 0);
  protected readonly supportsGroups = computed(() => !!this.groupsFormArray);
  protected readonly optionIds = computed(() => {
    const selected = this.selectedTrackedDeviceIds();
    const discovered = this.discoveredSolarIds();
    const configured = Object.keys(this.optionsByIdGroup?.controls ?? {});

    if (selected.length) {
      return [...new Set([...selected, ...configured.filter(id => selected.includes(id))])].sort();
    }

    return [...new Set([...configured, ...discovered])].sort();
  });

  private discoveryToken?: PathDiscoveryToken;

  ngOnInit(): void {
    this.solarFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormGroup;
    if (!this.solarFormGroup) return;

    this.ensureOptionsGroup();
    this.ensureTrackedControl();
    this.ensureGroupsArray();
    this.initializeDiscovery();
  }

  ngOnDestroy(): void {
    if (this.discoveryToken) {
      this.discovery.unregister(this.discoveryToken);
    }
  }

  protected ensureSolarOption(id: string): void {
    if (this.optionsByIdGroup.get(id)) return;
    this.optionsByIdGroup.addControl(id, this.createOptionGroup({ arrayRatedPowerW: null }));
  }

  protected compareTrackedDevice(
    left: ElectricalTrackedDevice | null,
    right: ElectricalTrackedDevice | null
  ): boolean {
    if (!left || !right) return left === right;
    return left.key === right.key;
  }

  private ensureTrackedControl(): void {
    const trackedControl = this.solarFormGroup.get('trackedDevices');
    if (trackedControl instanceof UntypedFormControl) {
      this.trackedDevicesControl = trackedControl;
      this.trackedDevicesControl.setValue(this.normalizeTrackedDeviceArray(this.trackedDevicesControl.value), { emitEvent: false });
      this.syncSelectedTrackedDeviceIds(this.trackedDevicesControl.value);
      this.trackedDevicesControl.valueChanges
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(value => this.syncSelectedTrackedDeviceIds(value));
      return;
    }

    this.trackedDevicesControl = new UntypedFormControl([]);
    this.solarFormGroup.addControl('trackedDevices', this.trackedDevicesControl);
    this.syncSelectedTrackedDeviceIds(this.trackedDevicesControl.value);
    this.trackedDevicesControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(value => this.syncSelectedTrackedDeviceIds(value));
  }

  private ensureGroupsArray(): void {
    const groupsControl = this.solarFormGroup.get('groups') ?? this.solarFormGroup.get('banks');
    if (!groupsControl) {
      return;
    }
    if (groupsControl instanceof FormArray || groupsControl instanceof UntypedFormArray) {
      this.groupsFormArray = groupsControl as UntypedFormArray;
      if (!this.solarFormGroup.get('groups')) {
        this.solarFormGroup.setControl('groups', this.groupsFormArray);
      }
      return;
    }

    const initialGroups = Array.isArray(groupsControl?.value) ? groupsControl.value as ElectricalGroupConfig[] : [];
    this.groupsFormArray = new UntypedFormArray(initialGroups.map(group => this.createGroup(group)));
    this.solarFormGroup.setControl('groups', this.groupsFormArray);
  }

  private ensureOptionsGroup(): void {
    const optionsControl = this.solarFormGroup.get('optionsById');
    if (optionsControl instanceof UntypedFormGroup) {
      this.optionsByIdGroup = optionsControl;
      this.syncOptionControlStates();
      return;
    }

    this.optionsByIdGroup = new UntypedFormGroup({});
    this.solarFormGroup.addControl('optionsById', this.optionsByIdGroup);
    this.syncOptionControlStates();
  }

  protected addGroup(): void {
    const next: ElectricalGroupConfig = {
      id: `solar-bank-${Date.now()}`,
      name: 'New Group',
      memberIds: [],
      connectionMode: 'parallel'
    };

    this.groupsFormArray.push(this.createGroup(next));
    this.groupsFormArray.markAsDirty();
  }

  protected removeGroup(index: number): void {
    this.groupsFormArray.removeAt(index);
    this.groupsFormArray.markAsDirty();
  }

  private createGroup(group: ElectricalGroupConfig): UntypedFormGroup {
    return new UntypedFormGroup({
      id: new UntypedFormControl(group.id, Validators.required),
      name: new UntypedFormControl(group.name, Validators.required),
      memberIds: new UntypedFormControl(group.memberIds ?? []),
      connectionMode: new UntypedFormControl(group.connectionMode ?? 'parallel', Validators.required)
    });
  }

  private createOptionGroup(option: SolarOptionConfig): UntypedFormGroup {
    return new UntypedFormGroup({
      arrayRatedPowerW: new UntypedFormControl(option.arrayRatedPowerW)
    });
  }

  private initializeDiscovery(): void {
    this.discoveryToken = this.discovery.register({
      id: 'solar-chargers',
      patterns: ['self.electrical.solar.*'],
      contextTypes: ['self'],
      pathPrefixes: ['electrical.solar.']
    });

    this.updateDiscoveredSolarIds();

    this.discovery.changes(this.discoveryToken)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateDiscoveredSolarIds());
  }

  private updateDiscoveredSolarIds(): void {
    if (!this.discoveryToken) return;

    const paths = new Set<string>([
      ...Array.from(this.discovery.activePaths(this.discoveryToken)),
      ...this.data.getCachedPaths(true)
    ]);

    const ids = Array.from(paths)
      .map(path => this.extractSolarId(path))
      .filter((id): id is string => !!id);

    const sorted = [...new Set(ids)].sort();
    const sourcesById = new Map<string, Set<string>>();
    Array.from(paths).forEach(path => {
      const id = this.extractSolarId(path);
      if (!id) return;

      const pathObject = this.data.getPathObject(path);
      const sourceKeys = Object.keys(pathObject?.sources ?? {});
      if (!sourcesById.has(id)) {
        sourcesById.set(id, new Set<string>());
      }

      const discoveredSources = sourcesById.get(id);
      if (!discoveredSources) {
        return;
      }

      sourceKeys.forEach(source => {
        const trimmedSource = source.trim();
        if (!trimmedSource) return;
        discoveredSources.add(trimmedSource);
      });
    });

    const devices = new Map<string, ElectricalTrackedDevice>();
    sorted.forEach(id => {
      const sources = sourcesById.get(id);
      const normalizedSources = sources && sources.size > 0
        ? [...sources].sort((left, right) => left.localeCompare(right))
        : ['default'];

      normalizedSources.forEach(source => {
        const key = `${id}||${source}`;
        devices.set(key, { id, source, key });
      });
    });

    for (const id of sorted) {
      this.ensureSolarOption(id);
    }
    this.discoveredSolarIds.set(sorted);
    this.discoveredTrackedDevices.set([...devices.values()].sort((left, right) => left.key.localeCompare(right.key)));
    this.syncOptionControlStates();
  }

  private syncSelectedTrackedDeviceIds(value: unknown): void {
    const selectedIds = [...new Set(this.normalizeTrackedDeviceArray(value).map(device => device.id))].sort();
    selectedIds.forEach(id => this.ensureSolarOption(id));
    this.selectedTrackedDeviceIds.set(selectedIds);
    this.syncOptionControlStates();
  }

  private syncOptionControlStates(): void {
    if (!this.optionsByIdGroup) {
      return;
    }

    const visibleIds = new Set(this.optionIds());
    Object.entries(this.optionsByIdGroup.controls).forEach(([id, control]) => {
      const powerControl = control.get('arrayRatedPowerW');
      if (!(powerControl instanceof UntypedFormControl)) {
        return;
      }

      if (visibleIds.has(id)) {
        powerControl.setValidators([Validators.required, Validators.min(0)]);
        powerControl.enable({ emitEvent: false });
      } else {
        powerControl.clearValidators();
        powerControl.disable({ emitEvent: false });
      }

      powerControl.updateValueAndValidity({ emitEvent: false });
    });

    this.optionsByIdGroup.updateValueAndValidity({ emitEvent: false });
    this.solarFormGroup.updateValueAndValidity({ emitEvent: false });
  }

  private extractSolarId(path: string): string | null {
    const match = path.match(/^self\.electrical\.solar\.([^.]+)(?:\.|$)/);
    return match ? match[1] : null;
  }

  private normalizeTrackedDeviceArray(value: unknown): ElectricalTrackedDevice[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const devices = new Map<string, ElectricalTrackedDevice>();
    value.forEach(item => {
      if (typeof item === 'string') {
        const id = item.trim();
        if (!id) return;
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
}
