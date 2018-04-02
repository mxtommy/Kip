import { Component, OnInit, OnDestroy, Inject } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';

import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { Subscription } from 'rxjs/Subscription';


export interface IModalSettings {
  paths: ISignalKPathInfo[];
  units?: IUnitInfo[];
  widgetLabel: string;

  numDecimal?: number; // number of decimal places if a number
  numInt?: number;

}

interface ISignalKPathInfo {
  key: string;
  description: string;
  path: string;       //can be null or set
  source: string;     //can be null or set
  pathType: string;
}
interface IUnitInfo {
  unitFor: string;
  unitName: string;
}

interface IFormGroups {
  [key: string]: FormGroup;
}

@Component({
  selector: 'app-modal-widget',
  templateUrl: './modal-widget.component.html',
  styleUrls: ['./modal-widget.component.css']
})
export class ModalWidgetComponent implements OnInit, OnDestroy {

  formGroups: IFormGroups = {};
  formMaster: FormGroup = new FormGroup({});
  formPaths: FormGroup = new FormGroup({
    'selfPaths': new FormControl(true)
  })
  subs: Subscription[] = [];


  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
    @Inject(MAT_DIALOG_DATA) public questions: IModalSettings) { }



  ngOnInit() {
    this.formMaster.addControl('paths', this.formPaths);
    this.generateFormGroups();
    console.log(this.formMaster);
  }

  ngOnDestroy() {
    this.subs.forEach(sub => sub.unsubscribe());
  }

  generateFormGroups() {
    // Generate formgroups for path selection
    this.questions.paths.forEach(pathQuestion => {
      let group: any = {};
      group[pathQuestion.key + 'Path'] = new FormControl(pathQuestion.path || '', Validators.required);
      group[pathQuestion.key + 'Source'] = new FormControl(pathQuestion.source || '', Validators.required);
      this.formPaths.addControl(pathQuestion.key, new FormGroup(group));
    });

    //label
    this.formMaster.addControl('widgetLabel', new FormControl(this.questions.widgetLabel));

    // Decimal positions if there...
    if ('numInt' in this.questions) {
      this.formMaster.addControl('numInt', new FormControl(this.questions.numInt, Validators.required));
      this.formMaster.addControl('numDecimal', new FormControl(this.questions.numDecimal, Validators.required));
    }

    //units
    if ('units' in this.questions) {
      let group = {};
      this.questions.units.forEach(unitQ => {
        group[unitQ.unitFor] = new FormControl(unitQ.unitName, Validators.required);
      });
      this.formMaster.addControl('units', new FormGroup(group));
    }

  }



}
