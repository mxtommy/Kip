import { Component, OnInit, Inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators }    from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

import { IUnitGroup } from '../../units.service';
import { SignalKService } from '../../signalk.service';
import { DataSetService, IDataSet } from '../../data-set.service';
import { IDynamicControl, IPathArray, IWidgetSvcConfig } from '../../widgets-interface';
import { UUID } from '../../uuid';


@Component({
  selector: 'modal-widget-config',
  templateUrl: './modal-widget-config.component.html',
  styleUrls: ['./modal-widget-config.component.css']
})
export class ModalWidgetConfigComponent implements OnInit {

  titleDialog: string = "Widget Options";
  formMaster: UntypedFormGroup;
  availableDataSets: IDataSet[];
  unitList: {default?: string, conversions?: IUnitGroup[] } = {};


  constructor(
    public dialog: MatDialog,
    public dialogRef: MatDialogRef<ModalWidgetConfigComponent>,
    private DataSetService: DataSetService,
    private signalKService: SignalKService,
    @Inject(MAT_DIALOG_DATA) public widgetConfig: IWidgetSvcConfig
  ) { }

  ngOnInit() {
    this.availableDataSets = this.DataSetService.getDataSets().sort();
    this.unitList = this.signalKService.getConversionsForPath(''); // array of Group or Groups: "angle", "speed", etc...
    this.formMaster = this.generateFormGroups(this.widgetConfig);
    this.formMaster.updateValueAndValidity();
  }

  generateFormGroups(formData: Object, objectType?: string): UntypedFormGroup {
    let groups = new UntypedFormGroup({});
    Object.keys(formData).forEach (key => {
      // handle Objects
      if ( (typeof(formData[key]) == 'object') && (formData[key] !== null) ) {
        switch (objectType) {
          case "paths":
            //if we are building Paths sub formGroups, skip none configurable
            if (this.widgetConfig.paths[key].isPathConfigurable) {
              groups.addControl(key, this.generateFormGroups(formData[key], key));
            }
            break;

          default: groups.addControl(key, this.generateFormGroups(formData[key], key));
            break;
        }
      } else {
      // Handle Primitives - property values
        if (objectType == "convertUnitTo") {
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

            case "ctrlLabel": groups.addControl(key, new UntypedFormControl(formData[key], Validators.required));
            break;

            default: groups.addControl(key, new UntypedFormControl(formData[key]));
            break;
          }
        }
      }
    });
    return groups;
  }

  public addDynamicControlGroup(ctrlLabel: string): void {
    let pathUUID = UUID.create();
    let ctrlCfg: IDynamicControl = {
      ctrlLabel: ctrlLabel,
      pathKeyName: pathUUID,
      color: "text",
      value: null
    }
    let pathCfg: IPathArray = {
      [pathUUID]: {
        description: ctrlLabel,
        path: null,
        source: null,
        pathType: "boolean",
        isPathConfigurable: true,
        convertUnitTo: "unitless",
        sampleTime: 500
      }
    }
    this.widgetConfig.multiChildCtrls.push(ctrlCfg);
    Object.assign(this.widgetConfig.paths, pathCfg);
    this.formMaster = this.generateFormGroups(this.widgetConfig);
  }

  public ctrlLabelChange(e: any): void {
    this.widgetConfig.multiChildCtrls[e.ctrlId].ctrlLabel = e.label;
    Object.assign(this.widgetConfig.paths[this.widgetConfig.multiChildCtrls[e.ctrlId].pathKeyName], {description: e.label});
    this.formMaster = this.generateFormGroups(this.widgetConfig);
  }

  public deleteControl(e: number) {
    delete this.widgetConfig.paths[this.widgetConfig.multiChildCtrls[e].pathKeyName];
    this.widgetConfig.multiChildCtrls.splice(e,1);
    this.formMaster = this.generateFormGroups(this.widgetConfig);
  }

  public openAddCtrlDialog(): void {
    let label: string = null;
    const dialogRef = this.dialog.open(DialogAddMultiControl, {data: label});

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.addDynamicControlGroup(result);
      }
    });
  }

  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }
}


@Component({
  selector: 'dialog-add-multi-control',
  templateUrl: 'dialog-add-multi-control.html'
})
export class DialogAddMultiControl {
  constructor (
    @Inject(MAT_DIALOG_DATA) public data: string
  ) {}
}
