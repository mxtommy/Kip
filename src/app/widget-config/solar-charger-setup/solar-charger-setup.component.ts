import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, input, signal } from '@angular/core';
import { FormGroupDirective, ReactiveFormsModule, UntypedFormControl, UntypedFormGroup, Validators } from '@angular/forms';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PathDiscoveryService, PathDiscoveryToken } from '../../core/services/path-discovery.service';
import type { SolarOptionConfig } from '../../widgets/widget-solar-charger/solar-charger.types';

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
  protected trackedSolarIdsControl!: UntypedFormControl;
  protected solarOptionsGroup!: UntypedFormGroup;
  protected readonly discoveredSolarIds = signal<string[]>([]);
  protected readonly optionIds = computed(() => {
    const discovered = this.discoveredSolarIds();
    const configured = Object.keys(this.solarOptionsGroup?.controls ?? {});
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

  protected ensureSolarOption(id: string): void {
    if (this.solarOptionsGroup.get(id)) return;
    this.solarOptionsGroup.addControl(id, this.createOptionGroup({ arrayRatedPowerW: null }));
  }

  private ensureTrackedControl(): void {
    const trackedControl = this.solarFormGroup.get('trackedSolarIds');
    if (trackedControl instanceof UntypedFormControl) {
      this.trackedSolarIdsControl = trackedControl;
      return;
    }
    this.trackedSolarIdsControl = new UntypedFormControl([]);
    this.solarFormGroup.addControl('trackedSolarIds', this.trackedSolarIdsControl);
  }

  private ensureOptionsGroup(): void {
    const optionsControl = this.solarFormGroup.get('solarOptionsById');
    if (optionsControl instanceof UntypedFormGroup) {
      this.solarOptionsGroup = optionsControl;
      return;
    }
    this.solarOptionsGroup = new UntypedFormGroup({});
    this.solarFormGroup.addControl('solarOptionsById', this.solarOptionsGroup);
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
