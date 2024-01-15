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
  selector: 'path-control-config',
  templateUrl: './path-control-config.component.html',
  styleUrls: ['./path-control-config.component.scss']
})
export class ModalPathControlConfigComponent implements OnInit, OnChanges, OnDestroy {
  @Input() pathFormGroup!: UntypedFormGroup;
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
    this.pathFormGroup.controls['path'].setValidators([Validators.required, requirePathMatch(this.availablePaths)]);
    this.pathFormGroup.controls['path'].updateValueAndValidity({onlySelf: true, emitEvent: false});

    // If SampleTime control is not present because the path property is missing, add it.
    if (!this.pathFormGroup.controls['sampleTime']) {
      this.pathFormGroup.addControl('sampleTime', new UntypedFormControl('500', Validators.required));
      this.pathFormGroup.controls['sampleTime'].updateValueAndValidity();
    }

    //populate sources and units for this path (or just the current or default setting if we know nothing about the path)
    this.updateSourcesAndUnits();

    // add autocomplete filtering
    this.filteredPaths = this.pathFormGroup.controls['path'].valueChanges.pipe(
      debounceTime(500),
      startWith(''),
      map(value => this.filterPaths(value || ''))
    );

    //subscribe to path formControl changes
    this.pathValueChange$ = this.pathFormGroup.controls['path'].valueChanges.subscribe( pathValue => {
        if (this.pathFormGroup.controls['path'].valid) {
          this.enableFormFields(true);
        } else {
          this.disablePathFields();
        }
      }
    );
  }

  ngOnChanges(changes: {[propertyName: string]: SimpleChange}) {
    //subscribe to filterSelfPaths parent formControl changes
    if (changes['filterSelfPaths'] && !changes['filterSelfPaths'].firstChange) {
      this.getPaths(this.filterSelfPaths);
    } else if (changes['pathFormGroup'] && !changes['pathFormGroup'].firstChange) {
      this.pathFormGroup.updateValueAndValidity();
    }
    else if (changes['pathFormGroup']) {
      this.pathFormGroup.updateValueAndValidity();
    } else {
      console.error('[modal-path-selector] Unmapped OnChange event')
    }
 }

  private getPaths(isOnlySef: boolean) {
    this.availablePaths = this.signalKService.getPathsAndMetaByType(this.pathFormGroup.value.pathType, isOnlySef).sort();
  }

  private filterPaths( value: string ): IPathMetaData[] {
    const filterValue = value.toLowerCase();
    return this.availablePaths.filter(pathAndMetaObj => pathAndMetaObj.path.toLowerCase().includes(filterValue)).slice(0,50);
  }

  private updateSourcesAndUnits() {
    if ((!this.pathFormGroup.value.path) || (this.pathFormGroup.value.path == '') || (!this.pathFormGroup.controls['path'].valid)) {
      this.disablePathFields();
    } else {
      this.enableFormFields();
    }
  }

  private enableFormFields(setValues?: boolean): void {
    let pathObject = this.signalKService.getPathObject(this.pathFormGroup.controls['path'].value);
    if (pathObject != null) {
      this.pathFormGroup.controls['sampleTime'].enable({onlySelf: true});
      if (this.pathFormGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
        this.unitList = this.signalKService.getConversionsForPath(this.pathFormGroup.controls['path'].value); // array of Group or Groups: "angle", "speed", etc...
        if (setValues) {
          this.pathFormGroup.controls['convertUnitTo'].setValue(this.unitList.default, {onlySelf: true});
        }
        this.pathFormGroup.controls['convertUnitTo'].enable({onlySelf: true});
      }

      if (Object.keys(pathObject.sources).length == 1) {
        this.availableSources = ['default'];
        if (setValues) {
          if (this.pathFormGroup.controls['source'].value != 'default') {
            this.pathFormGroup.controls['source'].setValue('default', {onlySelf: true});
          }
        }
      } else if (Object.keys(pathObject.sources).length > 1) {
        this.availableSources = Object.keys(pathObject.sources);
        if (this.pathFormGroup.controls['source'].value == 'default') {
          this.pathFormGroup.controls['source'].reset();
        }
      }
      this.pathFormGroup.controls['source'].enable({onlySelf: true});
    } else {
      // we don't know this path. Maybe and old saved path...
      this.disablePathFields();
    }
  }

  private disablePathFields(): void {
    this.pathFormGroup.controls['source'].reset('', {onlySelf: true});
    this.pathFormGroup.controls['source'].disable({onlySelf: true});
    this.pathFormGroup.controls['sampleTime'].disable({onlySelf: true});
    if (this.pathFormGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
      this.pathFormGroup.controls['convertUnitTo'].reset('', {onlySelf: true});
      this.pathFormGroup.controls['convertUnitTo'].disable({onlySelf: true});
    }
  }

  ngOnDestroy(): void {
    this.pathValueChange$.unsubscribe();
  }
}
