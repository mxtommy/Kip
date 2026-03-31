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
import type { BmsBankConnectionMode } from '../../core/interfaces/widgets-interface';
import { TitleCasePipe } from '@angular/common';

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
  private readonly destroyRef = inject(DestroyRef);

  protected solarFormGroup!: UntypedFormGroup;
  protected trackedIdsControl!: UntypedFormControl;
  protected groupsFormArray!: UntypedFormArray;
  protected optionsByIdGroup!: UntypedFormGroup;
  protected readonly discoveredSolarIds = signal<string[]>([]);
  protected readonly hasGroups = computed(() => this.groupsFormArray?.length > 0);
  protected readonly optionIds = computed(() => {
    const discovered = this.discoveredSolarIds();
    const configured = Object.keys(this.optionsByIdGroup?.controls ?? {});
    return [...new Set([...configured, ...discovered])].sort();
  });

  private discoveryToken?: PathDiscoveryToken;

  ngOnInit(): void {
    this.solarFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormGroup;
    if (!this.solarFormGroup) return;

    this.ensureTrackedControl();
    this.ensureGroupsArray();
    this.ensureOptionsGroup();
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

  private ensureTrackedControl(): void {
    const trackedControl = this.solarFormGroup.get('trackedIds');
    if (trackedControl instanceof UntypedFormControl) {
      this.trackedIdsControl = trackedControl;
      return;
    }

    this.trackedIdsControl = new UntypedFormControl([]);
    this.solarFormGroup.addControl('trackedIds', this.trackedIdsControl);
  }

  private ensureGroupsArray(): void {
    const groupsControl = this.solarFormGroup.get('groups') ?? this.solarFormGroup.get('banks');
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
    const optionsControl = this.solarFormGroup.get('optionsById') ?? this.solarFormGroup.get('solarOptionsById');
    if (optionsControl instanceof UntypedFormGroup) {
      this.optionsByIdGroup = optionsControl;
      if (!this.solarFormGroup.get('optionsById')) {
        this.solarFormGroup.addControl('optionsById', optionsControl);
      }
      return;
    }

    this.optionsByIdGroup = new UntypedFormGroup({});
    this.solarFormGroup.addControl('optionsById', this.optionsByIdGroup);
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
      arrayRatedPowerW: new UntypedFormControl(option.arrayRatedPowerW, [Validators.min(0)])
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
    const ids = Array.from(this.discovery.activePaths(this.discoveryToken))
      .map(path => this.extractSolarId(path))
      .filter((id): id is string => !!id);

    const sorted = [...new Set(ids)].sort();
    for (const id of sorted) {
      this.ensureSolarOption(id);
    }
    this.discoveredSolarIds.set(sorted);
  }

  private extractSolarId(path: string): string | null {
    const match = path.match(/self\.electrical\.solar\.([^.]+)\./);
    return match ? match[1] : null;
  }
}
