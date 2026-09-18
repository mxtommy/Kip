import {
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
  untracked
} from '@angular/core';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import type { IWidgetPath, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';
import { getColors } from '../../core/utils/themeColors.utils';
import {
  IRacerLineViewData,
  RacerLineViewComponent
} from './racer-line-view/racer-line-view.component';
import { NO_VMG, VMG_NAMES } from '../racer-vmg.constants';

/**
 * The start line, drawn at full frame and nothing else.
 *
 * Purely a display: no modes, no buttons, no editing. Everything that needs a control -
 * setting and adjusting the ends, picking a named line, and editing the best VMGs - lives
 * in the Racer - Start Line Setup widget. This one is for a dashboard slot that should
 * just show the line.
 *
 * The drawing itself sits in the child directory rather than here, so it stays a
 * self-contained component: if a second widget ever needs it again it lifts back out
 * unchanged.
 */
@Component({
  selector: 'widget-racer-line-view',
  templateUrl: './widget-racer-line-view.component.html',
  styleUrls: ['./widget-racer-line-view.component.scss'],
  imports: [RacerLineViewComponent]
})
export class WidgetRacerLineViewComponent {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme>();

  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    supportAutomaticHistoricalSeries: false,
    displayName: 'Start Line',
    filterSelfPaths: true,
    numDecimal: 1,
    viewSmoothing: 10,
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5,
    paths: {
      portLatPath: {
        description: 'Latitude of the port (pin) end of the start line',
        path: 'self.navigation.racing.startLinePort.latitude',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'pdeg', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null, sampleTime: 1000
      },
      portLonPath: {
        description: 'Longitude of the port (pin) end of the start line',
        path: 'self.navigation.racing.startLinePort.longitude',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'pdeg', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null, sampleTime: 1000
      },
      stbLatPath: {
        description: 'Latitude of the starboard (boat) end of the start line',
        path: 'self.navigation.racing.startLineStb.latitude',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'pdeg', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null, sampleTime: 1000
      },
      stbLonPath: {
        description: 'Longitude of the starboard (boat) end of the start line',
        path: 'self.navigation.racing.startLineStb.longitude',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'pdeg', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null, sampleTime: 1000
      },
      latPath: {
        description: 'Latitude of the vessel',
        path: 'self.navigation.position.latitude',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'pdeg', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null, sampleTime: 500
      },
      lonPath: {
        description: 'Longitude of the vessel',
        path: 'self.navigation.position.longitude',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'pdeg', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: null, sampleTime: 500
      },
      headingPath: {
        description: 'True heading of the vessel',
        path: 'self.navigation.headingTrue',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'rad', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad', sampleTime: 500
      },
      twdPath: {
        description: 'True wind direction',
        path: 'self.environment.wind.directionTrue',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'rad', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad', sampleTime: 1000
      },
      cogPath: {
        description: 'Course over ground (true) of the vessel',
        path: 'self.navigation.courseOverGroundTrue',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'rad', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad', sampleTime: 500
      },
      sogPath: {
        // Kept in m/s: the projections are metres on the ground, not a readout.
        description: 'Speed over ground of the vessel',
        path: 'self.navigation.speedOverGround',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'm/s', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 500
      },
      lineLengthPath: {
        description: 'Length of the start line',
        path: 'self.navigation.racing.startLineLength',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'm', showConvertUnitTo: true, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm', sampleTime: 1000
      },
      lineBearingPath: {
        description: 'Bearing of the start line',
        path: 'self.navigation.racing.startLineBearing',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'rad', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad', sampleTime: 1000
      },
      ttsPath: {
        description: 'Time to the start in seconds',
        path: 'self.navigation.racing.timeToStart',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 's', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 's', sampleTime: 500
      },
      startTimePath: {
        // Cleared by the plugin whenever the timer is not counting down, so it
        // doubles as the running flag.
        description: 'Time of the start',
        path: 'self.navigation.racing.startTime',
        source: 'default', pathType: 'Date', pathRequired: false, isPathConfigurable: false,
        sampleTime: 1000
      },
      boatLengthPath: {
        // Drawn to the same scale as the line, so the triangle is the vessel's real size.
        description: 'Overall length of the vessel',
        path: 'self.design.length.overall',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'm', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm', sampleTime: 10000
      },
      effectiveVmgToLinePath: {
        // What the plugin's time to line actually divides the perpendicular leg by:
        // the collected best, or the VMG being sailed now if that is better. Published
        // from signalk-racer 1.3.0; derived locally when it is absent.
        description: 'VMG the perpendicular leg of the time to line is divided by',
        path: 'self.navigation.racing.effectiveVmg.toLine',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'm/s', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      effectiveVmgAlongLinePath: {
        description: 'VMG the along-line leg of the time to line is divided by',
        path: 'self.navigation.racing.effectiveVmg.alongLine',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'm/s', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgToCourseSidePath: {
        description: 'Best VMG across the line towards the course side',
        path: 'self.navigation.racing.bestVmg.toCourseSide',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: true, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgToPortEndPath: {
        description: 'Best VMG along the line towards the port end (pin)',
        path: 'self.navigation.racing.bestVmg.toPortEnd',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgToStbEndPath: {
        description: 'Best VMG along the line towards the starboard end (boat)',
        path: 'self.navigation.racing.bestVmg.toStbEnd',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      },
      vmgFromCourseSidePath: {
        description: 'Best VMG back across the line from the course side',
        path: 'self.navigation.racing.bestVmg.fromCourseSide',
        source: 'default', pathType: 'number', pathRequired: false, isPathConfigurable: false,
        convertUnitTo: 'knots', showConvertUnitTo: false, showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'm/s', sampleTime: 1000
      }
    }
  };

  // Everything live, handed to the drawing as one object so it recomputes its scene once
  // per update rather than once per path.
  private readonly view = signal<IRacerLineViewData>({
    portLat: null, portLon: null, stbLat: null, stbLon: null,
    lat: null, lon: null, fixTime: null,
    heading: null, cog: null, sog: null,
    lineLength: null, lineBearing: null,
    timeToStart: null, timerRunning: false, twd: null,
    boatLength: null, effVmgToLine: null, effVmgAlongLine: null,
    bestVmg: { ...NO_VMG },
    // Only the VMG editor highlights an adjusted value, and this widget has none.
    vmgOverride: NO_VMG
  });
  protected readonly viewData = this.view.asReadonly();

  protected readonly palette = signal<{ color: string; dim: string; dimmer: string }>(
    { color: 'var(--kip-contrast-color)', dim: 'var(--kip-contrast-dim-color)',
      dimmer: 'var(--kip-contrast-dimmer-color)' });

  private cfg(): IWidgetSvcConfig {
    return this.runtime.options() ?? WidgetRacerLineViewComponent.DEFAULT_CONFIG;
  }

  private get pathsRecord(): Record<string, IWidgetPath> {
    return (this.cfg().paths as Record<string, IWidgetPath> | undefined) ?? {};
  }

  protected readonly title = computed<string>(() => this.cfg().displayName || 'Start Line');
  protected readonly numDecimal = computed<number>(() => this.cfg().numDecimal ?? 1);
  protected readonly viewSmoothing = computed<number>(() => this.cfg().viewSmoothing ?? 10);
  protected readonly lengthUnit = computed<string>(() =>
    this.pathsRecord['lineLengthPath']?.convertUnitTo ?? 'm');
  protected readonly vmgUnit = computed<string>(() =>
    this.pathsRecord['vmgToCourseSidePath']?.convertUnitTo ?? 'knots');

  constructor() {
    effect(() => {
      const cfg = this.runtime.options() ?? WidgetRacerLineViewComponent.DEFAULT_CONFIG;
      const theme = this.theme();
      if (!theme) return;
      untracked(() => this.palette.set(getColors(cfg.color ?? 'contrast', theme)));
    });

    const num = (key: string, apply: (v: number | null, at: number | null) => void) => {
      effect(() => {
        if (!this.pathsRecord[key]?.path) return;
        untracked(() => this.streams.observe(key, pkt => {
          const value = pkt?.data?.value;
          const at = pkt?.data?.timestamp;
          apply(typeof value === 'number' ? value : null, at ? at.getTime() : null);
        }));
      });
    };
    num('portLatPath', v => this.view.update(d => ({ ...d, portLat: v })));
    num('portLonPath', v => this.view.update(d => ({ ...d, portLon: v })));
    num('stbLatPath', v => this.view.update(d => ({ ...d, stbLat: v })));
    num('stbLonPath', v => this.view.update(d => ({ ...d, stbLon: v })));
    num('latPath', (v, at) => this.view.update(d => ({ ...d, lat: v, fixTime: at })));
    num('lonPath', v => this.view.update(d => ({ ...d, lon: v })));
    num('headingPath', v => this.view.update(d => ({ ...d, heading: v })));
    num('cogPath', v => this.view.update(d => ({ ...d, cog: v })));
    num('twdPath', v => this.view.update(d => ({ ...d, twd: v })));
    num('sogPath', v => this.view.update(d => ({ ...d, sog: v })));
    num('lineLengthPath', v => this.view.update(d => ({ ...d, lineLength: v })));
    num('lineBearingPath', v => this.view.update(d => ({ ...d, lineBearing: v })));
    num('ttsPath', v => this.view.update(d => ({ ...d, timeToStart: v })));
    num('boatLengthPath', v => this.view.update(d => ({ ...d, boatLength: v })));
    num('effectiveVmgToLinePath', v => this.view.update(d => ({ ...d, effVmgToLine: v })));
    num('effectiveVmgAlongLinePath', v => this.view.update(d => ({ ...d, effVmgAlongLine: v })));
    // The collected bests still matter: they are the fallback the drawing derives its
    // effective VMGs from when the plugin does not publish them.
    for (const name of VMG_NAMES) {
      const cap = name.charAt(0).toUpperCase() + name.slice(1);
      num(`vmg${cap}Path`, v =>
        this.view.update(d => ({ ...d, bestVmg: { ...d.bestVmg, [name]: v } })));
    }

    effect(() => {
      if (!this.pathsRecord['startTimePath']?.path) return;
      untracked(() => this.streams.observe('startTimePath', pkt =>
        this.view.update(d => ({ ...d, timerRunning: !!pkt?.data?.value }))));
    });
  }
}
