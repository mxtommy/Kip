/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { Component, AfterViewInit, ElementRef, effect, viewChild, inject, input, untracked, computed, signal } from '@angular/core';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { GaugesModule, RadialGaugeOptions, RadialGauge } from '@godind/ng-canvas-gauges';
import { IWidgetSvcConfig, IDataHighlight } from '../../core/interfaces/widgets-interface';
import { adjustLinearScaleAndMajorTicks, IScale } from '../../core/utils/dataScales.util';
import { States } from '../../core/interfaces/signalk-interfaces';
import { getHighlights } from '../../core/utils/zones-highlight.utils';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { WidgetMetadataDirective } from '../../core/directives/widget-metadata.directive';
import { UnitsService } from '../../core/services/units.service';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-gauge-ng-radial',
  templateUrl: './widget-gauge-ng-radial.component.html',
  styleUrls: ['./widget-gauge-ng-radial.component.scss'],
  imports: [NgxResizeObserverModule, GaugesModule]
})
export class WidgetGaugeNgRadialComponent implements AfterViewInit {
  // Functional Host2 inputs
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Host2 directives (applied by host container)
  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly metadata = inject(WidgetMetadataDirective);
  private readonly unitsService = inject(UnitsService);

  // Static default configuration (legacy parity)
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Gauge Label',
    filterSelfPaths: true,
    paths: {
      gaugePath: {
        description: 'Numeric Data',
        path: null,
        source: null,
        pathType: 'number',
        isPathConfigurable: true,
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: null,
        convertUnitTo: 'unitless',
        sampleTime: 500
      }
    },
    displayScale: { lower: 0, upper: 100, type: 'linear' },
    gauge: {
      type: 'ngRadial',
      subType: 'measuring',
      highlightsWidth: 5,
      scaleStart: 180,
      barStartPosition: 'left',
      enableTicks: true,
      enableProgressbar: true,
      enableNeedle: true
    },
    numInt: 1,
    numDecimal: 0,
    enableTimeout: false,
    color: 'contrast',
    dataTimeout: 5,
    ignoreZones: false
  };

  // Gauge option setting constant
  private readonly LINE: string = "line";
  private readonly ANIMATION_TARGET_NEEDLE: string = "needle";

  readonly ngGauge = viewChild.required<RadialGauge>('radialGauge');
  readonly gauge = viewChild('radialGauge', { read: ElementRef });

  // Reactive state
  protected value = signal(0);
  protected textValue = signal('');
  protected colorStrokeTicks = signal('');
  private adjustedScale = computed<IScale>(() => {
    const cfg = this.runtime.options();
    if (!cfg) return { min: 0, max: 100, majorTicks: [] };
    if (cfg.gauge?.subType === 'capacity') {
      return { min: cfg.displayScale?.lower ?? 0, max: cfg.displayScale?.upper ?? 100, majorTicks: [] };
    }
    // measuring
    return adjustLinearScaleAndMajorTicks(
      cfg.displayScale?.lower ?? 0,
      cfg.displayScale?.upper ?? 100,
      cfg.gauge?.barStartPosition === 'right'
    );
  });
  private highlights = computed<IDataHighlight[]>(() => {
    const zones = this.metadata.zones();
    const cfg = this.runtime.options();
    const theme = this.theme();

    if (!zones?.length) return [];
    if (!cfg || !theme) return [];
    if (cfg.ignoreZones) return [];
    if (cfg.gauge?.subType !== 'measuring') return []; // only measuring subtype shows bands

    const pathCfg = cfg.paths?.['gaugePath'];
    const scale = this.adjustedScale();
    const invert = cfg.gauge?.barStartPosition === 'right';
    return getHighlights(zones, theme, pathCfg.convertUnitTo, this.unitsService, scale.min, scale.max, invert);
  });
  protected displayName = computed(() => this.runtime.options()?.displayName);
  private pathDataState = signal<States | null>(null);
  private viewReady = signal(false);
  protected gaugeOptions: RadialGaugeOptions = {} as RadialGaugeOptions;

  constructor() {
    // Data subscription effect
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      if (!cfg.paths?.['gaugePath'].path) return;

      untracked(() => this.streams.observe('gaugePath', path => {
        if (path.state !== this.pathDataState()) {
          this.pathDataState.set((path.state as States) || null);
        }

        const raw = (path?.data?.value as number) ?? null;
        if (raw == null) {
          this.value.set(cfg.displayScale?.lower ?? 0);
          this.textValue.set('--');
        } else {
          const lower = cfg.displayScale?.lower ?? 0;
          const upper = cfg.displayScale?.upper ?? 100;
          // clamp
          const clamped = Math.min(Math.max(raw, lower), upper);
          this.value.set(clamped);
          if (this.textValue() === '--') this.textValue.set('');
        }
      }));
    });

    // Metadata observation (idempotent) – only when zones not ignored
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || cfg.ignoreZones) return;
      untracked(() => this.metadata.observe('gaugePath'));
    });

    // Push highlights to gauge when they change (imperative update)
    effect(() => {
      const hl = this.highlights();
      if (!this.viewReady()) return;

      untracked(() => {
        try {
          if (!hl.length) {
            this.ngGauge()?.update({ highlights: [] });
          } else {
            const serialized = JSON.stringify(hl) as unknown as string; // gauge lib tolerates stringified form
            this.ngGauge()?.update({ highlights: serialized, highlightsWidth: this.runtime.options().gauge?.highlightsWidth });
          }
        } catch { /* ignore */ }
      });
    });

    // Gauge option builder effect
    effect(() => {
      const theme = this.theme();
      // include scale dependency so options rebuild on scale recompute
      const scale = this.adjustedScale(); // reading for dependency

      untracked(() => {
        this.buildGaugeOptions(this.runtime.options(), theme, scale);
        if (this.viewReady()) {
          try {
            this.ngGauge()?.update(this.gaugeOptions);
          } catch { /* ignore */ }
        }
      });
    });

    // Apply state-based colors (after view ready)
    effect(() => {
      const state = this.pathDataState();
      if (!this.viewReady()) return;
      untracked(() => {
        const cfg = this.runtime.options();
        const theme = this.theme();
        if (cfg.ignoreZones) return;

        const option: RadialGaugeOptions = {};
        switch (state) {
          case States.Alarm:
            option.colorBorderMiddle = theme.cardColor;
            option.colorBarProgress = theme.zoneAlarm;
            option.colorValueText = theme.zoneAlarm;
            break;
          case States.Warn:
            option.colorBorderMiddle = theme.cardColor;
            option.colorBarProgress = theme.zoneWarn;
            option.colorValueText = theme.zoneWarn;
            break;
          case States.Alert:
            option.colorBorderMiddle = theme.cardColor;
            option.colorBarProgress = theme.zoneAlert;
            option.colorValueText = theme.zoneAlert;
            break;
          default:
            option.colorBorderMiddle = theme.cardColor;
            option.colorBarProgress = cfg.gauge?.subType === 'measuring' ? getColors(cfg.color, theme).color : getColors(cfg.color, theme).dim;
            option.colorValueText = getColors(cfg.color, theme).color;
        }
        try {
          this.ngGauge()?.update(option);
        } catch { /* ignore */}
      });
    });
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
    this.setCanvasSize();

    // Initial full push
    try {
      this.ngGauge()?.update(this.gaugeOptions);
    } catch { /* ignore */ }
  }

  public onResized(event: ResizeObserverEntry): void {
    const resize: RadialGaugeOptions = {
      height: event.contentRect.height,
      width: event.contentRect.width
    };
    try {
      this.ngGauge()?.update(resize);
    } catch { /* ignore */ }
  }

  private setCanvasSize(): void {
    const el = this.gauge()?.nativeElement as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const resize: RadialGaugeOptions = { height: rect.height, width: rect.width } as RadialGaugeOptions;
    try {
      this.ngGauge()?.update(resize);
    } catch { /* ignore */ }
  }

  private buildGaugeOptions(cfg: IWidgetSvcConfig, theme: ITheme, scale: IScale) {
    const g = {} as RadialGaugeOptions;
    g.title = this.displayName();
    g.minValue = scale.min;
    g.maxValue = scale.max;
    g.units = cfg.paths?.['gaugePath']?.convertUnitTo;
    g.highlights = [];
    // Include initial highlights if already available (after view init effect will re-apply).
    const initialHl = this.highlights();
    if (initialHl.length) {
      g.highlights = JSON.stringify(initialHl) as unknown as string;
      g.highlightsWidth = cfg.gauge?.highlightsWidth;
    }
    g.fontTitle = 'Roboto';
    g.fontTitleWeight = 'bold';
    g.fontUnits = 'Roboto';
    g.fontUnitsSize = 25;
    g.fontUnitsWeight = 'normal';
    g.barStrokeWidth = 0; g.barShadow = 0; g.colorBarStroke = '';
    g.fontValue = 'Roboto'; g.fontValueWeight = 'bold'; g.valueTextShadow = false; g.colorValueBoxShadow = '';
    g.fontNumbers = 'Roboto'; g.fontNumbersWeight = 'bold';
    g.valueInt = cfg.numInt ?? 1; g.valueDec = cfg.numDecimal ?? 2; g.majorTicksInt = g.valueInt; g.majorTicksDec = g.valueDec;
    g.highlightsWidth = cfg.gauge?.highlightsWidth;
    g.animation = true; g.animateOnInit = false; g.animatedValue = false; g.animationRule = 'linear';
    const st = cfg.paths?.['gaugePath']?.sampleTime ?? 500; g.animationDuration = st - 25;
    g.colorBorderShadow = false; g.colorBorderOuter = theme.cardColor; g.colorBorderOuterEnd = ''; g.colorBorderMiddle = theme.cardColor; g.colorBorderMiddleEnd = '';
    g.colorPlate = g.colorPlateEnd = theme.cardColor; g.colorBar = theme.background;

    g.barProgress = cfg.gauge?.enableProgressbar; g.colorBarProgress = getColors(cfg.color, theme).color;
    g.colorNeedle = getColors(cfg.color, theme).color; g.colorNeedleEnd = getColors(cfg.color, theme).color;
    g.needleShadow = true; g.colorNeedleShadowUp = "black"; g.colorNeedleShadowDown = "black";
    g.colorNeedleCircleInner = g.colorPlate; g.colorNeedleCircleInnerEnd = g.colorPlate; g.colorNeedleCircleOuter = g.colorPlate; g.colorNeedleCircleOuterEnd = g.colorPlate;

    g.colorTitle = theme.contrastDim; g.colorUnits = theme.contrastDim; g.colorValueText = getColors(cfg.color, theme).color;
    this.colorStrokeTicks.set(theme.contrastDim); g.colorMinorTicks = theme.contrastDim;
    g.animationTarget = this.ANIMATION_TARGET_NEEDLE; g.useMinPath = false;

    // subtype specific
    if (cfg.gauge?.subType === 'capacity') {
      g.fontTitleSize = 40;
      g.valueBox = true; g.fontValueSize = 60; g.valueBoxWidth = 10; g.valueBoxBorderRadius = 5; g.valueBoxStroke = 0; g.colorValueBoxBackground = '';
      g.colorMajorTicks = g.colorPlate; g.colorNumbers = g.colorMinorTicks = '' as unknown as string;

      g.barWidth = 20; g.colorBarProgress = getColors(cfg.color, theme).dim;
      g.needle = cfg.gauge.enableNeedle; g.needleType = this.LINE; g.needleWidth = 2; g.needleStart = 75; g.needleEnd = 95; g.needleCircleSize = 1; g.needleCircleInner = false; g.needleCircleOuter = false;
      g.ticksAngle = 360; g.startAngle = (cfg.gauge?.scaleStart as number) || 180; g.majorTicks = 0 as unknown as string[]; g.exactTicks = true; g.strokeTicks = false; g.minorTicks = 0; g.numbersMargin = 0; g.fontNumbersSize = 0;
      g.borders = true; g.borderOuterWidth = 2; g.borderMiddleWidth = 1; g.borderInnerWidth = 0; g.borderShadowWidth = 0;

    } else { // measuring
      g.fontTitleSize = 24;
      g.barWidth = 15; g.valueBox = true; g.fontValueSize = 60; g.valueBoxWidth = 100; g.valueBoxBorderRadius = 0; g.valueBoxStroke = 0; g.colorValueBoxBackground = '';
      g.needle = cfg.gauge.enableNeedle; g.needleType = this.LINE; g.needleWidth = 2; g.needleStart = 0; g.needleEnd = 95; g.needleCircleSize = 10; g.needleCircleInner = false; g.needleCircleOuter = false;
      g.ticksAngle = 270; g.startAngle = 45; g.barStartPosition = cfg.gauge?.barStartPosition || 'left';
      if (cfg.gauge.enableTicks) {
        g.strokeTicks = true; g.majorTicks = scale.majorTicks as unknown as string[]; g.minorTicks = 2; g.exactTicks = false; g.numbersMargin = 3; g.fontNumbersSize = 15;
        g.colorMajorTicks = theme.contrastDim; g.colorNumbers = theme.contrastDim;
      } else {
        g.strokeTicks = false; g.majorTicks = 0 as unknown as string[]; g.minorTicks = 0; g.exactTicks = true; g.numbersMargin = 0; g.fontNumbersSize = 0;
        g.colorMajorTicks = g.colorPlate; g.colorNumbers = g.colorMinorTicks = '' as unknown as string;
      }

      g.borders = true; g.borderOuterWidth = 2; g.borderMiddleWidth = 1; g.borderInnerWidth = 0; g.borderShadowWidth = 0; g.animationTarget = this.ANIMATION_TARGET_NEEDLE; g.useMinPath = false;
    }
    this.gaugeOptions = g;
  }
}
