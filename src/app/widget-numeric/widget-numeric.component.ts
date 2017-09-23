import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { MdDialog, MdDialogRef, MD_DIALOG_DATA } from '@angular/material';

import { SignalKService, pathObject } from '../signalk.service';
import { WidgetManagerService, IWidget } from '../widget-manager.service';
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
  selectedPath: string;
  availableSources: string[];
  selectedSource: string;
  pathDataType: string;
  label: string;
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

  @Input('widgetUUID') widgetUUID: string;

  converter = this.UnitConvertService.getConverter();
  
  settingsForm: widgetSettingsForm = {
    selectedPath: null,
    availableSources: [],
    selectedSource: null,
    pathDataType: null,
    label: null,
    selectedUnitGroup: null,
    selectedUnitName: null,
    numDecimal: 2,
  }

  activeWidget: IWidget;

  dataValue: any = null;
  dataTimestamp: number = Date.now();

  widgetConfig: widgetConfig = {
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
    public dialog: MdDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitConvertService: UnitConvertService) {
  }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);
    } else {
      this.widgetConfig = this.activeWidget.config; // load existing config.
    }0
    this.subscribePath();
  }

  ngOnDestroy() {
    this.unsubscribePath();
  }


  subscribePath() {
    this.unsubscribePath();
    if (this.widgetConfig.signalKPath === null) { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.widgetConfig.signalKPath).subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }
        let source: string;
        if (this.widgetConfig.signalKSource == 'default') {
          source = pathObject.defaultSource;
        } else {
          source = this.widgetConfig.signalKSource;
        }

        this.dataTimestamp = pathObject.sources[source].timestamp;

        if (pathObject.sources[source].value === null) {
          this.dataValue = null;
        }

        let value:number = pathObject.sources[source].value;
        let converted = this.converter[this.widgetConfig.unitGroup][this.widgetConfig.unitName](value);
        this.dataValue = converted.toFixed(this.widgetConfig.numDecimal);
        
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.widgetConfig.signalKPath)
    }
  }

  openWidgetSettings() {
    let dialogRef = this.dialog.open(WidgetNumericModalComponent, {
      
      data: { currentType: this.activeWidget.type }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (this.activeWidget.type != result) {
        this.WidgetManagerService.updateWidgetType(this.widgetUUID, result);
        this.ngOnInit();
      }
    });


  }
/*
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
      this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
      this.nodeConfig.signalKPath = this.settingsForm.selectedPath;
      this.nodeConfig.signalKSource = this.settingsForm.selectedSource;
      this.nodeConfig.label = this.settingsForm.label;
      this.nodeConfig.unitGroup = this.settingsForm.selectedUnitGroup;
      this.nodeConfig.unitName = this.settingsForm.selectedUnitName;
      this.nodeConfig.numDecimal = this.settingsForm.numDecimal;
      this.treeManager.saveNodeData(this.nodeUUID, this.nodeConfig);
      this.subscribePath();
  }
*/
}



@Component({
  selector: 'numeriv-widget-modal',
  templateUrl: './widget-numeric.modal.html',
  styleUrls: ['./widget-numeric.component.css']
})
export class WidgetNumericModalComponent implements OnInit {

  settingsData: widgetSettingsForm;
  selfPaths: boolean = true;
  availablePaths: Array<string> = [];
  availableUnitGroups: string[];
  availableUnitNames: string[];
  
  constructor(
    private SignalKService: SignalKService,
    public dialogRef: MdDialogRef<WidgetNumericModalComponent>,
    @Inject(MD_DIALOG_DATA) public data: any) { }

  onNoClick(): void {
    this.dialogRef.close();
  }


  ngOnInit() {
    this.availablePaths = this.SignalKService.getPathsByType('number').sort();

   
  }

  submitConfig() {

  }
  
}