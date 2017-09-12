import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs/Subscription';

import { SignalKService, pathObject } from '../signalk.service';
import { TreeNode, TreeManagerService } from '../tree-manager.service';


interface textWidgetConfig {
  signalKPath: string;
  signalKSource: string;
  label: string;
  unit: string;
  numDecimal: number; // number of decimal places if a number
}

interface textWidgetSettingsForm {
  availablePaths: string[];
  selectedPath: string;
  availableSources: string[];
  selectedSource: string;
  selfPaths: boolean;
  pathDataType: string;
  label: string;
  availableUnits: string[];
  selectedUnit: string;
  numDecimal: number;
}

@Component({
  selector: 'app-widget-text-generic',
  templateUrl: './widget-text-generic.component.html',
  styleUrls: ['./widget-text-generic.component.css']
})
export class WidgetTextGenericComponent implements OnInit, OnDestroy {

  @Input('nodeUUID') nodeUUID: string;

  modalRef;

  settingsForm: textWidgetSettingsForm = {
    availablePaths: [],
    selectedPath: null,
    availableSources: [],
    selectedSource: null,
    selfPaths: true, //only show paths for own vessel
    pathDataType: null,
    label: null,
    availableUnits: null,
    selectedUnit: null,
    numDecimal: 2,
  }

  activePage: TreeNode;

  dataValue: any = '---';
  dataTimestamp: number = Date.now();

  nodeConfig: textWidgetConfig = {
    signalKPath: null,
    signalKSource: 'default',
    label: null,
    unit: null,
    numDecimal: 2
  }

  //subs
  valueSub: Subscription = null;


  
  constructor(
    private modalService: NgbModal, 
    private SignalKService: SignalKService,
    private treeManager: TreeManagerService) {
  }

  ngOnInit() {
    this.activePage = this.treeManager.getNode(this.nodeUUID);
    if (this.activePage.nodeData === null) {
        // no data, let's set some!
      this.treeManager.saveNodeData(this.nodeUUID, this.nodeConfig);
    } else {
      this.nodeConfig = this.activePage.nodeData; // load existing config.
    }
    this.subscribePath();
  }

  ngOnDestroy() {
    this.unsubscribePath();
  }


  subscribePath() {
    this.unsubscribePath();
    if (this.nodeConfig.signalKPath === null) { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.nodeUUID, this.nodeConfig.signalKPath).subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }
        let source: string;
        if (this.nodeConfig.signalKSource == 'default') {
          source = pathObject.defaultSource;
        } else {
          source = this.nodeConfig.signalKSource;
        }
        if (pathObject.type == 'number') {
          let value:number = pathObject.sources[source].value;
          this.dataValue = value.toFixed(this.nodeConfig.numDecimal);
        } else {
          this.dataValue = pathObject.sources[source].value;
        }
        
        this.dataTimestamp = pathObject.sources[source].timestamp;
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
    }
  }

  openWidgetSettings(content) {
      
    this.settingsForm.selectedPath = this.nodeConfig.signalKPath;
    this.settingsForm.selectedSource = this.nodeConfig.signalKSource;
    this.settingsForm.label = this.nodeConfig.label;
    this.settingsForm.numDecimal = this.nodeConfig.numDecimal;
    
    let pathObject = this.SignalKService.getPathObject(this.settingsForm.selectedPath);
    if (pathObject !== null) { 
      this.settingsForm.availableSources = ['default'].concat(Object.keys(pathObject.sources));
      this.settingsForm.pathDataType = pathObject.type;

      
     }
    this.settingsForm.availablePaths = this.SignalKService.getAllPathsNormal().sort();
     
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
    this.settingsForm.pathDataType = pathObject.type;
    this.settingsForm.numDecimal = this.nodeConfig.numDecimal;
    if (pathObject.meta) {
      if (typeof(pathObject.meta.abbreviation) == 'string') {
        this.settingsForm.label = pathObject.meta.abbreviation;
      } else if (typeof(pathObject.meta.label) == 'string') {
        this.settingsForm.label = pathObject.meta.label;
      } else {
        this.settingsForm.label = ''; // who knows?
      }
    } else {
      this.settingsForm.label = '';
    }

  }
  
  saveSettings() {
      this.modalRef.close();
      this.nodeConfig.signalKPath = this.settingsForm.selectedPath;
      this.nodeConfig.signalKSource = this.settingsForm.selectedSource;
      this.nodeConfig.label = this.settingsForm.label;
      this.nodeConfig.numDecimal = this.settingsForm.numDecimal;
      this.treeManager.saveNodeData(this.nodeUUID, this.nodeConfig);
      this.subscribePath();
  }

}
