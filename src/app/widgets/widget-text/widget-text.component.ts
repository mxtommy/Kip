import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';


@Component({
    selector: 'widget-text',
    templateUrl: './widget-text.component.html',
    styleUrls: ['./widget-text.component.css'],
    imports: [ WidgetHostComponent, NgxResizeObserverModule ],
    standalone: true
})
export class WidgetTextComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;

  private readonly fontString = "Roboto";
  dataValue: any = null;
  dataTimestamp: number = Date.now();
  valueFontSize: number = 1;
  currentValueLength: number = 0; // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  canvasCtx: CanvasRenderingContext2D;
  canvasBGCtx: CanvasRenderingContext2D;
  labelColor: string = undefined;
  valueColor: string = undefined;

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Gauge Label',
      filterSelfPaths: true,
      paths: {
        "stringPath": {
          description: "String Data",
          path: null,
          source: null,
          pathType: "string",
          isPathConfigurable: true,
          sampleTime: 500
        }
      },
      color: 'white',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.startWidget();
  }

  protected startWidget(): void {
    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.getColors(this.widgetProperties.config.color);
    this.unsubscribeDataStream();
    this.observeDataStream('stringPath', newValue => {
      this.dataValue = newValue.data.value;
      this.updateCanvas();
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.updateCanvas();
    this.updateCanvasBG();
  }

  ngOnDestroy() {
    this.destroyDataStreams();
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

  protected onResized(event: ResizeObserverEntry) {
    if (event.contentRect.height < 50) { return; }
    if (event.contentRect.width < 50) { return; }
    if ((this.canvasEl.nativeElement.width != Math.floor(event.contentRect.width)) || (this.canvasEl.nativeElement.height != Math.floor(event.contentRect.height))) {
      this.canvasEl.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasEl.nativeElement.height = Math.floor(event.contentRect.height);
      this.canvasBG.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasBG.nativeElement.height = Math.floor(event.contentRect.height);
      this.currentValueLength = 0; //will force resetting the font size
      this.updateCanvas();
      this.updateCanvasBG();
    }
  }

/* ******************************************************************************************* */
/*                                  Canvas drawing                                             */
/* ******************************************************************************************* */

  updateCanvas() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
    }
  }

  updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawTitle();
    }
  }

  drawValue() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85);
    let valueText: string;

    if (this.dataValue === null) {
        valueText = "--";
    } else {
        valueText = this.dataValue;
    }

    // Check if length of string has changed since last time.
    if (this.currentValueLength !== valueText.length) {
        this.currentValueLength = valueText.length;
        this.valueFontSize = this.calculateFontSize(valueText, maxTextWidth, maxTextHeight, this.canvasCtx);
    }

    this.canvasCtx.font = `bold ${this.valueFontSize}px ${this.fontString}`;
    this.canvasCtx.textAlign = "center";
    this.canvasCtx.textBaseline = "middle";
    this.canvasCtx.fillStyle = this.valueColor;
    this.canvasCtx.fillText(valueText, this.canvasEl.nativeElement.width / 2, (this.canvasEl.nativeElement.height / 2) + (this.valueFontSize / 15), maxTextWidth);
  }

  private calculateFontSize(text: string, maxWidth: number, maxHeight: number, ctx: CanvasRenderingContext2D): number {
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

  drawTitle() {
    const displayName = this.widgetProperties.config.displayName;
    if (displayName === null) { return; }
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.94);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.1);
    const fontSize = this.calculateFontSize(displayName, maxTextWidth, maxTextHeight, this.canvasBGCtx);
    this.canvasBGCtx.font = `normal ${fontSize}px ${this.fontString}`;
    this.canvasBGCtx.textAlign = "left";
    this.canvasBGCtx.textBaseline = "top";
    this.canvasBGCtx.fillStyle = this.labelColor;
    this.canvasBGCtx.fillText(displayName, this.canvasEl.nativeElement.width * 0.03, this.canvasEl.nativeElement.height * 0.03, maxTextWidth);
  }
}
