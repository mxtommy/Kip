import { Component, Input, OnInit } from '@angular/core';
import { SignalKService, pathObject } from '../signalk.service';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'modal-path-selector',
  templateUrl: './modal-path-selector.component.html',
  styleUrls: ['./modal-path-selector.component.css']
})
export class ModalPathSelectorComponent implements OnInit {

  @Input() formGroup: FormGroup;

  @Input() selfPaths: boolean;

  availablePaths: Array<string> = [];
  availableSources: Array<string>;

  constructor(private SignalKService: SignalKService) { }

  ngOnInit() {
    console.log(this.formGroup);
    //populate available choices
    this.availablePaths = this.SignalKService.getPathsByType(this.formGroup.value.pathType).sort();

    //populate sources for this path (or just the current setting if we know nothing about the path)
    let pathObject = this.SignalKService.getPathObject(this.formGroup.value.path);
    if (pathObject === null) { 
      this.availableSources = [this.formGroup.value.source]; 
    } else {
      this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    }

    this.detectNewPath();
  }

  detectNewPath() {
    this.formGroup.controls.path.valueChanges.subscribe(newValue => {
      let pathObject = this.SignalKService.getPathObject(newValue);
      if (pathObject === null) { 
        this.availableSources = ['default']; 
      } else {
        this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
      }
      this.formGroup.controls.source.setValue('default');
    });
  }


}
