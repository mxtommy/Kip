import { Component, OnInit, Inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators, UntypedFormBuilder, UntypedFormArray, FormGroup, AbstractControl }    from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

import { IUnitGroup } from '../../units.service';
import { SignalKService } from '../../signalk.service';
import { DataSetService, IDataSet } from '../../data-set.service';
import { IDynamicControl, IWidgetPath, IWidgetSvcConfig } from '../../widgets-interface';
import { IAddNewPath } from '../paths-options/paths-options.component';
import { IDeleteEventObj } from '../boolean-control-config/boolean-control-config.component';

@Component({
  selector: 'modal-widget-config',
  templateUrl: './modal-widget-config.component.html',
  styleUrls: ['./modal-widget-config.component.css']
})
export class ModalWidgetConfigComponent implements OnInit {

  public titleDialog: string = "Widget Options";
  public formMaster: UntypedFormGroup;
  public availableDataSets: IDataSet[];
  public unitList: {default?: string, conversions?: IUnitGroup[] } = {};
  public isPathArray: boolean = false;
  public addPathEvent: IAddNewPath;

  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<ModalWidgetConfigComponent>,
    private fb : UntypedFormBuilder,
    private DataSetService: DataSetService,
    private signalKService: SignalKService,
    @Inject(MAT_DIALOG_DATA) public widgetConfig: IWidgetSvcConfig
  ) { }

  ngOnInit() {
    this.availableDataSets = this.DataSetService.getDataSets().sort();
    this.unitList = this.signalKService.getConversionsForPath(''); // array of Group or Groups: "angle", "speed", etc...
    this.formMaster = this.generateFormGroups(this.widgetConfig);
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

            case "dataSetUUID": groups.addControl(key, new UntypedFormControl(formData[key], Validators.required));
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

  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }
}
