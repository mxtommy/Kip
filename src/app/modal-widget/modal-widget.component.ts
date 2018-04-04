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
    /*this.widgetConfig.paths.forEach(pathQuestion => {
      let group: any = {};
      group[pathQuestion.key + 'Path'] = new FormControl(pathQuestion.path || '', Validators.required);
      group[pathQuestion.key + 'Source'] = new FormControl(pathQuestion.source || '', Validators.required);
      this.formPaths.addControl(pathQuestion.key, new FormGroup(group));
    });*/
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
    this.formMaster.addControl('widgetLabel', new FormControl(this.widgetConfig.widgetLabel));

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
    console.log(this.formMaster);
  }


  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }



}
