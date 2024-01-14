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
  private unitGrpValChange$: Subscription = null;

  // Sources control
  public availableSources: Array<string>;

  // Units control
  public unitList: {default?: string, conversions?: IUnitGroup[] };
  public unitGrpsCtrl: {conversions: IUnitGroup[],curGrpId: string};

  constructor(
    private signalKService: SignalKService,
    private unitService: UnitsService
    ) { }

  ngOnInit() {
    this.unitList = {};
    this.initUnitGrp();
        //populate available paths
    this.getPaths(this.filterSelfPaths,false);

    // If SampleTime control is not present because the path property is missing, add it.
    if (!this.pathFormGroup.controls['sampleTime']) {
      this.pathFormGroup.addControl('sampleTime', new UntypedFormControl('500', Validators.required));
      this.pathFormGroup.controls['sampleTime'].updateValueAndValidity();
    }

    //populate sources and units for this path (or just the current or default setting if we know nothing about the path)
    this.updateSourcesAndUnits();

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

  private getPaths(isOnlySef: boolean, emitEvent=true) {
    if (this.pathFormGroup.controls['pathType'].value == 'number'){
      const grpId = this.pathFormGroup.controls['unitGrpFilter'].value
      if (grpId == 'Unitless'){
        this.availablePaths = this.signalKService.getPathsAndMetaByType(this.pathFormGroup.value.pathType, isOnlySef).sort();
      }else{
      let skUnit = this.unitService.getSkUnit(grpId)
      this.availablePaths = this.signalKService.getPathsAndMetaByType(this.pathFormGroup.value.pathType, isOnlySef, skUnit).sort();
      }
    }else{
      this.availablePaths = this.signalKService.getPathsAndMetaByType(this.pathFormGroup.value.pathType, isOnlySef).sort();
    }
    // add path validator fn and validate
    this.pathFormGroup.controls['path'].setValidators([Validators.required, requirePathMatch(this.availablePaths)]);
    this.pathFormGroup.controls['path'].updateValueAndValidity({onlySelf: true,emitEvent: emitEvent});

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
        if (!this.pathFormGroup.controls['isFilterFixed'].value) {
          this.unitList = this.signalKService.getConversionsForPath(this.pathFormGroup.controls['path'].value); // array of Group or Groups: "angle", "speed", etc...
        }
        if (setValues) {
          this.pathFormGroup.controls['convertUnitTo'].setValue(this.unitList.default, {onlySelf: true});
          this.unitGrpPathChg()
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
    if (this.unitGrpValChange$){
      this.unitGrpValChange$.unsubscribe()
    }
    this.pathValueChange$.unsubscribe();
  }
  clearUnitGrpFilter(): void{
    const newGrpId = 'Unitless'
    this.pathFormGroup.controls['unitGrpFilter'].setValue(newGrpId, {onlySelf: true,emitEvent: false});
    this.unitGrpUpd(newGrpId,false);
  }

  private initUnitGrp(): void{
    if (this.pathFormGroup.controls['pathType'].value == 'number'){
      let cfGroupId = this.pathFormGroup.controls['unitGrpFilter'].value;
      if (this.pathFormGroup.controls['isFilterFixed'].value) {
        this.unitList={
          default: this.unitService.getDefaults()[cfGroupId],
          conversions: [this.unitService.getUnitGroup(cfGroupId)]
        };
        this.unitGrpsCtrl={conversions: [this.unitService.getUnitGroup(cfGroupId)],curGrpId:cfGroupId};
      }else{
        this.unitGrpValChange$ = this.pathFormGroup.controls['unitGrpFilter'].valueChanges.subscribe({
          next:  newGrpId => {
            this.unitGrpUpd(newGrpId,true);
          },
        });
        const curUnit = this.pathFormGroup.controls['convertUnitTo'].value;
        if ( curUnit!=="unitless"){
          const unitGrpId = this.unitService.getGroupOfUnit(curUnit);
          if ( unitGrpId!== cfGroupId){
            this.pathFormGroup.controls['unitGrpFilter'].setValue(unitGrpId, {onlySelf: true,emitEvent: false});
            cfGroupId = unitGrpId;
          }
        }
        this.unitGrpsCtrl={conversions: this.unitService.getConversions(),curGrpId:cfGroupId};
      }
    }
  }

  private unitGrpPathChg(){
    if (this.unitList.conversions.length == 1){
      const newGrpId=this.unitList.conversions[0].group
      if (newGrpId != this.unitGrpsCtrl.curGrpId){
        this.pathFormGroup.controls['unitGrpFilter'].setValue(newGrpId, {onlySelf: true,emitEvent: false});
        this.unitGrpUpd(newGrpId,false)
      }
    }else{
      //Position returns two groups and default on deg from Angle
      //Position is the only group that do not have a default setting.
      //Position skUnit is rad signal k path definition is deg but the conversion function is rad.
      //The data in signal k test is rad but the meta data have units sat to deg.
      //Setting widget default config (unitGrpFilter) to position and fixed would be a problem
      //when meta data dont match.
      //I have seen both deg and rad data on positions paths.
      this.pathFormGroup.controls['unitGrpFilter'].setValue('Unitless', {onlySelf: true});
    }
  }
  private unitGrpUpd(newGrpId: string,emitPathEvent: boolean){
    if (this.unitGrpsCtrl.curGrpId !== newGrpId){// It is easy to tricker a loop stop it here
      this.unitGrpsCtrl.curGrpId = newGrpId;
      this.getPaths(this.filterSelfPaths,emitPathEvent);
    }
  }
}
