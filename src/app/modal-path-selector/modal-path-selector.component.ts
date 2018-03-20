import { Component, Input, OnInit } from '@angular/core';
import { SignalKService, pathObject } from '../signalk.service';
import { FormGroup } from '@angular/forms';
import { SignalKPathQuestion } from '../question-path';


@Component({
  selector: 'modal-path-selector',
  templateUrl: './modal-path-selector.component.html',
  styleUrls: ['./modal-path-selector.component.css']
})
export class ModalPathSelectorComponent implements OnInit {

  @Input() question: SignalKPathQuestion;
  @Input() form: FormGroup;


  selfPaths: boolean = true;
  availablePaths: Array<string> = [];
  availableSources: Array<string>;

  constructor(private SignalKService: SignalKService) { }

  ngOnInit() {
    console.log (this.question);
    //populate available choices
    this.availablePaths = this.SignalKService.getPathsByType(this.question.pathType).sort();
    //if (this.availablePaths.includes(this.path)) {
      //this.settingsDataUpdatePath(); //TODO: this wipes out existing config, not good when editing existing config...
    //}    
  }

  get isValid() { return this.form.controls[this.question.key].valid; }

}
