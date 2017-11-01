import { Component, OnInit, Inject } from '@angular/core';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

import { SignalKService, pathObject } from '../signalk.service';
import { DataSetService, IDataSet } from '../data-set.service';

interface settingsForm {
  selectedPath: string;
  selectedSource: string;
  interval: number;
  dataPoints: number;
};

@Component({
  selector: 'app-settings-datasets',
  templateUrl: './settings-datasets.component.html',
  styleUrls: ['./settings-datasets.component.css']
})
export class SettingsDatasetsComponent implements OnInit {

  selectedDataSet: string;
  dataSets: IDataSet[];

  constructor(
    public dialog: MatDialog,
    private SignalKService: SignalKService,
    private DataSetService: DataSetService
    ) { }

  ngOnInit() {
    this.loadDataSets();
  }

  loadDataSets() {
    this.dataSets = this.DataSetService.getDataSets();
  }

  openNewDataSetModal() {
    let dialogRef = this.dialog.open(SettingsDatasetsModalComponent, {
      width: '600px'
    });
    dialogRef.afterClosed().subscribe(result => { this.loadDataSets() });
  }


  deleteDataSet(uuid:string) { 
    this.DataSetService.deleteDataSet(uuid); //TODO, bit bruteforce, can cause errors cause dataset deleted before subscrioptions canceled
    this.loadDataSets();
  }

}

@Component({
  selector: 'app-settings-datasets-modal',
  templateUrl: './settings-datasets.modal.html',
  styleUrls: ['./settings-datasets.component.css']
})
export class SettingsDatasetsModalComponent implements OnInit {

  settingsForm: settingsForm = {
    selectedPath: null,
    selectedSource: null,
    interval: 1,
    dataPoints: 30
  };

  availablePaths: string[] = [];
  availableSources: string[] = [];
  selfPaths:boolean = true;

  constructor(
    private SignalKService: SignalKService,
    private DataSetService: DataSetService,
    public dialogRef:MatDialogRef<SettingsDatasetsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
    ) { }

  ngOnInit() {
    this.availablePaths = this.SignalKService.getPathsByType('number').sort();
  }

  settingsFormUpdatePath() { // called when we choose a new path. resets the rest with default info of this path
    let pathObject = this.SignalKService.getPathObject(this.settingsForm.selectedPath);
    if (pathObject === null) { return; }
    this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.settingsForm.selectedSource = 'default';
  }

  addNewDataSet() {
    this.DataSetService.addDataSet(
      this.settingsForm.selectedPath, 
      this.settingsForm.selectedSource, 
      this.settingsForm.interval, 
      this.settingsForm.dataPoints);
    this.dialogRef.close();
  }
}