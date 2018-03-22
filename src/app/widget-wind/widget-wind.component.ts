import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import {MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { SignalKService, pathObject } from '../signalk.service';
import { WidgetManagerService, IWidget } from '../widget-manager.service';
import { UnitConvertService } from '../unit-convert.service';


interface IWidgetConfig {
  headingPath: string;
  headingSource: string;
  trueWindAnglePath: string;
  trueWindAngleSource: string;
  trueWindSpeedPath: string;
  trueWindSpeedSource: string;
  appWindAnglePath: string;
  appWindAngleSource: string;
  appWindSpeedPath: string;
  appWindSpeedSource: string;
  unitName: string;
}  

@Component({
  selector: 'app-widget-wind',
  templateUrl: './widget-wind.component.html',
  styleUrls: ['./widget-wind.component.css']
})
export class WidgetWindComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;
  converter: Object = this.UnitConvertService.getConverter();
  
  activeWidget: IWidget;
  
  widgetConfig: IWidgetConfig = {
    headingPath: 'vessels.self.navigation.headingTrue',
    headingSource: 'default',
    trueWindAnglePath: 'vessels.self.environment.wind.angleTrueWater',
    trueWindAngleSource: 'default',
    trueWindSpeedPath: 'vessels.self.environment.wind.speedTrue',
    trueWindSpeedSource: 'default',
    appWindAnglePath: 'vessels.self.environment.wind.angleApparent',
    appWindAngleSource: 'default',
    appWindSpeedPath: 'vessels.self.environment.wind.speedApparent',
    appWindSpeedSource: 'default',
    unitName: 'knots'
  }    

  currentHeading: number = 0;
  headingSub: Subscription = null;

  appWindAngle: number = null;
  appWindAngleSub: Subscription = null;

  appWindSpeed: number = null;
  appWindSpeedSub: Subscription = null;

  trueWindAngle: number = null;
  trueWindAngleSub: Subscription = null;

  trueWindSpeed: number = null;
  trueWindSpeedSub: Subscription = null;

  constructor(
    public dialog:MatDialog,
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
    this.startAll();
  }

  ngOnDestroy() {
    this.stopAll();
  }

  startAll() {
    this.subscribeHeading();
    this.subscribeAppWindAngle();
    this.subscribeAppWindSpeed();
    this.subscribeTrueWindAngle();
    this.subscribeTrueWindSpeed();
  }

  stopAll() {
    this.unsubscribeHeading();
    this.unsubscribeAppWindAngle();
    this.unsubscribeAppWindSpeed();
    this.unsubscribeTrueWindAngle();
    this.unsubscribeTrueWindSpeed();    
  }

  subscribeHeading() {
    this.unsubscribeHeading();
    if (this.widgetConfig.headingPath === null) { return } // nothing to sub to...

    this.headingSub = this.SignalKService.subscribePath(this.widgetUUID, this.widgetConfig.headingPath, this.widgetConfig.headingSource).subscribe(
      newValue => {
        if (newValue === null) {
          this.currentHeading = 0;
        } else {
          let converted = this.converter['angle']['deg'](newValue);
          this.currentHeading = converted;
        }
        
        
      }
    );
  }

  subscribeAppWindAngle() {
    this.unsubscribeAppWindAngle();
    if (this.widgetConfig.appWindAnglePath === null) { return } // nothing to sub to...

    this.appWindAngleSub = this.SignalKService.subscribePath(this.widgetUUID, this.widgetConfig.appWindAnglePath).subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }
        let source: string;
        if (this.widgetConfig.appWindAngleSource == 'default') {
          source = pathObject.defaultSource;
        } else {
          source = this.widgetConfig.appWindAngleSource;
        }

        if (pathObject.sources[source].value === null) {
          this.appWindAngle = null;
          return;
        }

        let value:number = pathObject.sources[source].value;
        let converted = this.converter['angle']['deg'](value);
        // 0-180+ for stb
        // -0 to -180 for port
        // need in 0-360
        if (converted > 0) {// stb
          this.appWindAngle= 360 - converted;
        } else if (converted < 0) {
          this.appWindAngle = (converted * -1);
        }

      }
    );
  }

  subscribeAppWindSpeed() {
    this.unsubscribeAppWindSpeed();
    if (this.widgetConfig.appWindSpeedPath === null) { return } // nothing to sub to...

    this.appWindSpeedSub = this.SignalKService.subscribePath(this.widgetUUID, this.widgetConfig.appWindSpeedPath).subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }
        let source: string;
        if (this.widgetConfig.appWindSpeedSource == 'default') {
          source = pathObject.defaultSource;
        } else {
          source = this.widgetConfig.appWindSpeedSource;
        }

        if (pathObject.sources[source].value === null) {
          this.appWindSpeed = null;
          return;
        }

        let value:number = pathObject.sources[source].value;
        this.appWindSpeed = this.converter['speed'][this.widgetConfig.unitName](value);
      }
    );
  }

  subscribeTrueWindAngle() {
    this.unsubscribeTrueWindAngle();
    if (this.widgetConfig.trueWindAnglePath === null) { return } // nothing to sub to...

    this.trueWindAngleSub = this.SignalKService.subscribePath(this.widgetUUID, this.widgetConfig.trueWindAnglePath).subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }
        let source: string;
        if (this.widgetConfig.trueWindAngleSource == 'default') {
          source = pathObject.defaultSource;
        } else {
          source = this.widgetConfig.trueWindAngleSource;
        }

        if (pathObject.sources[source].value === null) {
          this.trueWindAngle = null;
          return;
        }

        let value:number = pathObject.sources[source].value;
        let converted = this.converter['angle']['deg'](value);
        // 0-180+ for stb
        // -0 to -180 for port
        // need in 0-360
        if (converted > 0) {// stb
          this.trueWindAngle= 360 - converted;
        } else if (converted < 0) {
          this.trueWindAngle = (converted * -1);
        }

      }
    );
  }

  subscribeTrueWindSpeed() {
    this.unsubscribeTrueWindSpeed();
    if (this.widgetConfig.trueWindSpeedPath === null) { return } // nothing to sub to...

    this.trueWindSpeedSub = this.SignalKService.subscribePath(this.widgetUUID, this.widgetConfig.trueWindSpeedPath).subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }
        let source: string;
        if (this.widgetConfig.trueWindSpeedSource == 'default') {
          source = pathObject.defaultSource;
        } else {
          source = this.widgetConfig.trueWindSpeedSource;
        }

        if (pathObject.sources[source].value === null) {
          this.trueWindSpeed = null;
          return;
        }

        let value:number = pathObject.sources[source].value;
        this.trueWindSpeed = this.converter['speed'][this.widgetConfig.unitName](value);
      }
    );
  }


  unsubscribeHeading() {
    if (this.headingSub !== null) {
      this.headingSub.unsubscribe();
      this.headingSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.widgetConfig.headingPath);
    }
  }

  unsubscribeAppWindAngle() {
    if (this.appWindAngleSub !== null) {
      this.appWindAngleSub.unsubscribe();
      this.appWindAngleSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.widgetConfig.appWindAnglePath);
    }
  }

  unsubscribeAppWindSpeed() {
    if (this.appWindSpeedSub !== null) {
      this.appWindSpeedSub.unsubscribe();
      this.appWindSpeedSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.widgetConfig.appWindSpeedPath);
    }   
  }

  unsubscribeTrueWindAngle() {
    if (this.trueWindAngleSub !== null) {
      this.trueWindAngleSub.unsubscribe();
      this.trueWindAngleSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.widgetConfig.trueWindAnglePath);
    }
  }

  unsubscribeTrueWindSpeed() {
    if (this.trueWindSpeedSub !== null) {
      this.trueWindSpeedSub.unsubscribe();
      this.trueWindSpeedSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.widgetConfig.trueWindSpeedPath);
    }   
  }

  openWidgetSettings() {

    //prepare current data
    let settingsData: IWidgetConfig = {
      headingPath: this.widgetConfig.headingPath,
      headingSource: this.widgetConfig.headingSource,
      trueWindAnglePath: this.widgetConfig.trueWindAnglePath,
      trueWindAngleSource: this.widgetConfig.trueWindAngleSource,
      trueWindSpeedPath: this.widgetConfig.trueWindSpeedPath,
      trueWindSpeedSource: this.widgetConfig.trueWindSpeedSource,
      appWindAnglePath: this.widgetConfig.appWindAnglePath,
      appWindAngleSource: this.widgetConfig.appWindAngleSource,
      appWindSpeedPath: this.widgetConfig.appWindSpeedPath,
      appWindSpeedSource: this.widgetConfig.appWindSpeedSource,
      unitName: this.widgetConfig.unitName
    }


    let dialogRef = this.dialog.open(WidgetWindModalComponent, {
      width: '650px',
      data: settingsData
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.debug("Updating widget config");
        this.stopAll();//unsub now as we will change variables so wont know what was subbed before...
        this.widgetConfig.headingPath = result.headingPath;
        this.widgetConfig.headingSource = result.headingSource;
        this.widgetConfig.trueWindAnglePath = result.trueWindAnglePath;
        this.widgetConfig.trueWindAngleSource = result.trueWindAngleSource;
        this.widgetConfig.trueWindSpeedPath = result.trueWindSpeedPath;
        this.widgetConfig.trueWindSpeedSource = result.trueWindSpeedSource;

        this.widgetConfig.appWindAnglePath = result.appWindAnglePath;
        this.widgetConfig.appWindAngleSource = result.appWindAngleSource;
        this.widgetConfig.appWindSpeedPath = result.appWindSpeedPath;
        this.widgetConfig.appWindSpeedSource = result.appWindSpeedSource;
        this.widgetConfig.unitName = result.unitName;
        

        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);
        this.startAll();
      }

    });

  }


}

/*************************************************************
 * ***********************************************************
 * ***********************************************************
 *   Modal
 * ***********************************************************
 * ***********************************************************
 */


@Component({
  selector: 'wind-widget-modal',
  templateUrl: './widget-wind.modal.html',
  styleUrls: ['./widget-wind.component.css']
})
export class WidgetWindModalComponent implements OnInit {

  settingsData: IWidgetConfig;

  availableUnitNames: string[];
  
  selfPaths: boolean = true;
  availablePaths: Array<string> = [];

  headingSources: Array<string>;
  trueWindAngleSources: Array<string>;
  trueWindSpeedSources: Array<string>;
  appWindAngleSources: Array<string>;
  appWindSpeedSources: Array<string>;

  converter: Object = this.UnitConvertService.getConverter();
  

  constructor(
    private SignalKService: SignalKService,
    private UnitConvertService: UnitConvertService,
    public dialogRef:MatDialogRef<WidgetWindModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
    this.settingsData = this.data;
    //populate available choices
    this.availablePaths = this.SignalKService.getPathsByType('number').sort();

    this.updateHeadingSources();
    this.updateTrueWindAngleSources();
    this.updateTrueWindSpeedSources();
    this.updateAppWindAngleSources();
    this.updateAppWindSpeedSources();

    this.availableUnitNames = Object.keys(this.converter['speed']);
    

  }


  updateHeadingSources() { 
    let pathObject = this.SignalKService.getPathObject(this.settingsData.headingPath);
    if (pathObject === null) { return; }
    this.headingSources = ['default'].concat(Object.keys(pathObject.sources));
    if (!this.headingSources.includes(this.settingsData.headingSource))
      { this.settingsData.headingSource = 'default'; }
  }

  updateTrueWindAngleSources() {
    let pathObject = this.SignalKService.getPathObject(this.settingsData.trueWindAnglePath);
    if (pathObject === null) { return; }
    this.trueWindAngleSources = ['default'].concat(Object.keys(pathObject.sources));
    if (!this.trueWindAngleSources.includes(this.settingsData.trueWindAngleSource))
      { this.settingsData.trueWindAngleSource = 'default'; }
  }

  updateTrueWindSpeedSources() {
    let pathObject = this.SignalKService.getPathObject(this.settingsData.trueWindSpeedPath);
    if (pathObject === null) { return; }
    this.trueWindSpeedSources = ['default'].concat(Object.keys(pathObject.sources));
    if (!this.trueWindSpeedSources.includes(this.settingsData.trueWindSpeedSource))
      { this.settingsData.trueWindSpeedSource = 'default'; }
  }

  updateAppWindAngleSources() {
    let pathObject = this.SignalKService.getPathObject(this.settingsData.appWindAnglePath);
    if (pathObject === null) { return; }
    this.appWindAngleSources = ['default'].concat(Object.keys(pathObject.sources));
    if (!this.appWindAngleSources.includes(this.settingsData.appWindAngleSource))
      { this.settingsData.appWindAngleSource = 'default'; }
  }

  updateAppWindSpeedSources() {
    let pathObject = this.SignalKService.getPathObject(this.settingsData.appWindSpeedPath);
    if (pathObject === null) { return; }
    this.appWindSpeedSources = ['default'].concat(Object.keys(pathObject.sources));
    if (!this.appWindSpeedSources.includes(this.settingsData.appWindSpeedSource))
    { this.settingsData.appWindSpeedSource = 'default'; }
  }


  submitConfig() {
    this.dialogRef.close(this.settingsData);
  }
}