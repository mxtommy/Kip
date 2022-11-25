import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription, interval } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { SignalKService } from '../signalk.service';
import { WidgetManagerService, IWidget, IWidgetSvcConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';


const defaultConfig: IWidgetSvcConfig = {
  filterSelfPaths: true,
  paths: {
    "headingPath": {
      description: "Heading",
      path: 'self.navigation.courseOverGroundTrue',
      source: 'default',
      pathType: "number",
      isPathConfigurable: true,
      convertUnitTo: "deg"
    },
    "trueWindAngle": {
      description: "True Wind Angle",
      path: 'self.environment.wind.angleTrueWater',
      source: 'default',
      pathType: "number",
      isPathConfigurable: true,
      convertUnitTo: "deg"
    },
    "trueWindSpeed": {
      description: "True Wind Speed",
      path: 'self.environment.wind.speedTrue',
      source: 'default',
      pathType: "number",
      isPathConfigurable: true,
      convertUnitTo: "knots"
    },
    "appWindAngle": {
      description: "Apparent Wind Angle",
      path: 'self.environment.wind.angleApparent',
      source: 'default',
      pathType: "number",
      isPathConfigurable: true,
      convertUnitTo: "deg"
    },
    "appWindSpeed": {
      description: "Apparent Wind Speed",
      path: 'self.environment.wind.speedApparent',
      source: 'default',
      pathType: "number",
      isPathConfigurable: true,
      convertUnitTo: "knots"
    },
  },
  windSectorEnable: true,
  windSectorWindowSeconds: 10,
  laylineEnable: true,
  laylineAngle: 35,
};


@Component({
  selector: 'app-widget-wind',
  templateUrl: './widget-wind.component.html',
  styleUrls: ['./widget-wind.component.css']
})
export class WidgetWindComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  activeWidget: IWidget;
  config: IWidgetSvcConfig;

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

  trueWindHistoric: {
    timestamp: number;
    heading: number;
  }[] = [];
  trueWindMinHistoric: number;
  trueWindMidHistoric: number;
  trueWindMaxHistoric: number;

  windSectorObservableSub: Subscription;


  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService) {
  }


  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
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
    this.startWindSectors();
  }

  stopAll() {
    this.unsubscribeHeading();
    this.unsubscribeAppWindAngle();
    this.unsubscribeAppWindSpeed();
    this.unsubscribeTrueWindAngle();
    this.unsubscribeTrueWindSpeed();
    this.stopWindSectors();
  }

  subscribeHeading() {
    this.unsubscribeHeading();
    if (typeof(this.config.paths['headingPath'].path) != 'string') { return } // nothing to sub to...
    this.headingSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['headingPath'].path, this.config.paths['headingPath'].source).subscribe(
      newValue => {
        if (newValue.value === null) {
          this.currentHeading = 0;
        } else {
          this.currentHeading = this.UnitsService.convertUnit('deg', newValue.value);
        }

      }
    );
  }

  subscribeAppWindAngle() {
    this.unsubscribeAppWindAngle();
    if (typeof(this.config.paths['appWindAngle'].path) != 'string') { return } // nothing to sub to...

    this.appWindAngleSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['appWindAngle'].path, this.config.paths['appWindAngle'].source).subscribe(
      newValue => {
        if (newValue.value === null) {
          this.appWindAngle = null;
          return;
        }

        let converted = this.UnitsService.convertUnit('deg', newValue.value);
        // 0-180+ for stb
        // -0 to -180 for port
        // need in 0-360
        if (converted < 0) {// stb
          this.appWindAngle= 360 + converted; // adding a negative number subtracts it...
        } else {
          this.appWindAngle = converted;
        }

      }
    );
  }

  subscribeAppWindSpeed() {
    this.unsubscribeAppWindSpeed();
    if (typeof(this.config.paths['appWindSpeed'].path) != 'string') { return } // nothing to sub to...

    this.appWindSpeedSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['appWindSpeed'].path, this.config.paths['appWindSpeed'].source).subscribe(
      newValue => {
        this.appWindSpeed = this.UnitsService.convertUnit(this.config.paths['appWindSpeed'].convertUnitTo, newValue.value);
      }
    );
  }

  subscribeTrueWindAngle() {
    this.unsubscribeTrueWindAngle();
    if (typeof(this.config.paths['trueWindAngle'].path) != 'string') { return } // nothing to sub to...

    this.trueWindAngleSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['trueWindAngle'].path, this.config.paths['trueWindAngle'].source).subscribe(
      newValue => {
        if (newValue.value === null) {
          this.trueWindAngle = null;
          return;
        }

        let converted = this.UnitsService.convertUnit('deg', newValue.value);

        // Depending on path, this number can either be the magnetic compass heading, true compass heading, or heading relative to boat heading (-180 to 180deg)... Ugh...
          // 0-180+ for stb
          // -0 to -180 for port
          // need in 0-360

        if (this.config.paths['trueWindAngle'].path.match('angleTrueWater')||
        this.config.paths['trueWindAngle'].path.match('angleTrueGround')) {
          //-180 to 180
          this.trueWindAngle = this.addHeading(this.currentHeading, converted);
        } else if (this.config.paths['trueWindAngle'].path.match('direction')) {
          //0-360
          this.trueWindAngle = converted;
        } else {
          // some other path... assume it's the angle
          this.trueWindAngle = converted;
        }

        //add to historical for wind sectors
        if (this.config.windSectorEnable) {
          this.addHistoricalTrue(this.trueWindAngle);
        }
      }
    );
  }

  subscribeTrueWindSpeed() {
    this.unsubscribeTrueWindSpeed();
    if (typeof(this.config.paths['trueWindSpeed'].path) != 'string') { return } // nothing to sub to...

    this.trueWindSpeedSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['trueWindSpeed'].path, this.config.paths['trueWindSpeed'].source).subscribe(
      newValue => {
        this.trueWindSpeed = this.UnitsService.convertUnit(this.config.paths['trueWindSpeed'].convertUnitTo, newValue.value);
      }
    );
  }

  startWindSectors() {
    this.windSectorObservableSub = interval (500).subscribe(x => {
      this.historicalCleanup();
    });
  }

  addHistoricalTrue (windHeading) {
    this.trueWindHistoric.push({
      timestamp: Date.now(),
      heading: windHeading
    });
    let arr = this.arcForAngles(this.trueWindHistoric.map(d => d.heading));
    this.trueWindMinHistoric = arr[0];
    this.trueWindMaxHistoric = arr[1];
    this.trueWindMidHistoric = arr[2];
  }

  arcForAngles (data) {
    return data.slice(1).reduce((acc, theValue) => {
      let value = theValue
      while (value < acc[0] - 180) {
        value += 360
      }
      while (value > acc[1] + 180) {
        value -= 360
      }
      acc[0] = Math.min(acc[0], value)
      acc[1] = Math.max(acc[1], value)
      acc[2] = ((acc[1]-acc[0])/2)+acc[0];
      return acc
    }, [data[0], data[0]])
  }

  historicalCleanup() {
    let n = Date.now()-(this.config.windSectorWindowSeconds*1000);
    for (var i = this.trueWindHistoric.length - 1; i >= 0; --i) {
      if (this.trueWindHistoric[i].timestamp < n) {
        this.trueWindHistoric.splice(i,1);
      }
    }
  }

  stopWindSectors() {
    this.windSectorObservableSub.unsubscribe();
  }

  unsubscribeHeading() {
    if (this.headingSub !== null) {
      this.headingSub.unsubscribe();
      this.headingSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['headingPath'].path);
    }
  }

  unsubscribeAppWindAngle() {
    if (this.appWindAngleSub !== null) {
      this.appWindAngleSub.unsubscribe();
      this.appWindAngleSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['appWindAngle'].path);
    }
  }

  unsubscribeAppWindSpeed() {
    if (this.appWindSpeedSub !== null) {
      this.appWindSpeedSub.unsubscribe();
      this.appWindSpeedSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['appWindSpeed'].path);
    }
  }

  unsubscribeTrueWindAngle() {
    if (this.trueWindAngleSub !== null) {
      this.trueWindAngleSub.unsubscribe();
      this.trueWindAngleSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['trueWindAngle'].path);
    }
  }

  unsubscribeTrueWindSpeed() {
    if (this.trueWindSpeedSub !== null) {
      this.trueWindSpeedSub.unsubscribe();
      this.trueWindSpeedSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['trueWindSpeed'].path);
    }
  }




  addHeading(h1: number, h2: number) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }









  openWidgetSettings() {


    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.log(result);
        this.stopAll();//unsub now as we will change variables so wont know what was subbed before...
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.startAll();
      }

    });
  }

}
