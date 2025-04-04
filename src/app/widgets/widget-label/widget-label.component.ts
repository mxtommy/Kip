import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

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
  private canvasCtx = CanvasRenderingContext2D = null;
  private readonly fontString = "'Roboto'";

  constructor() {
    super();

    this.defaultConfig = {
      displayName: "Static Label",
      color: 'green',
      bgColor: 'grey',
      noColor: false,
      noBgColor: true
    };
   }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.canvasCtx = this.canvasEl().nativeElement.getContext('2d');
    this.canvasEl().nativeElement.width = Math.floor(this.wrapper().nativeElement.getBoundingClientRect().width);
    this.canvasEl().nativeElement.height = Math.floor(this.wrapper().nativeElement.getBoundingClientRect().height);
    document.fonts.ready.then(() => {
      this.updateCanvas();
    });
  }

  ngOnDestroy(): void {
    this.canvasCtx.clearRect(0, 0, this.canvasEl().nativeElement.width, this.canvasEl().nativeElement.height);
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
    this.canvasEl().nativeElement.width = Math.floor(event.contentRect.width);
    this.canvasEl().nativeElement.height = Math.floor(event.contentRect.height);
    this.updateCanvas();
  }

  private getColors(colorName: string): string {
    let color = "";
    switch (colorName) {
      case "white":
        color = this.theme.white;
        break;
      case "blue":
        color = this.theme.blue;
        break;
      case "green":
        color = this.theme.green;
        break;
      case "pink":
        color = this.theme.pink;
        break;
      case "orange":
        color = this.theme.orange;
        break;
      case "purple":
        color = this.theme.purple;
        break;
      case "grey":
        color = this.theme.grey;
        break;
      case "yellow":
        color = this.theme.yellow;
        break;
      default:
        color = this.theme.white;
        break;
    }
    return color;
  }

  /* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */
  private updateCanvas() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.canvasEl().nativeElement.width, this.canvasEl().nativeElement.height);
      if (!this.widgetProperties.config.noBgColor) {
        this.canvasCtx.fillStyle = this.getColors(this.widgetProperties.config.bgColor);;
        this.canvasCtx.fillRect(0, 0, this.canvasEl().nativeElement.width, this.canvasEl().nativeElement.height);
      }
      this.drawValue();
    }
  }

  private drawValue() {
    const maxTextWidth = Math.floor(this.canvasEl().nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl().nativeElement.height * 0.85);
    const valueFontSize = this.calculateOptimalFontSize(this.widgetProperties.config.displayName, "bold", maxTextWidth, maxTextHeight, this.canvasCtx);

    this.canvasCtx.font = `bold ${valueFontSize}px ${this.fontString}`;
    this.canvasCtx.fillStyle = this.getColors(this.widgetProperties.config.color);
    this.canvasCtx.textAlign = "center";
    this.canvasCtx.textBaseline = "middle";
    this.canvasCtx.fillText(this.widgetProperties.config.displayName, this.canvasEl().nativeElement.width / 2, (this.canvasEl().nativeElement.height / 2) + (valueFontSize / 15), maxTextWidth);
  }

  private calculateOptimalFontSize(text: string, fontWeight: string, maxWidth: number, maxHeight: number, ctx: CanvasRenderingContext2D): number {
    let minFontSize = 1;
    let maxFontSize = maxHeight;
    let fontSize = maxFontSize;

    while (minFontSize <= maxFontSize) {
        fontSize = Math.floor((minFontSize + maxFontSize) / 2);
        ctx.font = `${fontWeight} ${fontSize}px ${this.fontString}`;
        const measure = ctx.measureText(text).width;

        if (measure > maxWidth) {
            maxFontSize = fontSize - 1;
        } else {
            minFontSize = fontSize + 1;
        }
    }

    return maxFontSize;
  }
}
