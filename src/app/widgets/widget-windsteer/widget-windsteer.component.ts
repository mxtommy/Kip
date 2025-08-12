import { Component, OnInit, OnDestroy, NgZone, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SvgWindsteerComponent } from '../svg-windsteer/svg-windsteer.component';


@Component({
  selector: 'widget-wind-steer',
  templateUrl: './widget-windsteer.component.html',
  imports: [SvgWindsteerComponent, WidgetHostComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetWindComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  private zones = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);
  private markScheduled = false;
  private scheduleRafId: number | null = null;
  private readonly DEG_EPSILON = 1;      // degrees
  private readonly SPEED_EPSILON = 0.1;  // knots
  private hasHeading = false;
  private hasCOG = false;
  private hasAWA = false;
  private hasAWS = false;
  private hasTWA = false;
  private hasTWS = false;
  private hasSet = false;
  private hasDrift = false;
  private hasWPT = false;
  protected currentHeading = 0;
  protected courseOverGroundAngle = 0;
  protected appWindAngle = 0;
  protected appWindSpeed = 0;
  protected appWindSpeedUnit = '';
  protected trueWindAngle = 0;
  protected trueWindSpeed = 0;
  protected trueWindSpeedUnit = '';
  protected driftFlow = 0;
  protected driftSet = 0;
  protected waypointAngle = 0;
  protected historicalWindDirection: {
    timestamp: number;
    windDirection: number;
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
          description: "True Heading",
          path: 'self.navigation.headingTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          showConvertUnitTo: false,
          sampleTime: 1000
        },
        "appWindAngle": {
          description: "Apparent Wind Angle",
          path: 'self.environment.wind.angleApparent',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          convertUnitTo: "deg",
          showConvertUnitTo: false,
          sampleTime: 1000
        },
        "appWindSpeed": {
          description: "Apparent Wind Speed",
          path: 'self.environment.wind.speedApparent',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          pathRequired: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'm/s',
          convertUnitTo: "knots",
          sampleTime: 1000
        },
        "trueWindAngle": {
          description: "True Wind Angle",
          path: 'self.environment.wind.angleTrueWater',
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
        "trueWindSpeed": {
          description: "True Wind Speed",
          path: 'self.environment.wind.speedTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'm/s',
          convertUnitTo: "knots",
          sampleTime: 1000
        },
        "courseOverGround": {
          description: "True Course Over Ground",
          path: 'self.navigation.courseOverGroundTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          pathRequired: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          showConvertUnitTo: false,
          convertUnitTo: "deg",
          sampleTime: 1000
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
      windSectorEnable: true,
      windSectorWindowSeconds: 5,
      laylineEnable: true,
      laylineAngle: 40,
      waypointEnable: true,
      courseOverGroundEnable: true,
      driftEnable: true,
      awsEnable: true,
      twsEnable: true,
      twaEnable: true,
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
    const desiredAwsUnit = this.widgetProperties.config.paths['appWindSpeed'].convertUnitTo;
    const desiredTwsUnit = this.widgetProperties.config.paths['trueWindSpeed'].convertUnitTo;
    if (this.appWindSpeedUnit !== desiredAwsUnit) this.appWindSpeedUnit = desiredAwsUnit;
    if (this.trueWindSpeedUnit !== desiredTwsUnit) this.trueWindSpeedUnit = desiredTwsUnit;
    // Subscribe to streams outside Angular to avoid triggering Change Detection per emission
    this.zones.runOutsideAngular(() => {
      this.observeDataStream('headingPath', newValue => {
        if (newValue.data.value == null) { newValue.data.value = 0; }
        const next = this.normalizeAngle(newValue.data.value);
        if (!this.hasHeading || this.angleDelta(this.currentHeading, next) >= this.DEG_EPSILON) {
          this.currentHeading = next;
          this.hasHeading = true;
          this.scheduleMarkForCheck();
        }
      });

      this.observeDataStream('courseOverGround', newValue => {
        if (newValue.data.value == null) { newValue.data.value = 0; }
        const next = this.normalizeAngle(newValue.data.value);
        if (!this.hasCOG || this.angleDelta(this.courseOverGroundAngle, next) >= this.DEG_EPSILON) {
          this.courseOverGroundAngle = next;
          this.hasCOG = true;
          this.scheduleMarkForCheck();
        }
      });

      this.observeDataStream('drift', newValue => {
        if (newValue.data.value == null) { newValue.data.value = 0; }
        const next = newValue.data.value;
        if (!this.hasDrift || Math.abs(this.driftFlow - next) >= this.SPEED_EPSILON) {
          this.driftFlow = next;
          this.hasDrift = true;
          this.scheduleMarkForCheck();
        }
      });

      this.observeDataStream('set', newValue => {
        if (newValue.data.value == null) { newValue.data.value = 0; }
        const next = this.normalizeAngle(newValue.data.value);
        if (!this.hasSet || this.angleDelta(this.driftSet, next) >= this.DEG_EPSILON) {
          this.driftSet = next;
          this.hasSet = true;
          this.scheduleMarkForCheck();
        }
      });

      this.observeDataStream('nextWaypointBearing', newValue => {
        const raw = newValue.data.value;
        const next = this.normalizeAngle(raw);
        if (!this.hasWPT || this.angleDelta(this.waypointAngle, next) >= this.DEG_EPSILON) {
          this.waypointAngle = next;
          this.hasWPT = true;
          this.scheduleMarkForCheck();
        }
      });

      this.observeDataStream('appWindAngle', newValue => {
        if (newValue.data.value == null) { newValue.data.value = 0; }
        const raw = newValue.data.value;
        const next = this.normalizeAngle(raw);
        if (!this.hasAWA || this.angleDelta(this.appWindAngle, next) >= this.DEG_EPSILON) {
          this.appWindAngle = next;
          this.hasAWA = true;
          if (this.widgetProperties.config.windSectorEnable) {
            const to360Angle = this.addHeading(this.currentHeading, raw);
            this.addHistoricalWindDirection(to360Angle);
          }
          this.scheduleMarkForCheck();
        }
      });

      this.observeDataStream('appWindSpeed', newValue => {
        if (newValue.data.value == null) { newValue.data.value = 0; }
        const next = newValue.data.value;
        if (!this.hasAWS || Math.abs(this.appWindSpeed - next) >= this.SPEED_EPSILON) {
          this.appWindSpeed = next;
          this.hasAWS = true;
          this.scheduleMarkForCheck();
        }
      });

      this.observeDataStream('trueWindSpeed', newValue => {
        if (newValue.data.value == null) { newValue.data.value = 0; }
        const next = newValue.data.value;
        if (!this.hasTWS || Math.abs(this.trueWindSpeed - next) >= this.SPEED_EPSILON) {
          this.trueWindSpeed = next;
          this.hasTWS = true;
          this.scheduleMarkForCheck();
        }
      });

      this.observeDataStream('trueWindAngle', newValue => {
        if (newValue.data.value == null) { newValue.data.value = 0; }
        const path = this.widgetProperties.config.paths['trueWindAngle'].path;
        const base = (path.includes('angleTrueWater') || path.includes('angleTrueGround'))
          ? this.addHeading(this.currentHeading, newValue.data.value)
          : newValue.data.value;
        const next = this.normalizeAngle(base);
        if (!this.hasTWA || this.angleDelta(this.trueWindAngle, next) >= this.DEG_EPSILON) {
          this.trueWindAngle = next;
          this.hasTWA = true;
          this.scheduleMarkForCheck();
        }
      });
    });

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
      this.windSectorObservableSub = interval(1000).subscribe(() => {
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
    this.trueWindMinHistoric = arc.min;
    this.trueWindMaxHistoric = arc.max;
    this.trueWindMidHistoric = arc.mid;
    this.scheduleMarkForCheck();
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
    this.scheduleMarkForCheck();
  }

  private stopWindSectors() {
    this.windSectorObservableSub?.unsubscribe();
  }

  // Normalize any angle to [0,360)
  private normalizeAngle(a: number): number {
    return ((a % 360) + 360) % 360;
  }

  private addHeading(h1: number, h2: number) {
    let h3 = (h1 + h2) % 360;
    if (h3 < 0) h3 += 360;
    return h3;
  }

  // Smallest absolute angular difference (0..180)
  private angleDelta(from: number, to: number): number {
    const d = ((to - from + 540) % 360) - 180;
    return Math.abs(d);
  }

  // Coalesce multiple updates into a single markForCheck per animation frame
  private scheduleMarkForCheck() {
    if (this.markScheduled) return;
    this.markScheduled = true;
    this.zones.runOutsideAngular(() => {
      this.scheduleRafId = requestAnimationFrame(() => {
        this.zones.run(() => {
          this.cdr.markForCheck();
        });
        this.markScheduled = false;
        this.scheduleRafId = null;
      });
    });
  }
}
