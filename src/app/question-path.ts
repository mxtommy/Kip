import { QuestionBase } from './question-base';

export class SignalKPathQuestion extends QuestionBase<string> {
  controlType = 'signalkPath';
  pathType: string;
  path: string;
  source: string;

  constructor(options: {} = {}) {
    super(options);
    this.pathType = options['pathType'];
    this.required = true;
    this.path = options['path'];
    this.source = options['source'];
  }
}