import { AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';

@Component({
  selector: 'widget-label',
  standalone: true,
  imports: [WidgetHostComponent, NgxResizeObserverModule],
  templateUrl: './widget-label.component.html',
  styleUrl: './widget-label.component.scss'
})
export class WidgetLabelComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  private canvas = inject(CanvasService);
  private canvasCtx: CanvasRenderingContext2D = null;
  private isDestroyed = false; // guard against callbacks after destroyed
  private maxTextWidth = 0;
  private maxTextHeight = 0;

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
    this.canvas.setHighDPISize(this.canvasEl().nativeElement, this.canvasEl().nativeElement.parentElement.getBoundingClientRect());
    this.canvasCtx = this.canvasEl().nativeElement.getContext('2d');
    this.maxTextWidth = this.canvasEl().nativeElement.width - 40;
    this.maxTextHeight = this.canvasEl().nativeElement.height - 40;
    if (this.isDestroyed) return;
    this.updateCanvas();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    this.canvas.clearCanvas(this.canvasCtx, this.canvasEl().nativeElement.width, this.canvasEl().nativeElement.height);
    this.canvasEl().nativeElement.remove();
  }

  protected startWidget(): void {
    // No action needed
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    config.displayName ? this.widgetProperties.config.displayName = config.displayName : this.widgetProperties.config.displayName = "";
    this.updateCanvas();
  }

  protected onResized(e: ResizeObserverEntry) {
    this.canvas.setHighDPISize(this.canvasEl().nativeElement, e.contentRect);
    this.maxTextWidth = Math.floor(this.canvasEl().nativeElement.width - 40);
    this.maxTextHeight = Math.floor(this.canvasEl().nativeElement.height - 40);
    this.updateCanvas();
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
    if (!this.canvasCtx) return;
    this.canvas.clearCanvas(this.canvasCtx, this.canvasEl().nativeElement.width, this.canvasEl().nativeElement.height);

    if (!this.widgetProperties.config.noBgColor) {
      this.canvas.drawRectangle(this.canvasCtx, 0, 0, this.canvasEl().nativeElement.width, this.canvasEl().nativeElement.height, this.getColors(this.widgetProperties.config.bgColor));
    }

    this.drawValue();
  }

  private drawValue(): void {
    this.canvas.drawText(
      this.canvasCtx,
      this.widgetProperties.config.displayName,
      Math.floor(this.canvasEl().nativeElement.width / 2,),
      Math.floor(this.canvasEl().nativeElement.height / 2 + 10),
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.getColors(this.widgetProperties.config.color)
    );
  }
}
