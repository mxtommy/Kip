import { Component, Input, OnInit, OnChanges, SimpleChange  } from '@angular/core';
import { SignalKService } from '../signalk.service';
import { IPathMetaData } from "../app-interfaces";
import { IUnitGroup } from '../units.service';
import { UntypedFormGroup, UntypedFormControl,Validators } from '@angular/forms';
import { map, startWith } from 'rxjs/operators';
import { Observable } from 'rxjs'


@Component({
  selector: 'modal-path-selector',
  templateUrl: './modal-path-selector.component.html',
  styleUrls: ['./modal-path-selector.component.scss']
})
export class ModalPathSelectorComponent implements OnInit, OnChanges {
  //path control
  @Input() formGroup: UntypedFormGroup;
  @Input() filterSelfPaths: boolean;
  availablePaths: IPathMetaData[];
  filteredPaths: Observable<IPathMetaData[]> = new Observable;

  //source control
  availableSources: Array<string>;

  //unit control
  unitList: {default?: string, conversions?: IUnitGroup[] };
  default: string;

  ////require-match validation for path
  requirePathMatch = (allPathsAndMeta: IPathMetaData[]) => {
    return (control: UntypedFormControl) => {
      const selection: any = control.value;
      if (allPathsAndMeta.some(pm => pm.path === selection)) {
        return null;
      }
      return { requireMatch: true };
    }
  }

  constructor(
    private signalKService: SignalKService
    ) { }

  ngOnInit() {
    this.unitList = {};
    //disable formControl if path is empty. ie: a new/not yet configured Widget...
    if (this.formGroup.value.path == null) {
      this.formGroup.controls['source'].disable();
      this.formGroup.controls['sampleTime'].disable();
      if (this.formGroup.value.pathType == "number") {
        this.formGroup.controls['convertUnitTo'].disable();
      }
    }
    //populate available paths
    this.getPaths(this.filterSelfPaths);

    //populate sources and units for this path (or just the current or default setting if we know nothing about the path)
    this.updateSourcesAndUnits();

    // autocomplete filtering
    this.filteredPaths = this.formGroup.controls['path'].valueChanges.pipe(startWith(''), map(value => this.filterPaths(value)))

    //subscribe to path formControl changes
    this.formGroup.controls['path'].valueChanges.subscribe(pathValue => {

      this.updateSourcesAndUnits();
      try {
        if (this.formGroup.controls['path'].valid) {
          this.formGroup.controls['source'].enable();
          this.formGroup.controls['source'].patchValue('default');
          this.formGroup.controls['sampleTime'].enable();
          if (this.formGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
            this.formGroup.controls['convertUnitTo'].enable();
            this.formGroup.controls['convertUnitTo'].patchValue(this.unitList.default);
          }
        } else {
          this.formGroup.controls['source'].disable();
          this.formGroup.controls['sampleTime'].disable();
          if (this.formGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
            this.formGroup.controls['convertUnitTo'].disable();
          }
        }
      } catch (error) {
        console.debug(error);
      }
    });

  }

  ngOnChanges(changes: {[propertyName: string]: SimpleChange}) {
    //subscribe to filterSelfPaths formControl changes
    if (changes['filterSelfPaths'] && !changes['filterSelfPaths'].firstChange) {
      this.getPaths(this.filterSelfPaths);
      this.formGroup.controls['path'].patchValue("");
    }
 }

  getPaths(isOnlySef: boolean) {
    this.availablePaths = this.signalKService.getPathsAndMetaByType(this.formGroup.value.pathType, isOnlySef).sort();
    // path validator (must be path in available) Need to reset validators when paths change
    this.formGroup.controls['path'].setValidators([Validators.required]); //, this.requirePathMatch(this.availablePaths)]); // allow non-existing paths, maybe new path?
  }

  filterPaths( value: string ): IPathMetaData[] {
    const filterValue = value.toLowerCase();
    return this.availablePaths.filter(pathAndMetaObj => pathAndMetaObj.path.toLowerCase().includes(filterValue)).slice(0,50);
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
      if (pathObject != null) {
        this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
      } else {
        // the path cannot be found. It's probably coming from default fixed Widget config, or user changed server URL, or Signal K server config. We need to disable the fields.
        try {
          this.formGroup.controls['source'].disable();
          this.formGroup.controls['sampleTime'].disable();
          if (this.formGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
            this.formGroup.controls['convertUnitTo'].disable();
          }
        } catch (error) {
          console.debug(error);
        }

      }
    }
    this.unitList = this.signalKService.getConversionsForPath(this.formGroup.controls['path'].value); // array of Group or Groups: "angle", "speed", etc...
  }

}
