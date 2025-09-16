import { Component, OnDestroy, ElementRef, OnInit, AfterViewInit, effect, inject, viewChild, signal } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { States } from '../../core/interfaces/signalk-interfaces';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { getColors } from '../../core/utils/themeColors.utils';
import { MinichartComponent } from '../minichart/minichart.component';
import { DatasetService } from '../../core/services/data-set.service';

@Component({
  selector: 'widget-numeric',
  templateUrl: './widget-numeric.component.html',
  styleUrls: ['./widget-numeric.component.scss'],
  imports: [WidgetHostComponent, NgxResizeObserverModule, MinichartComponent]
})
export class WidgetNumericComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  protected miniChart = viewChild(MinichartComponent);
  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private backgroundBitmap: HTMLCanvasElement | null = null;
  private backgroundBitmapText: string | null = null;
  protected showMiniChart = signal<boolean>(false);
  private readonly canvas = inject(CanvasService);
  private readonly _dataset = inject(DatasetService);
  private dataValue: number = null;
  private maxValue: number = null;
  private minValue: number = null;
  protected labelColor = signal<string>(undefined);
  private valueColor: string = undefined;
  private valueStateColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  private maxMinMaxTextWidth = 0;
  private maxMinMaxTextHeight = 0;

  private flashInterval = null;
  private isDestroyed = false; // gard against callbacks after destroyed

  constructor() {
    super();

    this.defaultConfig = {
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

    effect(() => {
      if (this.theme()) {
        this.setColors();
        this.drawWidget();
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
    this.showMiniChart.set(this.widgetProperties.config.showMiniChart);
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

  protected startWidget(): void {
    if (this.showMiniChart() && this.miniChart()) {
      this.miniChart().startChart();
    }
    this.unsubscribeDataStream();
    this.minValue = null;
    this.maxValue = null;
    this.dataValue = null;
    this.setColors();
    this.observeDataStream('numericPath', newValue => {
      this.dataValue = newValue.data.value;
      // Initialize min/max
      if (this.minValue === null || this.dataValue < this.minValue) {
        this.minValue = this.dataValue;
      } else if (this.maxValue === null || this.dataValue > this.maxValue) {
        this.maxValue = this.dataValue;
      }
      if (!this.widgetProperties.config.ignoreZones) {
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

      this.drawWidget();
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;

    this.manageDatasetAndChart();

    // Defer to next tick so viewChild is ready if just shown
    setTimeout(() => {
      if (this.showMiniChart() && this.miniChart()) {
        this.setMiniChart();
      }
      this.startWidget();
      this.drawWidget();
    });
  }

  private manageDatasetAndChart(): void {
    const pathInfo = this.widgetProperties.config.paths['numericPath'];
    if (!pathInfo || !pathInfo.path || !pathInfo.source) return;

    if (this.widgetProperties.config.showMiniChart) {
      if (this._dataset.list().filter(ds => ds.uuid === this.widgetProperties.uuid).length === 0) {
        this._dataset.create(pathInfo.path, pathInfo.source, 'minute', 0.2, `simple-chart-${this.widgetProperties.uuid}`, true, false, this.widgetProperties.uuid);
      }
    } else {
      // Remove dataset if it exists
      this._dataset.list()
        .filter(ds => ds.uuid === this.widgetProperties.uuid)
        .forEach(ds => this._dataset.remove(ds.uuid));
    }

    this.showMiniChart.set(this.widgetProperties.config.showMiniChart);
  }

  private setMiniChart(): void {
    this.miniChart().dataPath = this.widgetProperties.config.paths['numericPath'].path;
    this.miniChart().dataSource = this.widgetProperties.config.paths['numericPath'].source;
    this.miniChart().color = this.widgetProperties.config.color;
    this.miniChart().convertUnitTo = this.widgetProperties.config.paths['numericPath'].convertUnitTo;
    this.miniChart().numDecimal = this.widgetProperties.config.numDecimal;
    this.miniChart().yScaleMin = this.widgetProperties.config.yScaleMin;
    this.miniChart().yScaleMax = this.widgetProperties.config.yScaleMax;
    this.miniChart().inverseYAxis = this.widgetProperties.config.inverseYAxis;
    this.miniChart().verticalChart = this.widgetProperties.config.verticalChart;
    this.miniChart().datasetUUID = this.widgetProperties.uuid;
  }

  private setColors(): void {
    this.labelColor.set(getColors(this.widgetProperties.config.color, this.theme()).dim);
    this.valueStateColor = this.valueColor = getColors(this.widgetProperties.config.color, this.theme()).color;
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
    // Remove associated mini-chart dataset if present
    this._dataset.removeIfExists(this.widgetProperties?.uuid, true);
    try { this.canvas.unregisterCanvas(this.canvasElement); }
    catch { /* ignore */ }
  }

  /* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */
  private drawWidget(): void {
    if (!this.canvasCtx) return;
    // Compose background bitmap with title and unit
    const unit = this.widgetProperties.config.paths['numericPath'].convertUnitTo;
    const marginX = 10 * this.canvas.scaleFactor;
    const marginY = 5 * this.canvas.scaleFactor;
    if (!this.backgroundBitmap ||
      this.backgroundBitmap.width !== this.canvasElement.width ||
      this.backgroundBitmap.height !== this.canvasElement.height ||
      this.backgroundBitmapText !== this.widgetProperties.config.displayName + '|' + unit
    ) {
      this.backgroundBitmap = this.canvas.renderStaticToBitmap(
        this.canvasCtx,
        this.cssWidth,
        this.cssHeight,
        (ctx) => {
          // Draw the title (same as before)
          this.canvas['drawTitleInternal'](
            ctx,
            this.widgetProperties.config.displayName,
            this.labelColor(),
            'normal',
            this.cssWidth,
            this.cssHeight,
            0.1 // titleFraction
          );
          // Draw the unit (same as drawUnit)
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
      this.backgroundBitmapText = this.widgetProperties.config.displayName + '|' + unit;
    }

    this.canvas.clearCanvas(this.canvasCtx, this.cssWidth, this.cssHeight);

    if (
      this.backgroundBitmap &&
      this.backgroundBitmap.width > 0 &&
      this.backgroundBitmap.height > 0
    ) {
      this.canvasCtx.drawImage(this.backgroundBitmap, 0, 0, this.cssWidth, this.cssHeight);
    }
    this.drawValue();
    if (this.widgetProperties.config.showMax || this.widgetProperties.config.showMin) {
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
    if (this.dataValue === null) {
      return "--";
    }

    const cUnit = this.widgetProperties.config.paths['numericPath'].convertUnitTo;
    if (['latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin', 'D HH:MM:SS'].includes(cUnit)) {
      return this.dataValue.toString();
    }

    return this.applyDecorations(this.dataValue.toFixed(this.widgetProperties.config.numDecimal));
  }

  private drawMinMax(): void {

    if (!this.widgetProperties.config.showMin && !this.widgetProperties.config.showMax) return;

    let valueText = '';
    if (this.widgetProperties.config.showMin) {
      valueText = this.minValue != null ? ` Min: ${this.applyDecorations(this.minValue.toFixed(this.widgetProperties.config.numDecimal))}` : ' Min: --';
    }
    if (this.widgetProperties.config.showMax) {
      valueText += this.maxValue != null ? ` Max: ${this.applyDecorations(this.maxValue.toFixed(this.widgetProperties.config.numDecimal))}` : ' Max: --';
    }
    valueText = valueText.trim();
    const marginX = 10 * this.canvas.scaleFactor;
    const marginY = 5 * this.canvas.scaleFactor;
    const canvasHeight = this.cssHeight;
    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      marginX, // X: left edge plus margin
      Math.floor(canvasHeight - marginY), // Y: bottom edge minus margin
      this.maxMinMaxTextWidth,
      this.maxMinMaxTextHeight,
      'normal',
      this.valueColor,
      'start',      // left-aligned
      'bottom'  // baseline at the bottom
    );
  }

  private applyDecorations(txtValue: string): string {
    // apply decoration when required
    switch (this.widgetProperties.config.paths['numericPath'].convertUnitTo) {
      case 'percent':
      case 'percentraw':
        txtValue += '%';
        break;
      default:
        break;
    }
    return txtValue;
  }
}
