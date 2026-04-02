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
import type { BmsBankConnectionMode, ElectricalGroupConfig } from '../../core/interfaces/widgets-interface';

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

  protected familyFormGroup!: UntypedFormGroup;
  protected trackedIdsControl!: UntypedFormControl;
  protected groupsFormArray!: UntypedFormArray;
  protected readonly discoveredIds = signal<string[]>([]);
  protected readonly hasGroups = computed(() => this.groupsFormArray?.length > 0);

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

  private ensureTrackedControl(): void {
    const trackedControl = this.familyFormGroup.get('trackedIds');
    if (trackedControl instanceof UntypedFormControl) {
      this.trackedIdsControl = trackedControl;
      return;
    }

    this.trackedIdsControl = new UntypedFormControl([]);
    this.familyFormGroup.addControl('trackedIds', this.trackedIdsControl);
  }

  private ensureGroupsArray(): void {
    const groupsControl = this.familyFormGroup.get('groups') ?? this.familyFormGroup.get('banks');
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

    const ids = Array.from(paths)
      .map(path => {
        const match = idRegex.exec(path);
        return match ? match[1] : null;
      })
      .filter((id): id is string => !!id);

    this.discoveredIds.set([...new Set(ids)].sort((left, right) => left.localeCompare(right)));
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
