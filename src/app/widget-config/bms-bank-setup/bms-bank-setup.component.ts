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
import type { BmsBankConfig } from '../../widgets/widget-bms/bms.types';

@Component({
  selector: 'bms-bank-setup',
  templateUrl: './bms-bank-setup.component.html',
  styleUrl: './bms-bank-setup.component.scss',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule, MatDividerModule]
})
export class BmsBankSetupComponent implements OnInit, OnDestroy {
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
  protected banksFormArray!: UntypedFormArray;
  protected trackedBatteryIdsControl!: UntypedFormControl;
  protected readonly discoveredBatteryIds = signal<string[]>([]);
  protected readonly hasBanks = computed(() => this.banksFormArray?.length > 0);

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
    const bank: BmsBankConfig = {
      id: `bank-${Date.now()}`,
      name: 'New Bank',
      batteryIds: []
    };
    this.banksFormArray.push(this.createBankGroup(bank));
    this.banksFormArray.markAsDirty();
  }

  protected removeBank(index: number): void {
    this.banksFormArray.removeAt(index);
    this.banksFormArray.markAsDirty();
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
    const trackedControl = this.bmsFormGroup.get('trackedBatteryIds');
    if (trackedControl instanceof UntypedFormControl) {
      this.trackedBatteryIdsControl = trackedControl;
      return;
    }
    this.trackedBatteryIdsControl = new UntypedFormControl([]);
    this.bmsFormGroup.addControl('trackedBatteryIds', this.trackedBatteryIdsControl);
  }

  private ensureBanksArray(): void {
    const banksControl = this.bmsFormGroup.get('banks');
    if (banksControl instanceof FormArray || banksControl instanceof UntypedFormArray) {
      this.banksFormArray = banksControl as UntypedFormArray;
      return;
    }

    const initialBanks = Array.isArray(banksControl?.value) ? banksControl.value as BmsBankConfig[] : [];
    this.banksFormArray = new UntypedFormArray(initialBanks.map(bank => this.createBankGroup(bank)));
    this.bmsFormGroup.setControl('banks', this.banksFormArray);
  }

  private createBankGroup(bank: BmsBankConfig): UntypedFormGroup {
    return new UntypedFormGroup({
      id: new UntypedFormControl(bank.id, Validators.required),
      name: new UntypedFormControl(bank.name, Validators.required),
      batteryIds: new UntypedFormControl(bank.batteryIds ?? [])
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
