import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';


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
  

  
  constructor(private UnitsService: UnitsService) { }

  ngOnInit() {
    
    this.defaultUnits = this.UnitsService.getDefaults();

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
    console.log(this.formUnitMaster);
  }



}
