import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild } from '@angular/core';
import { formatDate } from '@angular/common';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';

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
  protected dataValue: any = null;
  private _timeZoneGTM: string = "";
  private _valueFontSize = 1;
  private isDestroyed = false; // guard against callbacks after destroyed
  private canvasCtx: CanvasRenderingContext2D;
  protected labelColor: string = undefined;
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
        this.getColors(this.widgetProperties.config.color);
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
    this.getColors(this.widgetProperties.config.color);
    this.startWidget();
  }

  protected startWidget(): void {
    this._timeZoneGTM = this.getGMTOffset(this.widgetProperties.config.dateTimezone);
    this.unsubscribeDataStream();
    this.observeDataStream('gaugePath', newValue => {
      this.dataValue = newValue.data.value;
      this.drawValue();
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.getColors(this.widgetProperties.config.color);
    this.startWidget();
    this.drawValue();
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    this.canvas.clearCanvas(this.canvasCtx, this.canvasValue().nativeElement.width, this.canvasValue().nativeElement.height);
    this.canvasValue().nativeElement.remove();
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
