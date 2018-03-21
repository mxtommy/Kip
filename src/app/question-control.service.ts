import { Injectable }   from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';

import { QuestionBase } from './question-base';
import { SignalKPathQuestion } from './question-path';

@Injectable()
export class QuestionControlService {
  constructor() { }

  toFormGroup(questions: QuestionBase<any>[] ) {
    let group: any = {};

    questions.forEach(question => {
      group[question.key] = question.required ? new FormControl(question.value || '', Validators.required)
                                              : new FormControl(question.value || '');
    });
    console.log(group);
    return new FormGroup(group);
  }
/*
  pathToFormGroup(questions: SignalKPathQuestion[]) {
    questions.forEach(pathQuestion => {
      let group: any = {};
      group[pathQuestion.key + 'Path'] = new FormControl(pathQuestion.path || '', Validators.required);
      group[pathQuestion.key + 'Self'] = new FormControl(true);
      group[pathQuestion.key + 'Source'] = new FormControl(pathQuestion.source || '', Validators.required);
      pathQuestion.formGroup = new FormGroup(group);
      this.form.addControl(pathQuestion.key, pathQuestion.formGroup);
    });
  }
*/
}