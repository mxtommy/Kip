import { Component, OnDestroy, NgZone, inject, ChangeDetectionStrategy, ChangeDetectorRef, input, effect, untracked, signal } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SvgWindsteerComponent } from '../svg-windsteer/svg-windsteer.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { IPathUpdate } from '../../core/services/data.service';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-wind-steer',
  templateUrl: './widget-windsteer.component.html',
  imports: [SvgWindsteerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetWindComponent implements OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme|null>();

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    filterSelfPaths: true,
    paths: {
      headingPath: {
        description: 'True Heading',
        path: 'self.navigation.headingTrue',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        pathRequired: true,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad',
        convertUnitTo: 'deg',
        showConvertUnitTo: false,
        sampleTime: 1000
      },
      appWindAngle: {
        description: 'Apparent Wind Angle',
        path: 'self.environment.wind.angleApparent',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        pathRequired: true,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad',
        convertUnitTo: 'deg',
        showConvertUnitTo: false,
        sampleTime: 1000
      },
      appWindSpeed: {
        description: 'Apparent Wind Speed',
        path: 'self.environment.wind.speedApparent',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        pathRequired: true,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s',
        convertUnitTo: 'knots',
        sampleTime: 1000
      },
      trueWindAngle: {
        description: 'True Wind Angle',
        path: 'self.environment.wind.angleTrueWater',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        pathRequired: false,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad',
        convertUnitTo: 'deg',
        showConvertUnitTo: false,
        sampleTime: 1000
      },
      trueWindSpeed: {
        description: 'True Wind Speed',
        path: 'self.environment.wind.speedTrue',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        pathRequired: false,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s',
        convertUnitTo: 'knots',
        sampleTime: 1000
      },
      courseOverGround: {
        description: 'True Course Over Ground',
        path: 'self.navigation.courseOverGroundTrue',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        pathRequired: false,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad',
        showConvertUnitTo: false,
        convertUnitTo: 'deg',
        sampleTime: 1000
      },
      nextWaypointBearing: {
        description: 'Next Waypoint True Bearing',
        path: 'self.navigation.courseGreatCircle.nextPoint.bearingTrue',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: false,
        pathRequired: false,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad',
        convertUnitTo: 'deg',
        showConvertUnitTo: false,
        sampleTime: 1000
      },
      set: {
        description: 'True Drift Set',
        path: 'self.environment.current.setTrue',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        pathRequired: false,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad',
        convertUnitTo: 'deg',
        showConvertUnitTo: false,
        sampleTime: 1000
      },
      drift: {
        description: 'Drift Speed Impact',
        path: 'self.environment.current.drift',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        pathRequired: false,
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s',
        convertUnitTo: 'knots',
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

  public readonly runtime = inject(WidgetRuntimeDirective); // accessed in template
  private readonly stream = inject(WidgetStreamsDirective);
  private zones = inject(NgZone);
  private cdr = inject(ChangeDetectorRef);

  // Removed local registeredPaths guard; rely on WidgetStreamsDirective diff + idempotent observe() with stable callbacks

  private hasHeading = false;
  private hasCOG = false;
  private hasAWA = false;
  private hasAWS = false;
  private hasTWA = false;
  private hasTWS = false;
  private hasSet = false;
  private hasDrift = false;
  private hasWPT = false;

  protected currentHeading = signal(0);
  protected courseOverGroundAngle = signal(0);
  protected appWindAngle = signal(0);
  protected appWindSpeed = signal(0);
  protected appWindSpeedUnit = signal('');
  protected trueWindAngle = signal(0);
  protected trueWindSpeed = signal(0);
  protected trueWindSpeedUnit = signal('');
  protected driftFlow = signal(0);
  protected driftSet = signal(0);
  protected waypointAngle = signal(0);
  protected historicalWindDirection: { timestamp: number; windDirection: number; }[] = [];
  protected trueWindMinHistoric = signal<number | undefined>(undefined);
  protected trueWindMidHistoric = signal<number | undefined>(undefined);
  protected trueWindMaxHistoric = signal<number | undefined>(undefined);

  private windSectorObservableSub: Subscription = null;

  private windSamples: { t: number; u: number; i: number }[] = [];
  private windMinDeque: { i: number; u: number }[] = [];
  private windMaxDeque: { i: number; u: number }[] = [];
  private windSampleIndex = 0;
  private lastUnwrapped: number | null = null;
  private lastSector: { min?: number; mid?: number; max?: number } = {};

  private markScheduled = false;
  private scheduleRafId: number | null = null;
  private readonly DEG_EPSILON = 1;      // degrees
  private readonly SPEED_EPSILON = 0.1;  // knots

  constructor() {
    // Stable stream callbacks registered via effect; directive handles diffing
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      untracked(() => {
        this.appWindSpeedUnit.set(cfg.paths['appWindSpeed'].convertUnitTo);
        this.trueWindSpeedUnit.set(cfg.paths['trueWindSpeed'].convertUnitTo);
        this.registerStreams();
        this.stopWindSectors();
        this.startWindSectors();
      });
    });
  }

  // Stable callbacks -------------------------------------------------
  private onHeadingUpdate = (u: IPathUpdate) => {
    if (u.data.value == null) u.data.value = 0;
    const next = this.normalizeAngle(u.data.value);
    if (!this.hasHeading || this.angleDelta(this.currentHeading(), next) >= this.DEG_EPSILON) {
      this.currentHeading.set(next); this.hasHeading = true; this.scheduleMarkForCheck();
    }
  };
  private onCOGUpdate = (u: IPathUpdate) => {
    if (u.data.value == null) u.data.value = 0;
    const next = this.normalizeAngle(u.data.value);
    if (!this.hasCOG || this.angleDelta(this.courseOverGroundAngle(), next) >= this.DEG_EPSILON) {
      this.courseOverGroundAngle.set(next); this.hasCOG = true; this.scheduleMarkForCheck();
    }
  };
  private onDriftUpdate = (u: IPathUpdate) => {
    if (u.data.value == null) u.data.value = 0;
    const next = u.data.value;
    if (!this.hasDrift || Math.abs(this.driftFlow() - next) >= this.SPEED_EPSILON) {
      this.driftFlow.set(next); this.hasDrift = true; this.scheduleMarkForCheck();
    }
  };
  private onSetUpdate = (u: IPathUpdate) => {
    if (u.data.value == null) u.data.value = 0;
    const next = this.normalizeAngle(u.data.value);
    if (!this.hasSet || this.angleDelta(this.driftSet(), next) >= this.DEG_EPSILON) {
      this.driftSet.set(next); this.hasSet = true; this.scheduleMarkForCheck();
    }
  };
  private onWaypointUpdate = (u: IPathUpdate) => {
    const raw = u.data.value;
    const next = this.normalizeAngle(raw);
    if (!this.hasWPT || this.angleDelta(this.waypointAngle(), next) >= this.DEG_EPSILON) {
      this.waypointAngle.set(next); this.hasWPT = true; this.scheduleMarkForCheck();
    }
  };
  private onAppWindAngle = (u: IPathUpdate) => {
    if (u.data.value == null) u.data.value = 0;
    const raw = u.data.value;
    const next = this.normalizeAngle(raw);
    if (!this.hasAWA || this.angleDelta(this.appWindAngle(), next) >= this.DEG_EPSILON) {
      this.appWindAngle.set(next); this.hasAWA = true;
      const cfg = this.runtime.options();
      if (cfg?.windSectorEnable) this.addHistoricalWindDirection(this.normalizeAngle(raw));
      this.scheduleMarkForCheck();
    }
  };
  private onAppWindSpeed = (u: IPathUpdate) => {
    if (u.data.value == null) u.data.value = 0;
    const next = u.data.value;
    if (!this.hasAWS || Math.abs(this.appWindSpeed() - next) >= this.SPEED_EPSILON) {
      this.appWindSpeed.set(next); this.hasAWS = true; this.scheduleMarkForCheck();
    }
  };
  private onTrueWindSpeed = (u: IPathUpdate) => {
    if (u.data.value == null) u.data.value = 0;
    const next = u.data.value;
    if (!this.hasTWS || Math.abs(this.trueWindSpeed() - next) >= this.SPEED_EPSILON) {
      this.trueWindSpeed.set(next); this.hasTWS = true; this.scheduleMarkForCheck();
    }
  };
  private onTrueWindAngle = (u: IPathUpdate) => {
    if (u.data.value == null) u.data.value = 0;
    const cfg = this.runtime.options();
    const path = cfg?.paths['trueWindAngle'].path || '';
    const base = (path.includes('angleTrueWater') || path.includes('angleTrueGround')) ? this.addHeading(this.currentHeading(), u.data.value) : u.data.value;
    const next = this.normalizeAngle(base);
    if (!this.hasTWA || this.angleDelta(this.trueWindAngle(), next) >= this.DEG_EPSILON) {
      this.trueWindAngle.set(next); this.hasTWA = true; this.scheduleMarkForCheck();
    }
  };

  private registerStreams() {
    const cfg = this.runtime.options();
    if (!cfg) return;
    this.zones.runOutsideAngular(() => {
      this.stream.observe('headingPath', this.onHeadingUpdate);
      this.stream.observe('courseOverGround', this.onCOGUpdate);
      this.stream.observe('drift', this.onDriftUpdate);
      this.stream.observe('set', this.onSetUpdate);
      this.stream.observe('nextWaypointBearing', this.onWaypointUpdate);
      this.stream.observe('appWindAngle', this.onAppWindAngle);
      this.stream.observe('appWindSpeed', this.onAppWindSpeed);
      this.stream.observe('trueWindSpeed', this.onTrueWindSpeed);
      this.stream.observe('trueWindAngle', this.onTrueWindAngle);
    });
  }

  ngOnDestroy() {
    this.stopWindSectors();
    if (this.scheduleRafId != null) {
      cancelAnimationFrame(this.scheduleRafId);
      this.scheduleRafId = null;
    }
  }

  private startWindSectors() {
    this.windSamples = [];
    this.windMinDeque = [];
    this.windMaxDeque = [];
    this.windSampleIndex = 0;
    this.lastUnwrapped = null;
    this.lastSector = {};

    if (!this.runtime.options()?.windSectorEnable) {
      this.trueWindMinHistoric.set(undefined);
      this.trueWindMidHistoric.set(undefined);
      this.trueWindMaxHistoric.set(undefined);
      this.lastSector = {};
      this.scheduleMarkForCheck();
      return;
    }

    this.zones.runOutsideAngular(() => {
      this.windSectorObservableSub = interval(1000).subscribe(() => {
        this.historicalCleanup();
      });
    });
  }

  private addHistoricalWindDirection(absAngle: number) {
    const now = Date.now();
    const u = this.unwrapAngle(absAngle);
    const i = this.windSampleIndex++;
    this.windSamples.push({ t: now, u, i });
    while (this.windMinDeque.length && this.windMinDeque[this.windMinDeque.length - 1].u >= u) {
      this.windMinDeque.pop();
    }
    this.windMinDeque.push({ i, u });
    while (this.windMaxDeque.length && this.windMaxDeque[this.windMaxDeque.length - 1].u <= u) {
      this.windMaxDeque.pop();
    }
    this.windMaxDeque.push({ i, u });
  }

  private historicalCleanup() {
    if (!this.runtime.options()?.windSectorEnable) return;
    const cutoff = Date.now() - (this.runtime.options().windSectorWindowSeconds * 1000);
    while (this.windSamples.length && this.windSamples[0].t < cutoff) {
      const removed = this.windSamples.shift();
      if (!removed) break;
      if (this.windMinDeque.length && this.windMinDeque[0].i === removed.i) this.windMinDeque.shift();
      if (this.windMaxDeque.length && this.windMaxDeque[0].i === removed.i) this.windMaxDeque.shift();
    }

    if (!this.windSamples.length || !this.windMinDeque.length || !this.windMaxDeque.length) {
      if (this.trueWindMinHistoric() !== undefined || this.trueWindMidHistoric() !== undefined || this.trueWindMaxHistoric() !== undefined) {
        this.trueWindMinHistoric.set(undefined);
        this.trueWindMidHistoric.set(undefined);
        this.trueWindMaxHistoric.set(undefined);
        this.lastSector = {};
        this.scheduleMarkForCheck();
      }
      return;
    }

    const minU = this.windMinDeque[0].u;
    const maxU = this.windMaxDeque[0].u;
    const midU = (minU + maxU) / 2;
    const nextMin = this.normalizeAngle(minU);
    const nextMid = this.normalizeAngle(midU);
    const nextMax = this.normalizeAngle(maxU);
    const changed =
      this.lastSector.min === undefined || this.angleDelta(this.lastSector.min!, nextMin) >= this.DEG_EPSILON ||
      this.lastSector.mid === undefined || this.angleDelta(this.lastSector.mid!, nextMid) >= this.DEG_EPSILON ||
      this.lastSector.max === undefined || this.angleDelta(this.lastSector.max!, nextMax) >= this.DEG_EPSILON;
    if (changed) {
      this.trueWindMinHistoric.set(nextMin);
      this.trueWindMidHistoric.set(nextMid);
      this.trueWindMaxHistoric.set(nextMax);
      this.lastSector = { min: nextMin, mid: nextMid, max: nextMax };
      this.scheduleMarkForCheck();
    }
  }

  private stopWindSectors() {
    this.windSectorObservableSub?.unsubscribe();
  }

  private unwrapAngle(a: number): number {
    if (this.lastUnwrapped == null) {
      this.lastUnwrapped = a;
      return a;
    }
    const last = this.lastUnwrapped;
    const lastMod = ((last % 360) + 360) % 360;
    const diff = ((a - lastMod + 540) % 360) - 180;
    const u = last + diff;
    this.lastUnwrapped = u;
    return u;
  }

  private normalizeAngle(a: number): number { return ((a % 360) + 360) % 360; }
  private addHeading(h1: number, h2: number) { let h3 = (h1 + h2) % 360; if (h3 < 0) h3 += 360; return h3; }
  private angleDelta(from: number, to: number): number { const d = ((to - from + 540) % 360) - 180; return Math.abs(d); }

  private scheduleMarkForCheck() {
    if (this.markScheduled) return;
    this.markScheduled = true;
    this.zones.runOutsideAngular(() => {
      this.scheduleRafId = requestAnimationFrame(() => {
        this.zones.run(() => { this.cdr.markForCheck(); });
        this.markScheduled = false;
        this.scheduleRafId = null;
      });
    });
  }
}
