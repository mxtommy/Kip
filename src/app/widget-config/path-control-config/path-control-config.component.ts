import { Component, Input, OnInit, OnChanges, SimpleChange, OnDestroy } from '@angular/core';
import { SignalKService } from '../../signalk.service';
import { IPathMetaData } from "../../app-interfaces";
import { UnitsService, IUnitGroup } from '../../units.service';
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
  private unitValueChange$: Subscription = null;

  // Sources control
  public availableSources: Array<string>;

  //unit control
  public unitCtrl: {conversions?: IUnitGroup[],
                    isSingle?: boolean,
                    groupId?: string,
                   };

  constructor(
    private signalKService: SignalKService,
    private unitService: UnitsService
    ) { }

  ngOnInit() {
    this.unitInit()
    //populate available paths
    this.getPaths(this.filterSelfPaths,this.unitCtrl.groupId);

    // add path validator fn and validate
    this.pathFormGroup.controls['path'].setValidators([Validators.required, requirePathMatch(this.availablePaths)]);
    this.pathFormGroup.controls['path'].updateValueAndValidity({onlySelf: true, emitEvent: false});

    // If SampleTime control is not present because the path property is missing, add it.
    if (!this.pathFormGroup.controls['sampleTime']) {
      this.pathFormGroup.addControl('sampleTime', new UntypedFormControl('500', Validators.required));
      this.pathFormGroup.controls['sampleTime'].updateValueAndValidity();
    }

    //populate sources for this path (or just the current or default setting if we know nothing about the path)
    this.updateSources();

    // this.formGroup.updateValueAndValidity();

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
          this.unitPathChg(true);
        } else {
          this.disablePathFields();
          this.unitPathChg(false);
        }
      }
    );
  }

  ngOnChanges(changes: {[propertyName: string]: SimpleChange}) {
    //subscribe to filterSelfPaths parent formControl changes
    if (changes['filterSelfPaths'] && !changes['filterSelfPaths'].firstChange) {
      this.getPaths(this.filterSelfPaths,this.unitCtrl.groupId);
    } else if (changes['pathFormGroup'] && !changes['pathFormGroup'].firstChange) {
      this.pathFormGroup.updateValueAndValidity();
    }
    else if (changes['pathFormGroup']) {
      this.pathFormGroup.updateValueAndValidity();
    } else {
      console.error('[modal-path-selector] Unmapped OnChange event')
    }
 }

  private getPaths(isOnlySef: boolean, groupId: string) {
    if (groupId == 'Unitless'){
      this.availablePaths = this.signalKService.getPathsAndMetaByType(this.pathFormGroup.value.pathType, isOnlySef).sort();
    }else{
      let skUnit = this.unitService.getSkUnit(groupId)
      this.availablePaths = this.signalKService.getPathsAndMetaByType(this.pathFormGroup.value.pathType, isOnlySef, skUnit).sort();
    }
  }

  private filterPaths( value: string ): IPathMetaData[] {
    const filterValue = value.toLowerCase();
    return this.availablePaths.filter(pathAndMetaObj => pathAndMetaObj.path.toLowerCase().includes(filterValue)).slice(0,50);
  }

  private updateSources() {
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
  }
  private unitInit() {
    if (this.pathFormGroup.controls['pathType'].value == 'number'){
      const cfGroup = this.pathFormGroup.controls['unitGroup'].value;
      if (cfGroup == 'Unitless') {
        let groupId = this.unitService.getGroupOfUnit(cfGroup)
        this.unitCtrl = {conversions: this.unitService.getConversions(),
                         isSingle: false,
                         groupId: groupId,
                        };
        this.unitValueChange$ = this.pathFormGroup.controls['convertUnitTo'].valueChanges.subscribe({
          next:  unitValue => {
            this.unitChg(unitValue);
          },
        });

      }else{
        this.unitCtrl = {conversions: [this.unitService.getUnitGroup(cfGroup)],
                         isSingle: true,
                         groupId: cfGroup,
                        };
      }
    }else{
      this.unitCtrl = {groupId: 'Unitless'};
    }
  }

 private unitChg(newUnit: string){
    let nextGroupId = this.unitService.getGroupOfUnit(newUnit);
    if (this.unitCtrl.groupId != nextGroupId){
      this.unitCtrl.groupId  = nextGroupId;
      this.getPaths(this.filterSelfPaths,this.unitCtrl.groupId);
      this.pathFormGroup.controls['path'].updateValueAndValidity({onlySelf: true});
    }
  }

  private unitPathChg(isValid: boolean){
    if (this.pathFormGroup.controls['pathType'].value == 'number') { // convertUnitTo control not present unless pathType is number
      if (isValid) {
        if (!this.unitCtrl.isSingle){
          let skUnits = this.signalKService.getConversionsForPath(this.pathFormGroup.controls['path'].value);
          if (skUnits.conversions.length == 1){
            if (skUnits.conversions[0].group!=this.unitCtrl.groupId){
              this.pathFormGroup.controls['convertUnitTo'].setValue(skUnits.default, {onlySelf: true});

            }
          }else if(skUnits.conversions.length == 2){
            //Position returns two groups and default on deg from Angle
            //Position is the only group that do not have a default setting.
            //Place Position and Angle group next to each other so the default
            //value do not matter much.
            if (skUnits.conversions[1].group!=this.unitCtrl.groupId && skUnits.conversions[0].group!=this.unitCtrl.groupId){
              this.pathFormGroup.controls['convertUnitTo'].setValue(skUnits.default, {onlySelf: true});
            }
          }
        }
      }
    }
  }

  ngOnDestroy(): void {
    if (this.unitValueChange$){
      this.unitValueChange$.unsubscribe();
    }
    this.pathValueChange$.unsubscribe();
  }
}
