import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild, signal } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { getColors } from '../../core/utils/themeColors.utils';


@Component({
  selector: 'widget-text',
  templateUrl: './widget-text.component.html',
  styleUrls: ['./widget-text.component.scss'],
  imports: [WidgetHostComponent, NgxResizeObserverModule]
})
export class WidgetTextComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private titleBitmap: HTMLCanvasElement | null = null;
  private titleBitmapText: string | null = null;
  private canvas = inject(CanvasService);
  private cssWidth = 0;
  private cssHeight = 0;
  private dataValue: string | null = null;
  protected labelColor = signal<string>(undefined);
  private valueColor: string = undefined;
  private isDestroyed = false; // guard against callbacks after destroyed

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
        this.setColors();
        this.drawWidget();
      }
    });
  }

  ngOnInit() {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.canvasElement = this.canvasMainRef().nativeElement;
    this.canvasCtx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w;
        this.cssHeight = h;
        this.drawWidget();
      }
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    if (this.isDestroyed) return;
    this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.setColors();
    this.observeDataStream('stringPath', newValue => {
      this.dataValue = newValue.data.value;
      this.drawWidget();
    });
  }

  private setColors(): void {
    this.labelColor.set(getColors(this.widgetProperties.config.color, this.theme()).dim);
    this.valueColor = getColors(this.widgetProperties.config.color, this.theme()).color;
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.drawWidget();
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    try { this.canvas.unregisterCanvas(this.canvasElement); }
    catch { /* ignore */ }
  }

  /* ******************************************************************************************* */
  /*                                  Canvas Drawing                                             */
  /* ******************************************************************************************* */
  drawWidget() {
    if (!this.canvasCtx) return;
    const titleHeight = Math.floor(this.cssHeight * 0.1);
    if (!this.titleBitmap ||
      this.titleBitmap.width !== this.canvasElement.width ||
      this.titleBitmap.height !== this.canvasElement.height ||
      this.titleBitmapText !== this.widgetProperties.config.displayName
    ) {
      this.titleBitmap = this.canvas.createTitleBitmap(
        this.widgetProperties.config.displayName,
        this.labelColor(),
        'normal',
        this.cssWidth,
        this.cssHeight
      );
      this.titleBitmapText = this.widgetProperties.config.displayName;
    }

    this.canvas.clearCanvas(this.canvasCtx, this.cssWidth, this.cssHeight);
    if (this.titleBitmap && this.titleBitmap.width > 0 && this.titleBitmap.height > 0) {
      this.canvasCtx.drawImage(this.titleBitmap, 0, 0, this.cssWidth, this.cssHeight);
    }

    const valueText = this.dataValue === null ? '--' : this.dataValue;
    const edge = this.canvas.EDGE_BUFFER || 10;
    const availableHeight = Math.max(0, this.cssHeight - titleHeight - 2 * edge);
    const maxWidth = Math.max(0, Math.floor(this.cssWidth - 2 * edge));
    const maxHeight = Math.max(0, Math.floor(availableHeight));
    const centerX = Math.floor(this.cssWidth / 2);
    const centerY = Math.floor(titleHeight + edge + availableHeight / 2);

    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      centerX,
      centerY,
      maxWidth,
      maxHeight,
      'bold',
      this.valueColor,
      'center',
      'middle'
    );
  }
}
