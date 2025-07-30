import { Component, OnInit, OnDestroy, NgZone, inject, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SvgRacesteerComponent } from '../svg-racesteer/svg-racesteer.component';


@Component({
    selector: 'widget-racesteer',
    templateUrl: './widget-racesteer.component.html',
    imports: [ SvgRacesteerComponent, WidgetHostComponent ]
})
export class WidgetRacesteerComponent extends BaseWidgetComponent implements OnInit, OnDestroy  {
  private zones = inject(NgZone);
  protected currentHeading = signal<number>(0);
  protected tackTrue = signal<number>(0);
  protected polarSpeedRatio = signal<number>(null);
  protected trueWindAngle = signal<number>(0);
  protected trueWindSpeed = signal<number>(0);
  protected targetAngle = signal<number>(0);
  protected optimalWindAngle = signal<number>(0);
  protected targetVMG = signal<number>(0);
  protected VMG = signal<number>(0);
  protected driftFlow = signal<number>(0);
  protected driftSet = signal<number>(0);
  protected waypointAngle = signal<number>(0);
  protected vmgToWaypoint = signal<number>(0);
  protected gradianColor = signal<{ start: string; stop: string } | undefined>(undefined);
  protected historicalWindDirection: {
    timestamp: number;
    windDirection: number;
  }[] = [];
  protected trueWindMinHistoric = signal<number>(0);
  protected trueWindMidHistoric = signal<number>(0);
  protected trueWindMaxHistoric = signal<number>(0);
  private windSectorObservableSub: Subscription = null;

  constructor() {
    super();

    this.defaultConfig = {
      filterSelfPaths: true,
      paths: {
        "headingPath": {
          description: "True Heading",
          path: 'self.navigation.headingTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          showConvertUnitTo: false,
          sampleTime: 1000
        },
        "tackTrue": {
          description: "True Tack",
          path: 'self.performance.tackTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: false,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          showConvertUnitTo: false,
          convertUnitTo: "deg",
          sampleTime: 0
        },
        "windAngleTrueWaterDamped": {
          description: "Wind Angle True Water Damped",
          path: 'self.environment.wind.angleTrueWaterDamped',
          source: 'default',
          pathType: "number",
          isPathConfigurable: false,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          showConvertUnitTo: false,
          sampleTime: 0
        },
        "trueWindSpeed": {
          description: "True Wind Speed",
          path: 'self.environment.wind.speedTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'm/s',
          convertUnitTo: "knots",
          sampleTime: 0
        },
        "polarSpeedRatio": {
          description: "Polar Speed Ratio",
          path: "self.performance.polarSpeedRatio",
          source: "default",
          pathType: "number",
          isPathConfigurable: false,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          showConvertUnitTo: false,
          convertUnitTo: "ratio",
          sampleTime: 0
        },
        "targetAngle": {
          description: "Target Angle",
          path: "self.performance.targetAngle",
          source: "default",
          pathType: "number",
          isPathConfigurable: false,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          showConvertUnitTo: false,
          convertUnitTo: "deg",
          sampleTime: 0
        },
        "optimalWindAngle": {
          description: "Optimal Wind Angle",
          path: "self.performance.optimumWindAngle",
          source: "default",
          pathType: "number",
          isPathConfigurable: false,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          showConvertUnitTo: false,
          convertUnitTo: "deg",
          sampleTime: 0
        },
        "targetVMG": {
          description: "Target Velocity Made Good",
          path: "self.performance.targetVelocityMadeGood",
          source: "default",
          pathType: "number",
          isPathConfigurable: false,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          showConvertUnitTo: false,
          convertUnitTo: "knots",
          sampleTime: 0
        },
        "VMG": {
          description: "Velocity Made Good",
          path: "self.performance.velocityMadeGood",
          source: "default",
          pathType: "number",
          isPathConfigurable: false,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          showConvertUnitTo: false,
          convertUnitTo: "knots",
          sampleTime: 0
        },
        "nextWaypointBearing": {
          description: "Next Waypoint True Bearing",
          path: 'self.navigation.courseGreatCircle.nextPoint.bearingTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: false,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          showConvertUnitTo: false,
          sampleTime: 1000
        },
        "vmgToWaypoint": {
          description: "Velocity Made Good to Waypoint",
          path: 'self.performance.velocityMadeGoodToWaypoint',
          source: 'default',
          pathType: "number",
          isPathConfigurable: false,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          convertUnitTo: "knots",
          showConvertUnitTo: false,
          sampleTime: 1000
        },
        "set": {
          description: "True Drift Set",
          path: 'self.environment.current.setTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          showConvertUnitTo: false,
          sampleTime: 1000
        },
        "drift": {
          description: "Drift Speed Impact",
          path: 'self.environment.current.drift',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'm/s',
          convertUnitTo: "knots",
          sampleTime: 1000
        }
      },
      windSectorWindowSeconds: 5,
      laylineAngle: 40,
      waypointEnable: true,
      driftEnable: true,
      sailSetupEnable: false,
      enableTimeout: false,
      dataTimeout: 5
    };
   }

  ngOnInit(): void {
    this.validateConfig();
    this.startWidget();
    this.gradianColor.set({start: this.theme().blue, stop: this.theme().green});
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.stopWindSectors();

    this.observeDataStream('headingPath', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.currentHeading.set(newValue.data.value);
    });

    this.observeDataStream('windAngleTrueWaterDamped', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.trueWindAngle.set(this.addHeading(this.currentHeading(), newValue.data.value));
      const to360Angle =  this.addHeading(this.currentHeading(), newValue.data.value);
      this.addHistoricalWindDirection(to360Angle);
    });

    this.observeDataStream('trueWindSpeed', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.trueWindSpeed.set(90);//newValue.data.value);
    });

    this.observeDataStream('tackTrue', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.tackTrue.set(Math.round(newValue.data.value));
    });

    this.observeDataStream('nextWaypointBearing', newValue => {
      const value = newValue.data.value;
      const waypointAngle = value < 0 ? 360 + value : value;
      this.waypointAngle.set(Math.round(this.addHeading(-this.currentHeading(), waypointAngle)));
    });

    this.observeDataStream('vmgToWaypoint', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.vmgToWaypoint.set(newValue.data.value.toFixed(1));
    });

    this.observeDataStream('polarSpeedRatio', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.polarSpeedRatio.set(newValue.data.value);
    });

    this.observeDataStream('targetAngle', newValue => {
      const value = newValue.data.value;
      const targetAngle = value < 0 ? 360 + value : value;
      this.targetAngle.set(targetAngle);
    });

    this.observeDataStream('optimalWindAngle', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.optimalWindAngle.set(newValue.data.value);
    });

    this.observeDataStream('targetVMG', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.targetVMG.set(newValue.data.value.toFixed(1));
    });

    this.observeDataStream('VMG', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.VMG.set(newValue.data.value.toFixed(1));
    });

    this.observeDataStream('drift', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
        newValue.data.value = 0;
      }
      this.driftFlow.set(newValue.data.value);
    });

    this.observeDataStream('set', newValue => {
      if (newValue.data.value == null) { // act upon data timeout of null
          newValue.data.value = 0
      }
      this.driftSet.set(this.addHeading(-this.currentHeading(), newValue.data.value));
    });

    this.startWindSectors();
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }
  private startWindSectors() {
    this.zones.runOutsideAngular(() => {
      this.windSectorObservableSub = interval(500).subscribe(() => {
        this.historicalCleanup();
      });
    });
  }

  private addHistoricalWindDirection(windDirection: number) {
    this.historicalWindDirection.push({
      timestamp: Date.now(),
      windDirection: windDirection
    });
    const arc = this.arcForAngles(this.historicalWindDirection.map(d => d.windDirection));
    this.trueWindMinHistoric.set(arc.min);
    this.trueWindMaxHistoric.set(arc.max);
    this.trueWindMidHistoric.set(arc.mid);
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
    this.historicalWindDirection = this.historicalWindDirection.filter(d => d.timestamp >= n);
  }

  private stopWindSectors() {
    this.windSectorObservableSub?.unsubscribe();
  }

  private addHeading(h1: number, h2: number) {
    let h3 = (h1 + h2) % 360;
    if (h3 < 0) h3 += 360;
    return h3;
  }

  ngOnDestroy() {
    this.destroyDataStreams();
    this.stopWindSectors();
  }

}
