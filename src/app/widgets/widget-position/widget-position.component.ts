import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, effect, inject } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';

@Component({
    selector: 'widget-position',
    templateUrl: './widget-position.component.html',
    styleUrls: ['./widget-position.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, NgxResizeObserverModule]
})
export class WidgetPositionComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  @ViewChild('canvasEl', { static: true }) canvasEl: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasBG', { static: true }) canvasBG: ElementRef<HTMLCanvasElement>;
  private canvas = inject(CanvasService);
  private latPos: string = '';
  private longPos: string = '';
  private labelColor: string = undefined;
  private valueColor: string = undefined;
  private currentValueLength = 0;
  private valueFontSize = 1;
  private canvasValCtx: CanvasRenderingContext2D;
  private canvasBGCtx: CanvasRenderingContext2D;
  private isDestroyed = false;

  constructor() {
    super();
    this.defaultConfig = {
      displayName: 'Position',
      filterSelfPaths: true,
      paths: {
        longPath: {
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
        latPath: {
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

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.canvasValCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    document.fonts.ready.then(() => {
      if (this.isDestroyed) return;
      this.getColors(this.widgetProperties.config.color);
      this.startWidget();
      this.updateCanvasBG();
    });
  }

  protected startWidget(): void {
    this.observeDataStream('longPath', newValue => {
      this.longPos = newValue.data.value ? newValue.data.value.toString() : '';
      this.updateCanvas();
    });
    this.observeDataStream('latPath', newValue => {
      this.latPos = newValue.data.value ? newValue.data.value.toString() : '';
      this.updateCanvas();
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.unsubscribeDataStream();
    this.canvas.clearCanvas(this.canvasValCtx, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
    this.canvas.clearCanvas(this.canvasBGCtx, this.canvasBG.nativeElement.width, this.canvasBG.nativeElement.height);
    this.canvasEl.nativeElement.remove();
    this.canvasBG.nativeElement.remove();
    this.canvasEl = null;
    this.canvasBG = null;
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.getColors(this.widgetProperties.config.color);
    this.startWidget();
    this.updateCanvas();
    this.updateCanvasBG();
  }

  protected onResized(event: ResizeObserverEntry): void {
    if (event.contentRect.height < 50 || event.contentRect.width < 50) return;

    if (
      this.canvasEl.nativeElement.width !== Math.floor(event.contentRect.width) ||
      this.canvasEl.nativeElement.height !== Math.floor(event.contentRect.height)
    ) {
      this.canvasEl.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasEl.nativeElement.height = Math.floor(event.contentRect.height);
      this.canvasBG.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasBG.nativeElement.height = Math.floor(event.contentRect.height);
      this.currentValueLength = 0; // Force recalculation of font size
      this.updateCanvasBG();
      this.updateCanvas();
    }
  }

  private getColors(color: string): void {
    switch (color) {
      case 'white':
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
      case 'blue':
        this.labelColor = this.theme().blueDim;
        this.valueColor = this.theme().blue;
        break;
      case 'green':
        this.labelColor = this.theme().greenDim;
        this.valueColor = this.theme().green;
        break;
      case 'pink':
        this.labelColor = this.theme().pinkDim;
        this.valueColor = this.theme().pink;
        break;
      case 'orange':
        this.labelColor = this.theme().orangeDim;
        this.valueColor = this.theme().orange;
        break;
      case 'purple':
        this.labelColor = this.theme().purpleDim;
        this.valueColor = this.theme().purple;
        break;
      case 'grey':
        this.labelColor = this.theme().greyDim;
        this.valueColor = this.theme().grey;
        break;
      case 'yellow':
        this.labelColor = this.theme().yellowDim;
        this.valueColor = this.theme().yellow;
        break;
      default:
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
    }
  }

  private updateCanvas(): void {
    if (this.canvasValCtx) {
      this.canvas.clearCanvas(this.canvasValCtx, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
    }
  }

  private updateCanvasBG(): void {
    if (this.canvasBGCtx) {
      this.canvas.clearCanvas(this.canvasBGCtx, this.canvasBG.nativeElement.width, this.canvasBG.nativeElement.height);
      this.drawTitle();
    }
  }

  private drawValue(): void {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85) / 2; // Two lines
    const latPosText = this.latPos;
    const longPosText = this.longPos;
    const longestString = latPosText.length > longPosText.length ? latPosText : longPosText;

    if (this.currentValueLength !== longestString.length) {
      this.currentValueLength = longestString.length;
      this.valueFontSize = this.canvas.calculateOptimalFontSize(
        this.canvasValCtx,
        longestString,
        maxTextWidth,
        maxTextHeight,
        'bold'
      );
    }

    const center = this.canvasEl.nativeElement.width / 2;
    const middle = this.canvasEl.nativeElement.height * 0.55;
    const fontSizeOffset = this.valueFontSize / 2;

    this.canvas.drawText(
      this.canvasValCtx,
      latPosText,
      center,
      middle - fontSizeOffset,
      maxTextWidth,
      maxTextHeight,
      'bold',
      this.valueColor,
      'center',
      'middle'
    );

    this.canvas.drawText(
      this.canvasValCtx,
      longPosText,
      center,
      middle + fontSizeOffset,
      maxTextWidth,
      maxTextHeight,
      'bold',
      this.valueColor,
      'center',
      'middle'
    );
  }

  private drawTitle(): void {
    const maxTextWidth = Math.floor(this.canvasBG.nativeElement.width * 0.94);
    const maxTextHeight = Math.floor(this.canvasBG.nativeElement.height * 0.1);
    const displayName = this.widgetProperties.config.displayName;

    if (!displayName) return;

    this.canvas.drawText(
      this.canvasBGCtx,
      displayName,
      Math.floor(this.canvasBG.nativeElement.width * 0.03),
      Math.floor(this.canvasBG.nativeElement.height * 0.03),
      maxTextWidth,
      maxTextHeight,
      'normal',
      this.labelColor,
      'left',
      'top'
    );
  }
}
