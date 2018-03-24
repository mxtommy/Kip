import { Component, Input, OnInit } from '@angular/core';
import { SignalKService, pathObject } from '../signalk.service';
import { FormGroup } from '@angular/forms';
import { SignalKPathQuestion } from '../question-signalk-path';


@Component({
  selector: 'modal-path-selector',
  templateUrl: './modal-path-selector.component.html',
  styleUrls: ['./modal-path-selector.component.css']
})
export class ModalPathSelectorComponent implements OnInit {

  @Input() question: SignalKPathQuestion;
  @Input() selfPaths: boolean;

  availablePaths: Array<string> = [];
  availableSources: Array<string>;

  constructor(private SignalKService: SignalKService) { }

  ngOnInit() {
    //populate available choices
    this.availablePaths = this.SignalKService.getPathsByType(this.question.pathType).sort();

    //populate sources for this path (or just the current setting if we know nothing about the path)
    let pathKey = this.question.key + 'Path';
    let sourceKey = this.question.key + 'Source';
    let pathObject = this.SignalKService.getPathObject(this.question.formGroup.controls[pathKey].value);
    if (pathObject === null) { 
      this.availableSources = [this.question.formGroup.controls[sourceKey].value]; 
    } else {
      this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    }

    this.detectNewPath();
  }

  detectNewPath() {
    let pathKey = this.question.key + 'Path';
    let sourceKey = this.question.key + 'Source';
    this.question.formGroup.controls[pathKey].valueChanges.subscribe(newValue => {
      let pathObject = this.SignalKService.getPathObject(newValue);
      if (pathObject === null) { 
        this.availableSources = ['default']; 
      } else {
        this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
      }
      this.question.formGroup.controls[sourceKey].setValue('default');
    });
  }


}
