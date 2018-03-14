import { Component, OnInit, Inject } from '@angular/core';
import { FormGroup }                 from '@angular/forms';

import { QuestionBase }              from '../question-base';
import { QuestionControlService }    from '../question-control.service';

import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';


export interface IModalSettings {
  paths: ISignalKPathInfo[];
  widgetLabel: string;

  numDecimal?: number; // number of decimal places if a number
  numInt?: number;
}

interface ISignalKPathInfo {
  description: string;
  path: string;
  source: string;
  type: string;
  unitGroup?: string;  
  unitName?: string;

}

@Component({
  selector: 'app-modal-widget',
  templateUrl: './modal-widget.component.html',
  styleUrls: ['./modal-widget.component.css']
})
export class ModalWidgetComponent implements OnInit {

  settingsData: IModalSettings;

  questions: QuestionBase<any>[] = [];
  form: FormGroup;

  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
    private QuestionControlService: QuestionControlService,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
    this.settingsData = this.data;
    this.generateQuestions();
    console.log(this.settingsData);
  }


  generateQuestions() {
    


  }


}
