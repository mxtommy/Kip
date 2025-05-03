import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';


@Component({
    selector: 'widget-text',
    templateUrl: './widget-text.component.html',
    styleUrls: ['./widget-text.component.css'],
    imports: [ WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent ],
    standalone: true
})
export class WidgetTextComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private canvasValue = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasValue');
  private canvas = inject(CanvasService);
  private dataValue: any = null;
  private canvasCtx: CanvasRenderingContext2D;
  protected labelColor: string = undefined;
  private valueColor: string = undefined;
  private isDestroyed = false; // guard against callbacks after destroyed
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

    effect(() => {
      if (this.theme()) {
        this.getColors(this.widgetProperties.config.color);
        this.drawValue();
      }
    });
  }

  ngOnInit() {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    const canvasElement = this.canvasValue().nativeElement;
    this.canvas.setHighDPISize(this.canvasValue().nativeElement, canvasElement.parentElement.getBoundingClientRect());
    this.canvasCtx = this.canvasValue().nativeElement.getContext('2d');
    this.maxTextWidth = Math.floor(this.canvasValue().nativeElement.width * 0.85);
    this.maxTextHeight = Math.floor(this.canvasValue().nativeElement.height * 0.80);
    if (this.isDestroyed) return;
    this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.observeDataStream('stringPath', newValue => {
      this.dataValue = newValue.data.value;
      this.drawValue();
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.getColors(this.widgetProperties.config.color);
    this.drawValue();
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    this.canvas.clearCanvas(this.canvasCtx, this.canvasValue().nativeElement.width, this.canvasValue().nativeElement.height);
    this.canvasValue().nativeElement.remove();
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

  protected onResized(e: ResizeObserverEntry) {
    if (e.contentRect.height < 25 || e.contentRect.width < 25) return;
    this.canvas.setHighDPISize(this.canvasValue().nativeElement, e.contentRect);
    this.maxTextWidth = Math.floor(this.canvasValue().nativeElement.width * 0.85);
    this.maxTextHeight = Math.floor(this.canvasValue().nativeElement.height * 0.70);
    if (this.isDestroyed) return;
    this.drawValue();
  }

/* ******************************************************************************************* */
  /*                                  Canvas Drawing                                             */
  /* ******************************************************************************************* */
  drawValue() {
    if (!this.canvasCtx) return;
    this.canvas.clearCanvas(this.canvasCtx, this.canvasValue().nativeElement.width, this.canvasValue().nativeElement.height);
    const valueText = this.dataValue === null ? '--' : this.dataValue;

    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      Math.floor(this.canvasValue().nativeElement.width / 2),
      Math.floor(this.canvasValue().nativeElement.height / 2 * 1.15),
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.valueColor,
      'center',
      'middle'
    );
  }
}
