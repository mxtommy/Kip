import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { getColors } from '../../core/utils/themeColors.utils';

@Component({
  selector: 'widget-datetime',
  templateUrl: './widget-datetime.component.html',
  styleUrls: ['./widget-datetime.component.scss'],
  imports: [WidgetHostComponent, NgxResizeObserverModule]
})
export class WidgetDatetimeComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private titleBitmap: HTMLCanvasElement | null = null;
  private titleBitmapText: string | null = null;
  private canvas = inject(CanvasService);
  private cssWidth = 0;
  private cssHeight = 0;
  protected dataValue: string | null = null;
  private _timeZoneGTM = "";
  private isDestroyed = false; // guard against callbacks after destroyed
  protected labelColor = signal<string>(undefined);
  private valueColor: string = undefined;
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
        this.maxTextWidth = Math.floor(this.cssWidth * 0.85);
        this.maxTextHeight = Math.floor(this.cssHeight * 0.70);
        this.drawWidget();
      }
    });
    if (this.isDestroyed) return;
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.maxTextWidth = Math.floor(this.canvasElement.width * 0.85);
    this.maxTextHeight = Math.floor(this.canvasElement.height * 0.70);
    this.startWidget();
  }

  protected startWidget(): void {
    this._timeZoneGTM = this.getGMTOffset(this.widgetProperties.config.dateTimezone);
    this.unsubscribeDataStream();
    this.setColors();
    this.observeDataStream('gaugePath', newValue => {
      this.dataValue = newValue.data.value;
      this.drawWidget();
    });
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

  private getGMTOffset(timeZone: string): string {
    try {
      if (timeZone === 'System Timezone -') return '';
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

  private setColors(): void {
    this.labelColor.set(getColors(this.widgetProperties.config.color, this.theme()).dim);
    this.valueColor = getColors(this.widgetProperties.config.color, this.theme()).color;
  }
  /* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */
  private drawWidget(): void {
    if (!this.canvasCtx) return;
    // Only recreate the title bitmap if the title text or full canvas size changes.
    // Note: the offscreen bitmap returned by createTitleBitmap is backed by
    // device pixels (width/height === css * devicePixelRatio), so compare
    // against the full canvas device-pixel dimensions.
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

    // Draw the title bitmap at the top. Request an explicit target size in
    // CSS pixels to avoid any ambiguity with device-pixel intrinsic sizes.
    if (this.titleBitmap && this.titleBitmap.width > 0 && this.titleBitmap.height > 0) {
      this.canvasCtx.drawImage(this.titleBitmap, 0, 0, this.cssWidth, this.cssHeight);
    }

    let valueText: string;

    if (isNaN(Date.parse(this.dataValue))) {
      valueText = '--';
    } else {
      try {
        valueText = formatDate(this.dataValue, this.widgetProperties.config.dateFormat, 'en-US', this._timeZoneGTM);
      } catch (error) {
        valueText = error;
        console.log('[Date Time Widget]: ' + error);
      }
    }

    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      Math.floor(this.cssWidth / 2),
      Math.floor(this.cssHeight / 2 * 1.15),
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.valueColor
    );
  }
}
