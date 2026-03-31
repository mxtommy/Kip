import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormArray, FormGroupDirective, ReactiveFormsModule, UntypedFormArray, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PathDiscoveryService, PathDiscoveryToken } from '../../core/services/path-discovery.service';
import type { BmsBankConnectionMode } from '../../widgets/widget-bms/bms.types';
import type { ElectricalGroupConfig } from '../../core/interfaces/widgets-interface';
import { TitleCasePipe } from '@angular/common';

@Component({
  selector: 'bms-bank-setup',
  templateUrl: './bms-bank-setup.component.html',
  styleUrl: './bms-bank-setup.component.scss',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatDividerModule, TitleCasePipe]
})
export class BmsBankSetupComponent implements OnInit, OnDestroy {
  protected readonly connectionModes: BmsBankConnectionMode[] = ['parallel', 'series'];

  /**
   * Reactive form group name containing the BMS config object.
   *
   * @example
   * <bms-bank-setup formGroupName="bms"></bms-bank-setup>
   */
  readonly formGroupName = input.required<string>();

  private readonly rootFormGroup = inject(FormGroupDirective);
  private readonly discovery = inject(PathDiscoveryService);
  private readonly destroyRef = inject(DestroyRef);

  protected bmsFormGroup!: UntypedFormGroup;
  protected groupsFormArray!: UntypedFormArray;
  protected trackedIdsControl!: UntypedFormControl;
  protected readonly discoveredBatteryIds = signal<string[]>([]);
  protected readonly hasGroups = computed(() => this.groupsFormArray?.length > 0);

  private discoveryToken?: PathDiscoveryToken;

  /**
   * Initializes the bank setup form controls and discovery watchers.
   *
   * @returns void
   *
   * @example
   * // Triggered automatically by Angular when the config tab opens.
   */
  ngOnInit(): void {
    this.bmsFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormGroup;
    if (!this.bmsFormGroup) return;

    this.ensureTrackedControl();
    this.ensureBanksArray();
    this.initializeDiscovery();
  }

  protected addBank(): void {
    const group: ElectricalGroupConfig = {
      id: `bank-${Date.now()}`,
      name: 'New Bank',
      memberIds: [],
      connectionMode: 'parallel'
    };
    this.groupsFormArray.push(this.createGroup(group));
    this.groupsFormArray.markAsDirty();
  }

  protected removeBank(index: number): void {
    this.groupsFormArray.removeAt(index);
    this.groupsFormArray.markAsDirty();
  }

  /**
   * Cleans up path discovery registrations.
   *
   * @returns void
   *
   * @example
   * // Triggered automatically when the config dialog is destroyed.
   */
  ngOnDestroy(): void {
    if (this.discoveryToken) {
      this.discovery.unregister(this.discoveryToken);
    }
  }

  private ensureTrackedControl(): void {
    const trackedControl = this.bmsFormGroup.get('trackedIds');
    if (trackedControl instanceof UntypedFormControl) {
      this.trackedIdsControl = trackedControl;
      return;
    }

    this.trackedIdsControl = new UntypedFormControl([]);
    this.bmsFormGroup.addControl('trackedIds', this.trackedIdsControl);
  }

  private ensureBanksArray(): void {
    const groupsControl = this.bmsFormGroup.get('groups') ?? this.bmsFormGroup.get('banks');
    if (groupsControl instanceof FormArray || groupsControl instanceof UntypedFormArray) {
      this.groupsFormArray = groupsControl as UntypedFormArray;
      if (!this.bmsFormGroup.get('groups')) {
        this.bmsFormGroup.setControl('groups', this.groupsFormArray);
      }
      return;
    }

    const initialGroups = Array.isArray(groupsControl?.value) ? groupsControl.value as ElectricalGroupConfig[] : [];
    this.groupsFormArray = new UntypedFormArray(initialGroups.map(group => this.createGroup(group)));
    this.bmsFormGroup.setControl('groups', this.groupsFormArray);
  }

  private createGroup(group: ElectricalGroupConfig): UntypedFormGroup {
    const memberIds = Array.isArray(group.memberIds)
      ? group.memberIds
      : (Array.isArray(group.batteryIds) ? group.batteryIds : []);

    return new UntypedFormGroup({
      id: new UntypedFormControl(group.id, Validators.required),
      name: new UntypedFormControl(group.name, Validators.required),
      memberIds: new UntypedFormControl(memberIds),
      connectionMode: new UntypedFormControl(group.connectionMode ?? 'parallel', Validators.required)
    });
  }

  private initializeDiscovery(): void {
    this.discoveryToken = this.discovery.register({
      id: 'bms-batteries',
      patterns: ['self.electrical.batteries.*'],
      contextTypes: ['self'],
      pathPrefixes: ['electrical.batteries.']
    });

    this.updateDiscoveredBatteryIds();

    this.discovery.changes(this.discoveryToken)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateDiscoveredBatteryIds());
  }

  private updateDiscoveredBatteryIds(): void {
    if (!this.discoveryToken) return;
    const ids = Array.from(this.discovery.activePaths(this.discoveryToken))
      .map(path => this.extractBatteryId(path))
      .filter((id): id is string => !!id);
    this.discoveredBatteryIds.set([...new Set(ids)].sort());
  }

  private extractBatteryId(path: string): string | null {
    const match = path.match(/self\.electrical\.batteries\.([^.]+)\./);
    return match ? match[1] : null;
  }
}
