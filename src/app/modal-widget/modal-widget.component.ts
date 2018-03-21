import { Component, OnInit, Inject } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';

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
  pathType: string;
  unitGroup?: string;  
  unitName?: string;
  formGroup?: FormGroup;
}

@Component({
  selector: 'app-modal-widget',
  templateUrl: './modal-widget.component.html',
  styleUrls: ['./modal-widget.component.css']
})
export class ModalWidgetComponent implements OnInit {

  questionPaths: QuestionBase<any>[] = [];
  formGroupPaths: FormGroup[] = [];
  form: FormGroup = new FormGroup({});

  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
    private QuestionControlService: QuestionControlService,
    @Inject(MAT_DIALOG_DATA) public data: IModalSettings) { }

  ngOnInit() {
    this.generateFormGroups();
//    console.log(this.questionPaths);
//    this.form = this.QuestionControlService.toFormGroup(this.questionPaths);
  }


  generateFormGroups() {
    
    // Generate formgroups for path selection
    this.data.paths.forEach(pathQuestion => {
      let group: any = {};
      group[pathQuestion.key + 'Path'] = new FormControl(pathQuestion.path || '', Validators.required);
      group[pathQuestion.key + 'Self'] = new FormControl(true);
      group[pathQuestion.key + 'Source'] = new FormControl(pathQuestion.source || '', Validators.required);
      pathQuestion.formGroup = new FormGroup(group);
      this.form.addControl(pathQuestion.key, pathQuestion.formGroup);
    });
    //console.log(this.data.paths);
    // Add Path Questions
    /*this.data.paths.forEach(pathQuestion => {
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
    }); */

  }


}
