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

  formMaster: FormGroup;
  availableDataSets: IDataSet[];

  constructor(
    public dialogRef:MatDialogRef<ModalWidgetComponent>,
    private DataSetService: DataSetService,
    @Inject(MAT_DIALOG_DATA) public widgetConfig: IWidgetConfig
  ) { }

  ngOnInit() {
    //load datasets
    this.availableDataSets = this.DataSetService.getDataSets().sort();

    this.formMaster = this.generateFormGroups(this.widgetConfig);
    this.formMaster.updateValueAndValidity();
  }

  generateFormGroups(formData: Object): FormGroup {
    let groups = new FormGroup({});
    Object.keys(formData).forEach (key => {
      if ( (typeof(formData[key]) == 'object') && (formData[key] !== null) ) {
        groups.addControl(key, this.generateFormGroups(formData[key]));
      } else {
        // Use switch in case we need more then Required form validator at some point.
        switch (key) {
          case "path": groups.addControl(key, new FormControl(formData[key], Validators.required));
            break;

          case "dataSetUUID": groups.addControl(key, new FormControl(formData[key], Validators.required));
          break;

          default: groups.addControl(key, new FormControl(formData[key]));
            break;
        }
      }

    });
    return groups;
  }

  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }
}
