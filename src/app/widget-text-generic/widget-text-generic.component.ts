import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import {MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { SignalKService, pathObject } from '../signalk.service';
import { WidgetManagerService, IWidget } from '../widget-manager.service';
import { UnitConvertService } from '../unit-convert.service';


interface widgetConfig {
  signalKPath: string;
  signalKSource: string;
  label: string;
}

interface IWidgetsettingsData {
  selectedPath: string;
  selectedSource: string;
  label: string;

}

@Component({
  selector: 'app-widget-text-generic',
  templateUrl: './widget-text-generic.component.html',
  styleUrls: ['./widget-text-generic.component.css']
})
export class WidgetTextGenericComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

    activeWidget: IWidget;
  
  dataValue: any = null;
  dataTimestamp: number = Date.now();

  widgetConfig: widgetConfig = {
    signalKPath: null,
    signalKSource: 'default',
    label: null
  }

  //subs
  valueSub: Subscription = null;

  
  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService) {
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

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.widgetConfig.signalKPath, this.widgetConfig.signalKSource).subscribe(
      newValue => {
        this.dataValue = newValue;
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

  openWidgetSettings(content) {
      
    //prepare current data
    let settingsData: IWidgetsettingsData = {
      selectedPath: this.widgetConfig.signalKPath,
      selectedSource: this.widgetConfig.signalKSource,
      label: this.widgetConfig.label
    }
    let dialogRef = this.dialog.open(WidgetTextGenericModalComponent, {
      width: '500px',
      data: settingsData
    });
    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.debug("Updating widget config");
        this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
        this.widgetConfig.signalKPath = result.selectedPath;
        this.widgetConfig.signalKSource = result.selectedSource;
        this.widgetConfig.label = result.label;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);
        this.subscribePath();
      }
    });
  }

  
}



@Component({
  selector: 'text-widget-modal',
  templateUrl: './widget-text-generic.modal.html',
  styleUrls: ['./widget-text-generic.component.css']
})
export class WidgetTextGenericModalComponent implements OnInit {

  settingsData: IWidgetsettingsData;
  selfPaths: boolean = true;
  availablePaths: Array<string> = [];
  availableSources: Array<string>;

  constructor(
    private SignalKService: SignalKService,
    private UnitConvertService: UnitConvertService,
    public dialogRef:MatDialogRef<WidgetTextGenericModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }




  ngOnInit() {
    this.settingsData = this.data;

    //populate available choices
    this.availablePaths = this.SignalKService.getPathsByType('string').sort();
    if (this.availablePaths.includes(this.settingsData.selectedPath)) {
      this.settingsDataUpdatePath(); //TODO: this wipes out existing config, not good when editing existing config...
    }
  }


  settingsDataUpdatePath() { // called when we choose a new path. resets the rest with default info of this path
    let pathObject = this.SignalKService.getPathObject(this.settingsData.selectedPath);
    if (pathObject === null) { return; }
    this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.settingsData.selectedSource = 'default';

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
    this.dialogRef.close(this.settingsData);
  }
  
}
