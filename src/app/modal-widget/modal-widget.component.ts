import { Component, OnInit,  Inject } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { DataSetService, IDataSet } from '../data-set.service';
import { IWidgetConfig } from '../widget-manager.service';


@Component({
  selector: 'app-modal-widget',
  templateUrl: './modal-widget.component.html',
  styleUrls: ['./modal-widget.component.css']
})
export class ModalWidgetComponent implements OnInit {

  titleDialog: string = "Widget Options";
  formMaster: FormGroup;
  availableDataSets: IDataSet[];

  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
    private DataSetService: DataSetService,
    @Inject(MAT_DIALOG_DATA) public widgetConfig: IWidgetConfig
  ) { }

  ngOnInit() {
    this.availableDataSets = this.DataSetService.getDataSets().sort();
    this.formMaster = this.generateFormGroups(this.widgetConfig);
    this.formMaster.updateValueAndValidity();
  }

  generateFormGroups(formData: Object, objectType?: string): FormGroup {
    let groups = new FormGroup({});
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
          if (unitConfig.pathType == "number") {
            groups.addControl(key, new FormControl(formData[key])); //only add control if it's a number. Strings and booleans don't have units and conversions yet...
          }
        } else {
          // not building Units list
          // Use switch in case we will need more Required form validator at some point.
          switch (key) {
            case "path": groups.addControl(key, new FormControl(formData[key], Validators.required));
            break;

            case "dataSetUUID": groups.addControl(key, new FormControl(formData[key], Validators.required));
            break;

            default: groups.addControl(key, new FormControl(formData[key]));
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
