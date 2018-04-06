import { Component, OnInit,  Inject } from '@angular/core';
import { FormGroup, FormControl, Validators }    from '@angular/forms';
import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

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
    @Inject(MAT_DIALOG_DATA) public widgetConfig: IWidgetConfig) { }



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
        groups.addControl(key, new FormControl(formData[key]));
      }
      
    });
    return groups;
  }


  submitConfig() {
    this.dialogRef.close(this.formMaster.value);
  }



}
