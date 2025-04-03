import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

@Component({
    selector: 'widget-position',
    templateUrl: './widget-position.component.html',
    styleUrls: ['./widget-position.component.scss'],
    standalone: true,
    imports: [ WidgetHostComponent, NgxResizeObserverModule ]
})

export class WidgetPositionComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;
  private latPos: string = "";
  private longPos: string = "";
  private labelColor: string = undefined;
  private valueColor: string = undefined;
  private currentValueLength = 0; // length (in characters) of value text to be displayed.
  private valueFontSize = 1;
  private canvasValCtx: CanvasRenderingContext2D;
  private canvasBGCtx: CanvasRenderingContext2D;
  private readonly fontString = 'Roboto';

  constructor() {
    super();
    this.defaultConfig = {
      displayName: 'Position',
      filterSelfPaths: true,
      paths: {
        'longPath': {
          description: 'Longitude',
          path: 'self.navigation.position.longitude',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: 'longitudeMin',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        },
        'latPath': {
          description: 'Latitude',
          path: 'self.navigation.position.latitude',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: 'latitudeMin',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
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
  }

  ngAfterViewInit(): void {
    this.canvasValCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    document.fonts.ready.then(() => {
      this.getColors(this.widgetProperties.config.color);
      this.startWidget();
      this.updateCanvasBG();
    });
  }

  protected startWidget(): void {
    this.canvasValCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.getColors(this.widgetProperties.config.color);
    this.observeDataStream('longPath', newValue => {
      newValue.data.value ? this.longPos = newValue.data.value.toString() : this.longPos = "";
      this.updateCanvas();
    });
    this.observeDataStream('latPath', newValue => {
      newValue.data.value ? this.latPos = newValue.data.value.toString() : this.latPos = "";
      this.updateCanvas();
    });
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.canvasValCtx = null;
    this.canvasBGCtx = null;
    this.canvasEl = null;
    this.canvasBG = null;
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.updateCanvas();
    this.updateCanvasBG();
  }


  private getColors(color: string): void {
    switch (color) {
      case 'white':
        this.labelColor = this.theme.whiteDim;
        this.valueColor = this.theme.white;
        break;
      case 'blue':
        this.labelColor = this.theme.blueDim;
        this.valueColor = this.theme.blue;
        break;
      case 'green':
        this.labelColor = this.theme.greenDim;
        this.valueColor = this.theme.green;
        break;
      case 'pink':
        this.labelColor = this.theme.pinkDim;
        this.valueColor = this.theme.pink;
        break;
      case 'orange':
        this.labelColor = this.theme.orangeDim;
        this.valueColor = this.theme.orange;
        break;
      case 'purple':
        this.labelColor = this.theme.purpleDim;
        this.valueColor = this.theme.purple;
        break;
      case 'grey':
        this.labelColor = this.theme.greyDim;
        this.valueColor = this.theme.grey;
        break;
      case 'yellow':
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
    if ((this.canvasEl.nativeElement.width !== Math.floor(event.contentRect.width))
      || (this.canvasEl.nativeElement.height !== Math.floor(event.contentRect.height))) {
      this.canvasEl.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasEl.nativeElement.height = Math.floor(event.contentRect.height);
      this.canvasBG.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasBG.nativeElement.height = Math.floor(event.contentRect.height);
      this.currentValueLength = 0; // will force resetting the font size
      this.updateCanvasBG();
      this.updateCanvas();
    }
  }


/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
// TODO: Better canvas scaling
// see https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
  updateCanvas() {
    if (this.canvasValCtx) {
      this.canvasValCtx.clearRect(0, 0, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
    }
  }

  private updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0, 0, this.canvasBG.nativeElement.width, this.canvasBG.nativeElement.height);
      this.drawTitle();
    }
  }

  private drawValue() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85) / 2; // we use two lines
    const latPosText = this.latPos;
    const longPosText = this.longPos;
    let longestString: string;
    if (latPosText.length > longPosText.length) {
      longestString = latPosText;
    } else {
      longestString = longPosText;
    }
    // check if length of string has changed since last time.
    if (this.currentValueLength !== longestString.length) {
      this.currentValueLength = longestString.length;
      this.valueFontSize = this.calculateFontSize(longestString, maxTextWidth, maxTextHeight, this.canvasValCtx);
    }
    const center  = this.canvasEl.nativeElement.width / 2;
    const middle = this.canvasEl.nativeElement.height * 0.55;
    const fs = this.valueFontSize / 2;
    this.canvasValCtx.textAlign = 'center';
    this.canvasValCtx.textBaseline = 'middle';
    this.canvasValCtx.fillStyle = this.valueColor;
    this.canvasValCtx.font = `bold ${this.valueFontSize}px ${this.fontString}`;
    this.canvasValCtx.fillText(latPosText, center, middle - fs, maxTextWidth);
    this.canvasValCtx.fillText(longPosText, center, middle + fs, maxTextWidth);
  }

  private drawTitle() {
    const maxTextWidth = Math.floor(this.canvasBG.nativeElement.width * 0.94);
    const maxTextHeight = Math.floor(this.canvasBG.nativeElement.height * 0.1);
    if (this.widgetProperties.config.displayName === null) { return; }
    this.canvasBGCtx.font = 'normal ' + this.calculateFontSize(this.widgetProperties.config.displayName,
      maxTextWidth, maxTextHeight, this.canvasBGCtx).toString() + 'px ' + `${this.fontString}`;
    this.canvasBGCtx.textAlign = 'left';
    this.canvasBGCtx.textBaseline = 'top';
    this.canvasBGCtx.fillStyle = this.labelColor;

    this.canvasBGCtx.fillText(
      this.widgetProperties.config.displayName,
      this.canvasBG.nativeElement.width * 0.03,
      this.canvasBG.nativeElement.height * 0.03,
      maxTextWidth
    );
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
}
