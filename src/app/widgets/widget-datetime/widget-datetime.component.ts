import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, effect } from '@angular/core';
import { formatDate } from '@angular/common';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

@Component({
    selector: 'widget-datetime',
    templateUrl: './widget-datetime.component.html',
    styleUrls: ['./widget-datetime.component.css'],
    imports: [WidgetHostComponent, NgxResizeObserverModule],
    standalone: true
})
export class WidgetDatetimeComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('canvasEl', {static: true}) canvasEl: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasBG', {static: true}) canvasBG: ElementRef<HTMLCanvasElement>;

  protected dataValue: any = null;
  private _timeZoneGTM: string = "";
  private _valueFontSize = 1;
  private readonly _fontString = "Roboto";
  private isDestroyed = false; // guard against callbacks after destroyed

  // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  private currentValueLength = 0;
  private canvasCtx: CanvasRenderingContext2D;
  private canvasBGCtx: CanvasRenderingContext2D;

  private labelColor: string = undefined;
  private valueColor: string = undefined;
  private cWidth = 0;
  private cHeight = 0;
  private maxTextWidth = 0;
  private maxTextHeight = 0;

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Time Label',
      filterSelfPaths: true,
      paths: {
        'gaugePath': {
          description: 'String Data',
          path: null,
          source: null,
          pathType: 'Date',
          isPathConfigurable: true,
          sampleTime: 500
        }
      },
      dateFormat: 'dd/MM/yyyy HH:mm:ss',
      dateTimezone: 'Atlantic/Azores',
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5
    };

    effect(() => {
      if (this.theme()) {
        this.getColors(this.widgetProperties.config.color);
        this.updateCanvas();
        this.updateCanvasBG();
      }
    });
  }

  ngOnInit() {
    this.validateConfig();
    this.getColors(this.widgetProperties.config.color);
  }

  ngAfterViewInit(): void {
    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.cWidth = this.canvasEl.nativeElement.width;
    this.cHeight = this.canvasEl.nativeElement.height;
    this.maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    this.maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85);
    document.fonts.ready.then(() => {
      if (this.isDestroyed) return;
      this.getColors(this.widgetProperties.config.color);
      this.startWidget();
    });
  }

  protected startWidget(): void {
    this._timeZoneGTM = this.getGMTOffset(this.widgetProperties.config.dateTimezone);
    this.getColors(this.widgetProperties.config.color);
    this.unsubscribeDataStream();
    this.observeDataStream('gaugePath', newValue => {
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
    this.canvasCtx.clearRect(0, 0, this.cWidth, this.cHeight);
    this.canvasBGCtx.clearRect(0, 0, this.cWidth, this.cHeight);
    this.canvasEl.nativeElement.remove();
    this.canvasBG.nativeElement.remove();
    this.canvasEl = null;
    this.canvasBG = null;
  }

  private getGMTOffset(timeZone: string): string {
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            timeZoneName: 'short'
        });
        const parts = formatter.formatToParts(new Date());
        const timeZonePart = parts.find(part => part.type === 'timeZoneName');
        return timeZonePart ? timeZonePart.value : 'GMT';
    } catch (error) {
        console.error(`Error getting GMT offset for timezone "${timeZone}":`, error);
        return 'GMT';
    }
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
  }

  protected onResized(event: ResizeObserverEntry): void {
    if (event.contentRect.height < 50) { return; }
    if (event.contentRect.width < 50) { return; }
    if ((this.cWidth != Math.floor(event.contentRect.width)) || (this.cHeight != Math.floor(event.contentRect.height))) {
      this.cWidth = this.canvasEl.nativeElement.width = this.canvasBG.nativeElement.width = Math.floor(event.contentRect.width);
      this.cHeight = this.canvasEl.nativeElement.height = this.canvasBG.nativeElement.height = Math.floor(event.contentRect.height);

      this.maxTextWidth = Math.floor(this.cWidth * 0.85);
      this.maxTextHeight = Math.floor(this.cHeight * 0.85);

      this.currentValueLength = 0; // will force resetting the font size
      document.fonts.ready.then(() => {
        if (this.isDestroyed) return;
        this.updateCanvas();
        this.updateCanvasBG();
      });
    } else {
      document.fonts.ready.then(() => {
        if (this.isDestroyed) return;
        this.updateCanvasBG();
      });
    }

  }
/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
  updateCanvas() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.cWidth, this.cHeight);
      this.drawValue();
    }
  }

  updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0, 0, this.cWidth, this.cHeight);
      this.drawTitle();
    }
  }

  drawValue() {
    let valueText: string;

    if (isNaN(Date.parse(this.dataValue))) {
      valueText = '--';
    } else {
      try {
        valueText = formatDate(this.dataValue, this.widgetProperties.config.dateFormat, 'en-US', this._timeZoneGTM);
      } catch (error) {
        valueText = error;
        console.log("[Date Time Widget]: " + error);
      }
    }


    // Check if length of string has changed since last time.
    if (this.currentValueLength !== valueText.length) {
        this.currentValueLength = valueText.length;
        this._valueFontSize = this.calculateFontSize(valueText, this.maxTextWidth, this.maxTextHeight, this.canvasCtx);
    }

    this.canvasCtx.font = `bold ${this._valueFontSize}px ${this._fontString}`;
    this.canvasCtx.textAlign = 'center';
    this.canvasCtx.textBaseline = 'middle';
    this.canvasCtx.fillStyle = this.valueColor;
    this.canvasCtx.fillText(
      valueText,
      Math.floor(this.cWidth / 2),
      Math.floor((this.cHeight / 2) + (this._valueFontSize / 15)),
      this.maxTextWidth
    );
  }

  private calculateFontSize(text: string, maxWidth: number, maxHeight: number, ctx: CanvasRenderingContext2D): number {
    let minFontSize = 1;
    let maxFontSize = maxHeight;
    let fontSize = maxFontSize;

    while (minFontSize <= maxFontSize) {
        fontSize = Math.floor((minFontSize + maxFontSize) / 2);
        ctx.font = `bold ${fontSize}px ${this._fontString}`;
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
    this.canvasBGCtx.font = `normal ${fontSize}px ${this._fontString}`;
    this.canvasBGCtx.textAlign = 'left';
    this.canvasBGCtx.textBaseline = 'top';
    this.canvasBGCtx.fillStyle = this.labelColor;
    this.canvasBGCtx.fillText(displayName, Math.floor(this.cWidth * 0.03), Math.floor(this.cHeight * 0.03), maxTextWidth);
  }
}
