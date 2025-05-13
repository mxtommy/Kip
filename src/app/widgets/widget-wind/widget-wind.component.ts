import { Component, OnInit, OnDestroy, NgZone, inject } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SvgWindComponent } from '../svg-wind/svg-wind.component';


@Component({
    selector: 'widget-wind-steer',
    templateUrl: './widget-wind.component.html',
    standalone: true,
    imports: [ SvgWindComponent, WidgetHostComponent ]
})
export class WidgetWindComponent extends BaseWidgetComponent implements OnInit, OnDestroy  {
  private zones = inject(NgZone);
  protected currentHeading: number = 0;
  protected courseOverGroundAngle: number = 0;
  protected appWindAngle: number = 0;
  protected appWindSpeed: number = 0;
  protected trueWindAngle: number = 0;
  protected trueWindSpeed: number = 0;
  protected driftFlow: number = 0;
  protected driftSet: number = 0;
  protected waypointAngle: number = 0;
  protected trueWindHistoric: {
    timestamp: number;
    heading: number;
  }[] = [];
  protected trueWindMinHistoric: number;
  protected trueWindMidHistoric: number;
  protected trueWindMaxHistoric: number;

  private windSectorObservableSub: Subscription = null;

  constructor() {
    super();

    this.defaultConfig = {
      filterSelfPaths: true,
      paths: {
        "headingPath": {
          description: "Heading True",
          path: 'self.navigation.headingTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 500
        },
        "courseOverGround": {
          description: "Course Over Ground True",
          path: 'self.navigation.courseOverGroundTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 500
        },
        "trueWindAngle": {
          description: "True Wind Angle",
          path: 'self.environment.wind.angleTrueWater',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 500
        },
        "trueWindSpeed": {
          description: "Wind Speed True",
          path: 'self.environment.wind.speedTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'm/s',
          convertUnitTo: "knots",
          sampleTime: 500
        },
        "appWindAngle": {
          description: "Apparent Wind Angle",
          path: 'self.environment.wind.angleApparent',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 500
        },
        "appWindSpeed": {
          description: "Apparent Wind Speed",
          path: 'self.environment.wind.speedApparent',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'm/s',
          convertUnitTo: "knots",
          sampleTime: 500
        },
        "set": {
          description: "Drift Set True",
          path: 'self.environment.current.setTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 500
        },
        "drift": {
          description: "Drift Speed Impact",
          path: 'self.environment.current.drift',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'm/s',
          convertUnitTo: "knots",
          sampleTime: 500
        },
        "nextWaypointBearing": {
          description: "Next Waypoint Bearing",
          path: 'self.navigation.courseGreatCircle.nextPoint.bearingTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          sampleTime: 500
        },
      },
      windSectorEnable: true,
      windSectorWindowSeconds: 5,
      laylineEnable: true,
      laylineAngle: 40,
      waypointEnable: true,
      courseOverGroundEnable: true,
      driftEnable: true,
      awsEnable: true,
      twsEnable: true,
      sailSetupEnable: false,
      enableTimeout: false,
      dataTimeout: 5
    };
   }

  ngOnInit(): void {
    this.validateConfig();
    this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.stopWindSectors();

    this.observeDataStream('headingPath', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.currentHeading = newValue.data.value;
    });

    this.observeDataStream('courseOverGround', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.courseOverGroundAngle = newValue.data.value;
    });

    this.observeDataStream('drift', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.driftFlow = newValue.data.value;
    });

    this.observeDataStream('set', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
          newValue.data.value = 0
      }
      this.driftSet = newValue.data.value;
    });

    this.observeDataStream('nextWaypointBearing', newValue => {
      if (newValue.data.value < 0) {// stb
        this.waypointAngle = 360 + newValue.data.value; // adding a negative number subtracts it...
      } else {
        this.waypointAngle = newValue.data.value;
      }
    });

    this.observeDataStream('appWindAngle', newValue => {
        if (newValue.data.value == null) { // act upon data timeout of null
          newValue.data.value = 0
        }
        if (newValue.data.value < 0) {// stb
          this.appWindAngle = 360 + newValue.data.value; // adding a negative number subtracts it...
        } else {
          this.appWindAngle = newValue.data.value;
        }
      }
    );

    this.observeDataStream('appWindSpeed', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.appWindSpeed = newValue.data.value;
    });

    this.observeDataStream('trueWindSpeed', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.trueWindSpeed = newValue.data.value;
    });

    this.observeDataStream('trueWindAngle', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
        // Depending on path, this number can either be the magnetic compass heading, true compass heading, or heading relative to boat heading (-180 to 180deg)... Ugh...
          // 0-180+ for stb
          // -0 to -180 for port
          // need in 0-360
        if (this.widgetProperties.config.paths['trueWindAngle'].path.match('angleTrueWater')||
        this.widgetProperties.config.paths['trueWindAngle'].path.match('angleTrueGround')) {
          //-180 to 180
          this.trueWindAngle = this.addHeading(this.currentHeading, newValue.data.value);
        } else if (this.widgetProperties.config.paths['trueWindAngle'].path.match('direction')) {
          //0-360
          this.trueWindAngle = newValue.data.value;
        } else {
          // some other path... assume it's the angle
          this.trueWindAngle = newValue.data.value;
        }

        //add to historical for wind sectors
        if (this.widgetProperties.config.windSectorEnable) {
          this.addHistoricalTrue(this.trueWindAngle);
        }
      }
    );

    this.startWindSectors();
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  ngOnDestroy() {
    this.destroyDataStreams();
    this.stopWindSectors();
  }

  private startWindSectors() {
    this.zones.runOutsideAngular(() => {
      this.windSectorObservableSub = interval(500).subscribe(x => {
        this.historicalCleanup();
      });
    });
  }

  private addHistoricalTrue (windHeading: number) {
    this.trueWindHistoric.push({
      timestamp: Date.now(),
      heading: windHeading
    });
    let arr = this.arcForAngles(this.trueWindHistoric.map(d => d.heading));
    this.trueWindMinHistoric = arr[0];
    this.trueWindMaxHistoric = arr[1];
    this.trueWindMidHistoric = arr[2];
  }

  private arcForAngles (data) {
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

  private historicalCleanup() {
    let n = Date.now()-(this.widgetProperties.config.windSectorWindowSeconds*1000);
    for (let i = this.trueWindHistoric.length - 1; i >= 0; --i) {
      if (this.trueWindHistoric[i].timestamp < n) {
        this.trueWindHistoric.splice(i,1);
      }
    }
  }

  private stopWindSectors() {
    this.windSectorObservableSub?.unsubscribe();
  }

  private addHeading(h1: number, h2: number) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }
}
