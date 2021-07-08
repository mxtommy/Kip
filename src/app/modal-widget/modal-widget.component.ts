import { Component, OnInit,  Inject } from '@angular/core';
import { FormGroup, FormArray, FormControl, Validators }    from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { UnitsService, IUnitGroup } from '../units.service';
import { DataSetService, IDataSet } from '../data-set.service';
import { IWidgetConfig, IZone } from '../widget-manager.service';


@Component({
  selector: 'app-modal-widget',
  templateUrl: './modal-widget.component.html',
  styleUrls: ['./modal-widget.component.css']
})
export class ModalWidgetComponent implements OnInit {

  titleDialog: string = "Widget Options";
  formMaster; //: FormGroup; Can't type it or everything is "Abstract" Typed and can't access things like Arr
  availableDataSets: IDataSet[];
  unitList: {default?: string, conversions?: IUnitGroup[] } = {};


  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
    private DataSetService: DataSetService,
    private unitsService: UnitsService,
    @Inject(MAT_DIALOG_DATA) public widgetConfig: IWidgetConfig
  ) { }

  ngOnInit() {
    this.availableDataSets = this.DataSetService.getDataSets().sort();
    this.unitList = this.unitsService.getConversionsForPath(''); // array of Group or Groups: "angle", "speed", etc...
    this.formMaster = this.generateFormGroups(this.widgetConfig);
    this.formMaster.updateValueAndValidity();
  }

  generateFormGroups(formData: Object, objectType?: string): FormGroup {
    let groups = new FormGroup({});
    Object.keys(formData).forEach (key => {
      // handle Objects
      if ( (typeof(formData[key]) == 'object') && (formData[key] !== null) && !(Array.isArray(formData[key]) ) ) {
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
      } else if (Array.isArray(formData[key])) {
        let formArray = new FormArray([]);
        formData[key].forEach(element => {
          formArray.push(this.generateFormGroups(element));
        });

        groups.addControl(key, formArray);

      } else {
      // Handle Primitives - property values
        if (objectType == "convertUnitTo") {
          // If we are building units list
          let unitConfig = this.widgetConfig.paths[key];
          if ( (unitConfig.pathType == "number") || ('datasetUUID' in this.widgetConfig)) {
            groups.addControl(key, new FormControl(formData[key])); //only add control if it's a number or historical graph. Strings and booleans don't have units and conversions yet...
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

  addZone() {
    let zone = new FormGroup({});
    zone.addControl('upper', new FormControl(null));
    zone.addControl('lower', new FormControl(null));
    zone.addControl('state', new FormControl('warning', Validators.required));

    if ('zones' in this.formMaster.controls) {
      this.formMaster.controls.zones.push(zone);
    }
  }

  delZone(index: number) {
    this.formMaster.controls.zones.controls.splice(index,1);
    this.formMaster.controls.zones.updateValueAndValidity();
  }

  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }
}
