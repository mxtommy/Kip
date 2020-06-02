import { Component, Input, OnInit } from '@angular/core';
import { SignalKService } from '../signalk.service';
import { UnitsService, IUnitGroup } from '../units.service';
import { FormGroup } from '@angular/forms';

@Component({
  selector: 'modal-path-selector',
  templateUrl: './modal-path-selector.component.html',
  styleUrls: ['./modal-path-selector.component.css']
})
export class ModalPathSelectorComponent implements OnInit {
  //path control
  @Input() formGroup: FormGroup;
  @Input() filterSelfPaths: boolean;
  availablePaths: Array<string> = [];

  //source control
  availableSources: Array<string>;

  //unit control
  unitList: {default: string, conversions: IUnitGroup[] };
  default: string;

  constructor(
    private signalKService: SignalKService,
    private unitsService: UnitsService
    ) { }

  ngOnInit() {
    //populate available paths
    this.availablePaths = this.signalKService.getPathsByType(this.formGroup.value.pathType, this.filterSelfPaths).sort();

    //populate sources and units for this path (or just the current or default setting if we know nothing about the path)
    this.updateSourcesAndUnits();

    //subscribe to path formControl changes
    this.formGroup.controls['path'].valueChanges.subscribe(pathValue => {
      this.updateSourcesAndUnits();
      this.formGroup.controls['source'].patchValue('default');
      this.formGroup.controls['convertUnitTo'].patchValue(this.unitList.default);

      if (pathValue != null && this.formGroup.controls['source'].disabled) {
        this.formGroup.controls['source'].enable;
      }
    });

    //subscribe to filterSelfPaths formControl changes
    this.formGroup.parent.parent.controls['filterSelfPaths'].valueChanges.subscribe(val => {
      this.availablePaths = this.signalKService.getPathsByType(this.formGroup.value.pathType, val).sort();
    });
  }

  updateSourcesAndUnits() {
    if (this.formGroup.controls['path'].value == undefined || this.formGroup.controls['path'].value == null || this.formGroup.controls['path'].value == "") {
      if (this.formGroup.value.source == undefined || this.formGroup.value.source == null || this.formGroup.value.source == "") {
        this.availableSources = ['default'];
      } else {
        this.availableSources = ['default'].concat([this.formGroup.value.source]);
      }
    } else {
      let pathObject = this.signalKService.getPathObject(this.formGroup.controls['path'].value);
      this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    }

    this.unitList = this.unitsService.getConversionsForPath(this.formGroup.controls['path'].value); // array of Group or Groups: "angle", "speed", etc...
  }

}
