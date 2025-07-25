import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild, signal } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { getColors } from '../../core/utils/themeColors.utils';

@Component({
    selector: 'widget-position',
    templateUrl: './widget-position.component.html',
    styleUrls: ['./widget-position.component.scss'],
    imports: [WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent]
})
export class WidgetPositionComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private canvasValue = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasValue');
  private canvas = inject(CanvasService);
  private latPos = '';
  private longPos = '';
  protected labelColor = signal<string>(undefined);
  private valueColor: string = undefined;
  private maxTextWidth = 0;
  private maxTextHeight = 0;
  private middle = 0;
  private center = 0;
  private fontSizeOffset = 0;
  private canvasValCtx: CanvasRenderingContext2D;
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
        this.setColors();
        this.drawValue();
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.canvas.setHighDPISize(this.canvasValue().nativeElement, this.canvasValue().nativeElement.parentElement.getBoundingClientRect());
    this.maxTextHeight = Math.floor(this.canvasValue().nativeElement.height * 0.60 / 2); // Two lines
    this.maxTextWidth = Math.floor(this.canvasValue().nativeElement.width * 0.85);
    this.canvasValCtx = this.canvasValue().nativeElement.getContext('2d');
    this.calculateFontSizeAndPositions();
    if (this.isDestroyed) return;
    this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.setColors();
    this.observeDataStream('longPath', newValue => {
      if (newValue.data.value ===  null) {
        this.longPos = '';
      } else if (this.widgetProperties.config.paths['longPath'].convertUnitTo === 'pdeg') {
        this.longPos = newValue.data.value.toFixed(6) + '°';
      } else {
        this.longPos = newValue.data.value.toString();
      }
      this.drawValue();
    });
    this.observeDataStream('latPath', newValue => {
      if (newValue.data.value ===  null) {
        this.latPos = '';
      } else if (this.widgetProperties.config.paths['latPath'].convertUnitTo === 'pdeg') {
        this.latPos = newValue.data.value.toFixed(7) + '°';
      } else {
        this.latPos = newValue.data.value.toString();
      }
      this.drawValue();
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.unsubscribeDataStream();
    this.canvas.clearCanvas(this.canvasValCtx, this.canvasValue().nativeElement.width, this.canvasValue().nativeElement.height);
    this.canvasValue().nativeElement.remove();
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  protected onResized(event: ResizeObserverEntry): void {
    if (event.contentRect.height < 25 || event.contentRect.width < 25) return;
    this.canvas.setHighDPISize(this.canvasValue().nativeElement, this.canvasValue().nativeElement.parentElement.getBoundingClientRect());
    this.maxTextHeight = Math.floor(this.canvasValue().nativeElement.height * 0.60 / 2); // Two lines
    this.maxTextWidth = Math.floor(this.canvasValue().nativeElement.width * 0.85);
    this.calculateFontSizeAndPositions();
    this.drawValue();
  }

  private setColors(): void {
    this.labelColor.set(getColors(this.widgetProperties.config.color, this.theme()).dim);
    this.valueColor = getColors(this.widgetProperties.config.color, this.theme()).color;
  }

  private calculateFontSizeAndPositions(): void {
    this.center = this.canvasValue().nativeElement.width / 2;
    this.middle = this.canvasValue().nativeElement.height * 0.57;

    const longestString = this.latPos.length > this.longPos.length ? this.latPos : this.longPos;
    const size = this.canvas.calculateOptimalFontSize(this.canvasValCtx, longestString, this.maxTextWidth, this.maxTextHeight, 'bold')
    this.fontSizeOffset = Math.floor(size * 0.0005);
  }

  private drawValue(): void {
    if (!this.canvasValCtx) return;
    this.canvas.clearCanvas(this.canvasValCtx, this.canvasValue().nativeElement.width, this.canvasValue().nativeElement.height);
    this.canvas.drawText(
      this.canvasValCtx,
      this.latPos,
      this.center,
      this.middle - this.fontSizeOffset,
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.valueColor,
      'center',
      'bottom'
    );

    this.canvas.drawText(
      this.canvasValCtx,
      this.longPos,
      this.center,
      this.middle + this.fontSizeOffset,
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.valueColor,
      'center',
      'top'
    );
  }
}
