import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';

@Component({
    selector: 'widget-position',
    templateUrl: './widget-position.component.html',
    styleUrls: ['./widget-position.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent]
})
export class WidgetPositionComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private canvasValue = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasValue');
  private canvas = inject(CanvasService);
  private latPos: string = '';
  private longPos: string = '';
  protected labelColor: string = undefined;
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
        this.getColors(this.widgetProperties.config.color);
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
    this.observeDataStream('longPath', newValue => {
      this.longPos = newValue.data.value ? newValue.data.value.toString() : '';
      this.drawValue();
    });
    this.observeDataStream('latPath', newValue => {
      this.latPos = newValue.data.value ? newValue.data.value.toString() : '';
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
    this.getColors(this.widgetProperties.config.color);
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
