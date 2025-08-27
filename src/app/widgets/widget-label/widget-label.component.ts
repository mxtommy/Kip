import { AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { CanvasService } from '../../core/services/canvas.service';

@Component({
  selector: 'widget-label',
  imports: [WidgetHostComponent],
  templateUrl: './widget-label.component.html',
  styleUrl: './widget-label.component.scss'
})
export class WidgetLabelComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private canvas = inject(CanvasService);
  private cssWidth = 0;
  private cssHeight = 0;
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
        this.maxTextWidth = this.cssWidth - 40;
        this.maxTextHeight = this.cssHeight - 40;
        this.drawWidget();
      }
    });
    if (this.isDestroyed) return;
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.maxTextWidth = this.canvasElement.width - 40;
    this.maxTextHeight = this.canvasElement.height - 40;
    this.startWidget();
  }

  ngOnDestroy(): void {
    this.isDestroyed = true;
    try { this.canvas.unregisterCanvas(this.canvasElement); }
    catch { /* ignore */ }
  }

  protected startWidget(): void {
    // No action needed
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    if (config.displayName) {
      this.widgetProperties.config.displayName = config.displayName;
    } else {
      this.widgetProperties.config.displayName = "";
    }
    this.drawWidget();
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
  private drawWidget(): void {
    if (!this.canvasCtx) return;
    this.canvas.clearCanvas(this.canvasCtx, this.cssWidth, this.cssHeight);

    if (!this.widgetProperties.config.noBgColor) {
      this.canvas.drawRectangle(this.canvasCtx, 0, 0, this.canvasElement.width, this.canvasElement.height, this.getColors(this.widgetProperties.config.bgColor));
    }

    this.canvas.drawText(
      this.canvasCtx,
      this.widgetProperties.config.displayName,
      Math.floor(this.cssWidth / 2),
      Math.floor(this.cssHeight / 2 + 10),
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.getColors(this.widgetProperties.config.color)
    );
  }
}
