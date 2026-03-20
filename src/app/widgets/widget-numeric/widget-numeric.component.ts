import { Component, OnDestroy, AfterViewInit, ElementRef, inject, signal, viewChild, effect, untracked, input, OnInit, computed } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
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
  public theme = input.required<ITheme|null>();
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
  protected labelColor = signal<string>(undefined);
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private backgroundBitmap: HTMLCanvasElement | null = null;
  private backgroundBitmapText: string | null = null;

  private dataValue: number = null;
  private maxValue: number = null;
  private minValue: number = null;
  private valueColor: string = undefined;
  private valueStateColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  private maxMinMaxTextWidth = 0;
  private maxMinMaxTextHeight = 0;
  private streamRegistered = false;
  private pathDataState: States | null = null;
  private isDestroyed = false;
  private lastSubscriptionSignature: string | null = null;

  private subscriptionSignature = computed(() => {
    const cfg = this.runtime?.options();
    const pathCfg = cfg?.paths?.['numericPath'];
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

    if (!this.runtime?.options().ignoreZones) {
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
    this.showMiniChart.set(this.runtime.options().showMiniChart);
    effect(() => {
      const theme = this.theme();
      const color = this.runtime?.options()?.color;

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
      const cfg = this.runtime?.options();
      const pathInfo = cfg?.paths?.['numericPath'];
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
      this.miniChart().startChart();
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
    const cfg = this.runtime.options();
    const pathInfo = cfg.paths['numericPath'];
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
    const cfg = this.runtime.options();
    const pathInfo = cfg.paths['numericPath'];
    this.miniChart().dataPath = pathInfo?.path ?? null;
    this.miniChart().dataSource = pathInfo?.source ?? 'default';
    this.miniChart().color = cfg.color;
    this.miniChart().convertUnitTo = pathInfo?.convertUnitTo;
    this.miniChart().numDecimal = cfg.numDecimal;
    this.miniChart().yScaleMin = cfg.yScaleMin;
    this.miniChart().yScaleMax = cfg.yScaleMax;
    this.miniChart().inverseYAxis = cfg.inverseYAxis;
    this.miniChart().verticalChart = cfg.verticalChart;
    this.miniChart().datasetUUID = this.id();
  }

  private setColors(): void {
    const cfg = this.runtime.options();
    if (!cfg) return;
    this.labelColor.set(getColors(cfg.color, this.theme()).dim);
    this.valueStateColor = this.valueColor = getColors(cfg.color, this.theme()).color;
    this.backgroundBitmap = null;
    this.backgroundBitmapText = null;
  }

  private drawWidget(): void {
    if (!this.canvasCtx) return;
    const cfg = this.runtime.options();
    if (!cfg) return;
    const unit = cfg.paths['numericPath'].convertUnitTo;
    const marginX = 10 * this.canvas.scaleFactor;
    const marginY = 5 * this.canvas.scaleFactor;
    const bgText = cfg.displayName + '|' + unit;

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
            cfg.displayName,
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
    this.canvas.drawText(
      this.canvasCtx,
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
    const cUnit = this.runtime.options().paths['numericPath'].convertUnitTo;
    if (['latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin', 'D HH:MM:SS'].includes(cUnit)) {
      return this.dataValue.toString();
    }
    return this.applyDecorations(this.dataValue.toFixed(this.runtime.options().numDecimal));
  }

  private drawMinMax(): void {
    const cfg = this.runtime.options();
    if (!cfg.showMin && !cfg.showMax) return;
    let valueText = '';
    if (cfg.showMin) {
      valueText = this.minValue != null ? ` Min: ${this.applyDecorations(this.minValue.toFixed(cfg.numDecimal))}` : ' Min: --';
    }
    if (cfg.showMax) {
      valueText += this.maxValue != null ? ` Max: ${this.applyDecorations(this.maxValue.toFixed(cfg.numDecimal))}` : ' Max: --';
    }
    valueText = valueText.trim();
    const marginX = 10 * this.canvas.scaleFactor;
    const marginY = 5 * this.canvas.scaleFactor;
    this.canvas.drawText(
      this.canvasCtx,
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
    switch (this.runtime.options().paths['numericPath'].convertUnitTo) {
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
