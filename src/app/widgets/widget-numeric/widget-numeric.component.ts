import { Component, OnDestroy, AfterViewInit, ElementRef, inject, signal, viewChild, effect, untracked, input, OnInit } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { MinichartComponent } from '../minichart/minichart.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { IPathUpdate } from '../../core/services/data.service';
import { CanvasService } from '../../core/services/canvas.service';
import { DatasetService } from '../../core/services/data-set.service';
import { AppService } from '../../core/services/app-service';
import { toSignal } from '@angular/core/rxjs-interop';
import { getColors } from '../../core/utils/themeColors.utils';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

@Component({
  selector: 'widget-numeric',
  templateUrl: './widget-numeric.component.html',
  styleUrls: ['./widget-numeric.component.scss'],
  imports: [NgxResizeObserverModule, MinichartComponent]
})
export class WidgetNumericComponent implements OnInit, AfterViewInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  // Static default so Host2 can merge without instantiating component
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Gauge Label',
    filterSelfPaths: true,
    paths: {
      "numericPath": {
        description: "Numeric Data",
        path: null,
        source: null,
        pathType: "number",
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
  // Instance alias (kept for any legacy access patterns)
  public defaultConfig: IWidgetSvcConfig = WidgetNumericComponent.DEFAULT_CONFIG;

  protected miniChart = viewChild(MinichartComponent);
  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');

  protected showMiniChart = signal<boolean>(false);
  protected app = inject(AppService);
  protected theme = toSignal(this.app.cssThemeColorRoles$, { requireSync: true });
  protected labelColor = signal<string>(undefined);

  private readonly canvas = inject(CanvasService);
  private readonly _dataset = inject(DatasetService);
  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly stream = inject(WidgetStreamsDirective);

  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private backgroundBitmap: HTMLCanvasElement | null = null;
  private backgroundBitmapText: string | null = null;

  private dataValue: number = null;
  private maxValue: number = null;
  private minValue: number = null;
  private lastDrawnValue: number | null = null;
  private lastDrawnMin: number | null = null;
  private lastDrawnMax: number | null = null;
  private valueColor: string = undefined;
  private valueStateColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  private maxMinMaxTextWidth = 0;
  private maxMinMaxTextHeight = 0;
  private streamRegistered = false;
  private isDestroyed = false;

  private onNumericValue = (newValue: IPathUpdate) => {
    this.dataValue = newValue.data.value as number;
    if (this.minValue === null || this.dataValue < this.minValue) {
      this.minValue = this.dataValue;
    } else if (this.maxValue === null || this.dataValue > this.maxValue) {
      this.maxValue = this.dataValue;
    }
    if (!this.runtime?.options().ignoreZones) {
      // No States enum here; assume colors are already in theme
      this.valueStateColor = this.valueColor;
    }
    this.drawWidget();
  };

  constructor() {
    effect(() => {
      const theme = this.theme();

      untracked(() => {
        if (!this.runtime?.options()) return
        if (theme) {
          this.setColors();
          this.drawWidget();
        }
      });
    });

    effect(() => {
      const cfg = this.runtime?.options();
      if (!cfg) return;
      if (this.isDestroyed || !this.canvasCtx) return;
      this.manageDatasetAndChart();
      if (this.showMiniChart() && this.miniChart()) {
        this.setMiniChart();
      }
      this.startWidget();
      this.drawWidget();
    });
  }

  ngOnInit(): void {
    const opts = this.runtime.options();
    if (opts) {
      this.showMiniChart.set(opts.showMiniChart);
    }
  }

  ngAfterViewInit(): void {
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
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.calculateMaxMinTextDimensions();
    if (this.isDestroyed) return;
    this.manageDatasetAndChart();
    if (this.showMiniChart() && this.miniChart()) {
      this.setMiniChart();
    }
    this.startWidget();
  }

  private calculateMaxMinTextDimensions(): void {
    this.maxValueTextWidth = Math.floor(this.cssWidth * 0.85);
    this.maxValueTextHeight = Math.floor(this.cssHeight * 0.70);
    this.maxMinMaxTextWidth = Math.floor(this.cssWidth * 0.57);
    this.maxMinMaxTextHeight = Math.floor(this.cssHeight * 0.1);
  }

  private startWidget(): void {
    if (this.showMiniChart() && this.miniChart()) {
      this.miniChart().startChart();
    }
    this.minValue = null;
    this.maxValue = null;
    this.dataValue = null;
    this.setColors();
    if (!this.streamRegistered) {
      this.stream?.observe('numericPath', this.onNumericValue);
      this.streamRegistered = true;
    }
  }

  private manageDatasetAndChart(): void {
    const cfg = this.runtime.options();
    const pathInfo = cfg.paths['numericPath'];
    const show = !!cfg.showMiniChart;
    this.showMiniChart.set(show);
    if (!show) {
      this._dataset.removeIfExists(this.id(), true);
      return;
    }
    if (!pathInfo || !pathInfo.path) return;
    const source = pathInfo.source ?? 'default';
    const existing = this._dataset.getDatasetConfig(this.id());
    if (!existing) {
      this._dataset.create(pathInfo.path, source, 'minute', 0.2, `simple-chart-${this.id()}`, true, false, this.id());
    } else if (existing.path !== pathInfo.path || existing.pathSource !== source) {
      this._dataset.edit({ ...existing, path: pathInfo.path, pathSource: source });
    }
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
    const unit = cfg.paths['numericPath'].convertUnitTo;
    const marginX = 10 * this.canvas.scaleFactor;
    const marginY = 5 * this.canvas.scaleFactor;
    const bgText = cfg.displayName + '|' + unit;

    if (
      this.backgroundBitmapText === bgText &&
      this.lastDrawnValue === this.dataValue &&
      this.lastDrawnMin === this.minValue &&
      this.lastDrawnMax === this.maxValue
    ) {
      return;
    }

    if (!this.backgroundBitmap ||
      this.backgroundBitmap.width !== this.canvasElement.width ||
      this.backgroundBitmap.height !== this.canvasElement.height ||
      this.backgroundBitmapText !== bgText
    ) {
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
    if (cfg.showMax || cfg.showMin) this.drawMinMax();
    this.lastDrawnValue = this.dataValue;
    this.lastDrawnMin = this.minValue;
    this.lastDrawnMax = this.maxValue;
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
    this._dataset.removeIfExists(this.id(), true);
    try { this.canvas.unregisterCanvas(this.canvasElement); } catch { /* ignore */ }
  }
}
