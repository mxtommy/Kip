/**
 * Responsibilities:
 *  - Reactive config via WidgetRuntimeDirective
 *  - Data subscription via WidgetStreamsDirective
 *  - Zones metadata via WidgetMetadataDirective (highlights + state colors)
 *  - Resize handling and scale recalculation
 */
import { Component, AfterViewInit, ElementRef, effect, viewChild, input, inject, untracked, computed, signal } from '@angular/core';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { LinearGaugeOptions, LinearGauge, GaugesModule } from '@godind/ng-canvas-gauges';
import { IWidgetSvcConfig, IDataHighlight } from '../../core/interfaces/widgets-interface';
import { adjustLinearScaleAndMajorTicks, IScale } from '../../core/utils/dataScales.util';
import { getHighlights } from '../../core/utils/zones-highlight.utils';
import { getColors } from '../../core/utils/themeColors.utils';
import { States } from '../../core/interfaces/signalk-interfaces';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { WidgetMetadataDirective } from '../../core/directives/widget-metadata.directive';
import { UnitsService } from '../../core/services/units.service';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-gauge-ng-linear',
  templateUrl: './widget-gauge-ng-linear.component.html',
  styleUrls: ['./widget-gauge-ng-linear.component.scss'],
  imports: [NgxResizeObserverModule, GaugesModule]
})
export class WidgetGaugeNgLinearComponent implements AfterViewInit {
  // Host2 functional inputs
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Inject directives/services
  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly metadata = inject(WidgetMetadataDirective);
  private readonly unitsService = inject(UnitsService);

  // Static default config (legacy parity)
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
      type: 'ngLinear',
      subType: 'vertical', // vertical | horizontal
      highlightsWidth: 5,
      enableTicks: true,
      enableNeedle: false
    },
    numInt: 1,
    numDecimal: 0,
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5,
    ignoreZones: false
  };

  protected readonly ngGauge = viewChild<LinearGauge>('linearGauge');
  protected readonly gauge = viewChild('linearGauge', { read: ElementRef });

  // Reactive presentation
  protected textValue = signal('--');
  protected value = signal(0);
  protected gaugeOptions: LinearGaugeOptions = {} as LinearGaugeOptions;
  private viewReady = signal(false);
  private currentState = signal<string>(States.Normal);

  private adjustedScale = computed<IScale>(() => {
    const cfg = this.runtime.options();
    if (!cfg) return { min: 0, max: 100, majorTicks: [] };
    if (cfg.gauge?.enableTicks) {
      return adjustLinearScaleAndMajorTicks(cfg.displayScale.lower, cfg.displayScale.upper);
    }
    return { min: cfg.displayScale.lower, max: cfg.displayScale.upper, majorTicks: [] };
  });
  private highlights = computed<IDataHighlight[]>(() => {
    const zones = this.metadata.zones();
    const cfg = this.runtime.options();
    const theme = this.theme();

    if (!zones?.length) return [];
    if (!cfg || !theme) return [];
    if (cfg.ignoreZones) return [];

    if (!cfg.paths?.['gaugePath']) return [];
    return getHighlights(zones, theme, cfg.paths['gaugePath'].convertUnitTo, this.unitsService, this.adjustedScale().min, this.adjustedScale().max);
  });
  protected displayName = computed(() => this.runtime.options()?.displayName || 'Gauge Label');

  constructor() {
    // Observe data stream reactively
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      if (!cfg.paths?.['gaugePath'].path) return;

      untracked(() => this.streams.observe('gaugePath', path => {
        const raw = (path?.data?.value as number) ?? null;
        if (raw == null) {
          this.value.set(cfg.displayScale.lower);
          this.textValue.set('--');
        } else {
          const clamped = Math.min(Math.max(raw, cfg.displayScale.lower), cfg.displayScale.upper);
          this.value.set(clamped);
          if (this.textValue() === '--') this.textValue.set('');
        }
        if (path.state !== this.currentState()) {
          this.currentState.set(path.state);
        }
      }));
    });

    // Metadata observation
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg || cfg.ignoreZones) return;
      untracked(() => this.metadata.observe('gaugePath'));
    });

    // Apply highlights to gauge post-init
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

    // Build / update gauge options when config/theme/scale change
    effect(() => {
      const theme = this.theme();
      // include scale dependency so options rebuild on scale recompute
      const scale = this.adjustedScale();

      untracked(() => {
        this.buildGaugeOptions(this.runtime.options(), theme, scale);
        if (this.viewReady()) {
          try {
            this.ngGauge()?.update(this.gaugeOptions);
            this.applyInitialSize();
          } catch { /* ignore */ }
        }
      });
    });

    // Apply state-based colors (after view ready)
    effect(() => {
      const state = this.currentState();
      if (!this.viewReady()) return;
      untracked(() => {
        const cfg = this.runtime.options();
        const theme = this.theme();
        if (cfg.ignoreZones) return;

        const opt: LinearGaugeOptions = {};
        const enableNeedle = cfg.gauge?.enableNeedle;
        const palette = getColors(cfg.color, theme);
        switch (state) {
          case States.Alarm:
            if (enableNeedle) {
              opt.colorNeedle = theme.zoneAlarm;
              opt.colorValueText = theme.zoneAlarm;
            } else {
              opt.colorBarProgress = theme.zoneAlarm;
              opt.colorValueText = theme.zoneAlarm;
            }
            break;
          case States.Warn:
            if (enableNeedle) {
              opt.colorNeedle = theme.zoneWarn;
              opt.colorValueText = theme.zoneWarn;
            } else {
              opt.colorBarProgress = theme.zoneWarn;
              opt.colorValueText = theme.zoneWarn;
            }
            break;
          case States.Alert:
            if (enableNeedle) {
              opt.colorNeedle = theme.zoneAlert;
              opt.colorValueText = theme.zoneAlert;
            } else {
              opt.colorBarProgress = theme.zoneAlert;
              opt.colorValueText = theme.zoneAlert;
            }
            break;
          default:
            if (enableNeedle) {
              opt.colorNeedle = palette.color;
              opt.colorValueText = palette.color;
            } else {
              opt.colorBarProgress = palette.color;
              opt.colorValueText = palette.color;
            }
        }
        try {
          this.ngGauge()?.update(opt);
        } catch { /* ignore */ }
      });
    });
  }

  private buildGaugeOptions(cfg: IWidgetSvcConfig, theme: ITheme, scale: IScale) {
    const opt = this.gaugeOptions = {} as LinearGaugeOptions;
    const isVertical = cfg.gauge?.subType === 'vertical';
    const enableNeedle = cfg.gauge?.enableNeedle;
    const ticks = cfg.gauge?.enableTicks;
    // Canvas size (defer dynamic resize until AfterViewInit)
    opt.minValue = scale.min; opt.maxValue = scale.max;
    opt.valueInt = cfg.numInt ?? 1; opt.valueDec = cfg.numDecimal ?? 2;
    opt.title = this.displayName(); opt.fontTitleSize = 40; opt.fontTitle = 'Roboto'; opt.fontTitleWeight = 'bold';
    // Bar geometry (match legacy defaults)
    opt.barLength = isVertical ? 80 : 90;
    opt.barWidth = ticks ? (enableNeedle ? 0 : 30) : 60;
    opt.barProgress = true; opt.barBeginCircle = 0; opt.barStrokeWidth = 0; opt.barShadow = 0;
    // Needle geometry
    opt.needle = !!enableNeedle; opt.needleType = enableNeedle ? 'arrow' : 'line';
    opt.needleStart = enableNeedle ? (isVertical ? 200 : 155) : -45;
    opt.needleEnd = enableNeedle ? (isVertical ? 175 : 180) : 55;
    opt.needleShadow = true; opt.needleSide = 'both';
    opt.units = cfg.paths?.['gaugePath']?.convertUnitTo; opt.fontUnits = 'Roboto'; opt.fontUnitsWeight = 'normal';
    opt.borders = false; opt.borderOuterWidth = 0; opt.borderMiddleWidth = 0; opt.borderInnerWidth = 0; opt.borderShadowWidth = 0; opt.borderRadius = 0;
    // Value box
    opt.valueBox = true; opt.valueBoxWidth = 35; opt.valueBoxStroke = 0; opt.valueBoxBorderRadius = 10;
    opt.colorValueBoxRect = ''; opt.colorValueBoxRectEnd = ''; opt.colorValueBoxShadow = '';
    opt.fontValueSize = 50; opt.fontValue = 'Roboto'; opt.fontValueWeight = 'bold'; opt.valueTextShadow = false;
    opt.fontNumbers = 'Roboto'; opt.fontNumbersWeight = 'normal'; opt.fontUnitsSize = isVertical ? 40 : 35;
    opt.colorTitle = getColors('contrast', theme).dim; opt.colorUnits = getColors('contrast', theme).dim;
    opt.colorValueBoxBackground = theme.background;
    const palette = getColors(cfg.color, theme);
    // baseline colors
    opt.colorValueText = palette.color;
    if (enableNeedle) {
      opt.colorNeedle = palette.color; opt.colorNeedleEnd = palette.color; opt.needleWidth = 45;
      opt.colorNeedleShadowUp = palette.color; opt.colorNeedleShadowDown = palette.color;
    } else {
      opt.colorBarProgress = palette.color; opt.colorBarProgressEnd = ''; opt.needleWidth = 0;
    }
    opt.colorPlate = theme.cardColor; opt.colorBar = theme.background; opt.colorBarEnd = ''; opt.colorBarStroke = '0';
    opt.colorMajorTicks = getColors('contrast', theme).dim; opt.colorMinorTicks = getColors('contrast', theme).dim; opt.colorNumbers = getColors('contrast', theme).dim;
    opt.majorTicks = ticks ? scale.majorTicks as unknown as string[] : [];
    opt.majorTicksInt = cfg.numInt ?? 1; opt.majorTicksDec = cfg.numDecimal ?? 2;
    opt.strokeTicks = !!ticks; opt.minorTicks = ticks ? 2 : 0; opt.ticksWidthMinor = ticks ? 6 : 0;
    opt.numberSide = enableNeedle ? 'right' : 'left';
    opt.fontNumbersSize = ticks ? (isVertical ? 22 : 30) : 0;
    opt.numbersMargin = isVertical ? (enableNeedle ? -7 : -3) : (enableNeedle ? -33 : -5);
    opt.ticksWidth = ticks ? (enableNeedle ? (isVertical ? 15 : 10) : 10) : 0;
    opt.ticksPadding = ticks ? (isVertical ? (enableNeedle ? 0 : 5) : (enableNeedle ? 9 : 8)) : 0;
    opt.tickSide = 'left';
    opt.animation = true; opt.animationRule = 'linear'; opt.animatedValue = false; opt.animateOnInit = false; opt.animationDuration = (cfg.paths?.['gaugePath']?.sampleTime ?? 500) - 25;
    opt.highlights = []; opt.highlightsWidth = cfg.gauge?.highlightsWidth;
    // pre-populate highlights if already available
    const h = this.highlights();
    if (h.length) { opt.highlights = JSON.stringify(h) as unknown as string; }
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
    this.applyInitialSize();
    try {
      this.ngGauge()?.update(this.gaugeOptions);
    } catch { /* ignore */ }
  }

  private applyInitialSize(): void {
    const el = this.gauge()?.nativeElement as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const aspect = 0.3;
    let height: number; let width: number;
    const cfg = this.runtime.options();
    const isVertical = cfg?.gauge?.subType === 'vertical';
    if (isVertical) { height = rect.height; width = rect.height * aspect; } else { width = rect.width; height = rect.width * aspect; }
    const resize: LinearGaugeOptions = { height, width } as LinearGaugeOptions;
    try { this.ngGauge()?.update(resize); } catch { /* ignore */ }
  }

  public onResized(evt: ResizeObserverEntry): void {
    const cfg = this.runtime.options();
    if (!cfg) return;
    const aspectRatio = 0.3;
    const isVertical = cfg.gauge?.subType === 'vertical';
    const resize: LinearGaugeOptions = {};

    if (isVertical) {
      resize.height = evt.contentRect.height;
      resize.width = resize.height * aspectRatio;
      if (resize.width > evt.contentRect.width) {
        resize.width = evt.contentRect.width;
        resize.height = resize.width / aspectRatio;
      }
    } else {
      resize.width = evt.contentRect.width;
      resize.height = resize.width * aspectRatio;
      if (resize.height > evt.contentRect.height) {
        resize.height = evt.contentRect.height;
        resize.width = resize.height / aspectRatio;
      }
    }

    resize.height = (resize.height ?? 0) - 10;
    try { this.ngGauge()?.update(resize); } catch { /* ignore */ }
  }
}
