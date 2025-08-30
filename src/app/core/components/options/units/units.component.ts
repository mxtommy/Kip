import { Component, OnInit, inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, FormsModule, ReactiveFormsModule }    from '@angular/forms';
import { AppSettingsService } from '../../../services/app-settings.service';
import { AppService } from '../../../services/app-service';
import { IUnitDefaults, UnitsService, IUnit } from '../../../services/units.service';
import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { KeyValuePipe } from '@angular/common';

@Component({
    selector: 'settings-units',
    templateUrl: './units.component.html',
    styleUrls: ['./units.component.scss'],
    imports: [FormsModule, ReactiveFormsModule, MatFormField, MatLabel, MatSelect, MatOption, MatDivider, MatButton, KeyValuePipe]
})
export class SettingsUnitsComponent implements OnInit {
  private units = inject(UnitsService);
  private appSettingsService = inject(AppSettingsService);
  private appService = inject(AppService);

  public unitsFormGroup = new UntypedFormGroup({});
  protected groupUnits: Record<string, IUnit>[] = [];

  ngOnInit() {
    const unitsSettings: IUnitDefaults = this.appSettingsService.getDefaultUnits();
    // Format unit group data a bit better for consumption in template
    const unitGroupsRaw = this.units.getConversions();

    for (const groupRaw of unitGroupsRaw) {
      if (groupRaw.group === "Position") continue; // Skip the iteration when key is "Position" as it's not a valid unit group as-is. We need to use position Objects instead. Then we can set format properly.
      const units = [];

      for (const unit of groupRaw.units) {
        units.push(unit);
      }
      this.groupUnits[groupRaw.group] = units;
      // Generate formGroup
      this.unitsFormGroup.addControl(groupRaw.group, new UntypedFormControl(unitsSettings[groupRaw.group]));
    }
    this.unitsFormGroup.updateValueAndValidity();
  }

  submitConfig() {
    this.appSettingsService.setDefaultUnits(this.unitsFormGroup.value);
    this.appService.sendSnackbarNotification("Configuration saved", 3000, false);
  }
}
