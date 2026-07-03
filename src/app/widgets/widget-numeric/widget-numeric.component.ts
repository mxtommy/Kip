import { Component, OnDestroy, AfterViewInit, ElementRef, inject, signal, viewChild, effect, untracked, input, OnInit, computed } from '@angular/core';
import type { IWidgetPath, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { MinichartComponent } from '../minichart/minichart.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { IPathUpdate } from '../../core/services/data.service';
import { CanvasService } from '../../core/services/canvas.service';
import { WidgetDatasetOrchestratorService } from '../../core/services/widget-dataset-orchestrator.service';
import { ITheme } from '../../core/services/app-service';
import { getColors } from '../../core/utils/themeColors.utils';
import { States } from '../../core/interfaces/signalk-interfaces';

@Component({
  selector: 'widget-numeric',
  templateUrl: './widget-numeric.component.html',
  styleUrls: ['./widget-numeric.component.scss'],
  imports: [MinichartComponent]
})
export class WidgetNumericComponent implements OnInit, AfterViewInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme>();
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    supportAutomaticHistoricalSeries: true,
    displayName: 'Gauge Label',
    filterSelfPaths: true,
    paths: {
      "numericPath": {
        description: "Numeric Data",
        path: null,
        source: null,
        pathType: "number",
        suppressBootstrapNull: true,
        isPathConfigurable: true,
        convertUnitTo: "unitless",
        showPathSkUnitsFilter: true,
        pathSkUnitsFilter: null,
        sampleTime: 500
      }
    },
    showMax: false,
    showMin: false,
    numDecimal: 1,
    showMiniChart: false,
    yScaleMin: 0,
    yScaleMax: 10,
    inverseYAxis: false,
    verticalChart: false,
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5,
    ignoreZones: false
  };
  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly stream = inject(WidgetStreamsDirective);

  private readonly canvas = inject(CanvasService);
  private readonly datasetLifecycle = inject(WidgetDatasetOrchestratorService);
  protected miniChart = viewChild(MinichartComponent);
  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');

  protected showMiniChart = signal<boolean>(false);
  protected labelColor = signal<string>('');
  private canvasElement!: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private cssWidth = 0;
  private cssHeight = 0;
  private backgroundBitmap: HTMLCanvasElement | null = null;
  private backgroundBitmapText: string | null = null;

  private dataValue: number | null = null;
  private maxValue: number | null = null;
  private minValue: number | null = null;
  private valueColor = '';
  private valueStateColor = '';
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  private maxMinMaxTextWidth = 0;
  private maxMinMaxTextHeight = 0;
  private streamRegistered = false;
  private pathDataState: States | null = null;
  private isDestroyed = false;
  private lastSubscriptionSignature: string | null = null;
  private readonly normalizedConfig = computed<IWidgetSvcConfig>(() => this.runtime.options() ?? WidgetNumericComponent.DEFAULT_CONFIG);
  private readonly numericPathConfig = computed<IWidgetPath | undefined>(() => {
    const paths = this.normalizedConfig().paths as Record<string, IWidgetPath> | undefined;
    return paths?.numericPath;
  });

  private subscriptionSignature = computed(() => {
    const cfg = this.normalizedConfig();
    const pathCfg = this.numericPathConfig();
    if (!pathCfg?.path) return null;
    const src = (pathCfg.source?.trim() || 'default');
    return [
      pathCfg.path,
      pathCfg.pathType,
      pathCfg.sampleTime,
      pathCfg.convertUnitTo,
      src,
      pathCfg.suppressBootstrapNull ? '1' : '0'
    ].join('|');
  });

  private onNumericValue = (newValue: IPathUpdate) => {
    this.dataValue = newValue.data.value as number;
    if (this.minValue === null || this.dataValue < this.minValue) {
      this.minValue = this.dataValue;
    } else if (this.maxValue === null || this.dataValue > this.maxValue) {
      this.maxValue = this.dataValue;
    }

    if (!this.normalizedConfig().ignoreZones) {
      if (this.pathDataState !== newValue.state) {
        this.pathDataState = newValue.state as States;
        switch (newValue.state) {
          case States.Alarm:
            this.valueStateColor = this.theme().zoneAlarm;
            break;
          case States.Warn:
            this.valueStateColor = this.theme().zoneWarn;
            break;
          case States.Alert:
            this.valueStateColor = this.theme().zoneAlert;
            break;
          default:
            this.valueStateColor = this.valueColor;
            break;
        }
      }
    }
    this.drawWidget();
  };

  constructor() {
    this.showMiniChart.set(this.normalizedConfig().showMiniChart ?? false);
    effect(() => {
      const theme = this.theme();
      const color = this.normalizedConfig().color;

      untracked(() => {
        if (theme && color !== undefined) {
          this.setColors();
          this.drawWidget();
        }
      });
    });

    effect(() => {
      const sig = this.subscriptionSignature();
      untracked(() => {
        if (this.isDestroyed || !this.canvasCtx) return;

        // Guard: if subscription signature unchanged and already subscribed, skip
        if (sig === this.lastSubscriptionSignature && this.streamRegistered) {
          return;
        }

        // Subscription changed: reset state and subscribe
        this.minValue = null;
        this.maxValue = null;
        this.dataValue = null;
        this.pathDataState = null;
        this.lastSubscriptionSignature = sig;

        if (sig) {
          this.stream?.observe('numericPath', this.onNumericValue);
          this.streamRegistered = true;
          this.manageDatasetAndChart();
        }
      });
    });

    effect(() => {
      const show = this.showMiniChart();
      const chart = this.miniChart();
      const cfg = this.normalizedConfig();
      const pathInfo = this.numericPathConfig();
      const miniChartSignature = [
        cfg?.showMiniChart ? '1' : '0',
        pathInfo?.path ?? '',
        pathInfo?.source ?? 'default',
        pathInfo?.convertUnitTo ?? '',
        cfg?.numDecimal ?? '',
        cfg?.yScaleMin ?? '',
        cfg?.yScaleMax ?? '',
        cfg?.inverseYAxis ? '1' : '0',
        cfg?.verticalChart ? '1' : '0',
        cfg?.color ?? ''
      ].join('|');
      if (!miniChartSignature) return;
      if (!show) return;
      if (!chart) return; // will re-run when present
      this.setMiniChart();
      chart.startChart();
    });
  }

  ngOnInit(): void {
    this.setColors();
    this.canvasElement = this.canvasMainRef().nativeElement;
    this.canvasCtx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w;
        this.cssHeight = h;
        this.calculateMaxMinTextDimensions();
        this.drawWidget();
      },
    });
  }

  ngAfterViewInit(): void {
    if (this.isDestroyed) return;

    // Effects will auto-run when subscriptionSignature is first accessed
    // This is a sanity check in case subscription effect hasn't fired yet
    if (!this.streamRegistered && this.subscriptionSignature()) {
      this.stream?.observe('numericPath', this.onNumericValue);
      this.streamRegistered = true;
      this.manageDatasetAndChart();
    }
  }

  private calculateMaxMinTextDimensions(): void {
    this.maxValueTextWidth = Math.floor(this.cssWidth * 0.85);
    this.maxValueTextHeight = Math.floor(this.cssHeight * 0.70);
    this.maxMinMaxTextWidth = Math.floor(this.cssWidth * 0.57);
    this.maxMinMaxTextHeight = Math.floor(this.cssHeight * 0.1);
  }

  private manageDatasetAndChart(): void {
    const cfg = this.normalizedConfig();
    const pathInfo = this.numericPathConfig();
    const show = !!cfg.showMiniChart;
    this.showMiniChart.set(show);
    if (!show) {
      this.datasetLifecycle.removeDatasetIfExists(this.id(), false);
      return;
    }
    if (!pathInfo || !pathInfo.path) return;
    const source = pathInfo.source ?? 'default';
    this.datasetLifecycle.syncNumericMiniChartDataset(this.id(), pathInfo.path, source);
  }

  private setMiniChart(): void {
    const chart = this.miniChart();
    const cfg = this.normalizedConfig();
    const pathInfo = this.numericPathConfig();
    if (!chart) return;

    chart.dataPath = pathInfo?.path ?? null;
    chart.dataSource = pathInfo?.source ?? 'default';
    chart.color = cfg.color ?? 'contrast';
    chart.convertUnitTo = pathInfo?.convertUnitTo ?? null;
    chart.numDecimal = cfg.numDecimal ?? null;
    chart.yScaleMin = cfg.yScaleMin ?? null;
    chart.yScaleMax = cfg.yScaleMax ?? null;
    chart.inverseYAxis = cfg.inverseYAxis ?? false;
    chart.verticalChart = cfg.verticalChart ?? null;
    chart.datasetUUID = this.id();
  }

  private setColors(): void {
    const cfg = this.normalizedConfig();
    const theme = this.theme();
    const color = cfg.color ?? 'contrast';
    this.labelColor.set(getColors(color, theme).dim);
    this.valueStateColor = this.valueColor = getColors(color, theme).color;
    this.backgroundBitmap = null;
    this.backgroundBitmapText = null;
  }

  private drawWidget(): void {
    if (!this.canvasCtx) return;
    const cfg = this.normalizedConfig();
    const unit = this.numericPathConfig()?.convertUnitTo ?? '';
    const marginX = 10 * this.canvas.scaleFactor;
    const marginY = 5 * this.canvas.scaleFactor;
    const bgText = (cfg.displayName ?? '') + '|' + unit;

    if (!this.backgroundBitmap ||
        this.backgroundBitmap.width !== this.canvasElement.width ||
        this.backgroundBitmap.height !== this.canvasElement.height ||
        this.backgroundBitmapText !== bgText) {
      this.backgroundBitmap = this.canvas.renderStaticToBitmap(
        this.canvasCtx,
        this.cssWidth,
        this.cssHeight,
        (ctx) => {
          this.canvas['drawTitleInternal'](
            ctx,
            cfg.displayName ?? '',
            this.labelColor(),
            'normal',
            this.cssWidth,
            this.cssHeight,
            0.1
          );
          if (!['unitless', 'percent', 'ratio', 'latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin'].includes(unit)) {
            this.canvas.drawText(
              ctx,
              unit,
              this.cssWidth - marginX,
              this.cssHeight - marginY,
              Math.floor(this.cssWidth * 0.25),
              Math.floor(this.cssHeight * 0.15),
              'bold',
              this.valueColor,
              'end',
              'bottom'
            );
          }
        }
      );
      this.backgroundBitmapText = bgText;
    }

    this.canvas.clearCanvas(this.canvasCtx, this.cssWidth, this.cssHeight);
    if (this.backgroundBitmap && this.backgroundBitmap.width > 0 && this.backgroundBitmap.height > 0) {
      this.canvasCtx.drawImage(this.backgroundBitmap, 0, 0, this.cssWidth, this.cssHeight);
    }

    this.drawValue();
    if (cfg.showMax || cfg.showMin) {
      this.drawMinMax();
    }
  }

  private drawValue(): void {
    const valueText = this.getValueText();
    const ctx = this.canvasCtx;
    if (!ctx) return;
    this.canvas.drawText(
      ctx,
      valueText,
      Math.floor(this.cssWidth / 2),
      Math.floor((this.cssHeight / 2) * 1.15),
      this.maxValueTextWidth,
      this.maxValueTextHeight,
      'bold',
      this.valueStateColor
    );
  }

  private getValueText(): string {
    if (this.dataValue === null) return "--";
    const cfg = this.normalizedConfig();
    const cUnit = this.numericPathConfig()?.convertUnitTo ?? '';
    if (['latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin', 'D HH:MM:SS'].includes(cUnit)) {
      return this.dataValue.toString();
    }
    return this.applyDecorations(this.dataValue.toFixed(cfg.numDecimal ?? 1));
  }

  private drawMinMax(): void {
    const cfg = this.normalizedConfig();
    if (!cfg.showMin && !cfg.showMax) return;
    const decimals = cfg.numDecimal ?? 1;
    let valueText = '';
    if (cfg.showMin) {
      valueText = this.minValue != null ? ` Min: ${this.applyDecorations(this.minValue.toFixed(decimals))}` : ' Min: --';
    }
    if (cfg.showMax) {
      valueText += this.maxValue != null ? ` Max: ${this.applyDecorations(this.maxValue.toFixed(decimals))}` : ' Max: --';
    }
    valueText = valueText.trim();
    const marginX = 10 * this.canvas.scaleFactor;
    const marginY = 5 * this.canvas.scaleFactor;
    const ctx = this.canvasCtx;
    if (!ctx) return;
    this.canvas.drawText(
      ctx,
      valueText,
      marginX,
      Math.floor(this.cssHeight - marginY),
      this.maxMinMaxTextWidth,
      this.maxMinMaxTextHeight,
      'normal',
      this.valueColor,
      'start',
      'bottom'
    );
  }

  private applyDecorations(txtValue: string): string {
    switch (this.numericPathConfig()?.convertUnitTo ?? '') {
      case 'percent':
      case 'percentraw':
        txtValue += '%';
        break;
    }
    return txtValue;
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.datasetLifecycle.removeDatasetIfExists(this.id(), false);
    try { this.canvas.unregisterCanvas(this.canvasElement); } catch { /* ignore */ }
  }
}
