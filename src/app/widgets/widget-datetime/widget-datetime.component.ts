import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild, signal } from '@angular/core';
import { formatDate } from '@angular/common';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { getColors } from '../../core/utils/themeColors.utils';

@Component({
  selector: 'widget-datetime',
  templateUrl: './widget-datetime.component.html',
  styleUrls: ['./widget-datetime.component.css'],
  imports: [WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent],
  standalone: true
})
export class WidgetDatetimeComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private canvasValue = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasValue');
  private canvas = inject(CanvasService);
  protected dataValue: string | null = null;
  private _timeZoneGTM = "";
  private isDestroyed = false; // guard against callbacks after destroyed
  private canvasCtx: CanvasRenderingContext2D;
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
        this.drawValue();
      }
    });
  }

  ngOnInit() {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.canvas.setHighDPISize(this.canvasValue().nativeElement, this.canvasValue().nativeElement.parentElement.getBoundingClientRect());
    this.canvasCtx = this.canvasValue().nativeElement.getContext('2d');
    this.maxTextWidth = Math.floor(this.canvasValue().nativeElement.width * 0.85);
    this.maxTextHeight = Math.floor(this.canvasValue().nativeElement.height * 0.70);
    if (this.isDestroyed) return;
    this.startWidget();
  }

  protected startWidget(): void {
    this._timeZoneGTM = this.getGMTOffset(this.widgetProperties.config.dateTimezone);
    this.unsubscribeDataStream();
    this.setColors();
    this.observeDataStream('gaugePath', newValue => {
      this.dataValue = newValue.data.value;
      this.drawValue();
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.drawValue();
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    this.canvas.releaseCanvas(this.canvasValue()?.nativeElement, { clear: true, removeFromDom: true });
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

  protected onResized(e: ResizeObserverEntry): void {
    if ((e.contentRect.height < 25) || (e.contentRect.width < 25)) return;
    this.canvas.setHighDPISize(this.canvasValue().nativeElement, e.contentRect);
    this.canvasCtx = this.canvasValue().nativeElement.getContext('2d');
    this.maxTextWidth = Math.floor(this.canvasValue().nativeElement.width * 0.85);
    this.maxTextHeight = Math.floor(this.canvasValue().nativeElement.height * 0.70);
    if (this.isDestroyed) return;
    this.drawValue();
  }
  /* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */
  private drawValue(): void {
    if (!this.canvasCtx) return;
    let valueText: string;
    this.canvas.clearCanvas(this.canvasCtx, this.canvasValue().nativeElement.width, this.canvasValue().nativeElement.height);

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
      Math.floor(this.canvasValue().nativeElement.width / 2),
      Math.floor(this.canvasValue().nativeElement.height / 2 * 1.15),
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.valueColor
    );
  }
}
