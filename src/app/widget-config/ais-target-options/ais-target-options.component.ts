import { ChangeDetectionStrategy, Component, OnInit, inject, input } from '@angular/core';
import { FormGroupDirective, ReactiveFormsModule, UntypedFormBuilder, UntypedFormControl, UntypedFormGroup } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDividerModule } from '@angular/material/divider';
import { VesselIconKey, VESSEL_ICON_KEYS } from '../../core/utils/ais-icon-registry';

@Component({
  selector: 'ais-target-options',
  imports: [ReactiveFormsModule, MatCheckboxModule, MatDividerModule],
  templateUrl: './ais-target-options.component.html',
  styleUrl: './ais-target-options.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AisTargetOptionsComponent implements OnInit {
  readonly formGroupName = input.required<string>();

  private rootFormGroup = inject(FormGroupDirective);
  private fb = inject(UntypedFormBuilder);

  protected aisFormGroup: UntypedFormGroup | null = null;
  protected filtersGroup: UntypedFormGroup | null = null;

  protected readonly vesselTypeFilters = VESSEL_ICON_KEYS
    .filter(key => key !== 'vessel/self' && key !== 'vessel/unknown' && key !== 'vessel/spare');

  ngOnInit(): void {
    this.aisFormGroup = this.rootFormGroup.control.get(this.formGroupName()) as UntypedFormGroup | null;
    if (!this.aisFormGroup) {
      console.warn(`AIS form group "${this.formGroupName()}" not found for target options.`);
      return;
    }

    this.filtersGroup = this.ensureFiltersGroup(this.aisFormGroup);
  }

  protected isVesselTypeSelected(key: VesselIconKey): boolean {
    const control = this.vesselTypesControl();
    if (!control) return false;
    const value = control.value;
    return Array.isArray(value) && value.includes(key);
  }

  protected toggleVesselType(key: VesselIconKey): void {
    const control = this.vesselTypesControl();
    if (!control) return;
    const value = Array.isArray(control.value) ? control.value : [];
    const next = new Set<string>(value);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    control.setValue(Array.from(next));
  }

  protected formatVesselTypeLabel(key: VesselIconKey): string {
    const shortKey = key.replace('vessel/', '');
    switch (shortKey) {
      case 'pleasurecraft':
        return 'Pleasure Craft';
      case 'highspeed':
        return 'High Speed';
      case 'sar':
        return 'SAR';
      case 'law':
        return 'Law Enforcement';
      default:
        return `${shortKey.charAt(0).toUpperCase()}${shortKey.slice(1)}`;
    }
  }

  private ensureFiltersGroup(aisGroup: UntypedFormGroup): UntypedFormGroup {
    let filtersGroup = aisGroup.get('filters') as UntypedFormGroup | null;
    if (!filtersGroup) {
      filtersGroup = this.buildDefaultFiltersGroup();
      aisGroup.addControl('filters', filtersGroup);
      return filtersGroup;
    }

    this.ensureControl(filtersGroup, 'anchoredMoored', false);
    this.ensureControl(filtersGroup, 'noCollisionRisk', false);
    this.ensureControl(filtersGroup, 'allAton', false);
    this.ensureControl(filtersGroup, 'allButSar', false);
    this.ensureControl(filtersGroup, 'allVessels', false);
    const vesselTypesControl = this.ensureControl(filtersGroup, 'vesselTypes', []);
    if (!Array.isArray(vesselTypesControl.value)) {
      vesselTypesControl.setValue([]);
    }
    return filtersGroup;
  }

  private buildDefaultFiltersGroup(): UntypedFormGroup {
    return this.fb.group({
      anchoredMoored: new UntypedFormControl(false),
      noCollisionRisk: new UntypedFormControl(false),
      allAton: new UntypedFormControl(false),
      allButSar: new UntypedFormControl(false),
      allVessels: new UntypedFormControl(false),
      vesselTypes: new UntypedFormControl([])
    });
  }

  private ensureControl(
    group: UntypedFormGroup,
    key: string,
    defaultValue: boolean | string[]
  ): UntypedFormControl {
    let control = group.get(key) as UntypedFormControl | null;
    if (!control) {
      control = new UntypedFormControl(defaultValue);
      group.addControl(key, control);
    }
    return control;
  }

  private vesselTypesControl(): UntypedFormControl | null {
    return this.filtersGroup?.get('vesselTypes') as UntypedFormControl | null;
  }
}
