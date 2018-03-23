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
  @Input() selfPaths: boolean;

  availablePaths: Array<string> = [];
  availableSources: Array<string>;

  constructor(private SignalKService: SignalKService) { }

  ngOnInit() {
    console.log (this.question);
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

  settingsDataUpdatePath() { // called when we choose a new path. resets the rest with default info of this path
    let pathKey = this.question.key + 'Path';
    let sourceKey = this.question.key + 'Source';

    let pathObject = this.SignalKService.getPathObject(this.question.formGroup.controls[pathKey].value);
    if (pathObject === null) { return; }
    this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.settingsData.signalKSource = 'default';
    this.settingsData.numDecimal = this.data.numDecimal;
    if (pathObject.meta) {
      if (typeof(pathObject.meta.abbreviation) == 'string') {
        this.settingsData.label = pathObject.meta.abbreviation;
      } else if (typeof(pathObject.meta.label) == 'string') {
        this.settingsData.label = pathObject.meta.label;
      } else {
        this.settingsData.label = this.settingsData.signalKPath; // who knows?
      }
    } else {
      this.settingsData.label = this.settingsData.signalKPath;// who knows?
    }
  }

  //get isValid() { return this.form.controls[this.question.key].valid; }

}
