import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, effect, inject, viewChild, signal } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { getColors } from '../../core/utils/themeColors.utils';

@Component({
  selector: 'widget-position',
  templateUrl: './widget-position.component.html',
  styleUrls: ['./widget-position.component.scss'],
  imports: [WidgetHostComponent, NgxResizeObserverModule]
})
export class WidgetPositionComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly canvas = inject(CanvasService);
  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private titleBitmap: HTMLCanvasElement | null = null;
  private titleBitmapText: string | null = null;
  private latPos = '';
  private longPos = '';
  protected labelColor = signal<string>(undefined);
  private valueColor: string = undefined;
  private maxTextWidth = 0;
  private maxTextHeight = 0;
  private middle = 0;
  private center = 0;
  private fontSizeOffset = 0;
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
        this.drawWidget();
      }
    });
  }

  ngOnInit(): void {
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
        this.calculateFontSizeAndPositions();
        this.drawWidget();
      },
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    if (this.isDestroyed) return;
    this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.setColors();
    this.observeDataStream('longPath', newValue => {
      if (newValue.data.value === null) {
        this.longPos = '';
      } else if (this.widgetProperties.config.paths['longPath'].convertUnitTo === 'pdeg') {
        this.longPos = newValue.data.value.toFixed(6) + '°';
      } else {
        this.longPos = newValue.data.value.toString();
      }
      this.drawWidget();
    });
    this.observeDataStream('latPath', newValue => {
      if (newValue.data.value === null) {
        this.latPos = '';
      } else if (this.widgetProperties.config.paths['latPath'].convertUnitTo === 'pdeg') {
        this.latPos = newValue.data.value.toFixed(7) + '°';
      } else {
        this.latPos = newValue.data.value.toString();
      }
      this.drawWidget();
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.unsubscribeDataStream();
    try { this.canvas.unregisterCanvas(this.canvasElement); }
    catch { /* ignore */ }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  private setColors(): void {
    this.labelColor.set(getColors(this.widgetProperties.config.color, this.theme()).dim);
    this.valueColor = getColors(this.widgetProperties.config.color, this.theme()).color;
  }

  private calculateFontSizeAndPositions(): void {
    this.maxTextHeight = Math.floor(this.cssHeight * 0.6 / 2);
    this.maxTextWidth = Math.floor(this.cssWidth * 0.85);
    this.center = this.cssWidth / 2;
    this.middle = this.cssHeight * 0.57;
    const longestString = this.latPos.length > this.longPos.length ? this.latPos : this.longPos;
    const size = this.canvas.calculateOptimalFontSize(this.canvasCtx, longestString, this.maxTextWidth, this.maxTextHeight, 'bold')
    this.fontSizeOffset = Math.floor(size * 0.0005);
  }

  private drawWidget(): void {
    if (!this.canvasCtx) return;

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
    this.canvas.drawText(
      this.canvasCtx,
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
      this.canvasCtx,
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
