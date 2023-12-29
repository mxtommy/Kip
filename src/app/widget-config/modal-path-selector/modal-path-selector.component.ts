import { Component, Input, OnInit, OnChanges, SimpleChange  } from '@angular/core';
import { SignalKService } from '../../signalk.service';
import { IPathMetaData } from "../../app-interfaces";
import { IUnitGroup } from '../../units.service';
import { UntypedFormGroup, UntypedFormControl, Validators } from '@angular/forms';
import { debounceTime, map, startWith } from 'rxjs/operators';
import { Observable } from 'rxjs'


@Component({
  selector: 'modal-path-selector',
  templateUrl: './modal-path-selector.component.html',
  styleUrls: ['./modal-path-selector.component.scss']
})
export class ModalPathSelectorComponent implements OnInit, OnChanges {
  //path control
  @Input() formGroup!: UntypedFormGroup;
  @Input() filterSelfPaths!: boolean;
  availablePaths: IPathMetaData[];
  filteredPaths: Observable<IPathMetaData[]> = new Observable;

  //source control
  availableSources: Array<string>;

  //unit control
  unitList: {default?: string, conversions?: IUnitGroup[] };

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
    //populate available paths
    this.getPaths(this.filterSelfPaths);
    //populate sources and units for this path (or just the current or default setting if we know nothing about the path)
    this.updateSourcesAndUnits();
    // add path validator fn
    this.formGroup.controls['path'].setValidators([Validators.required, this.requirePathMatch(this.availablePaths)]);
    this.formGroup.controls['path'].updateValueAndValidity();
    // add autocomplete filtering
    this.filteredPaths = this.formGroup.controls['path'].valueChanges.pipe(
      debounceTime(800),
      startWith(''),
      map(value => this.filterPaths(value))
    );
    // If SampleTime control is not present because the path property is missing, add it.
    if (!this.formGroup.controls['sampleTime']) {
      this.formGroup.addControl('sampleTime', new UntypedFormControl('500', Validators.required));
    }
    //disable formControl if path is empty. ie: a new/not yet configured Widget...
    if (this.formGroup.value.path == null) {
      this.formGroup.controls['source'].disable();
      this.formGroup.controls['sampleTime'].disable();
      if (this.formGroup.value.pathType == "number") {
        this.formGroup.controls['convertUnitTo'].disable();
      }
    }

    //subscribe to path formControl changes
    this.formGroup.controls['path'].valueChanges.subscribe({
        next:  pathValue => {
          this.updateSourcesAndUnits();
          try {
            this.formGroup.controls['source'].reset(); // clear value
            if (this.formGroup.controls['path'].valid) {
              if (this.availableSources.length == 1) { // if only on source, set to default (default source means: use parent path, and not a specific source value)
                this.formGroup.controls['source'].setValue('default');
              }
              this.formGroup.controls['source'].enable();
              this.formGroup.controls['sampleTime'].enable();
              if (this.formGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
                this.formGroup.controls['convertUnitTo'].setValue(this.unitList.default);
                this.formGroup.controls['convertUnitTo'].enable();
              }
            } else {
              this.formGroup.controls['source'].disable();
              this.formGroup.controls['sampleTime'].disable();
              if (this.formGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
                this.formGroup.controls['convertUnitTo'].reset();
                this.formGroup.controls['convertUnitTo'].disable();
              }
            }
          } catch (error) {
            console.debug(error);
          }
        },
        error: () => { console.error("error") },
        complete: () => { console.error("completed") }
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
  }

  filterPaths( value: string ): IPathMetaData[] {
    const filterValue = value.toLowerCase();
    return this.availablePaths.filter(pathAndMetaObj => pathAndMetaObj.path.toLowerCase().includes(filterValue)).slice(0,50);
  }

  updateSourcesAndUnits() {
    let pathObject = this.signalKService.getPathObject(this.formGroup.controls['path'].value);
    if (pathObject != null) {
      if (Object.keys(pathObject.sources).length == 1) {
        this.availableSources = ['default'];
      } else if (Object.keys(pathObject.sources).length > 1) {
        this.availableSources = Object.keys(pathObject.sources);
        if (this.formGroup.controls['source'].value == 'default') {
          this.formGroup.controls['source'].reset();
        }
      }
    } else {
      // the path cannot be found. It's probably coming from default fixed Widget config, or user changed server URL, or Signal K server config. We need to disable the fields.
      try {
        this.formGroup.controls['source'].disable();
        this.formGroup.controls['source'].reset();
        this.formGroup.controls['sampleTime'].disable();
        if (this.formGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
          this.formGroup.controls['convertUnitTo'].disable();
          this.formGroup.controls['convertUnitTo'].reset();
        }
      } catch (error) {
        console.debug(error);
      }

    }

    this.unitList = this. signalKService.getConversionsForPath(this.formGroup.controls['path'].value); // array of Group or Groups: "angle", "speed", etc...
  }

}
