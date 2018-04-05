import { Component, OnInit,  Inject } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';
import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { IWidgetConfig } from '../widget-manager.service';


@Component({
  selector: 'app-modal-widget',
  templateUrl: './modal-widget.component.html',
  styleUrls: ['./modal-widget.component.css']
})
export class ModalWidgetComponent implements OnInit {

  formMaster: FormGroup = new FormGroup({});



  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
    @Inject(MAT_DIALOG_DATA) public widgetConfig: IWidgetConfig) { }



  ngOnInit() {
    this.generateFormGroups();
    this.formMaster.updateValueAndValidity();
  }


  generateFormGroups() {
    // Generate formgroups for path selection
    let pathGroups = new FormGroup({});
    for (var path in this.widgetConfig.paths) {
      let pathGroup = new FormGroup({});
      for (var pathInfo in this.widgetConfig.paths[path]) {
        pathGroup.addControl(pathInfo, new FormControl(this.widgetConfig.paths[path][pathInfo]));
      }
      pathGroups.addControl(path, pathGroup);
    }
    this.formMaster.addControl('paths', pathGroups);
    this.formMaster.addControl('selfPaths', new FormControl(this.widgetConfig.selfPaths));

    //label
    if ('widgetLabel' in this.widgetConfig) {
      this.formMaster.addControl('widgetLabel', new FormControl(this.widgetConfig.widgetLabel));
    }

    // Decimal positions if there...
    if ('numInt' in this.widgetConfig) {
      this.formMaster.addControl('numInt', new FormControl(this.widgetConfig.numInt, Validators.required));
      this.formMaster.addControl('numDecimal', new FormControl(this.widgetConfig.numDecimal, Validators.required));
    }

    //units
    if ('units' in this.widgetConfig) {
      let unitsGroup = {};
      for (var unit in this.widgetConfig.units) {
        unitsGroup[unit] = new FormControl(this.widgetConfig.units[unit], Validators.required);
      }
      this.formMaster.addControl('units', new FormGroup(unitsGroup));
    }

    //windgauge
    if ('windSectorEnable' in this.widgetConfig) {
      this.formMaster.addControl('windSectorEnable', new FormControl(this.widgetConfig.windSectorEnable, Validators.required));      
      this.formMaster.addControl('laylineEnable', new FormControl(this.widgetConfig.laylineEnable, Validators.required));      
      this.formMaster.addControl('windSectorWindowSeconds', new FormControl(this.widgetConfig.windSectorWindowSeconds, Validators.required));
      this.formMaster.addControl('laylineAngle', new FormControl(this.widgetConfig.laylineAngle, Validators.required));      
    }


  }


  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }



}
