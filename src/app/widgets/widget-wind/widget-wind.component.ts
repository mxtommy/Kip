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
          description: "True Wind Speed",
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
        // Depending on path, this number can either be an absolute 360 deg value
        // or a +/-180 deg value relative to boat - usually includes the word angle.
        // 1 to 180 for stb
        // -1 to -180 for port
        // The display dial needs the value in 0-360
        const path = this.widgetProperties.config.paths['trueWindAngle'].path;
        if (path.includes('angleTrueWater') || path.includes('angleTrueGround')) {
          //-180 to 180, we need to account for boat heading
          this.trueWindAngle = this.addHeading(this.currentHeading, newValue.data.value);
        } else {
          // Other path, assume it's an absolute 360 angle
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
    const arc = this.arcForAngles(this.trueWindHistoric.map(d => d.heading));
    this.trueWindMinHistoric = arc.min;
    this.trueWindMaxHistoric = arc.max;
    this.trueWindMidHistoric = arc.mid;
  }

  private arcForAngles(data: number[]): { min: number; max: number; mid: number } {
    if (!data || data.length === 0) {
      return { min: 0, max: 0, mid: 0 };
    }
    const result = data.slice(1).reduce(
      (acc, theValue) => {
        let value = theValue;
        while (value < acc.min - 180) {
          value += 360;
        }
        while (value > acc.max + 180) {
          value -= 360;
        }
        acc.min = Math.min(acc.min, value);
        acc.max = Math.max(acc.max, value);
        acc.mid = ((acc.max - acc.min) / 2) + acc.min;
        return acc;
      },
      { min: data[0], max: data[0], mid: data[0] }
    );
    return result;
  }

  private historicalCleanup() {
    const n = Date.now() - (this.widgetProperties.config.windSectorWindowSeconds * 1000);
    this.trueWindHistoric = this.trueWindHistoric.filter(d => d.timestamp >= n);
  }

  private stopWindSectors() {
    this.windSectorObservableSub?.unsubscribe();
  }

  private addHeading(h1: number, h2: number) {
    let h3 = (h1 + h2) % 360;
    if (h3 < 0) h3 += 360;
    return h3;
  }
}
