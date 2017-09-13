import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { NgbModal, ModalDismissReasons } from '@ng-bootstrap/ng-bootstrap';
import { Subscription } from 'rxjs/Subscription';

import { SignalKService, pathObject } from '../signalk.service';
import { TreeNode, TreeManagerService } from '../tree-manager.service';
import { UnitConvertService } from '../unit-convert.service';


interface widgetConfig {
  signalKPath: string;
  signalKSource: string;
  label: string;
  unitGroup: string;
  unitName: string;
  numDecimal: number; // number of decimal places if a number
}

interface widgetSettingsForm {
  availablePaths: string[];
  selectedPath: string;
  availableSources: string[];
  selectedSource: string;
  selfPaths: boolean;
  pathDataType: string;
  label: string;
  availableUnitGroups: string[];
  availableUnitNames: string[];
  selectedUnitGroup: string;
  selectedUnitName: string;
  numDecimal: number;
}

@Component({
  selector: 'app-widget-numeric',
  templateUrl: './widget-numeric.component.html',
  styleUrls: ['./widget-numeric.component.css']
})
export class WidgetNumericComponent implements OnInit, OnDestroy {

  @Input('nodeUUID') nodeUUID: string;

  modalRef;
  converter = this.UnitConvertService.getConverter();
  
  settingsForm: widgetSettingsForm = {
    availablePaths: [],
    selectedPath: null,
    availableSources: [],
    selectedSource: null,
    selfPaths: true, //only show paths for own vessel
    pathDataType: null,
    label: null,
    availableUnitGroups: Object.keys(this.converter),
    availableUnitNames: null,
    selectedUnitGroup: null,
    selectedUnitName: null,
    numDecimal: 2,
  }

  activePage: TreeNode;

  dataValue: any = '---';
  dataTimestamp: number = Date.now();

  nodeConfig: widgetConfig = {
    signalKPath: null,
    signalKSource: 'default',
    label: null,
    unitGroup: 'discreet',
    unitName: 'no unit',
    numDecimal: 2

  }

  //subs
  valueSub: Subscription = null;
  
  constructor(
    private modalService: NgbModal, 
    private SignalKService: SignalKService,
    private treeManager: TreeManagerService,
    private UnitConvertService: UnitConvertService) {
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

        this.dataTimestamp = pathObject.sources[source].timestamp;

        if (pathObject.sources[source].value === null) {
          this.dataValue = 'N/A';
        }

        if (pathObject.type == 'number') {
          let value:number = pathObject.sources[source].value;
          let converted = this.converter[this.nodeConfig.unitGroup][this.nodeConfig.unitName](value);
          this.dataValue = converted.toFixed(this.nodeConfig.numDecimal);
        } else {
          this.dataValue = pathObject.sources[source].value;
        }
        
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
    this.settingsForm.availableUnitNames = Object.keys(this.converter[this.nodeConfig.unitGroup]);
    this.settingsForm.selectedUnitGroup = this.nodeConfig.unitGroup;
    this.settingsForm.selectedUnitName = this.nodeConfig.unitName;
    
    let pathObject = this.SignalKService.getPathObject(this.settingsForm.selectedPath);
    if (pathObject !== null) { 
      this.settingsForm.availableSources = ['default'].concat(Object.keys(pathObject.sources));
      this.settingsForm.pathDataType = pathObject.type;

      
     }
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
    this.settingsForm.pathDataType = pathObject.type;
    this.settingsForm.numDecimal = this.nodeConfig.numDecimal;
    if (pathObject.meta) {
      if (typeof(pathObject.meta.abbreviation) == 'string') {
        this.settingsForm.label = pathObject.meta.abbreviation;
      } else if (typeof(pathObject.meta.label) == 'string') {
        this.settingsForm.label = pathObject.meta.label;
      } else {
        this.settingsForm.label = this.settingsForm.selectedPath; // who knows?
      }
    } else {
      this.settingsForm.label = this.settingsForm.selectedPath;// who knows?
    }

  }

  settingsFormUpdateUnitType() {
    this.settingsForm.availableUnitNames = Object.keys(this.converter[this.settingsForm.selectedUnitGroup]);
    this.settingsForm.selectedUnitName = this.settingsForm.availableUnitNames[0];
  }
  
  saveSettings() {
      this.modalRef.close();
      this.nodeConfig.signalKPath = this.settingsForm.selectedPath;
      this.nodeConfig.signalKSource = this.settingsForm.selectedSource;
      this.nodeConfig.label = this.settingsForm.label;
      this.nodeConfig.unitGroup = this.settingsForm.selectedUnitGroup;
      this.nodeConfig.unitName = this.settingsForm.selectedUnitName;
      this.nodeConfig.numDecimal = this.settingsForm.numDecimal;
      this.treeManager.saveNodeData(this.nodeUUID, this.nodeConfig);
      this.subscribePath();
  }

}
