import { Component, OnDestroy, ViewChild, ElementRef, OnInit } from '@angular/core';
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
export class WidgetNumericComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasMM', {static: true, read: ElementRef}) canvasMM: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;

  dataValue: number = null;
  maxValue: number = null;
  minValue: number = null;
  labelColor: string = undefined;
  valueColor: string = undefined;
  dataTimestamp: number = Date.now();
  currentValueLength: number = 0; // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  currentMinMaxLength: number = 0;
  valueFontSize: number = 1;
  minMaxFontSize: number = 1;
  flashOn: boolean = true;
  flashInterval = null;
  dataState: string = States.Normal;

  private readonly fontString = "Roboto";
  canvasValCtx: CanvasRenderingContext2D;
  canvasMMCtx: CanvasRenderingContext2D;
  canvasBGCtx: CanvasRenderingContext2D;

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
      color: 'white',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit(): void {
    this.validateConfig();
    this.startWidget();
  }

  protected startWidget(): void {
    this.canvasValCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasMMCtx = this.canvasMM.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.getColors(this.widgetProperties.config.color);
    this.unsubscribeDataStream();
    this.observeDataStream('numericPath', newValue => {
      this.dataValue = newValue.data.value;

      // Initialize min/max
      if (this.minValue === null || this.dataValue < this.minValue) {
        this.minValue = this.dataValue;
      } else if (this.maxValue === null || this.dataValue > this.maxValue) {
        this.maxValue = this.dataValue;
      }

      if (this.dataState != newValue.state) {
        clearInterval(this.flashInterval);
        this.flashInterval = null;
        this.dataState = newValue.state;

        switch (newValue.state) {
          case States.Alarm:
            this.flashInterval = setInterval(() => {
              this.updateCanvasBG();
            }, 200);
            break;
          case States.Warn:
            this.flashInterval = setInterval(() => {
              this.updateCanvasBG();
            }, 400);
            break;
          case States.Alert:
            this.flashInterval = setInterval(() => {
              this.updateCanvasBG();
            }, 800);
          break;
          default:
            this.updateCanvasBG();
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
    if (event.contentRect.height < 50) { return; }
    if (event.contentRect.width < 50) { return; }
    if ((this.canvasEl.nativeElement.width != Math.floor(event.contentRect.width)) || (this.canvasEl.nativeElement.height != Math.floor(event.contentRect.height))) {
      this.canvasEl.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasEl.nativeElement.height = Math.floor(event.contentRect.height);
      this.canvasMM.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasMM.nativeElement.height = Math.floor(event.contentRect.height);
      this.canvasBG.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasBG.nativeElement.height = Math.floor(event.contentRect.height);
      this.currentValueLength = 0; //will force resetting the font size
      this.currentMinMaxLength = 0;
      this.updateCanvas();
      this.updateCanvasBG();
    }
  }

  private getColors(color: string): void {
    switch (color) {
      case "white":
        this.labelColor = this.theme.whiteDim;
        this.valueColor = this.theme.white;
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
        this.labelColor = this.theme.whiteDim;
        this.valueColor = this.theme.white;
        break;
    }
  }

  ngOnDestroy() {
    this.destroyDataStreams();
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
  }

/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
//TODO: Better canvas scaling see https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
  private updateCanvas() {
    if (this.canvasValCtx) {
      this.canvasValCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
      if (this.widgetProperties.config.showMax || this.widgetProperties.config.showMin) {
        this.canvasMMCtx.clearRect(0,0,this.canvasMM.nativeElement.width, this.canvasMM.nativeElement.height);
        this.drawMinMax();
      }
    }
  }

  private updateCanvasBG() {
    if (this.canvasBGCtx) {
      switch (this.dataState) {
          case States.Alarm:
              this.handleFlash(this.theme.zoneAlarm);
              break;
          case States.Warn:
              this.handleFlash(this.theme.zoneWarn);
              break;
          case States.Alert:
              this.handleFlash(this.theme.zoneAlert);
              break;
          default:
              this.canvasBGCtx.clearRect(0, 0, this.canvasBG.nativeElement.width, this.canvasBG.nativeElement.height);
              break;
      }

      this.flashOn = !this.flashOn;
      this.drawTitle();
      this.drawUnit();
    }
  }

  private handleFlash(color: string) {
    if (this.flashOn) {
        this.canvasBGCtx.fillStyle = color;
        this.canvasBGCtx.fillRect(0, 0, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
    } else {
        this.canvasBGCtx.clearRect(0, 0, this.canvasBG.nativeElement.width, this.canvasBG.nativeElement.height);
    }
  }

  private drawValue() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85);
    const valueText = this.getValueText();

    if (this.currentValueLength !== valueText.length) {
        this.currentValueLength = valueText.length;
        this.valueFontSize = this.calculateOptimalFontSize(valueText, maxTextWidth, maxTextHeight, this.canvasValCtx);
    }
    this.canvasValCtx.font = `bold ${this.valueFontSize}px ${this.fontString}`;
    this.canvasValCtx.fillStyle = this.valueColor;
    this.canvasValCtx.textAlign = "center";
    this.canvasValCtx.textBaseline = "middle";
    this.canvasValCtx.fillText(valueText, this.canvasEl.nativeElement.width / 2, (this.canvasEl.nativeElement.height * 0.5) + (this.valueFontSize / 15), maxTextWidth);
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

  private calculateOptimalFontSize(text: string, maxWidth: number, maxHeight: number, ctx: CanvasRenderingContext2D): number {
      let minFontSize = 1;
      let maxFontSize = maxHeight;
      let fontSize = maxFontSize;

      while (minFontSize <= maxFontSize) {
          fontSize = Math.floor((minFontSize + maxFontSize) / 2);
          ctx.font = `bold ${fontSize}px ${this.fontString}`;
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
      const maxTextWidth = Math.floor(this.canvasBG.nativeElement.width * 0.94);
      const maxTextHeight = Math.floor(this.canvasBG.nativeElement.height * 0.1);
      const fontSize = this.calculateOptimalFontSize(displayName, maxTextWidth, maxTextHeight, this.canvasBGCtx);
      this.canvasBGCtx.font = `normal ${fontSize}px ${this.fontString}`;
      this.canvasBGCtx.textAlign = "left";
      this.canvasBGCtx.textBaseline = "top";
      this.canvasBGCtx.fillStyle = this.labelColor;
      this.canvasBGCtx.fillText(displayName, this.canvasBG.nativeElement.width * 0.03, this.canvasBG.nativeElement.height * 0.03, maxTextWidth);
    }

    private drawUnit() {
      const unit = this.widgetProperties.config.paths['numericPath'].convertUnitTo;
      if (['unitless', 'percent', 'ratio', 'latitudeSec', 'latitudeMin', 'longitudeSec', 'longitudeMin'].includes(unit)) { return; }

      const maxTextWidth = Math.floor(this.canvasBG.nativeElement.width * 0.35);
      const maxTextHeight = Math.floor(this.canvasBG.nativeElement.height * 0.15);
      const fontSize = this.calculateOptimalFontSize(unit, maxTextWidth, maxTextHeight, this.canvasBGCtx);

      this.canvasBGCtx.font = `bold ${fontSize}px ${this.fontString}`;
      this.canvasBGCtx.textAlign = "right";
      this.canvasBGCtx.textBaseline="bottom";
      this.canvasBGCtx.fillStyle = this.valueColor;
      this.canvasBGCtx.fillText(unit,this.canvasBG.nativeElement.width*0.97,this.canvasBG.nativeElement.height*0.97, maxTextWidth);
    }

    private drawMinMax() {
      if (!this.widgetProperties.config.showMin && !this.widgetProperties.config.showMax) { return; }

      let valueText = '';
      const maxTextWidth = Math.floor(this.canvasMM.nativeElement.width * 0.57);
      const maxTextHeight = Math.floor(this.canvasMM.nativeElement.height * 0.1);

      if (this.widgetProperties.config.showMin) {
          valueText = this.minValue != null ? ` Min: ${this.applyDecorations(this.minValue.toFixed(this.widgetProperties.config.numDecimal))}` : " Min: --";
      }
      if (this.widgetProperties.config.showMax) {
          valueText += this.maxValue != null ? ` Max: ${this.applyDecorations(this.maxValue.toFixed(this.widgetProperties.config.numDecimal))}` : " Max: --";
      }
      valueText = valueText.trim();

      if (this.currentMinMaxLength !== valueText.length) {
          this.currentMinMaxLength = valueText.length;
          this.minMaxFontSize = this.calculateOptimalFontSize(valueText, maxTextWidth, maxTextHeight, this.canvasMMCtx);
      }

      this.canvasMMCtx.font = `normal ${this.minMaxFontSize}px ${this.fontString}`;
      this.canvasMMCtx.textAlign = "left";
      this.canvasMMCtx.textBaseline = "bottom";
      this.canvasMMCtx.fillStyle = this.valueColor;
      this.canvasMMCtx.fillText(valueText, this.canvasMM.nativeElement.width * 0.03, this.canvasMM.nativeElement.height * 0.95, maxTextWidth);
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
