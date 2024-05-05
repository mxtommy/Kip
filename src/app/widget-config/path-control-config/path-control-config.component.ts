import { Component, Input, OnInit, OnChanges, SimpleChange, OnDestroy } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { IPathMetaData } from "../../core/interfaces/app-interfaces";
import { IConversionPathList, ISkBaseUnit, UnitsService } from '../../core/services/units.service';
import { UntypedFormGroup, UntypedFormControl, Validators, ValidatorFn, AbstractControl, ValidationErrors, FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { debounceTime, map, startWith } from 'rxjs/operators';
import { BehaviorSubject, Subscription } from 'rxjs'
import { MatSelect } from '@angular/material/select';
import { MatOption, MatOptgroup } from '@angular/material/core';
import { MatIconButton } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatSuffix, MatError } from '@angular/material/form-field';
import { AsyncPipe } from '@angular/common';


function requirePathMatch(allPathsAndMeta: IPathMetaData[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const pathFound = allPathsAndMeta.some(array => array.path === control.value);
    return pathFound ? null : { requireMatch: true };
  };
}

@Component({
    selector: 'path-control-config',
    templateUrl: './path-control-config.component.html',
    styleUrls: ['./path-control-config.component.scss'],
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, MatFormField, MatLabel, MatInput, MatAutocompleteModule, MatIconButton, MatSuffix, MatOption, MatError, MatSelect, MatOptgroup, AsyncPipe]
})
export class ModalPathControlConfigComponent implements OnInit, OnChanges, OnDestroy {
  @Input() pathFormGroup!: UntypedFormGroup;
  @Input() filterSelfPaths!: boolean;

  public availablePaths: IPathMetaData[];
  public filteredPaths = new BehaviorSubject<IPathMetaData[] | null>(null);
  private pathValueChange$: Subscription = null;

  // Sources control
  public availableSources: Array<string>;

  // Units control
  public unitList: IConversionPathList = {default: '', conversions: []};
  public showPathSkUnitsFilter: boolean = false;
  public pathSkUnitsFilterControl = new FormControl<ISkBaseUnit | null>(null);
  public pathSkUnitsFiltersList: ISkBaseUnit[];

  constructor(
    private DataService: DataService,
    private units: UnitsService
    ) { }

  ngOnInit() {
    this.getPaths(this.filterSelfPaths);

    // Path Unit filter setup
    this.pathSkUnitsFiltersList = this.units.skBaseUnits.sort((a, b) => {
      return a.properties.quantity > b.properties.quantity ? 1 : -1;
    });

    if (this.pathFormGroup.value.pathSkUnitsFilter) {
      this.pathSkUnitsFilterControl.setValue(this.pathSkUnitsFiltersList.find(item => item.unit === this.pathFormGroup.value.pathSkUnitsFilter), {onlySelf: true});
    }

    if (this.pathFormGroup.value.showPathSkUnitsFilter) {
      this.showPathSkUnitsFilter = this.pathFormGroup.value.showPathSkUnitsFilter;
    }

    // add path validator fn and validate
    this.pathFormGroup.controls['path'].setValidators([Validators.required, requirePathMatch(this.availablePaths)]);
    this.pathFormGroup.controls['path'].updateValueAndValidity({onlySelf: true, emitEvent: false});

    // If SampleTime control is not present because the path property is missing, add it.
    if (!this.pathFormGroup.controls['sampleTime']) {
      this.pathFormGroup.addControl('sampleTime', new UntypedFormControl('500', Validators.required));
      this.pathFormGroup.controls['sampleTime'].updateValueAndValidity();
    }

    // Populate sources and units for this path (or just the current or default setting if we know nothing about the path)
    this.updateSourcesAndUnits();

    // subscribe to path formControl changes
    this.pathValueChange$ = this.pathFormGroup.controls['path'].valueChanges.pipe(
      debounceTime(200),
      startWith(''),
      map(value => this._filterPaths(value || '')))
      .subscribe((paths) => {
        this.filteredPaths.next(paths);
        if (this.pathFormGroup.controls['path'].valid) {
          this.enableFormFields(true);
        } else {
          this.disablePathFields();
        }
      });
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
    this.availablePaths = this.DataService.getPathsAndMetaByType(this.pathFormGroup.value.pathType, isOnlySef).sort();
  }

  private _filterPaths(value: string): IPathMetaData[] {
    const filterValue = value.toLowerCase();

    let filteredPaths = this.availablePaths;

    // If a unit filter is set, apply it first
      if (this.pathSkUnitsFilterControl.value != null) {
      filteredPaths = filteredPaths.filter(item => item.meta.units === this.pathSkUnitsFilterControl.value.unit);
    }

    // Then filter based on string
    filteredPaths = filteredPaths.filter(item => item.path.toLowerCase().includes(filterValue));

    return filteredPaths;
}

  private updateSourcesAndUnits() {
    if ((!this.pathFormGroup.value.path) || (this.pathFormGroup.value.path == '') || (!this.pathFormGroup.controls['path'].valid)) {
      this.disablePathFields();
    } else {
      this.enableFormFields();
    }
  }

  private enableFormFields(setValues?: boolean): void {
    let pathObject = this.DataService.getPathObject(this.pathFormGroup.controls['path'].value);
    if (pathObject != null) {
      this.pathFormGroup.controls['sampleTime'].enable({onlySelf: true});
      if (this.pathFormGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
        this.unitList = this.units.getConversionsForPath(this.pathFormGroup.controls['path'].value); // array of Group or Groups: "angle", "speed", etc...
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
    this.pathValueChange$?.unsubscribe();
  }
}
