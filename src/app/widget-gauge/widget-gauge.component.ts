import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { MdDialog, MdDialogRef, MD_DIALOG_DATA } from '@angular/material';

import { SignalKService, pathObject } from '../signalk.service';
import { WidgetManagerService, IWidget } from '../widget-manager.service';
import { UnitConvertService } from '../unit-convert.service';


interface IWidgetConfig {
  gaugeType: string;
  signalKPath: string;
  signalKSource: string;
  label: string;
  unitGroup: string;
  unitName: string;
  minValue: number;
  maxValue: number;
}



@Component({
  selector: 'app-widget-gauge',
  templateUrl: './widget-gauge.component.html',
  styleUrls: ['./widget-gauge.component.css']
})
export class WidgetGaugeComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;
  

  converter = this.UnitConvertService.getConverter();

  activeWidget: IWidget;
  
  dataValue: any = null;

  valueSub: Subscription = null;
  
  widgetConfig: IWidgetConfig = {
    gaugeType: 'linear',
    signalKPath: null,
    signalKSource: 'default',
    label: null,
    unitGroup: 'discreet',
    unitName: 'no unit',
    minValue: 0,
    maxValue: 100
  }

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
    }

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

        if (pathObject.sources[source].value === null) {
          this.dataValue = null;
        }

        let value:number = pathObject.sources[source].value;
        let converted = this.converter[this.widgetConfig.unitGroup][this.widgetConfig.unitName](value);
        this.dataValue = converted;
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
        let settingsData: IWidgetConfig = {
          gaugeType: this.widgetConfig.gaugeType,
          signalKPath: this.widgetConfig.signalKPath,
          signalKSource: this.widgetConfig.signalKSource,
          label: this.widgetConfig.label,
          unitGroup: this.widgetConfig.unitGroup,
          unitName: this.widgetConfig.unitName,
          minValue: this.widgetConfig.minValue,
          maxValue: this.widgetConfig.maxValue
        }
    
    
        let dialogRef = this.dialog.open(WidgetGaugeModalComponent, {
          width: '650px',
          data: settingsData
        });
    
        dialogRef.afterClosed().subscribe(result => {
          // save new settings
          if (result) {
            console.debug("Updating widget config");
            this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
            this.widgetConfig.gaugeType = result.gaugeType;
            this.widgetConfig.signalKPath = result.signalKPath;
            this.widgetConfig.signalKSource = result.signalKSource;
            this.widgetConfig.label = result.label;
            this.widgetConfig.unitGroup = result.unitGroup;
            this.widgetConfig.unitName = result.unitName;
            this.widgetConfig.minValue = result.minValue;
            this.widgetConfig.maxValue = result.maxValue;
            this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);
            this.subscribePath();
          }
    
        });
    
      }

}


@Component({
  selector: 'gauge-widget-modal',
  templateUrl: './widget-gauge.modal.html',
  styleUrls: ['./widget-gauge.component.css']
})
export class WidgetGaugeModalComponent implements OnInit {

  settingsData: IWidgetConfig;
  selfPaths: boolean = true;
  availablePaths: Array<string> = [];
  availableSources: Array<string>;
  availableUnitGroups: string[];
  availableUnitNames: string[];
  
  converter: Object = this.UnitConvertService.getConverter();

  constructor(
    private SignalKService: SignalKService,
    private UnitConvertService: UnitConvertService,
    public dialogRef: MdDialogRef<WidgetGaugeModalComponent>,
    @Inject(MD_DIALOG_DATA) public data: any) { }


  ngOnInit() {
    this.settingsData = this.data;

    //populate available choices
    this.availablePaths = this.SignalKService.getPathsByType('number').sort();
    if (this.availablePaths.includes(this.settingsData.signalKPath)) {
      this.settingsDataUpdatePath(); //TODO: this wipes out existing config, not good when editing existing config...
    }
    this.availableUnitGroups = Object.keys(this.converter);
    if (this.converter.hasOwnProperty(this.settingsData.unitGroup)) {
            this.availableUnitNames = Object.keys(this.converter[this.settingsData.unitGroup]);
    }
  }

  settingsDataUpdatePath() { // called when we choose a new path. resets the rest with default info of this path
    let pathObject = this.SignalKService.getPathObject(this.settingsData.signalKPath);
    if (pathObject === null) { return; }
    this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.settingsData.signalKSource = 'default';
    if (pathObject.meta) {
      if (typeof(pathObject.meta.abbreviation) == 'string') {
        this.settingsData.label = pathObject.meta.abbreviation;
      } else if (typeof(pathObject.meta.label) == 'string') {
        this.settingsData.label = pathObject.meta.label;
      } else {
        this.settingsData.label = this.settingsData.signalKPath; // who knows?
      }
    } else {
      this.settingsData.label = this.settingsData.signalKPath;// who knows?
    }
  }

  updateUnitType() {
    if (this.converter.hasOwnProperty(this.settingsData.unitGroup)) {
      this.availableUnitNames = Object.keys(this.converter[this.settingsData.unitGroup]);
      // select first name
      this.settingsData.unitName = this.availableUnitNames[0];
    }
  }


  submitConfig() {
    this.dialogRef.close(this.settingsData);
  }

}