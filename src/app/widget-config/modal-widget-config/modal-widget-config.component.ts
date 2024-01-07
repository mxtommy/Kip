import { Component, OnInit, Inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators, UntypedFormBuilder, UntypedFormArray }    from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';

import { IUnitGroup } from '../../units.service';
import { SignalKService } from '../../signalk.service';
import { DataSetService, IDataSet } from '../../data-set.service';
import { IDynamicControl, IWidgetSvcConfig } from '../../widgets-interface';

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
            fa.push(this.generateArrayCtrls(ctrl));
          })
        } else if (key == "paths") {
          groups.addControl(key, this.generateFormGroups(formData[key], key));
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

  private generateArrayCtrls(formData: IDynamicControl): UntypedFormGroup {
    const fg = this.fb.group(formData);
    const ctrlLabel = fg.get('ctrlLabel');
    ctrlLabel.addValidators(Validators.required);
    return fg;
  }

  public addPathGroup(e): void {
    const paths = this.formMaster.get('paths') as UntypedFormGroup;
    paths.addControl(e.pathUUID, this.fb.group({
      description: [''],
      path: [null, Validators.required],
      source: ['default'],
      pathType: ['boolean'],
      isPathConfigurable: [true],
      convertUnitTo: ['unitless'],
      sampleTime: [500]
    }));
    // this.formMaster = this.generateFormGroups(this.widgetConfig);
  }

  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }
}
