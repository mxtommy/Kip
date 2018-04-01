import { Component, OnInit, Inject } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';

import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';


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
  unitGroup: string;
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
export class ModalWidgetComponent implements OnInit {

  formGroups: IFormGroups = {};
  form: FormGroup = new FormGroup({
    'selfPaths': new FormControl(true)
  });

  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
    @Inject(MAT_DIALOG_DATA) public questions: IModalSettings) { }

  ngOnInit() {
    this.generateFormGroups();
//    console.log(this.questionPaths);
//    this.form = this.QuestionControlService.toFormGroup(this.questionPaths);
  }


  generateFormGroups() {
    // Generate formgroups for path selection
    this.questions.paths.forEach(pathQuestion => {
      let group: any = {};
      group[pathQuestion.key + 'Path'] = new FormControl(pathQuestion.path || '', Validators.required);
      group[pathQuestion.key + 'Source'] = new FormControl(pathQuestion.source || '', Validators.required);
      this.formGroups[pathQuestion.key] = new FormGroup(group);
      this.form.addControl(pathQuestion.key, this.formGroups[pathQuestion.key]);
    });

    //label
    this.formGroups['widgetLabel'] = new FormGroup({widgetLabel: new FormControl(this.questions.widgetLabel)});
    this.form.addControl('widgetLabel', this.formGroups['widgetLabel']);

    // Decimal positions if there...
    if ('numInt' in this.questions) {
      this.formGroups['numIntDec'] = new FormGroup({
        numInt: new FormControl(this.questions.numInt, Validators.required),
        numDecimal: new FormControl(this.questions.numDecimal, Validators.required)
      });
      this.form.addControl('numIntDec', this.formGroups['numIntDec']);

    }

  }


}
