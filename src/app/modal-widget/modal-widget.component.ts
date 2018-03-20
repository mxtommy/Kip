import { Component, OnInit, Inject } from '@angular/core';
import { FormGroup }                 from '@angular/forms';

import { QuestionBase }              from '../question-base';
import { QuestionControlService }    from '../question-control.service';
import { SignalKPathQuestion }       from '../question-path';

import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';


export interface IModalSettings {
  paths: ISignalKPathInfo[];
  widgetLabel: string;

  numDecimal?: number; // number of decimal places if a number
  numInt?: number;
}

interface ISignalKPathInfo {
  key: string;
  description: string;
  path: string;       //can be null or set
  source: string;     //can be null or set
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

  questionPaths: QuestionBase<any>[] = [];
  form: FormGroup;

  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
    private QuestionControlService: QuestionControlService,
    @Inject(MAT_DIALOG_DATA) public data: IModalSettings) { }

  ngOnInit() {
    this.generateQuestions();
    console.log(this.questionPaths);
    this.form = this.QuestionControlService.toFormGroup(this.questionPaths);
  }


  generateQuestions() {
    
    // Add Path Questions
    this.data.paths.forEach(pathQuestion => {
      let newQuestion = {
        key: pathQuestion.key,
        label: pathQuestion.description,
        pathType: pathQuestion.type,
        path: pathQuestion.path,
        source: pathQuestion.source,
      };
      if (pathQuestion.type == "number") {
        newQuestion['unitGroup'] = pathQuestion.unitGroup;
        newQuestion['unitName'] = pathQuestion.unitName;
      }

      this.questionPaths.push(new SignalKPathQuestion(newQuestion));
    });


  }


}
