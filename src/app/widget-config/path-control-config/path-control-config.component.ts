import { Component, OnInit, OnChanges, SimpleChange, input, inject, DestroyRef } from '@angular/core';
import { DataService } from '../../core/services/data.service';
import { IPathMetaData } from "../../core/interfaces/app-interfaces";
import { IConversionPathList, ISkBaseUnit, UnitsService } from '../../core/services/units.service';
import { UntypedFormGroup, UntypedFormControl, Validators, ValidatorFn, AbstractControl, ValidationErrors, FormsModule, ReactiveFormsModule, FormControl, FormGroup } from '@angular/forms';
import { debounce, map, startWith } from 'rxjs/operators';
import { BehaviorSubject, timer } from 'rxjs'
import { MatSelect } from '@angular/material/select';
import { MatOption, MatOptgroup } from '@angular/material/core';
import { MatIconButton } from '@angular/material/button';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatSuffix, MatError, MatHint } from '@angular/material/form-field';
import { AsyncPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { compare } from 'compare-versions';
import { SignalKConnectionService } from '../../core/services/signalk-connection.service';
import { IDynamicControl } from '../../core/interfaces/widgets-interface';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

function pathRequiredOrValidMatch(getPaths: () => IPathMetaData[]): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    // If pathRequired is undefined or true, path is required and must be valid
    const required = control.parent?.value?.pathRequired !== false;
    const value = control.value;
    if (required) {
      // Required: must not be empty and must match a valid path
      if (value === null || value === '') {
        return { requireMatch: true };
      }
      const allPathsAndMeta = getPaths();
      const pathFound = allPathsAndMeta.some(array => array.path === value);
      return pathFound ? null : { requireMatch: true };
    } else {
      // Not required: valid if empty, or if matches a valid path
      if (value === null || value === '') {
        return null;
      }
      const allPathsAndMeta = getPaths();
      const pathFound = allPathsAndMeta.some(array => array.path === value);
      return pathFound ? null : { requireMatch: true };
    }
  };
}

@Component({
    selector: 'path-control-config',
    templateUrl: './path-control-config.component.html',
    styleUrls: ['./path-control-config.component.scss'],
    imports: [FormsModule, ReactiveFormsModule, MatFormField, MatLabel, MatInput, MatAutocompleteModule, MatIconButton, MatSuffix, MatOption, MatError, MatSelect, MatOptgroup, AsyncPipe, MatIconModule, MatHint]
})
export class PathControlConfigComponent implements OnInit, OnChanges {
  private readonly _data = inject(DataService);
  private readonly _units = inject(UnitsService);
  private readonly _connection = inject(SignalKConnectionService);
  private readonly _destroyRef = inject(DestroyRef);

  readonly pathFormGroup = input.required<UntypedFormGroup>();
  readonly multiCTRLArray = input.required<IDynamicControl[]>();
  readonly filterSelfPaths = input.required<boolean>();

  public availablePaths: IPathMetaData[];
  public filteredPaths = new BehaviorSubject<IPathMetaData[] | null>(null);

  // Sources control
  public availableSources: string[];

  // Units control
  public unitList: IConversionPathList = {base: '', conversions: []};
  public showPathSkUnitsFilter = false;
  public pathSkUnitsFilterControl = new FormControl<ISkBaseUnit | null>(null);
  public pathSkUnitsFiltersList: ISkBaseUnit[];
  public readonly unitlessUnit: ISkBaseUnit = {unit: 'unitless', properties: {display: '(null)', quantity: 'Unitless', quantityDisplay: '(null)', description: '', }};

  ngOnInit() {
    // Do not process if path is disabled. Disabled path control (isPathConfigurable: false
    // widget property) means the path is hardcoded and cannot be changed by the user.
    const pathFormGroup = this.pathFormGroup();
    if (pathFormGroup.controls['path'].disabled) return;
    // Path Unit filter setup
    this.pathSkUnitsFiltersList = this._units.skBaseUnits.sort((a, b) => {
      return a.properties.quantity > b.properties.quantity ? 1 : -1;
    });
    this.pathSkUnitsFiltersList.unshift(this.unitlessUnit);

    if (pathFormGroup.value.pathSkUnitsFilter) {
      this.pathSkUnitsFilterControl.setValue(this.pathSkUnitsFiltersList.find(item => item.unit === this.pathFormGroup().value.pathSkUnitsFilter), {onlySelf: true});
    }

    if (pathFormGroup.value.showPathSkUnitsFilter) {
      this.showPathSkUnitsFilter = pathFormGroup.value.showPathSkUnitsFilter;
    }

    // add path validator fn and validate
    pathFormGroup.controls['path'].setValidators([
      pathRequiredOrValidMatch(() => this.getPaths())
    ]);
    pathFormGroup.controls['path'].updateValueAndValidity({onlySelf: true, emitEvent: false});
    // Subscribe to pathRequired changes to re-validate path
    if (pathFormGroup.controls['pathRequired']) {
      pathFormGroup.controls['pathRequired'].valueChanges.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => {
        this.pathFormGroup().controls['path'].updateValueAndValidity();
      });
    }
    if (pathFormGroup.controls['path'].valid) {
      this.enableFormFields(false);
    } else {
      this.disablePathFields();
    }

    // If SampleTime control is not present because the path property is missing, add it.
    if (!pathFormGroup.controls['sampleTime']) {
      pathFormGroup.addControl('sampleTime', new UntypedFormControl('500', Validators.required));
      pathFormGroup.controls['sampleTime'].updateValueAndValidity({onlySelf: true, emitEvent: false});
    }

    // subscribe to path formControl changes
    pathFormGroup.controls['path'].valueChanges.pipe(
      debounce(value => value === '' ? timer(0) : timer(350)),
      startWith(''),
      map(value => this.filterPaths(value || '')))
      .pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => {
        const pathFormGroupValue = this.pathFormGroup();
        if (pathFormGroupValue.controls['path'].pristine) {
          return;
        } else {
          if (pathFormGroupValue.controls['path'].valid){
            this.enableFormFields(true);
            this.updatePathMetaBoundDisplayName(pathFormGroupValue.controls['path'].value);
            this.updatePathMetaBoundDisplayScale(pathFormGroupValue.controls['path'].value);
          } else {
            this.disablePathFields();
          }
        }
      }
    );

    pathFormGroup.controls['pathType'].valueChanges.pipe(takeUntilDestroyed(this._destroyRef)).subscribe(() => {
      const pathFormGroupValue = this.pathFormGroup();
      if (pathFormGroupValue.value.showPathSkUnitsFilter) {
        this.pathSkUnitsFilterControl.setValue(this.unitlessUnit);
      } else {
        this.pathSkUnitsFilterControl.setValue(null);
      }
      pathFormGroupValue.controls['path'].updateValueAndValidity();
    });
  }

  ngOnChanges(changes: Record<string, SimpleChange>) {
    //subscribe to filterSelfPaths parent formControl changes
    if (changes['filterSelfPaths'] && !changes['filterSelfPaths'].firstChange) {
      this.pathFormGroup().controls['path'].updateValueAndValidity();
    }
  }

  private getPaths(): IPathMetaData[] {
    const pathType = this.pathFormGroup().controls['pathType'].value;
    const filterSelfPaths = this.filterSelfPaths();
    let supportsPUT = false;
    const pathFormGroup = this.pathFormGroup();
    if (pathFormGroup.value.supportsPut) {
      let isMultiCTRLTypeLight = false;
      if (this.multiCTRLArray().length > 0) {
        isMultiCTRLTypeLight = this.multiCTRLArray().some((ctrlItem: IDynamicControl) =>
            ctrlItem.pathID === this.pathFormGroup().value.pathID && ctrlItem.type === '3' // type 3 = light
          );
      }

      if (isMultiCTRLTypeLight) {
        supportsPUT = false;
      } else {
        supportsPUT = compare(this._connection.skServerVersion, '2.12.0', ">=") ? pathFormGroup.value.supportsPut : false;
      }
    }
    return this._data.getPathsAndMetaByType(pathType, supportsPUT, filterSelfPaths).sort();
  }

  public filterPaths(searchString: string) {
    const filterString = searchString.toLowerCase();
    let filteredPaths = this.getPaths();

    // If a unit filter is set, apply it first
    if (this.pathSkUnitsFilterControl.value) {
      const selectedUnit = this.pathSkUnitsFilterControl.value.unit;
      filteredPaths = filteredPaths.filter(item => {
        const hasUnits = !!item.meta && !!item.meta.units;
        const isUnitless = selectedUnit === 'unitless';
        const matchesUnit = hasUnits && item.meta.units === selectedUnit;
        const isActuallyUnitless = !hasUnits && isUnitless;
        return matchesUnit || isActuallyUnitless;
      });
    }

    // Then filter based on the path
    filteredPaths = filteredPaths.filter(item => item.path.toLowerCase().includes(filterString));
    this.filteredPaths.next(filteredPaths);
  }

  private enableFormFields(setValues?: boolean): void {
    const pathObject = this._data.getPathObject(this.pathFormGroup().controls['path'].value);
    if (pathObject != null) {
      this.pathFormGroup().controls['sampleTime'].enable({onlySelf: false});
      const pathFormGroup = this.pathFormGroup();
      if (pathFormGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
        this.unitList = this._units.getConversionsForPath(pathFormGroup.controls['path'].value); // array of Group or Groups: "angle", "speed", etc...
        if (setValues) {
          pathFormGroup.controls['convertUnitTo'].setValue(this.unitList.base, {onlySelf: true});
        }
        pathFormGroup.controls['convertUnitTo'].enable({onlySelf: false});
      }

      if (Object.keys(pathObject.sources).length == 1) {
        this.availableSources = ['default'];
        if (setValues) {
          if (pathFormGroup.controls['source'].value != 'default') {
            pathFormGroup.controls['source'].setValue('default', {onlySelf: true});
          }
        }
        else if (pathFormGroup.controls['source'].value != 'default') {
          pathFormGroup.controls['source'].setValue('', {onlySelf: true});
        }
      } else if (Object.keys(pathObject.sources).length > 1) {
        this.availableSources = Object.keys(pathObject.sources);
        if (pathFormGroup.controls['source'].value == 'default') {
          pathFormGroup.controls['source'].reset();
        }
      }
      pathFormGroup.controls['source'].enable({onlySelf: false});
    } else {
      // we don't know this path. Maybe and old saved path...
      this.disablePathFields();
    }
  }

  private disablePathFields(): void {
    this.pathFormGroup().controls['source'].reset('', {onlySelf: true});
    this.pathFormGroup().controls['source'].disable({onlySelf: false});
    this.pathFormGroup().controls['sampleTime'].disable({onlySelf: false});
    const pathFormGroup = this.pathFormGroup();
    if (pathFormGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
      pathFormGroup.controls['convertUnitTo'].reset('', {onlySelf: true});
      pathFormGroup.controls['convertUnitTo'].disable({onlySelf: false});
    }
  }

  private updatePathMetaBoundDisplayName(path: string) {
    const pathFormGroup = this.pathFormGroup();
    if (!Object.prototype.hasOwnProperty.call(pathFormGroup.parent.parent.value, 'displayName')) {return;}
    const meta = this._data.getPathMeta(path);
    if (meta?.displayName) {
      pathFormGroup.parent.parent.controls['displayName'].setValue(meta.displayName);
    }
  }

  private updatePathMetaBoundDisplayScale(path: string) {
    const pathFormGroup = this.pathFormGroup();
    if (!Object.prototype.hasOwnProperty.call(pathFormGroup.parent.parent.value, 'displayScale')) {return;}

    const meta = this._data.getPathMeta(path);
    if (meta?.displayScale) {
      const displayScale = pathFormGroup.parent.parent.get('displayScale') as FormGroup;
      const unit = pathFormGroup.controls['convertUnitTo'].value;

      if (meta.displayScale.lower !== null && meta.displayScale.lower !== undefined) {
        displayScale.controls['lower'].setValue(this._units.convertToUnit(unit, meta.displayScale.lower));
      }
      if (meta.displayScale.upper !== null && meta.displayScale.upper !== undefined) {
        displayScale.controls['upper'].setValue(this._units.convertToUnit(unit, meta.displayScale.upper));
      }
      if (meta.displayScale.type !== null && meta.displayScale.type !== undefined){
        displayScale.controls['type'].setValue(meta.displayScale.type);
      }
      if (meta.displayScale.power !== null && meta.displayScale.power !== undefined){
        displayScale.controls['power'].setValue(meta.displayScale.power);
      }
    }
  }
}
