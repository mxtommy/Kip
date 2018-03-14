import { QuestionBase } from './question-base';

export class SignalKPathQuestion extends QuestionBase<string> {
  controlType = 'signalkPath';
  options: {key: string, value: string}[] = [];

  constructor(options: {} = {}) {
    super(options);
    this.options = options['options'] || [];
  }
}