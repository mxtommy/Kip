import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl }    from '@angular/forms';
import { AppSettingsService } from '../app-settings.service';
import { NotificationsService } from '../notifications.service';

import { IUnitDefaults, UnitsService, IUnit } from '../units.service';

@Component({
  selector: 'app-settings-units',
  templateUrl: './settings-units.component.html',
  styleUrls: ['./settings-units.component.css']
})
export class SettingsUnitsComponent implements OnInit {

  formUnitMaster: FormGroup;

  groupUnits: {[key: string]: IUnit}[] = [];
  defaultUnits: IUnitDefaults;



  constructor(
    private UnitsService: UnitsService,
    private appSettingsService: AppSettingsService,
    private notificationsService: NotificationsService,
    ) { }

  ngOnInit() {

    this.defaultUnits = this.appSettingsService.getDefaultUnits();

    //format unit group data a bit better for consumption in template
    let unitGroupsRaw = this.UnitsService.getConversions();

    for (let gindex = 0; gindex < unitGroupsRaw.length; gindex++) {
      const unitGroup = unitGroupsRaw[gindex];
      let units = [];

      for (let index = 0; index < unitGroup.units.length; index++) {
        const unit = unitGroup.units[index];
        units.push(unit);
      }
      this.groupUnits[unitGroup.group] = units;
    }

    //generate formGroup
    let groups = new FormGroup({});
    Object.keys(this.defaultUnits).forEach(key => {
      groups.addControl(key, new FormControl(this.defaultUnits[key]));
    });

    this.formUnitMaster = groups;
    this.formUnitMaster.updateValueAndValidity();
    //console.log(this.formUnitMaster);
  }

  submitConfig() {
    this.appSettingsService.setDefaultUnits(this.formUnitMaster.value);
    this.notificationsService.sendSnackbarNotification("Default units configuration saved", 5000, false);
  }

}
