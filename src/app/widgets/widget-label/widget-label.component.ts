import { AfterViewInit, Component, effect, ElementRef, OnDestroy, OnInit, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasUtils } from '../../core/utils/canvas-utils';

@Component({
  selector: 'widget-label',
  standalone: true,
  imports: [WidgetHostComponent, NgxResizeObserverModule],
  templateUrl: './widget-label.component.html',
  styleUrl: './widget-label.component.scss'
})
export class WidgetLabelComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  private wrapper = viewChild<ElementRef<HTMLDivElement>>('wrapper');
  private canvasCtx: CanvasRenderingContext2D = null;
  private readonly fontString = "Roboto";
  private isDestroyed = false; // guard against callbacks after destroyed
  private cWidth = 0;
  private cHeight = 0;

  constructor() {
    super();

    this.defaultConfig = {
      displayName: "Static Label",
      color: 'green',
      bgColor: 'grey',
      noColor: false,
      noBgColor: true
    };

    effect(() => {
      if (this.theme()) {
        this.getColors(this.widgetProperties.config.color);
        this.updateCanvas();
      }
    });
   }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.canvasCtx = this.canvasEl().nativeElement.getContext('2d');
    this.canvasEl().nativeElement.width = this.cWidth = Math.floor(this.wrapper().nativeElement.getBoundingClientRect().width);
    this.canvasEl().nativeElement.height = this.cHeight = Math.floor(this.wrapper().nativeElement.getBoundingClientRect().height);
    document.fonts.ready.then(() => {
      if (this.isDestroyed) return;
      this.updateCanvas();
    });
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    CanvasUtils.clearCanvas(this.canvasCtx, this.cWidth, this.cHeight);
    this.canvasEl().nativeElement.remove();
  }

  protected startWidget(): void {
    // No action needed
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    config.displayName ? this.widgetProperties.config.displayName = config.displayName : this.widgetProperties.config.displayName = "";
    this.updateCanvas();
  }

  protected onResized(event: ResizeObserverEntry) {
    document.fonts.ready.then(() => {
      this.canvasEl().nativeElement.width = this.cWidth = Math.floor(event.contentRect.width);
      this.canvasEl().nativeElement.height = this.cHeight = Math.floor(event.contentRect.height);
      this.updateCanvas();
    });
  }

  private getColors(colorName: string): string {
    switch (colorName) {
      case "contrast":
        return this.theme().contrast;
      case "blue":
        return this.theme().blue;
      case "green":
        return this.theme().green;
      case "pink":
        return this.theme().pink;
      case "orange":
        return this.theme().orange;
      case "purple":
        return this.theme().purple;
      case "grey":
        return this.theme().grey;
      case "yellow":
        return this.theme().yellow;
      default:
        return this.theme().contrast;
    }
  }

  /* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */
  private updateCanvas(): void {
    if (this.canvasCtx) {
      CanvasUtils.clearCanvas(this.canvasCtx, this.cWidth, this.cHeight);

      if (!this.widgetProperties.config.noBgColor) {
        CanvasUtils.drawRectangle(
          this.canvasCtx,
          0,
          0,
          this.cWidth,
          this.cHeight,
          this.getColors(this.widgetProperties.config.bgColor)
        );
      }

      this.drawValue();
    }
  }

  private drawValue(): void {
    const maxTextWidth = Math.floor(this.cWidth * 0.85);
    const maxTextHeight = Math.floor(this.cHeight * 0.85);

    CanvasUtils.drawText(
      this.canvasCtx,
      this.widgetProperties.config.displayName,
      Math.floor(this.cWidth / 2),
      Math.floor(this.cHeight / 2),
      maxTextWidth,
      maxTextHeight,
      'bold',
      this.getColors(this.widgetProperties.config.color),
      'center',
      'middle'
    );
  }
}
