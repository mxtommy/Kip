import { Component, Input, OnInit, OnChanges, SimpleChange, OnDestroy } from '@angular/core';
import { SignalKService } from '../../signalk.service';
import { IPathMetaData } from "../../app-interfaces";
import { IUnitGroup } from '../../units.service';
import { UntypedFormGroup, UntypedFormControl, Validators, ValidatorFn, AbstractControl, ValidationErrors } from '@angular/forms';
import { debounceTime, map, startWith } from 'rxjs/operators';
import { Observable, Subscription } from 'rxjs'

function requirePathMatch(allPathsAndMeta: IPathMetaData[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const pathFound = allPathsAndMeta.some(array => array.path === control.value);
    return pathFound ? null : { requireMatch: true };
  };
}

@Component({
  selector: 'modal-path-selector',
  templateUrl: './modal-path-selector.component.html',
  styleUrls: ['./modal-path-selector.component.scss']
})
export class ModalPathSelectorComponent implements OnInit, OnChanges, OnDestroy {
  @Input() formGroup!: UntypedFormGroup;
  @Input() filterSelfPaths!: boolean;

  public availablePaths: IPathMetaData[];
  public filteredPaths: Observable<IPathMetaData[]>;
  private pathValueChange$: Subscription = null;

  // Sources control
  public availableSources: Array<string>;

  // Units control
  public unitList: {default?: string, conversions?: IUnitGroup[] };

  constructor(
    private signalKService: SignalKService
    ) { }

  ngOnInit() {
    this.unitList = {};
    //populate available paths
    this.getPaths(this.filterSelfPaths);

    // add path validator fn and validate
    this.formGroup.controls['path'].setValidators([Validators.required, requirePathMatch(this.availablePaths)]);
    this.formGroup.controls['path'].updateValueAndValidity({onlySelf: true, emitEvent: false});

    // If SampleTime control is not present because the path property is missing, add it.
    if (!this.formGroup.controls['sampleTime']) {
      this.formGroup.addControl('sampleTime', new UntypedFormControl('500', Validators.required));
      this.formGroup.controls['sampleTime'].updateValueAndValidity();
    }

    //populate sources and units for this path (or just the current or default setting if we know nothing about the path)
    this.updateSourcesAndUnits();

    // this.formGroup.updateValueAndValidity();

    // add autocomplete filtering
    this.filteredPaths = this.formGroup.controls['path'].valueChanges.pipe(
      debounceTime(500),
      startWith(''),
      map(value => this.filterPaths(value || ''))
    );

    //subscribe to path formControl changes
    this.pathValueChange$ = this.filteredPaths.subscribe({
        next:  pathValue => {
          if (this.formGroup.controls['path'].valid) {
            this.enableFormFields(true);
          } else {
            this.disablePathFields();
          }
        },
        error: () => { console.error("Filtered path Observer error") },
        complete: () => { console.error("Filtered path Observer completed")
        }
      }
    );
  }

  ngOnChanges(changes: {[propertyName: string]: SimpleChange}) {
    //subscribe to filterSelfPaths formControl changes
    if (changes['filterSelfPaths'] && !changes['filterSelfPaths'].firstChange) {
      this.getPaths(this.filterSelfPaths);
      this.formGroup.controls['path'].patchValue("");
    }
 }

  private getPaths(isOnlySef: boolean) {
    this.availablePaths = this.signalKService.getPathsAndMetaByType(this.formGroup.value.pathType, isOnlySef).sort();
  }

  private filterPaths( value: string ): IPathMetaData[] {
    console.error('filter: ' + value);
    const filterValue = value.toLowerCase();
    return this.availablePaths.filter(pathAndMetaObj => pathAndMetaObj.path.toLowerCase().includes(filterValue)).slice(0,50);
  }

  private updateSourcesAndUnits() {
    if ((!this.formGroup.value.path) || (this.formGroup.value.path == '') || (!this.formGroup.controls['path'].valid)) {
      this.disablePathFields();
    } else {
      this.enableFormFields();
    }
  }

  private enableFormFields(setValues?: boolean): void {
    let pathObject = this.signalKService.getPathObject(this.formGroup.controls['path'].value);
    if (pathObject != null) {
      this.formGroup.controls['sampleTime'].enable({onlySelf: true});
      if (this.formGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
        this.unitList = this.signalKService.getConversionsForPath(this.formGroup.controls['path'].value); // array of Group or Groups: "angle", "speed", etc...
        if (setValues) {
          this.formGroup.controls['convertUnitTo'].setValue(this.unitList.default, {onlySelf: true});
        }
        this.formGroup.controls['convertUnitTo'].enable({onlySelf: true});
      }

      if (Object.keys(pathObject.sources).length == 1) {
        this.availableSources = ['default'];
        if (setValues) {
          if (this.formGroup.controls['source'].value != 'default') {
            this.formGroup.controls['source'].setValue('default', {onlySelf: true});
          }
        }
      } else if (Object.keys(pathObject.sources).length > 1) {
        this.availableSources = Object.keys(pathObject.sources);
        if (this.formGroup.controls['source'].value == 'default') {
          this.formGroup.controls['source'].reset();
        }
      }
      this.formGroup.controls['source'].enable({onlySelf: true});
    } else {
      // we don't know this path. Maybe and old saved path...
      this.disablePathFields();
    }
  }

  private disablePathFields(): void {
    this.formGroup.controls['source'].reset('', {onlySelf: true});
    this.formGroup.controls['source'].disable({onlySelf: true});
    this.formGroup.controls['sampleTime'].disable({onlySelf: true});
    if (this.formGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
      this.formGroup.controls['convertUnitTo'].reset('', {onlySelf: true});
      this.formGroup.controls['convertUnitTo'].disable({onlySelf: true});
    }
  }

  ngOnDestroy(): void {
    this.pathValueChange$.unsubscribe();
  }
}
