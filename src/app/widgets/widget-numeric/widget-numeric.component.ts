import { Component, OnDestroy, ElementRef, OnInit, AfterViewInit, effect, inject, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { States } from '../../core/interfaces/signalk-interfaces';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { WidgetTitleComponent } from "../../core/components/widget-title/widget-title.component";

@Component({
    selector: 'widget-numeric',
    templateUrl: './widget-numeric.component.html',
    styleUrls: ['./widget-numeric.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent]
})
export class WidgetNumericComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private canvasUnit = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasUnit');
  private canvasMinMax = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMinMax');
  private canvasValue = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasValue');
  private canvas = inject(CanvasService);
  private dataValue: number = null;
  private maxValue: number = null;
  private minValue: number = null;
  protected labelColor: string = undefined;
  private valueColor: string = undefined;
  private valueStateColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  private maxMinMaxTextWidth = 0;
  private maxMinMaxTextHeight = 0;

  private flashInterval = null;
  private isDestroyed = false; // gard against callbacks after destroyed

  protected canvasValCtx: CanvasRenderingContext2D;
  protected canvasMinMaxCtx: CanvasRenderingContext2D;
  protected canvasUnitCtx: CanvasRenderingContext2D;

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
      numInt: 1,
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    };

    effect(() => {
      if (this.theme()) {
        this.getColors(this.widgetProperties.config.color);
        this.updateCanvas();
        this.updateCanvasUnit();
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    const canvasElement = this.canvasValue().nativeElement;
    this.canvas.setHighDPISize(this.canvasValue().nativeElement, canvasElement.parentElement.getBoundingClientRect());
    this.canvas.setHighDPISize(this.canvasUnit().nativeElement, canvasElement.parentElement.getBoundingClientRect());
    this.canvas.setHighDPISize(this.canvasMinMax().nativeElement, canvasElement.parentElement.getBoundingClientRect());
    this.canvasValCtx = this.canvasValue().nativeElement.getContext('2d');
    this.canvasMinMaxCtx = this.canvasMinMax().nativeElement.getContext('2d');
    this.canvasUnitCtx = this.canvasUnit().nativeElement.getContext('2d');

    this.maxValueTextWidth = Math.floor(this.canvasValue().nativeElement.width * 0.85);
    this.maxValueTextHeight = Math.floor(this.canvasValue().nativeElement.height * 0.70);
    this.maxMinMaxTextWidth = Math.floor(this.canvasMinMax().nativeElement.width * 0.57);
    this.maxMinMaxTextHeight = Math.floor(this.canvasMinMax().nativeElement.height * 0.1);
    if (this.isDestroyed) return;
    this.startWidget();
    this.updateCanvasUnit();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.minValue = null;
    this.maxValue = null;
    this.dataValue = null;
    this.getColors(this.widgetProperties.config.color);
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

      this.updateCanvas();
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.updateCanvas();
    this.updateCanvasUnit();
  }

  protected onResized(e: ResizeObserverEntry) {
    if ((e.contentRect.height < 25) || (e.contentRect.width < 25)) return;

    this.canvas.setHighDPISize(this.canvasValue().nativeElement, e.contentRect);
    this.canvas.setHighDPISize(this.canvasUnit().nativeElement, e.contentRect);
    this.canvas.setHighDPISize(this.canvasMinMax().nativeElement, e.contentRect);

    this.maxValueTextWidth = Math.floor(this.canvasValue().nativeElement.width * 0.85);
    this.maxValueTextHeight = Math.floor(this.canvasValue().nativeElement.height * 0.70);
    this.maxMinMaxTextWidth = Math.floor(this.canvasMinMax().nativeElement.width * 0.57);
    this.maxMinMaxTextHeight = Math.floor(this.canvasMinMax().nativeElement.height * 0.1);

    if (this.isDestroyed) return;
    this.updateCanvas();
    this.updateCanvasUnit();
  }

  private getColors(color: string): void {
    switch (color) {
      case "contrast":
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
      case "blue":
        this.labelColor = this.theme().blueDim;
        this.valueColor = this.theme().blue;
        break;
      case "green":
        this.labelColor = this.theme().greenDim;
        this.valueColor = this.theme().green;
        break;
      case "pink":
        this.labelColor = this.theme().pinkDim;
        this.valueColor = this.theme().pink;
        break;
      case "orange":
        this.labelColor = this.theme().orangeDim;
        this.valueColor = this.theme().orange;
        break;
      case "purple":
        this.labelColor = this.theme().purpleDim;
        this.valueColor = this.theme().purple;
        break;
      case "grey":
        this.labelColor = this.theme().greyDim;
        this.valueColor = this.theme().grey;
        break;
      case "yellow":
        this.labelColor = this.theme().yellowDim;
        this.valueColor = this.theme().yellow;
        break;
      default:
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
    }
    this.valueStateColor = this.valueColor;
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
    this.canvas.clearCanvas(this.canvasValCtx, this.canvasValue().nativeElement.width, this.canvasValue().nativeElement.height);
    this.canvas.clearCanvas(this.canvasMinMaxCtx, this.canvasMinMax().nativeElement.width, this.canvasMinMax().nativeElement.height);
    this.canvas.clearCanvas(this.canvasUnitCtx, this.canvasUnit().nativeElement.width, this.canvasUnit().nativeElement.height);
  }

/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
private updateCanvas(): void {
    if (this.canvasValCtx) {
      this.canvas.clearCanvas(this.canvasValCtx, this.canvasValue().nativeElement.width, this.canvasValue().nativeElement.height);
      this.drawValue();
      if (this.widgetProperties.config.showMax || this.widgetProperties.config.showMin) {
        this.canvas.clearCanvas(this.canvasMinMaxCtx, this.canvasMinMax().nativeElement.width, this.canvasMinMax().nativeElement.height);
        this.drawMinMax();
      }
    }
  }

  private updateCanvasUnit(): void {
    if (this.canvasUnitCtx) {
      this.canvas.clearCanvas(this.canvasUnitCtx, this.canvasUnit().nativeElement.width, this.canvasUnit().nativeElement.height);
      this.drawUnit();
    }
  }

  private drawValue(): void {
    const valueText = this.getValueText();
    this.canvas.clearCanvas(this.canvasValCtx, this.canvasValue().nativeElement.width, this.canvasValue().nativeElement.height);
    this.canvas.drawText(
      this.canvasValCtx,
      valueText,
      Math.floor(this.canvasValue().nativeElement.width / 2),
      Math.floor((this.canvasValue().nativeElement.height / 2) * 1.15),
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
    if (['latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin', 'HH:MM:SS'].includes(cUnit)) {
        return this.dataValue.toString();
    }

    return this.applyDecorations(this.dataValue.toFixed(this.widgetProperties.config.numDecimal));
  }

  private drawUnit(): void {
    const unit = this.widgetProperties.config.paths['numericPath'].convertUnitTo;
    if (['unitless', 'percent', 'ratio', 'latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin'].includes(unit)) return;

    this.canvas.drawText(
      this.canvasUnitCtx,
      unit,
      Math.floor(this.canvasUnit().nativeElement.width - 10 * this.canvas.scaleFactor),
      Math.floor(this.canvasUnit().nativeElement.height - 10 * this.canvas.scaleFactor),
      Math.floor(this.canvasUnit().nativeElement.width * 0.25),
      Math.floor(this.canvasUnit().nativeElement.height * 0.15),
      'bold',
      this.valueColor,
      'end',
      'alphabetic'
    );
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

    this.canvas.drawText(
      this.canvasMinMaxCtx,
      valueText,
      10 * this.canvas.scaleFactor,
      Math.floor(this.canvasMinMax().nativeElement.height - 10 * this.canvas.scaleFactor),
      this.maxMinMaxTextWidth,
      this.maxMinMaxTextHeight,
      'normal',
      this.valueColor,
      'start',
      'alphabetic'
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
