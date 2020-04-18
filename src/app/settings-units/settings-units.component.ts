import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';
import { AppSettingsService } from '../app-settings.service';
import { NotificationsService } from '../notifications.service';

import { IUnitInfo, IUnitDefaults, UnitsService } from '../units.service';


@Component({
  selector: 'app-settings-units',
  templateUrl: './settings-units.component.html',
  styleUrls: ['./settings-units.component.css']
})
export class SettingsUnitsComponent implements OnInit {

  formUnitMaster: FormGroup;

  groupUnits: {[key: string]: string[]} = {};
  defaultUnits: IUnitDefaults;
  

  
  constructor( 
    private UnitsService: UnitsService, 
    private AppSettingsService: AppSettingsService,
    private NotificationsService: NotificationsService,
    ) { }

  ngOnInit() {
    
    this.defaultUnits = this.AppSettingsService.getDefaultUnits();

    //format data a bit better for consumption in template
    let unitGroupsRaw = this.UnitsService.getConversions();
    unitGroupsRaw.forEach(entry => {
      this.groupUnits[entry.group] = entry.units;
    });

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
    this.AppSettingsService.setDefaultUnits(this.formUnitMaster.value);
    this.NotificationsService.newNotification("Saved Default Units", 5000);
  }

}
