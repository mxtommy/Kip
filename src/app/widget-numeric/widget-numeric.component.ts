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

interface IWidgetsettingsData {
  selectedPath: string;
  selectedSource: string;
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

    //prepare current data
    let settingsData: IWidgetsettingsData = {
      selectedPath: this.widgetConfig.signalKPath,
      selectedSource: this.widgetConfig.signalKSource,
      label: this.widgetConfig.label,
      numDecimal: this.widgetConfig.numDecimal,
      selectedUnitGroup: this.widgetConfig.unitGroup,
      selectedUnitName: this.widgetConfig.unitName
    }


    let dialogRef = this.dialog.open(WidgetNumericModalComponent, {
      width: '500px',
      data: settingsData
    });

    dialogRef.afterClosed().subscribe(result => {
     console.log(result);
    });



  }
/*

      
    
    let pathObject = this.SignalKService.getPathObject(this.settingsData.selectedPath);
    if (pathObject !== null) { 
      this.settingsData.availableSources = ['default'].concat(Object.keys(pathObject.sources));
      this.settingsData.pathDataType = pathObject.type;

      
     }
    
     
    this.modalRef = this.modalService.open(content);
    this.modalRef.result.then((result) => {
    }, (reason) => {
    });
  }

  settingsDataUpdatePath() { // called when we choose a new path. resets the rest with default info of this path
    let pathObject = this.SignalKService.getPathObject(this.settingsData.selectedPath);
    if (pathObject === null) { return; }
    this.settingsData.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.settingsData.selectedSource = 'default';
    this.settingsData.pathDataType = pathObject.type;
    this.settingsData.numDecimal = this.widgetConfig.numDecimal;
    if (pathObject.meta) {
      if (typeof(pathObject.meta.abbreviation) == 'string') {
        this.settingsData.label = pathObject.meta.abbreviation;
      } else if (typeof(pathObject.meta.label) == 'string') {
        this.settingsData.label = pathObject.meta.label;
      } else {
        this.settingsData.label = this.settingsData.selectedPath; // who knows?
      }
    } else {
      this.settingsData.label = this.settingsData.selectedPath;// who knows?
    }

  }

  settingsDataUpdateUnitType() {
    this.settingsData.availableUnitNames = Object.keys(this.converter[this.settingsData.selectedUnitGroup]);
    this.settingsData.selectedUnitName = this.settingsData.availableUnitNames[0];
  }
  
  saveSettings() {
      this.modalRef.close();
      this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
      this.widgetConfig.signalKPath = this.settingsData.selectedPath;
      this.widgetConfig.signalKSource = this.settingsData.selectedSource;
      this.widgetConfig.label = this.settingsData.label;
      this.widgetConfig.unitGroup = this.settingsData.selectedUnitGroup;
      this.widgetConfig.unitName = this.settingsData.selectedUnitName;
      this.widgetConfig.numDecimal = this.settingsData.numDecimal;
      this.treeManager.saveNodeData(this.nodeUUID, this.widgetConfig);
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

  settingsData: IWidgetsettingsData;
  selfPaths: boolean = true;
  availablePaths: Array<string> = [];
  availableSources: Array<string>;
  availableUnitGroups: string[];
  availableUnitNames: string[];
  
  converter = this.UnitConvertService.getConverter();

 // availableUnitNames = Object.keys(this.converter[this.widgetConfig.unitGroup]);

  constructor(
    private SignalKService: SignalKService,
    private UnitConvertService: UnitConvertService,
    public dialogRef: MdDialogRef<WidgetNumericModalComponent>,
    @Inject(MD_DIALOG_DATA) public data: any) { }

  onNoClick(): void {
    this.dialogRef.close();
  }


  ngOnInit() {
    this.settingsData = this.data;
    this.availablePaths = this.SignalKService.getPathsByType('number').sort();
    console.log(this.availablePaths);
    if (this.availablePaths.includes(this.settingsData.selectedPath)) {
      this.settingsDataUpdatePath();
    }
  }


  settingsDataUpdatePath() { // called when we choose a new path. resets the rest with default info of this path
    console.debug('New Path, reseting form!');
    let pathObject = this.SignalKService.getPathObject(this.settingsData.selectedPath);
    if (pathObject === null) { return; }
    console.log(pathObject);
    this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.settingsData.selectedSource = 'default';
    this.settingsData.numDecimal = this.data.numDecimal;
    if (pathObject.meta) {
      if (typeof(pathObject.meta.abbreviation) == 'string') {
        this.settingsData.label = pathObject.meta.abbreviation;
      } else if (typeof(pathObject.meta.label) == 'string') {
        this.settingsData.label = pathObject.meta.label;
      } else {
        this.settingsData.label = this.settingsData.selectedPath; // who knows?
      }
    } else {
      this.settingsData.label = this.settingsData.selectedPath;// who knows?
    }
  }


  submitConfig() {

  }
  
}