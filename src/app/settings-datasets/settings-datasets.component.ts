import { Component, OnInit } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';

import { SignalKService, pathObject } from '../signalk.service';
import { DataSetService } from '../data-set.service';

interface settingsForm {
  selectedPath: string;
  selectedSource: string;
  availablePaths: string[];
  availableSources: string[];
  selfPaths: boolean;
  interval: number;
  dataPoints: number;
};

@Component({
  selector: 'app-settings-datasets',
  templateUrl: './settings-datasets.component.html',
  styleUrls: ['./settings-datasets.component.css']
})
export class SettingsDatasetsComponent implements OnInit {

  modalRef;
  
  settingsForm: settingsForm = {
    selectedPath: null,
    selectedSource: null,
    availablePaths: [],
    availableSources: [],
    selfPaths: true,
    interval: 1,
    dataPoints: 300
  };

  dataSets;

  constructor(
    private modalService: NgbModal, 
    private SignalKService: SignalKService,
    private DataSetService: DataSetService
    ) { }

  ngOnInit() {
    this.loadDataSets();
  }

  loadDataSets() {
    this.dataSets = this.DataSetService.getDataSets();
  }

  openNewDataSetModal(content) {
    this.settingsForm.availablePaths = this.SignalKService.getPathsByType('number').sort();
   
    this.modalRef = this.modalService.open(content);
    this.modalRef.result.then((result) => {
    }, (reason) => {
    });
  }

  settingsFormUpdatePath() { // called when we choose a new path. resets the rest with default info of this path
    let pathObject = this.SignalKService.getPathObject(this.settingsForm.selectedPath);
    if (pathObject === null) { return; }
    this.settingsForm.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.settingsForm.selectedSource = 'default';
  }

  addNewDataSet() {
    this.modalRef.close();
    this.DataSetService.addDataSet(
      this.settingsForm.selectedPath, 
      this.settingsForm.selectedSource, 
      this.settingsForm.interval, 
      this.settingsForm.dataPoints);
    this.loadDataSets();
  }

  deleteDataSet() { //TODO 
  
  }

}
