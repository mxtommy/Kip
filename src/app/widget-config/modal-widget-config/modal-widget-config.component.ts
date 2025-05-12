import { Component, OnInit, inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators, UntypedFormBuilder, UntypedFormArray, FormsModule, ReactiveFormsModule }    from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';

import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { NgIf } from '@angular/common';
import { MatTabGroup, MatTab, MatTabLabel } from '@angular/material/tabs';

import { BooleanMultiControlOptionsComponent, IAddNewPathObject } from '../boolean-multicontrol-options/boolean-multicontrol-options.component';
import { DisplayChartOptionsComponent } from '../display-chart-options/display-chart-options.component';
import { DatasetChartOptionsComponent } from '../dataset-chart-options/dataset-chart-options.component';
import { IUnitGroup, UnitsService } from '../../core/services/units.service';
import { AppService } from '../../core/services/app-service';
import { DatasetService, IDatasetServiceDatasetConfig } from '../../core/services/data-set.service';
import type { IDynamicControl, IWidgetPath, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { PathsOptionsComponent } from '../paths-options/paths-options.component';
import { IDeleteEventObj } from '../boolean-control-config/boolean-control-config.component';
import { DisplayDatetimeComponent } from '../display-datetime/display-datetime.component';

@Component({
    selector: 'modal-widget-config',
    templateUrl: './modal-widget-config.component.html',
    styleUrls: ['./modal-widget-config.component.scss'],
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, MatDialogTitle, MatDialogContent, MatTabGroup, MatTab, NgIf, MatFormField, MatLabel, MatInput, MatCheckbox, MatSelect, MatOption, MatTabLabel, MatDivider, MatDialogActions, MatButton, MatDialogClose,
      DisplayDatetimeComponent,
      DisplayChartOptionsComponent,
      DatasetChartOptionsComponent,
      BooleanMultiControlOptionsComponent,
      PathsOptionsComponent
    ]
})
export class ModalWidgetConfigComponent implements OnInit {
  private dialogRef = inject<MatDialogRef<ModalWidgetConfigComponent>>(MatDialogRef);
  private fb = inject(UntypedFormBuilder);
  private DatasetService = inject(DatasetService);
  private units = inject(UnitsService);
  private app = inject(AppService);
  protected widgetConfig = inject<IWidgetSvcConfig>(MAT_DIALOG_DATA);


  public titleDialog: string = "Widget Options";
  public formMaster: UntypedFormGroup;
  public availableDataSets: IDatasetServiceDatasetConfig[];
  public unitList: {default?: string, conversions?: IUnitGroup[] } = {};
  public isPathArray: boolean = false;
  public addPathEvent: IAddNewPathObject;
  public delPathEvent: string;
  public updatePathEvent: IDynamicControl[];
  public colors = [];

  ngOnInit() {
    this.availableDataSets = this.DatasetService.list().sort();
    this.unitList = this.units.getConversionsForPath(''); // array of Group or Groups: "angle", "speed", etc...
    this.formMaster = this.generateFormGroups(this.widgetConfig);
    this.setFormOptions();
    this.colors = this.app.configurableThemeColors;
  }

  private generateFormGroups(formData: Object, parent?: string): UntypedFormGroup {
    const groups = this.fb.group({});

    Object.keys(formData).forEach(key => {
      // handle Objects
      if ( (typeof(formData[key]) == 'object') && (formData[key] !== null) ) {

        if (key == "multiChildCtrls") {
          groups.addControl(key, this.fb.array([]));
          const fa = groups.get(key) as UntypedFormArray;

          formData[key].forEach((ctrl: IDynamicControl) => {
            fa.push(this.generateCtrlArray(ctrl));
          });

        } else if (key == "displayScale") {
          groups.addControl(key, this.generateFormGroups(formData[key], key));
        } else if (key == "gauge") {
          groups.addControl(key, this.generateFormGroups(formData[key], key));
        }else if (key == "paths") {
          if (this.widgetConfig.multiChildCtrls !== undefined) { // build as formArray if multi control type widget only
            this.isPathArray = true;
            groups.addControl(key, this.fb.array([]));
            const fa = groups.get(key) as UntypedFormArray;
            Object.keys(formData[key]).forEach(pathKey => {
              fa.push(this.generatePathArray(pathKey, this.widgetConfig.paths[pathKey]));
            });
          } else {
            groups.addControl(key, this.generateFormGroups(formData[key], key));
          }
        }

        if (parent == 'paths') {
          groups.addControl(key, this.generateFormGroups(formData[key], key));
        }

      } else {
      // Handle Primitives - property values
        if (parent == "convertUnitTo") {
          // If we are building units list
          let unitConfig = this.widgetConfig.paths[key];
          if ( (unitConfig.pathType == "number") || ('datasetUUID' in this.widgetConfig)) {
            groups.addControl(key, new UntypedFormControl(formData[key])); //only add control if it's a number or historical graph. Strings and booleans don't have units and conversions yet...
          }
        } else {
          // not building Units list
          // Use switch in case we will need more Required form validator at some point.
          switch (key) {
            case "path": groups.addControl(key, new UntypedFormControl(formData[key], Validators.required));
            break;

            case "datasetUUID": groups.addControl(key, new UntypedFormControl(formData[key], Validators.required));
            break;

            case "dataTimeout": groups.addControl(key, new UntypedFormControl(formData[key], Validators.required));
            break;

            default: groups.addControl(key, new UntypedFormControl(formData[key]));
            break;
          }
        }
      }
    });
    return groups;
  }

  private generatePathArray(pathKey: string, formData: IWidgetPath): UntypedFormGroup {
    // use addControl for formGroup and addControl for formControl
    const fg = new UntypedFormGroup({});
    Object.keys(formData).forEach(key => {
      fg.addControl(key, this.generatePathFields(key, formData[key]));
    });
    return fg;
  }

  private generatePathFields(key: string, value: any): UntypedFormControl {
    let ctrl: UntypedFormControl = null;

    switch (key) {
      case "path": ctrl = new UntypedFormControl(value, Validators.required);
      break;

      case "source": ctrl = new UntypedFormControl(value, Validators.required);
      break;

      case "sampleTime": ctrl = new UntypedFormControl(value, Validators.required);
      break;

      default: ctrl = new UntypedFormControl(value);
      break;
    }
    return ctrl;
  }

  private generateCtrlArray(formData: IDynamicControl): UntypedFormGroup {
    const fg = this.fb.group(formData);
    const ctrlLabel = fg.get('ctrlLabel');
    ctrlLabel.addValidators(Validators.required);
    return fg;
  }

  public addPathGroup(e: IAddNewPathObject): void {
    this.addPathEvent = e;
  }

  public updatePath(ctrlUpdates: IDynamicControl[]): void {
    ctrlUpdates.forEach(ctrl => {
      const pathsFormArray = this.formMaster.get('paths') as UntypedFormArray;

      pathsFormArray.controls.forEach((fg: UntypedFormGroup) => {
        const pathIDCtrl = fg.get('pathID') as UntypedFormControl;
        if (pathIDCtrl.value == ctrl.pathID) {
          fg.controls['description'].setValue(ctrl.ctrlLabel);
          fg.controls['pathType'].setValue(ctrl.isNumeric ? 'number' : 'boolean');
          this.updatePathEvent = ctrlUpdates;
        }
      });
    });
  }

  public deletePath(e: IDeleteEventObj): void {
    const pathsFormArray = this.formMaster.get('paths') as UntypedFormArray;
    let i = 0;
    pathsFormArray.controls.forEach((fg: UntypedFormGroup) => {
      const pathIDCtrl = fg.get('pathID') as UntypedFormControl;
      if (pathIDCtrl.value == e.pathID) {
        const del = pathsFormArray.controls['']
         pathsFormArray.removeAt(i);
      } else {
        i++
      }
    });

    const multiCtrlFormArray = this.formMaster.get('multiChildCtrls') as UntypedFormArray;
    multiCtrlFormArray.removeAt(e.ctrlIndex);

    this.delPathEvent = e.pathID;

    // Explicitly update the form's value object
    this.formMaster.updateValueAndValidity();
  }

  /**
   * EnablePaths
   */
  public setPaths() {
    this.setFormOptions();
  }

  private setFormOptions(): void {
    if (this.formMaster.contains('courseOverGroundEnable')) {
      const ctrlGrp = this.formMaster.get('paths.courseOverGround');
      this.formMaster.controls['courseOverGroundEnable'].value ? ctrlGrp.enable() : ctrlGrp.disable();
    }
    if (this.formMaster.contains('driftEnable')) {
      const setCtrl = this.formMaster.get('paths.set');
      const driftCtrl = this.formMaster.get('paths.drift');
      this.formMaster.controls['driftEnable'].value ? setCtrl.enable() : setCtrl.disable();
      this.formMaster.controls['driftEnable'].value ? driftCtrl.enable() : driftCtrl.disable();
    }
    if (this.formMaster.contains('waypointEnable')) {
      const waypointCtrl = this.formMaster.get('paths.nextWaypointBearing');
      this.formMaster.controls['waypointEnable'].value ? waypointCtrl.enable() : waypointCtrl.disable();
    }
  }

  get convertUnitToControl(): UntypedFormControl {
    return this.formMaster.get('convertUnitTo') as UntypedFormControl;
  }

  get datasetUUIDToControl(): UntypedFormControl {
    return this.formMaster.get('datasetUUID') as UntypedFormControl;
  }

  get filterSelfPathsToControl(): UntypedFormControl {
    return this.formMaster.get('filterSelfPaths') as UntypedFormControl;
  }

  get dataTimeoutToControl(): UntypedFormControl {
    return this.formMaster.get('dataTimeout') as UntypedFormControl;
  }

  get enableTimeoutToControl(): UntypedFormControl {
    return this.formMaster.get('enableTimeout') as UntypedFormControl;
  }

  get dateTimezoneToControl(): UntypedFormControl {
    return this.formMaster.get('dateTimezone') as UntypedFormControl;
  }

  get yScaleSuggestedMaxToControl(): UntypedFormControl {
    return this.formMaster.get('yScaleSuggestedMax') as UntypedFormControl;
  }

  get enableMinMaxScaleLimitToControl(): UntypedFormControl {
    return this.formMaster.get('enableMinMaxScaleLimit') as UntypedFormControl;
  }

  get showDatasetMinimumValueLineToControl(): UntypedFormControl {
    return this.formMaster.get('showDatasetMinimumValueLine') as UntypedFormControl;
  }

  get showDatasetMaximumValueLineToControl(): UntypedFormControl {
    return this.formMaster.get('showDatasetMaximumValueLine') as UntypedFormControl;
  }

  get showDatasetAverageValueLineToControl(): UntypedFormControl {
    return this.formMaster.get('showDatasetAverageValueLine') as UntypedFormControl;
  }

  get showDatasetAngleAverageValueLineToControl(): UntypedFormControl {
    return this.formMaster.get('showDatasetAngleAverageValueLine') as UntypedFormControl;
  }

  get startScaleAtZeroToControl(): UntypedFormControl {
    return this.formMaster.get('startScaleAtZero') as UntypedFormControl;
  }

  get showLabelToControl(): UntypedFormControl {
    return this.formMaster.get('showLabel') as UntypedFormControl;
  }

  get showTimeScaleToControl(): UntypedFormControl {
    return this.formMaster.get('showTimeScale') as UntypedFormControl;
  }

  get showYScaleToControl(): UntypedFormControl {
    return this.formMaster.get('showYScale') as UntypedFormControl;
  }

  get yScaleSuggestedMinToControl(): UntypedFormControl {
    return this.formMaster.get('yScaleSuggestedMin') as UntypedFormControl;
  }

  get yScaleMinToControl(): UntypedFormControl {
    return this.formMaster.get('yScaleMin') as UntypedFormControl;
  }

  get yScaleMaxToControl(): UntypedFormControl {
    return this.formMaster.get('yScaleMax') as UntypedFormControl;
  }

  get datasetAverageArrayToControl(): UntypedFormControl {
    return this.formMaster.get('datasetAverageArray') as UntypedFormControl;
  }

  get trackAgainstAverageToControl(): UntypedFormControl {
    return this.formMaster.get('trackAgainstAverage') as UntypedFormControl;
  }

  get showAverageDataToControl(): UntypedFormControl {
    return this.formMaster.get('showAverageData') as UntypedFormControl;
  }

  get convertUnitToToControl(): UntypedFormControl {
    return this.formMaster.get('convertUnitTo') as UntypedFormControl;
  }

  get datasetUUIDControl(): UntypedFormControl {
    return this.formMaster.get('datasetUUID') as UntypedFormControl;
  }

  get displayNameToControl(): UntypedFormControl {
    return this.formMaster.get('displayName') as UntypedFormControl;
  }

  get numDecimalToControl(): UntypedFormControl {
    return this.formMaster.get('numDecimal') as UntypedFormControl;
  }

  get verticalGraphToControl(): UntypedFormControl {
    return this.formMaster.get('verticalGraph') as UntypedFormControl;
  }

  get colorToControl(): UntypedFormControl {
    return this.formMaster.get('color') as UntypedFormControl;
  }

  get dateFormatToControl(): UntypedFormControl {
    return this.formMaster.get('dateFormat') as UntypedFormControl;
  }

  get multiChildCtrlsToControl(): UntypedFormArray {
    return this.formMaster.get('multiChildCtrls') as UntypedFormArray;
  }

  submitConfig() {
    this.dialogRef.close(this.formMaster.getRawValue());
  }
}
