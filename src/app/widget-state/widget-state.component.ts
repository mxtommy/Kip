import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import {MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { SignalKService, pathObject } from '../signalk.service';
import { WidgetManagerService, IWidget } from '../widget-manager.service';


interface widgetConfig {
  signalKPath: string;
  signalKSource: string;
  label: string;
}


@Component({
  selector: 'app-widget-state',
  templateUrl: './widget-state.component.html',
  styleUrls: ['./widget-state.component.css']
})
export class WidgetStateComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  valueSub: Subscription = null;
  activeWidget: IWidget;
  
  state: boolean = null;

  widgetConfig: widgetConfig = {
    signalKPath: null,
    signalKSource: 'default',
    label: null
  }
    
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
          this.state = null;
        }

        this.state = pathObject.sources[source].value;
        
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
    let settingsData: widgetConfig = {
      signalKPath: this.widgetConfig.signalKPath,
      signalKSource: this.widgetConfig.signalKSource,
      label: this.widgetConfig.label
    }
    let dialogRef = this.dialog.open(WidgetStateModalComponent, {
      width: '500px',
      data: settingsData
    });
    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.debug("Updating widget config");
        this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
        this.widgetConfig.signalKPath = result.signalKPath;
        this.widgetConfig.signalKSource = result.signalKSource;
        this.widgetConfig.label = result.label;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);
        this.subscribePath();
      }
    });
  }


}



@Component({
  selector: 'state-widget-modal',
  templateUrl: './widget-state.modal.html',
  styleUrls: ['./widget-state.component.css']
})
export class WidgetStateModalComponent implements OnInit {

  settingsData: widgetConfig;
  selfPaths: boolean = true;
  availablePaths: Array<string> = [];
  availableSources: Array<string>;

  constructor(
    private SignalKService: SignalKService,
    public dialogRef:MatDialogRef<WidgetStateModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }




  ngOnInit() {
    this.settingsData = this.data;

    //populate available choices
    this.availablePaths = this.SignalKService.getPathsByType('boolean').sort();
    if (this.availablePaths.includes(this.settingsData.signalKPath)) {
      this.settingsDataUpdatePath(); //TODO: this wipes out existing config, not good when editing existing config...
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

   submitConfig() {
    this.dialogRef.close(this.settingsData);
  }
  
}




