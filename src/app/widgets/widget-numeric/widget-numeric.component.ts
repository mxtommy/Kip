import { Component, OnDestroy, ViewChild, ElementRef, OnInit, AfterViewInit } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { States } from '../../core/interfaces/signalk-interfaces';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';


@Component({
    selector: 'widget-numeric',
    templateUrl: './widget-numeric.component.html',
    styleUrls: ['./widget-numeric.component.scss'],
    standalone: true,
    imports: [ WidgetHostComponent, NgxResizeObserverModule ]
})
export class WidgetNumericComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('canvasEl', {static: true}) canvasEl: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasMM', {static: true}) canvasMM: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasBG', {static: true}) canvasBG: ElementRef<HTMLCanvasElement>;

  private dataValue: number = null;
  private maxValue: number = null;
  private minValue: number = null;
  private labelColor: string = undefined;
  private valueColor: string = undefined;
  private valueStateColor: string = undefined;
  private currentValueLength: number = 0; // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  private currentMinMaxLength: number = 0;
  private valueFontSize: number = 1;
  private minMaxFontSize: number = 1;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  private maxMinMaxTextWidth = 0;
  private maxMinMaxTextHeight = 0;
  private flashInterval = null;
  private isDestroyed = false; // gard against callbacks after destroyed

  private readonly fontString = "Roboto";
  protected canvasValCtx: CanvasRenderingContext2D;
  protected canvasMMCtx: CanvasRenderingContext2D;
  protected canvasBGCtx: CanvasRenderingContext2D;
  private cHeight: number = 0;
  private cWidth: number = 0;

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
  }

  ngOnInit(): void {
    this.validateConfig();
    this.getColors(this.widgetProperties.config.color);
  }

  ngAfterViewInit(): void {
    this.canvasValCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasMMCtx = this.canvasMM.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.cWidth = Math.floor(this.cWidth);
    this.cHeight = Math.floor(this.cHeight);
    document.fonts.ready.then(() => {
      if (this.isDestroyed) return;
      this.startWidget();
      this.updateCanvasBG();
    });
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
            this.valueStateColor = this.theme.zoneAlarm;
            break;
          case States.Warn:
            this.valueStateColor = this.theme.zoneWarn;
            break;
          case States.Alert:
            this.valueStateColor = this.theme.zoneAlert;
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
    this.updateCanvasBG();
  }

  protected onResized(event: ResizeObserverEntry) {
    if (!this.canvasEl || !this.canvasMM || !this.canvasBG) {
      console.error('[Widget Canvas] Canvas elements are not initialized.');
      return;
    }
    if (this.isDestroyed) return;
    if (event.contentRect.height < 50) return;
    if (event.contentRect.width < 50) return;

    if ((this.cWidth != Math.floor(event.contentRect.width)) || (this.cHeight != Math.floor(event.contentRect.height))) {
      this.cWidth = this.canvasEl.nativeElement.width = this.canvasBG.nativeElement.width = this.canvasMM.nativeElement.width = Math.floor(event.contentRect.width);
      this.cHeight = this.canvasEl.nativeElement.height = this.canvasBG.nativeElement.height = this.canvasMM.nativeElement.height = Math.floor(event.contentRect.height);

      this.maxValueTextWidth = Math.floor(this.cWidth * 0.85);
      this.maxValueTextHeight = Math.floor(this.cHeight * 0.85);
      this.maxMinMaxTextWidth = Math.floor(this.cWidth * 0.57);
      this.maxMinMaxTextHeight = Math.floor(this.cHeight * 0.1);

      this.currentValueLength = 0; //will force resetting the font size
      this.currentMinMaxLength = 0;
      document.fonts.ready.then(() => {
        this.updateCanvas();
        this.updateCanvasBG();
      });
    };
  }

  private getColors(color: string): void {
    switch (color) {
      case "white":
        this.labelColor = this.theme.contrastDim;
        this.valueColor = this.theme.contrast;
        break;
      case "blue":
        this.labelColor = this.theme.blueDim;
        this.valueColor = this.theme.blue;
        break;
      case "green":
        this.labelColor = this.theme.greenDim;
        this.valueColor = this.theme.green;
        break;
      case "pink":
        this.labelColor = this.theme.pinkDim;
        this.valueColor = this.theme.pink;
        break;
      case "orange":
        this.labelColor = this.theme.orangeDim;
        this.valueColor = this.theme.orange;
        break;
      case "purple":
        this.labelColor = this.theme.purpleDim;
        this.valueColor = this.theme.purple;
        break;
      case "grey":
        this.labelColor = this.theme.greyDim;
        this.valueColor = this.theme.grey;
        break;
      case "yellow":
        this.labelColor = this.theme.yellowDim;
        this.valueColor = this.theme.yellow;
        break;
      default:
        this.labelColor = this.theme.contrastDim;
        this.valueColor = this.theme.contrast;
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
    this.canvasValCtx.clearRect(0, 0, this.cWidth, this.cHeight);
    this.canvasMMCtx.clearRect(0, 0, this.cWidth, this.cHeight);
    this.canvasBGCtx.clearRect(0, 0, this.cWidth, this.cHeight);
    this.canvasBG.nativeElement.remove();
    this.canvasBG = null;
    this.canvasEl.nativeElement.remove();
    this.canvasEl = null;
    this.canvasMM.nativeElement.remove();
    this.canvasMM = null;
  }

/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
// High resolution scaling see https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas#scaling_for_high_resolution_displays
  private updateCanvas() {
    if (this.canvasValCtx) {
      this.canvasValCtx.clearRect(0, 0, this.cWidth, this.cHeight);
      this.drawValue();
      if (this.widgetProperties.config.showMax || this.widgetProperties.config.showMin) {
        this.canvasMMCtx.clearRect(0, 0, this.cWidth, this.cHeight);
        this.drawMinMax();
      }
    }
  }

  private updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0, 0, this.cWidth, this.cHeight);
      this.drawTitle();
      this.drawUnit();
    }
  }

  private drawValue() {
    const valueText = this.getValueText();

    if (this.currentValueLength !== valueText.length) {
        this.currentValueLength = valueText.length;
        this.valueFontSize = this.calculateOptimalFontSize(valueText, "bold", this.maxValueTextWidth, this.maxValueTextHeight, this.canvasValCtx);
    }

    this.canvasValCtx.font = `bold ${this.valueFontSize}px ${this.fontString}`;
    this.canvasValCtx.fillStyle = this.valueStateColor;
    this.canvasValCtx.textAlign = "center";
    this.canvasValCtx.textBaseline = "middle";
    this.canvasValCtx.fillText(valueText, Math.floor(this.cWidth / 2), Math.floor((this.cHeight * 0.5) + (this.valueFontSize / 15)), this.maxValueTextWidth);
  }

  private getValueText(): string {
    const cUnit = this.widgetProperties.config.paths['numericPath'].convertUnitTo;
    if (this.dataValue === null) {
        return "--";
    }
    if (['latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin', 'HH:MM:SS'].includes(cUnit)) {
        return this.dataValue.toString();
    }

    return this.applyDecorations(this.dataValue.toFixed(this.widgetProperties.config.numDecimal));
  }

  private calculateOptimalFontSize(text: string, fontWeight: string, maxWidth: number, maxHeight: number, ctx: CanvasRenderingContext2D): number {
    let minFontSize = 1;
    let maxFontSize = maxHeight;
    let fontSize = maxFontSize;

    while (minFontSize <= maxFontSize) {
        fontSize = Math.floor((minFontSize + maxFontSize) / 2);
        ctx.font = `${fontWeight} ${fontSize}px ${this.fontString}`;
        const measure = ctx.measureText(text).width;

        if (measure > maxWidth) {
            maxFontSize = fontSize - 1;
        } else {
            minFontSize = fontSize + 1;
        }
    }

    return maxFontSize;
  }

  private drawTitle() {
    const displayName = this.widgetProperties.config.displayName;
    if (displayName === null) { return; }
    const maxTextWidth = Math.floor(this.cWidth * 0.94);
    const maxTextHeight = Math.floor(this.cHeight * 0.1);
    const fontSize = this.calculateOptimalFontSize(displayName, "normal", maxTextWidth, maxTextHeight, this.canvasBGCtx);
    this.canvasBGCtx.font = `normal ${fontSize}px ${this.fontString}`;
    this.canvasBGCtx.textAlign = "left";
    this.canvasBGCtx.textBaseline = "top";
    this.canvasBGCtx.fillStyle = this.labelColor;
    this.canvasBGCtx.fillText(displayName, Math.floor(this.cWidth * 0.03), Math.floor(this.cHeight * 0.03), maxTextWidth);
  }

  private drawUnit() {
    const unit = this.widgetProperties.config.paths['numericPath'].convertUnitTo;
    if (['unitless', 'percent', 'ratio', 'latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin'].includes(unit)) { return; }

    const maxTextWidth = Math.floor(this.cWidth * 0.35);
    const maxTextHeight = Math.floor(this.cHeight * 0.15);
    const fontSize = this.calculateOptimalFontSize(unit, "bold", maxTextWidth, maxTextHeight, this.canvasBGCtx);

    this.canvasBGCtx.font = `bold ${fontSize}px ${this.fontString}`;
    this.canvasBGCtx.textAlign = "right";
    this.canvasBGCtx.textBaseline="bottom";
    this.canvasBGCtx.fillStyle = this.valueColor;
    this.canvasBGCtx.fillText(unit, Math.floor(this.cWidth * 0.97), Math.floor(this.cHeight * 0.97), maxTextWidth);
  }

  private drawMinMax() {
    if (!this.widgetProperties.config.showMin && !this.widgetProperties.config.showMax) { return; }

    let valueText = '';

    if (this.widgetProperties.config.showMin) {
        valueText = this.minValue != null ? ` Min: ${this.applyDecorations(this.minValue.toFixed(this.widgetProperties.config.numDecimal))}` : " Min: --";
    }
    if (this.widgetProperties.config.showMax) {
        valueText += this.maxValue != null ? ` Max: ${this.applyDecorations(this.maxValue.toFixed(this.widgetProperties.config.numDecimal))}` : " Max: --";
    }
    valueText = valueText.trim();

    if (this.currentMinMaxLength !== valueText.length) {
        this.currentMinMaxLength = valueText.length;
        this.minMaxFontSize = this.calculateOptimalFontSize(valueText, "normal", this.maxMinMaxTextWidth, this.maxMinMaxTextHeight, this.canvasMMCtx);
    }

    this.canvasMMCtx.font = `normal ${this.minMaxFontSize}px ${this.fontString}`;
    this.canvasMMCtx.textAlign = "left";
    this.canvasMMCtx.textBaseline = "bottom";
    this.canvasMMCtx.fillStyle = this.valueColor;
    this.canvasMMCtx.fillText(valueText, Math.floor(this.cWidth * 0.03), Math.floor(this.cHeight * 0.9559), this.maxMinMaxTextWidth);
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
