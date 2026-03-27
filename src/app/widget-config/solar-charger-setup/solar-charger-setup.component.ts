import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormGroupDirective, ReactiveFormsModule, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PathDiscoveryService, PathDiscoveryToken } from '../../core/services/path-discovery.service';
import type { SolarChargerOptionConfig } from '../../widgets/widget-solar-charger/solar-charger.types';

@Component({
  selector: 'solar-charger-setup',
  templateUrl: './solar-charger-setup.component.html',
  styleUrl: './solar-charger-setup.component.scss',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDividerModule]
})
export class SolarChargerSetupComponent implements OnInit, OnDestroy {
  readonly formGroupName = input.required<string>();

  private readonly rootFormGroup = inject(FormGroupDirective);
  private readonly discovery = inject(PathDiscoveryService);
  private readonly destroyRef = inject(DestroyRef);

  protected solarFormGroup!: UntypedFormGroup;
  protected trackedChargerIdsControl!: UntypedFormControl;
  protected chargerOptionsGroup!: UntypedFormGroup;
  protected readonly discoveredChargerIds = signal<string[]>([]);
  protected readonly optionIds = computed(() => {
    const discovered = this.discoveredChargerIds();
    const configured = Object.keys(this.chargerOptionsGroup?.controls ?? {});
    return [...new Set([...configured, ...discovered])].sort();
  });

  private discoveryToken?: PathDiscoveryToken;

  ngOnInit(): void {
    this.solarFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormGroup;
    if (!this.solarFormGroup) return;

    this.ensureTrackedControl();
    this.ensureOptionsGroup();
    this.initializeDiscovery();
  }

  ngOnDestroy(): void {
    if (this.discoveryToken) {
      this.discovery.unregister(this.discoveryToken);
    }
  }

  protected ensureChargerOption(id: string): void {
    if (this.chargerOptionsGroup.get(id)) return;
    this.chargerOptionsGroup.addControl(id, this.createOptionGroup({ arrayRatedPowerW: null }));
  }

  private ensureTrackedControl(): void {
    const trackedControl = this.solarFormGroup.get('trackedChargerIds');
    if (trackedControl instanceof UntypedFormControl) {
      this.trackedChargerIdsControl = trackedControl;
      return;
    }
    this.trackedChargerIdsControl = new UntypedFormControl([]);
    this.solarFormGroup.addControl('trackedChargerIds', this.trackedChargerIdsControl);
  }

  private ensureOptionsGroup(): void {
    const optionsControl = this.solarFormGroup.get('chargerOptionsById');
    if (optionsControl instanceof UntypedFormGroup) {
      this.chargerOptionsGroup = optionsControl;
      return;
    }
    this.chargerOptionsGroup = new UntypedFormGroup({});
    this.solarFormGroup.addControl('chargerOptionsById', this.chargerOptionsGroup);
  }

  private createOptionGroup(option: SolarChargerOptionConfig): UntypedFormGroup {
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

    this.updateDiscoveredChargerIds();

    this.discovery.changes(this.discoveryToken)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.updateDiscoveredChargerIds());
  }

  private updateDiscoveredChargerIds(): void {
    if (!this.discoveryToken) return;
    const ids = Array.from(this.discovery.activePaths(this.discoveryToken))
      .map(path => this.extractChargerId(path))
      .filter((id): id is string => !!id);

    const sorted = [...new Set(ids)].sort();
    for (const id of sorted) {
      this.ensureChargerOption(id);
    }
    this.discoveredChargerIds.set(sorted);
  }

  private extractChargerId(path: string): string | null {
    const match = path.match(/self\.electrical\.solar\.([^.]+)\./);
    return match ? match[1] : null;
  }
}
