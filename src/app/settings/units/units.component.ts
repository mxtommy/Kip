import { Component, OnInit } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, FormsModule, ReactiveFormsModule }    from '@angular/forms';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { AppService } from '../../core/services/app-service';
import { IUnitDefaults, UnitsService, IUnit } from '../../core/services/units.service';
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
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, MatFormField, MatLabel, MatSelect, MatOption, MatDivider, MatButton, KeyValuePipe]
})
export class SettingsUnitsComponent implements OnInit {
  public unitsFormGroup = new UntypedFormGroup({});
  protected groupUnits: {[key: string]: IUnit}[] = [];

  constructor(
    private units: UnitsService,
    private appSettingsService: AppSettingsService,
    private appService: AppService,
    ) { }

  ngOnInit() {
    const unitsSettings: IUnitDefaults = this.appSettingsService.getDefaultUnits();
    // Format unit group data a bit better for consumption in template
    const unitGroupsRaw = this.units.getConversions();

    for (let i = 0; i < unitGroupsRaw.length; i++) {
      if(unitGroupsRaw[i].group === "Position") return; // Skip the iteration when key is "Position" as it's not a valid unit group as-is. We need to use position Objects instead. Then we can set format properly.
      const units = [];

      for (let index = 0; index < unitGroupsRaw[i].units.length; index++) {
        const unit: IUnit = unitGroupsRaw[i].units[index];
        units.push(unit);
      }
      this.groupUnits[unitGroupsRaw[i].group] = units;
      // Generate formGroup
      this.unitsFormGroup.addControl(unitGroupsRaw[i].group, new UntypedFormControl(unitsSettings[unitGroupsRaw[i].group]));
    }
    this.unitsFormGroup.updateValueAndValidity();
  }

  submitConfig() {
    this.appSettingsService.setDefaultUnits(this.unitsFormGroup.value);
    this.appService.sendSnackbarNotification("Configuration saved", 5000, false);
  }
}
