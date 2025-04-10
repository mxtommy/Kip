import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
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
export class WidgetTextComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('canvasEl', {static: true}) canvasEl: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasBG', {static: true}) canvasBG: ElementRef<HTMLCanvasElement>;

  private readonly fontString = "Roboto";
  private dataValue: any = null;
  private valueFontSize: number = 1;
  private currentValueLength: number = 0; // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  private canvasCtx: CanvasRenderingContext2D;
  private canvasBGCtx: CanvasRenderingContext2D;
  private labelColor: string = undefined;
  private valueColor: string = undefined;
  private isDestroyed = false; // guard against callbacks after destroyed
  private cWidth: number = 0;
  private cHeight: number = 0;
  private maxTextWidth = 0;
  private maxTextHeight = 0;

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
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.cWidth = Math.floor(this.canvasEl.nativeElement.width);
    this.cHeight = Math.floor(this.canvasEl.nativeElement.height);
    this.maxTextWidth = Math.floor(this.cWidth * 0.85);
    this.maxTextHeight = Math.floor(this.cHeight * 0.85);
    document.fonts.ready.then(() => {
      if (this.isDestroyed) return;
      this.getColors(this.widgetProperties.config.color);
      this.startWidget();
    });
  }

  protected startWidget(): void {
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
    this.isDestroyed = true;
    this.destroyDataStreams();
    this.canvasCtx.clearRect(0,0,this.cWidth, this.cHeight);
    this.canvasBGCtx.clearRect(0,0,this.cWidth, this.cHeight);
    this.canvasEl.nativeElement.remove();
    this.canvasBG.nativeElement.remove();
    this.canvasEl = null;
    this.canvasBG = null;
  }

  private getColors(color: string): void {
    switch (color) {
      case "contrast":
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
  }

  protected onResized(event: ResizeObserverEntry) {
    if (event.contentRect.height < 50) { return; }
    if (event.contentRect.width < 50) { return; }
    if ((this.cWidth != Math.floor(event.contentRect.width)) || (this.cHeight != Math.floor(event.contentRect.height))) {
      this.cWidth = this.canvasEl.nativeElement.width = this.canvasBG.nativeElement.width = Math.floor(event.contentRect.width);
      this.cHeight = this.canvasEl.nativeElement.height = this.canvasBG.nativeElement.height = Math.floor(event.contentRect.height);

      this.currentValueLength = 0; //will force resetting the font size
      this.maxTextWidth = Math.floor(this.cWidth * 0.85);
      this.maxTextHeight = Math.floor(this.cHeight * 0.85);
      document.fonts.ready.then(() => {
        if (this.isDestroyed) return;
        this.updateCanvas();
        this.updateCanvasBG();
      });
    }
  }

/* ******************************************************************************************* */
/*                                  Canvas drawing                                             */
/* ******************************************************************************************* */

  updateCanvas() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0,0,this.cWidth, this.cHeight);
      this.drawValue();
    }
  }

  updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0,0,this.cWidth, this.cHeight);
      this.drawTitle();
    }
  }

  drawValue() {
    let valueText: string;

    if (this.dataValue === null) {
        valueText = "--";
    } else {
        valueText = this.dataValue;
    }

    // Check if length of string has changed since last time.
    if (this.currentValueLength !== valueText.length) {
        this.currentValueLength = valueText.length;
        this.valueFontSize = this.calculateFontSize(valueText, this.maxTextWidth, this.maxTextHeight, this.canvasCtx);
    }

    this.canvasCtx.font = `bold ${this.valueFontSize}px ${this.fontString}`;
    this.canvasCtx.textAlign = "center";
    this.canvasCtx.textBaseline = "middle";
    this.canvasCtx.fillStyle = this.valueColor;
    this.canvasCtx.fillText(valueText, Math.floor(this.cWidth / 2), Math.floor((this.cHeight / 2) + (this.valueFontSize / 15)), this.maxTextWidth);
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
    const maxTextWidth = Math.floor(this.cWidth * 0.94);
    const maxTextHeight = Math.floor(this.cHeight * 0.1);
    const fontSize = this.calculateFontSize(displayName, maxTextWidth, maxTextHeight, this.canvasBGCtx);

    this.canvasBGCtx.font = `normal ${fontSize}px ${this.fontString}`;
    this.canvasBGCtx.textAlign = "left";
    this.canvasBGCtx.textBaseline = "top";
    this.canvasBGCtx.fillStyle = this.labelColor;
    this.canvasBGCtx.fillText(displayName, Math.floor(this.cWidth * 0.03), Math.floor(this.cHeight * 0.03), maxTextWidth);
  }
}
