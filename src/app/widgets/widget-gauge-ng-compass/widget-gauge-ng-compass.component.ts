/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { Component, AfterViewInit, ElementRef, effect, viewChild, input, inject, untracked, computed, signal } from '@angular/core';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

import { GaugesModule, RadialGaugeOptions, RadialGauge } from '@godind/ng-canvas-gauges';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { States } from '../../core/interfaces/signalk-interfaces';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { ITheme } from '../../core/services/app-service';

function rgbaToHex(rgba: string) {
  const match = rgba.match(/(\d+(\.\d+)?|\.\d+)/g);
  if (!match || match.length < 3) {
    throw new Error("Invalid RGBA format");
  }

  // Extract RGBA values
  const [r, g, b, a = 1] = match.map(Number);

  // Convert alpha from 0-1 to 0-255 and then to HEX
  const alpha = a === 1 ? '' : Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();

  // Convert RGB to HEX
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase() + alpha;
}

function convertNegToPortDegree(degree: number) {
  if (degree < 0) {
      degree = 360 + degree;
  }
  return degree;
}

@Component({
  selector: 'widget-gauge-ng-compass',
  imports: [NgxResizeObserverModule, GaugesModule],
  templateUrl: './widget-gauge-ng-compass.component.html',
  styleUrl: './widget-gauge-ng-compass.component.scss'
})
export class WidgetGaugeNgCompassComponent implements AfterViewInit {
  // Functional Host2 inputs
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Inject directives/services
  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);

  // Static DEFAULT_CONFIG for Host2
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
        showPathSkUnitsFilter: false,
        pathSkUnitsFilter: 'rad',
        showConvertUnitTo: false,
        convertUnitTo: 'deg',
        sampleTime: 500
      }
    },
    gauge: {
      type: 'ngRadial',
      subType: 'baseplateCompass', // marineCompass, baseplateCompass
      enableTicks: true,
      compassUseNumbers: false,
      showValueBox: false
    },
    enableTimeout: false,
    color: "contrast",
    dataTimeout: 5
  };

  private readonly LINE: string = "line";
  private readonly NEEDLE_START: number = 40;
  private readonly NEEDLE_END: number = 100;
  private readonly NEEDLE_CIRCLE_SIZE: number = 15;
  private readonly BORDER_MIDDLE_WIDTH: number = 2;
  private readonly BORDER_INNER_WIDTH: number = 2;
  private readonly ANIMATION_TARGET_PLATE:string = "plate";
  private readonly ANIMATION_TARGET_NEEDLE:string = "needle";

  // Data/state
  protected textValue = signal('--');
  protected value = signal(0);

  readonly ngGauge = viewChild<RadialGauge>('compassGauge');
  readonly gauge = viewChild('compassGauge', { read: ElementRef });
  private viewReady = signal(false);
  protected gaugeOptions: RadialGaugeOptions = {} as RadialGaugeOptions;
  protected colorStrokeTicks = '';
  private currentState = signal<States>(States.Normal);
  private lastAppliedState: States | null = null;

  private readonly negToPortPaths = [
    "self.environment.wind.angleApparent",
    "self.environment.wind.angleTrueGround",
    "self.environment.wind.angleTrueWater",
    "self.environment.wind.angleTrueWaterDamped",
    "self.performance.beatAngle",
    "self.performance.gybeAngle",
    "self.performance.targetAngle",
    "self.performance.optimumWindAngle"
  ];

  // Derived display name
  protected displayName = computed(() => this.runtime.options()?.displayName);

  constructor() {
    // Data effect
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      const pCfg = cfg.paths?.['gaugePath'];
      if (!pCfg?.path) return;
      untracked(() => this.streams.observe('gaugePath', pkt => {
        let raw = (pkt?.data?.value as number) ?? null;
        if (raw == null) {
          this.value.set(0);
          this.textValue.set('--');
        } else {
          if (this.negToPortPaths.includes(pCfg.path)) raw = convertNegToPortDegree(raw);
          const clamped = Math.min(Math.max(raw, 0), 360);
          this.value.set(clamped);
          this.textValue.set(clamped.toFixed(0));
        }
        const newState = (pkt?.state ?? States.Normal) as States;
        if (newState !== this.currentState()) this.currentState.set(newState);
      }));
    });

    // Build options when config/theme changes
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      if (!cfg || !theme) return;
      untracked(() => {
        this.buildGaugeOptions(cfg, theme);
        if (this.viewReady()) {
          try { this.ngGauge()?.update(this.gaugeOptions); } catch { /* ignore */ }
        }
      });
    });

    // Apply state-based value color post-init
    effect(() => {
      const cfg = this.runtime.options();
      const theme = this.theme();
      const state = this.currentState();
      if (!cfg || !theme) return;
      if (!this.viewReady()) return;
      if (state === this.lastAppliedState) return;
      untracked(() => {
        const opt: RadialGaugeOptions = {};
        switch (state) {
          case States.Emergency: opt.colorValueText = theme.zoneEmergency; break;
          case States.Alarm: opt.colorValueText = theme.zoneAlarm; break;
          case States.Warn: opt.colorValueText = theme.zoneWarn; break;
          case States.Alert: opt.colorValueText = theme.zoneAlert; break;
          default: opt.colorValueText = theme.contrast; break;
        }
        try { this.ngGauge()?.update(opt); } catch { /* ignore */ }
        this.lastAppliedState = state;
      });
    });
  }

  private buildGaugeOptions(cfg: IWidgetSvcConfig, theme: ITheme) {
    const g = this.gaugeOptions = {} as RadialGaugeOptions;
    g.title = this.displayName();
    g.minValue = 0; g.maxValue = 360; g.units = cfg.paths?.['gaugePath']?.convertUnitTo || '';
    // Use configured integer/decimal digits (compass default: whole degrees)
    g.valueDec = cfg.numDecimal ?? 0; g.valueInt = cfg.numInt ?? 1;
    g.barProgress = false; g.barWidth = 0;
    g.valueBox = !!cfg.gauge?.showValueBox; g.fontValueSize = 60; g.valueBoxWidth = 30; g.valueBoxBorderRadius = 10; g.valueBoxStroke = 0;
    g.ticksAngle = 360; g.startAngle = 180; g.exactTicks = false; g.strokeTicks = '' as unknown as string;
    g.majorTicks = cfg.gauge?.compassUseNumbers ? ['N','30','60','E','120','150','S','210','240','W','300','330','N'] : ['N','NE','E','SE','S','SW','W','NW','N'];
    g.majorTicksDec = 0; g.majorTicksInt = 1; g.numbersMargin = 5; g.fontNumbersSize = 25; g.minorTicks = cfg.gauge?.compassUseNumbers ? 3 : 2;
    g.needle = true; g.needleType = this.LINE; g.needleStart = this.NEEDLE_START; g.needleEnd = this.NEEDLE_END; g.needleCircleSize = this.NEEDLE_CIRCLE_SIZE; g.needleWidth = 4; g.needleShadow = false; g.needleCircleInner = false; g.needleCircleOuter = false;
    g.borders = true; g.borderOuterWidth = 0; g.borderMiddleWidth = this.BORDER_MIDDLE_WIDTH; g.borderInnerWidth = this.BORDER_INNER_WIDTH; g.borderShadowWidth = 0;
    g.highlights = []; g.highlightsWidth = 0;
    g.fontTitle = 'Roboto'; g.fontTitleWeight = 'normal'; g.fontTitleSize = 25; g.fontUnits = 'Roboto'; g.fontUnitsSize = 25; g.fontUnitsWeight = 'normal';
    g.barStrokeWidth = 0; g.barShadow = 0; g.fontValue = 'Roboto'; g.fontValueWeight = 'bold'; g.valueTextShadow = false; g.colorValueBoxShadow = '';
    g.fontNumbers = 'Roboto'; g.fontNumbersWeight = 'bold';
    // animation mode by subtype
    if (cfg.gauge?.subType === 'marineCompass') { g.animationTarget = this.ANIMATION_TARGET_PLATE; g.useMinPath = true; }
    else { g.animationTarget = this.ANIMATION_TARGET_NEEDLE; g.useMinPath = true; }
    g.animation = true; g.animateOnInit = true; g.animatedValue = true; g.animationRule = 'linear'; g.animationDuration = (cfg.paths?.['gaugePath']?.sampleTime ?? 500) - 50;
    // Colors (RGBA unsupported -> convert)
    const palette = getColors(cfg.color, theme);
    const dim = rgbaToHex(palette.dim);
    const contrastDim = rgbaToHex(getColors('contrast', theme).dim);
    g.colorBarProgress = palette.color; g.colorBorderMiddle = dim; g.colorBorderMiddleEnd = dim; g.colorNeedle = palette.color; g.colorNeedleEnd = palette.color;
    g.colorTitle = contrastDim; g.colorUnits = contrastDim; g.colorValueText = palette.color; g.colorMinorTicks = contrastDim;
    g.colorNumbers = cfg.gauge?.compassUseNumbers ? [theme.port, contrastDim, contrastDim, dim, contrastDim, contrastDim, dim, contrastDim, contrastDim, dim, contrastDim, contrastDim, theme.port] : [theme.port, dim, dim, dim, dim, dim, dim, dim, theme.port];
    g.colorMajorTicks = cfg.gauge?.compassUseNumbers ? [theme.port, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.port] : [theme.port, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.contrast, theme.port];
    g.colorPlate = g.colorPlateEnd = g.colorBorderInner = g.colorBorderInnerEnd = theme.cardColor; g.colorBar = theme.background; g.colorBarStroke = '';
    g.colorValueBoxBackground = theme.background; g.colorNeedleShadowUp = ''; g.colorNeedleShadowDown = ''; g.colorNeedleCircleInner = g.colorPlate; g.colorNeedleCircleInnerEnd = g.colorPlate; g.colorNeedleCircleOuter = g.colorPlate; g.colorNeedleCircleOuterEnd = g.colorPlate;
  }

  private setCanvasSize(): void {
    const el = this.gauge()?.nativeElement as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const resize: RadialGaugeOptions = { height: rect.height, width: rect.width } as RadialGaugeOptions;
    try { this.ngGauge()?.update(resize); } catch { /* ignore */ }
  }

  ngAfterViewInit(): void {
    this.viewReady.set(true);
    this.setCanvasSize();
    try { this.ngGauge()?.update(this.gaugeOptions); } catch { /* ignore */ }
  }

  protected onResized(event: ResizeObserverEntry): void {
    const resize: RadialGaugeOptions = { height: event.contentRect.height, width: event.contentRect.width } as RadialGaugeOptions;
    try { this.ngGauge()?.update(resize); } catch { /* ignore */ }
  }
}
