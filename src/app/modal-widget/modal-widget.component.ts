import { Component, OnInit,  Inject } from '@angular/core';
import { UntypedFormGroup, UntypedFormControl, Validators }    from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { IUnitGroup } from '../units.service';
import { SignalKService } from '../signalk.service';
import { DataSetService, IDataSet } from '../data-set.service';
import { IWidgetSvcConfig } from '../widgets-interface';


@Component({
  selector: 'app-modal-widget',
  templateUrl: './modal-widget.component.html',
  styleUrls: ['./modal-widget.component.css']
})
export class ModalWidgetComponent implements OnInit {

  titleDialog: string = "Widget Options";
  formMaster: UntypedFormGroup;
  availableDataSets: IDataSet[];
  unitList: {default?: string, conversions?: IUnitGroup[] } = {};


  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
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

            default: groups.addControl(key, new UntypedFormControl(formData[key]));
            break;
          }
        }
      }
    });
    return groups;
  }

  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }
}
