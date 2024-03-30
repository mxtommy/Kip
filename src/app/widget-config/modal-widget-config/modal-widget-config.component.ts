import { Component, OnInit, Inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators, UntypedFormBuilder, UntypedFormArray, FormsModule, ReactiveFormsModule }    from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog, MatDialogTitle, MatDialogContent, MatDialogActions, MatDialogClose } from '@angular/material/dialog';

import { MatButton } from '@angular/material/button';
import { MatDivider } from '@angular/material/divider';
import { MatRadioGroup, MatRadioButton } from '@angular/material/radio';
import { MatOption, MatOptgroup } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel } from '@angular/material/form-field';
import { NgIf, NgFor } from '@angular/common';
import { MatTabGroup, MatTab, MatTabLabel } from '@angular/material/tabs';

import { BooleanMultiControlOptionsComponent } from '../boolean-multicontrol-options/boolean-multicontrol-options.component';
import { DisplayChartOptionsComponent } from '../display-chart-options/display-chart-options.component';
import { DatasetChartOptionsComponent } from '../dataset-chart-options/dataset-chart-options.component';
import { IUnitGroup } from '../../core/services/units.service';
import { SignalKDataService } from '../../core/services/signalk-data.service';
import { DatasetService, IDatasetServiceDatasetConfig } from '../../core/services/data-set.service';
import { IDynamicControl, IWidgetPath, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { IAddNewPath, PathsOptionsComponent } from '../paths-options/paths-options.component';
import { IDeleteEventObj } from '../boolean-control-config/boolean-control-config.component';
import { DisplayDatetimeComponent } from '../display-datetime/display-datetime.component';

@Component({
    selector: 'modal-widget-config',
    templateUrl: './modal-widget-config.component.html',
    styleUrls: ['./modal-widget-config.component.css'],
    standalone: true,
    imports: [FormsModule, ReactiveFormsModule, MatDialogTitle, MatDialogContent, MatTabGroup, MatTab, NgIf, MatFormField, MatLabel, MatInput, MatCheckbox, MatSelect, MatOption, MatTabLabel, MatRadioGroup, MatRadioButton, NgFor, MatOptgroup, MatDivider, MatDialogActions, MatButton, MatDialogClose,
      DisplayDatetimeComponent,
      DisplayChartOptionsComponent,
      DatasetChartOptionsComponent,
      BooleanMultiControlOptionsComponent,
      PathsOptionsComponent
    ]
})
export class ModalWidgetConfigComponent implements OnInit {

  public titleDialog: string = "Widget Options";
  public formMaster: UntypedFormGroup;
  public availableDataSets: IDatasetServiceDatasetConfig[];
  public unitList: {default?: string, conversions?: IUnitGroup[] } = {};
  public isPathArray: boolean = false;
  public addPathEvent: IAddNewPath;

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<ModalWidgetConfigComponent>,
    private fb : UntypedFormBuilder,
    private DatasetService: DatasetService,
    private signalKDataService: SignalKDataService,
    @Inject(MAT_DIALOG_DATA) public widgetConfig: IWidgetSvcConfig
  ) { }

  ngOnInit() {
    this.availableDataSets = this.DatasetService.list().sort();
    this.unitList = this.signalKDataService.getConversionsForPath(''); // array of Group or Groups: "angle", "speed", etc...
    this.formMaster = this.generateFormGroups(this.widgetConfig);
    this.setFormOptions();
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

        } else if (key == "paths") {
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
          //if we are building Paths sub object formGroups, skip non configurable paths
          if (this.widgetConfig.paths[key].isPathConfigurable) {
            groups.addControl(key, this.generateFormGroups(formData[key], key));
          }
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

  public addPathGroup(e: IAddNewPath): void {
    this.addPathEvent = e;
  }

  public updatePath(ctrlUpdates: IDynamicControl[]): void {
    ctrlUpdates.forEach(ctrl => {
      const pathsFormArray = this.formMaster.get('paths') as UntypedFormArray;

      pathsFormArray.controls.forEach((fg: UntypedFormGroup) => {
        const pathIDCtrl = fg.get('pathID') as UntypedFormControl;
        if (pathIDCtrl.value == ctrl.pathID) {
          fg.controls['description'].setValue(ctrl.ctrlLabel);
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
  }

  /**
   * EnablePaths
   */
  public setPaths() {
    this.setFormOptions();
  }

  private setFormOptions(): void {
    if (this.formMaster.contains('waypointEnable')) {
      const ctrlGrp = this.formMaster.get('paths.nextWaypointBearing');
      this.formMaster.controls['waypointEnable'].value ? ctrlGrp.enable() : ctrlGrp.disable()
    }

    if (this.formMaster.contains('courseOverGroundEnable')) {
      const ctrlGrp = this.formMaster.get('paths.courseOverGround');
      this.formMaster.controls['courseOverGroundEnable'].value ? ctrlGrp.enable() : ctrlGrp.disable();
    }

    if (this.formMaster.contains('windSectorEnable')) {
      const checkCtrl = this.formMaster.get('windSectorEnable');
      const valCtrl = this.formMaster.get('windSectorWindowSeconds');

      checkCtrl.value ? valCtrl.enable() : valCtrl.disable();

      checkCtrl.valueChanges.subscribe(v => {
        if (v) {
          valCtrl.enable();
        } else {
          valCtrl.disable();
        }
      });
    }

    if (this.formMaster.contains('laylineEnable')) {
      const checkCtrl = this.formMaster.get('laylineEnable');
      const valCtrl = this.formMaster.get('laylineAngle');

      checkCtrl.value ? valCtrl.enable() : valCtrl.disable();

      checkCtrl.valueChanges.subscribe(v => {
        if (v) {
          valCtrl.enable();
        } else {
          valCtrl.disable();
        }
      });
    }
  }

  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }
}
