import { Component, effect, signal, computed, inject, input, untracked, OnDestroy } from '@angular/core';
import { SvgRacesteerComponent } from '../svg-racesteer/svg-racesteer.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { IWidgetSvcConfig, IPathArray } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';
import { interval, Subscription } from 'rxjs';

interface IWindDirSample { timestamp: number; windDirection: number; }

@Component({
  selector: 'widget-racesteer',
  templateUrl: './widget-racesteer.component.html',
  styleUrls: ['./widget-racesteer.component.scss'],
  imports: [SvgRacesteerComponent]
})
export class WidgetRacesteerComponent implements OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Static full default config
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    filterSelfPaths: true,
    paths: {
      headingPath: { description: 'True Heading', path: 'self.navigation.headingTrue', source: 'default', pathType: 'number', isPathConfigurable: true, pathSkUnitsFilter: 'rad', convertUnitTo: 'deg', sampleTime: 500 },
      tackTrue: { description: 'True Tack', path: 'self.performance.tackTrue', source: 'default', pathType: 'number', isPathConfigurable: false, pathRequired: true, pathSkUnitsFilter: 'rad', convertUnitTo: 'deg', sampleTime: 500 },
      polarSpeedRatio: { description: 'Polar Speed Ratio', path: 'self.performance.polarSpeedRatio', source: 'default', pathType: 'number', isPathConfigurable: false, pathRequired: false, convertUnitTo: 'ratio', sampleTime: 500 },
      targetAngle: { description: 'Target Angle', path: 'self.performance.targetAngle', source: 'default', pathType: 'number', isPathConfigurable: false, pathRequired: false, convertUnitTo: 'deg', sampleTime: 500 },
      optimalWindAngle: { description: 'Optimal Wind Angle', path: 'self.performance.optimumWindAngle', source: 'default', pathType: 'number', isPathConfigurable: false, pathRequired: false, convertUnitTo: 'deg', sampleTime: 500 },
      targetVMG: { description: 'Target Velocity Made Good', path: 'self.performance.targetVelocityMadeGood', source: 'default', pathType: 'number', isPathConfigurable: false, pathRequired: false, convertUnitTo: 'knots', sampleTime: 500 },
      VMG: { description: 'Velocity Made Good', path: 'self.performance.velocityMadeGood', source: 'default', pathType: 'number', isPathConfigurable: false, pathRequired: false, convertUnitTo: 'knots', sampleTime: 500 },
      appWindAngle: { description: 'Apparent Wind Angle', path: 'self.environment.wind.angleApparent', source: 'default', pathType: 'number', isPathConfigurable: true, pathSkUnitsFilter: 'rad', convertUnitTo: 'deg', sampleTime: 500 },
      appWindSpeed: { description: 'Apparent Wind Speed', path: 'self.environment.wind.speedApparent', source: 'default', pathType: 'number', isPathConfigurable: true, pathSkUnitsFilter: 'm/s', convertUnitTo: 'knots', sampleTime: 500 },
      trueWindAngle: { description: 'True Wind Angle', path: 'self.environment.wind.angleTrueWater', source: 'default', pathType: 'number', isPathConfigurable: true, pathRequired: false, pathSkUnitsFilter: 'rad', convertUnitTo: 'deg', sampleTime: 500 },
      trueWindSpeed: { description: 'True Wind Speed', path: 'self.environment.wind.speedTrue', source: 'default', pathType: 'number', isPathConfigurable: true, pathRequired: false, pathSkUnitsFilter: 'm/s', convertUnitTo: 'knots', sampleTime: 500 },
      courseOverGround: { description: 'True Course Over Ground', path: 'self.navigation.courseOverGroundTrue', source: 'default', pathType: 'number', isPathConfigurable: true, pathRequired: false, pathSkUnitsFilter: 'rad', convertUnitTo: 'deg', sampleTime: 500 },
      nextWaypointBearing: { description: 'Next Waypoint True Bearing', path: 'self.navigation.courseGreatCircle.nextPoint.bearingTrue', source: 'default', pathType: 'number', isPathConfigurable: true, pathRequired: false, pathSkUnitsFilter: 'rad', convertUnitTo: 'deg', sampleTime: 500 },
      vmgToWaypoint: { description: 'Velocity Made Good to Waypoint', path: 'self.performance.velocityMadeGoodToWaypoint', source: 'default', pathType: 'number', isPathConfigurable: false, pathRequired: false, convertUnitTo: 'knots', sampleTime: 500 },
      set: { description: 'True Drift Set', path: 'self.environment.current.setTrue', source: 'default', pathType: 'number', isPathConfigurable: true, pathRequired: false, pathSkUnitsFilter: 'rad', convertUnitTo: 'deg', sampleTime: 500 },
      drift: { description: 'Drift Speed Impact', path: 'self.environment.current.drift', source: 'default', pathType: 'number', isPathConfigurable: true, pathRequired: false, pathSkUnitsFilter: 'm/s', convertUnitTo: 'knots', sampleTime: 500 }
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

  // Injected directives
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);

  // Signals for display state
  protected readonly currentHeading = signal(0);
  protected readonly courseOverGroundAngle = signal(0);
  protected readonly appWindAngle = signal(0);
  protected readonly appWindSpeed = signal(0);
  protected readonly appWindSpeedUnit = signal('knots');
  protected readonly trueWindAngle = signal(0);
  protected readonly trueWindSpeed = signal(0);
  protected readonly trueWindSpeedUnit = signal('knots');
  protected readonly driftFlow = signal(0);
  protected readonly driftSet = signal(0);
  protected readonly waypointAngle = signal(0);
  protected readonly vmgToWaypoint = signal<number | null>(null);
  protected readonly tackTrue = signal(0);
  protected readonly polarSpeedRatio = signal(0);
  protected readonly targetAngle = signal(0);
  protected readonly optimalWindAngle = signal(0);
  protected readonly targetVMG = signal(0);
  protected readonly VMG = signal(0);
  protected readonly gradianColor = signal<{ start: string; stop: string }>({ start: '#3298ff', stop: '#15af00' });
  protected readonly trueWindMinHistoric = signal<number>(0);
  protected readonly trueWindMidHistoric = signal<number>(0);
  protected readonly trueWindMaxHistoric = signal<number>(0);

  private windSectorSub: Subscription | null = null;
  private historicalWindDirection: IWindDirSample[] = [];

  constructor() {
    // Heading
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined; // Host2 config uses object map
      const path = paths?.['headingPath']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('headingPath', pkt => {
        const v = pkt?.data?.value as number | null;
        this.currentHeading.set(v == null ? 0 : v);
      }));
    });
    // Course over ground
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || !cfg.courseOverGroundEnable) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['courseOverGround']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('courseOverGround', pkt => {
        const v = pkt?.data?.value as number | null;
        this.courseOverGroundAngle.set(v == null ? 0 : v);
      }));
    });

    // Drift speed
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || !cfg.driftEnable) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['drift']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('drift', pkt => {
        const v = pkt?.data?.value as number | null;
        this.driftFlow.set(v == null ? 0 : v);
      }));
    });

    // Drift set (direction)
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || !cfg.driftEnable) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['set']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('set', pkt => {
        const v = pkt?.data?.value as number | null;
        const normalized = v == null ? 0 : v;
        this.driftSet.set(this.addHeading(-this.currentHeading(), normalized));
      }));
    });

    // Waypoint bearing
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || !cfg.waypointEnable) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['nextWaypointBearing']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('nextWaypointBearing', pkt => {
        const v = pkt?.data?.value as number | null;
        if (v == null) { this.waypointAngle.set(0); return; }
        const normalized = v < 0 ? 360 + v : v;
        const relative = this.addHeading(-this.currentHeading(), normalized);
        this.waypointAngle.set(Math.round(relative));
      }));
    });

    // Apparent Wind Angle (+ historic sectors + AWA dependent arcs)
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || !cfg.awsEnable) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['appWindAngle']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('appWindAngle', pkt => {
        const raw = pkt?.data?.value as number | null;
        let value = raw == null ? 0 : raw;
        value = value < 0 ? 360 + value : value;
        this.appWindAngle.set(value);
        if (cfg.windSectorEnable) {
          const heading = this.currentHeading();
          const relative360 = this.addHeading(heading, raw == null ? 0 : raw);
          this.addHistoricalWindDirection(relative360, cfg.windSectorWindowSeconds);
        }
      }));
    });

    // Tack True
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['tackTrue']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('tackTrue', pkt => {
        const v = pkt?.data?.value as number | null;
        this.tackTrue.set(v == null ? 0 : Math.round(v));
      }));
    });

    // Polar Speed Ratio
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['polarSpeedRatio']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('polarSpeedRatio', pkt => {
        const v = pkt?.data?.value as number | null;
        this.polarSpeedRatio.set(v == null ? 0 : v);
      }));
    });

    // Target Angle
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['targetAngle']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('targetAngle', pkt => {
        const v = pkt?.data?.value as number | null;
        const normalized = v == null ? 0 : (v < 0 ? 360 + v : v);
        this.targetAngle.set(normalized);
      }));
    });

    // Optimal Wind Angle
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['optimalWindAngle']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('optimalWindAngle', pkt => {
        const v = pkt?.data?.value as number | null;
        this.optimalWindAngle.set(v == null ? 0 : v);
      }));
    });

    // Target VMG
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['targetVMG']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('targetVMG', pkt => {
        const v = pkt?.data?.value as number | null;
        const rounded = v == null ? 0 : Math.round(v * 10) / 10;
        this.targetVMG.set(rounded);
      }));
    });

    // VMG
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['VMG']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('VMG', pkt => {
        const v = pkt?.data?.value as number | null;
        const rounded = v == null ? 0 : Math.round(v * 10) / 10;
        this.VMG.set(rounded);
      }));
    });

    // VMG to Waypoint
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['vmgToWaypoint']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('vmgToWaypoint', pkt => {
        const v = pkt?.data?.value as number | null;
        const rounded = v == null ? null : Math.round(v * 10) / 10;
        this.vmgToWaypoint.set(rounded);
      }));
    });

    // Theme gradient color (fallbacks for non-m3 themes)
    effect(() => {
      const t = this.theme();
      if (!t) return;
      const start = (t as unknown as Record<string, string>)?.['blue'] ?? '#3298ff';
      const stop = (t as unknown as Record<string, string>)?.['green'] ?? '#15af00';
      untracked(() => this.gradianColor.set({ start, stop }));
    });

    // Apparent Wind Speed
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || !cfg.awsEnable) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['appWindSpeed']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('appWindSpeed', pkt => {
        const v = pkt?.data?.value as number | null;
        this.appWindSpeed.set(v == null ? 0 : v);
      }));
    });

    // True Wind Speed
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || !cfg.twsEnable) return;
      const paths = cfg.paths as IPathArray | undefined;
      const path = paths?.['trueWindSpeed']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('trueWindSpeed', pkt => {
        const v = pkt?.data?.value as number | null;
        this.trueWindSpeed.set(v == null ? 0 : v);
      }));
    });

    // True Wind Angle (may be +/-180 or absolute 0-360 depending on path)
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || !cfg.twsEnable) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const paths = cfg.paths as Record<string, any> | undefined;
      const path = paths?.['trueWindAngle']?.path;
      if (!path) return;
      untracked(() => this.streams.observe('trueWindAngle', pkt => {
        const raw = pkt?.data?.value as number | null;
        let value = raw == null ? 0 : raw;
        if (path.includes('angleTrueWater') || path.includes('angleTrueGround')) {
          const heading = this.currentHeading();
          value = this.addHeading(heading, value);
        } else {
          value = value < 0 ? 360 + value : value;
        }
        this.trueWindAngle.set(value);
      }));
    });

    // Start / stop wind sectors interval
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      if (cfg.windSectorEnable) {
        if (!this.windSectorSub) {
          untracked(() => this.windSectorSub = interval(500).subscribe(() => this.historicalCleanup(cfg.windSectorWindowSeconds)));
        }
      } else {
        this.windSectorSub?.unsubscribe();
        this.windSectorSub = null;
      }
    });
  }

  // Derived sector arc
  protected readonly sectorArc = computed(() => {
    const min = this.trueWindMinHistoric();
    const mid = this.trueWindMidHistoric();
    const max = this.trueWindMaxHistoric();
    return { min, mid, max };
  });

  private addHistoricalWindDirection(windDirection: number, windowSeconds: number) {
    this.historicalWindDirection.push({ timestamp: Date.now(), windDirection });
    // reduce
    const arc = this.arcForAngles(this.historicalWindDirection.map(d => d.windDirection));
    this.trueWindMinHistoric.set(arc.min);
    this.trueWindMaxHistoric.set(arc.max);
    this.trueWindMidHistoric.set(arc.mid);
    this.historicalCleanup(windowSeconds);
  }

  private arcForAngles(data: number[]): { min: number; max: number; mid: number } {
    if (!data || data.length === 0) return { min: 0, max: 0, mid: 0 };
    const result = data.slice(1).reduce(
      (acc, theValue) => {
        let value = theValue;
        while (value < acc.min - 180) value += 360;
        while (value > acc.max + 180) value -= 360;
        acc.min = Math.min(acc.min, value);
        acc.max = Math.max(acc.max, value);
        acc.mid = ((acc.max - acc.min) / 2) + acc.min;
        return acc;
      },
      { min: data[0], max: data[0], mid: data[0] }
    );
    return result;
  }

  private historicalCleanup(windowSeconds: number) {
    const n = Date.now() - (windowSeconds * 1000);
    this.historicalWindDirection = this.historicalWindDirection.filter(d => d.timestamp >= n);
  }

  private addHeading(h1: number, h2: number) {
    let h3 = (h1 + h2) % 360;
    if (h3 < 0) h3 += 360;
    return h3;
  }

  ngOnDestroy() {
    this.windSectorSub?.unsubscribe();
    this.windSectorSub = null;
  }

}
