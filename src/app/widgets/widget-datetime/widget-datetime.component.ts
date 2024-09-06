import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
export class WidgetDatetimeComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;

  dataValue: any = null;
  dataTimestamp: number = Date.now();
  valueFontSize = 1;
  private readonly fontString = "px Roboto";

  // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  currentValueLength = 0;
  canvasCtx: CanvasRenderingContext2D;
  canvasBGCtx: CanvasRenderingContext2D;

  labelColor: string = undefined;
  valueColor: string = undefined;

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
      dateTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      color: 'white',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.initWidget();
    this.startWidget();
  }

  protected startWidget(): void {
    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
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
    this.unsubscribeDataStream();
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

  protected onResized(event: ResizeObserverEntry): void {
    if (event.contentRect.height < 50) { return; }
    if (event.contentRect.width < 50) { return; }
    if ((this.canvasEl.nativeElement.width != Math.floor(event.contentRect.width)) || (this.canvasEl.nativeElement.height != Math.floor(event.contentRect.height))) {
      this.canvasEl.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasEl.nativeElement.height = Math.floor(event.contentRect.height);
      this.canvasBG.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasBG.nativeElement.height = Math.floor(event.contentRect.height);
      this.currentValueLength = 0; // will force resetting the font size
      this.updateCanvas();
      this.updateCanvasBG();
    } else {
      this.updateCanvasBG();
    }

  }
/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
  updateCanvas() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
    }
  }

  updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0, 0, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawTitle();
    }
  }

  drawValue() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85);
    let valueText: string;

    if (this.dataValue === null) {
      valueText = '--';
    } else {

      valueText = this.dataValue;
      try {
        let date = formatDate(valueText, this.widgetProperties.config.dateFormat, 'en-US', this.widgetProperties.config.dateTimezone);
        valueText = date;
      } catch (error) {
        valueText = error;
        console.log("[Date Value Widget]: " + error);
      }
    }

    // check if length of string has changed since last time.
    if (this.currentValueLength != valueText.length) {
      // we need to set font size...
      this.currentValueLength = valueText.length;

      // start with large font, no sense in going bigger than the size of the canvas :)
      this.valueFontSize = maxTextHeight;
      this.canvasCtx.font = 'bold ' + this.valueFontSize.toString() + this.fontString;
      const measure = this.canvasCtx.measureText(valueText).width;

      // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
      if (measure > maxTextWidth) {
        const estimateRatio = maxTextWidth / measure;
        this.valueFontSize = Math.floor(this.valueFontSize * estimateRatio);
        this.canvasCtx.font = 'bold ' + this.valueFontSize.toString() + this.fontString;
      }
      // now decrease by 1 to in case still too big
      while (this.canvasCtx.measureText(valueText).width > maxTextWidth && this.valueFontSize > 0) {
        this.valueFontSize--;
        this.canvasCtx.font = 'bold ' + this.valueFontSize.toString() + this.fontString;
      }
    }

    this.canvasCtx.font = 'bold ' + this.valueFontSize.toString() + this.fontString;
    this.canvasCtx.textAlign = 'center';
    this.canvasCtx.textBaseline = 'middle';
    this.canvasCtx.fillStyle = this.valueColor;
    this.canvasCtx.fillText(
      valueText,
      this.canvasEl.nativeElement.width / 2,
      (this.canvasEl.nativeElement.height / 2) + (this.valueFontSize / 15),
      maxTextWidth
    );
  }

  drawTitle() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.94);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.1);
    // set font small and make bigger until we hit a max.
    if (this.widgetProperties.config.displayName === null) { return; }
    let fontSize = 1;

    this.canvasBGCtx.font = 'normal ' + fontSize.toString() + this.fontString; // need to init it, so we do loop at least once :)
    while ( (this.canvasBGCtx.measureText(this.widgetProperties.config.displayName).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasBGCtx.font = 'normal ' + fontSize.toString() + this.fontString;
    }

    this.canvasBGCtx.textAlign = 'left';
    this.canvasBGCtx.textBaseline = 'top';
    this.canvasBGCtx.fillStyle = this.labelColor;
    this.canvasBGCtx.fillText(
      this.widgetProperties.config.displayName,
      this.canvasEl.nativeElement.width * 0.03,
      this.canvasEl.nativeElement.height * 0.03,
      maxTextWidth);

  }




}
