import { AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { DashboardService } from '../../core/services/dashboard.service';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { Subscription } from 'rxjs';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { AppService } from '../../core/services/app-service';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';

@Component({
  selector: 'widget-range-slider',
  imports: [ WidgetHostComponent, NgxResizeObserverModule ],
  templateUrl: './widget-range-slider.component.html',
  styleUrl: './widget-range-slider.component.scss'
})
export class WidgetRangeSliderComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasLabel', {static: true}) canvasLabelElement: ElementRef<HTMLCanvasElement>;
  @ViewChild('widgetContainer', {static: true}) widgetContainerElement: ElementRef<HTMLCanvasElement>;
  @ViewChild('svgSlider', {static: true}) svgElement: ElementRef<SVGElement>;

  protected dashboard = inject(DashboardService);
  private signalkRequestsService = inject(SignalkRequestsService);
  private appService = inject(AppService);
  private canvasLabelCtx: CanvasRenderingContext2D;
  protected labelColor: string = undefined;
  protected barColor: string = undefined;
  private skRequestSub = new Subscription; // Request result observer
  private readonly fontString = "Roboto";

  private lineStartPx: number;
  private lineWidthPx: number;
  private lineEndPx: number;

  private resizeTimeout: any;

  protected handlePosition = 20;
  private lineStart = this.handlePosition;
  private isDragStarted: boolean = false;
  lineWidth: string = '0px';
  labels: string[] = ["25", "50", "75"];

  private readonly VIEWBOX_WIDTH = 200;
  private readonly LINE_START = 20;
  private readonly LINE_WIDTH = 160;

  private readonly colorMap = new Map<string, { label: string; bar: string }>([
    ["contrast", { label: this.theme().contrastDim, bar: this.theme().contrast }],
    ["blue", { label: this.theme().blueDim, bar: this.theme().blue }],
    ["green", { label: this.theme().greenDim, bar: this.theme().green }],
    ["pink", { label: this.theme().pinkDim, bar: this.theme().pink }],
    ["orange", { label: this.theme().orangeDim, bar: this.theme().orange }],
    ["purple", { label: this.theme().purpleDim, bar: this.theme().purple }],
    ["grey", { label: this.theme().greyDim, bar: this.theme().grey }],
    ["yellow", { label: this.theme().yellowDim, bar: this.theme().yellow }],
  ]);

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Range Slider Label',
      filterSelfPaths: true,
      paths: {
        'gaugePath': {
          description: 'Numeric PUT path',
          path: null,
          source: null,
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "unitless",
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        }
      },
      enableTimeout: false,
      dataTimeout: 5,
      color: "blue",
    };

    effect(() => {
      if (this.theme()) {
        this.getColors(this.widgetProperties.config.color);
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.startWidget();
  }

  private calculateLineBounds(): void {
    if (!this.svgElement?.nativeElement) {
      console.warn('SVG element is not initialized yet.');
      return;
    }

    const svgRect = this.svgElement.nativeElement.getBoundingClientRect();
    const lineStartPx = (this.LINE_START / this.VIEWBOX_WIDTH) * svgRect.width;
    const lineWidthPx = (this.LINE_WIDTH / this.VIEWBOX_WIDTH) * svgRect.width;

    this.lineStartPx = lineStartPx;
    this.lineWidthPx = lineWidthPx;
    this.lineEndPx = this.lineStartPx + this.lineWidthPx;
  }

  protected startWidget(): void {
    this.canvasLabelCtx = this.canvasLabelElement.nativeElement.getContext('2d');

    // Listen to PUT response msg
    this.skRequestSub?.unsubscribe();
    this.subscribeSKRequest();
  }

  private subscribeSKRequest(): void {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetProperties.uuid) {
        let errMsg = `Toggle Widget ${this.widgetProperties.config.displayName}: `;
        if (requestResult.statusCode != 200){
          if (requestResult.message){
            errMsg += requestResult.message;
          } else {
            errMsg += requestResult.statusCode + " - " +requestResult.statusCodeDescription;
          }
          this.appService.sendSnackbarNotification(errMsg, 0);
        }
      }
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
  }

  onResized(event: ResizeObserverEntry): void {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.resizeWidget();
      this.calculateLineBounds(); // Recalculate line bounds on resize
    }, 200); // Adjust debounce time as needed
  }

  private resizeWidget(): void {
    const rect = this.canvasLabelElement.nativeElement.getBoundingClientRect();
    if ((this.canvasLabelElement.nativeElement.width != Math.floor(rect.width)) || (this.canvasLabelElement.nativeElement.height != Math.floor(rect.height))) {
      this.canvasLabelElement.nativeElement.width = Math.floor(rect.width);
      this.canvasLabelElement.nativeElement.height = Math.floor(rect.height);

      if (this.canvasLabelCtx) {
        this.canvasLabelCtx.clearRect(0, 0, this.canvasLabelElement.nativeElement.width, this.canvasLabelElement.nativeElement.height);
        this.drawTitle();
      }
    }
  }

  getLabelXPosition(i: number): number {
    return (this.svgElement.nativeElement.clientWidth / (this.labels.length + 1)) * (i + 1);
  }

  public getLineWidth(): string {
    return this.handlePosition + 'px';
  }

  private updateHandlePosition(position: number): void {
    this.handlePosition = position;
    this.lineWidth = `${position - this.lineStart}px`;
  }

  private getPointerX(e: PointerEvent): number {
    return e.clientX - this.svgElement.nativeElement.getBoundingClientRect().left;
  }

  protected onPointerDown(e: PointerEvent) {
    this.isDragStarted = true;
    this.onPointerMove(e); // Update position immediately on pointer down
    e.stopPropagation();
    e.preventDefault();
  }

  protected onPointerMove(e: PointerEvent) {
    if (this.isDragStarted) {
      const pointerX = this.getPointerX(e);

      if (pointerX >= this.lineStartPx && pointerX <= this.lineEndPx) {
        const constrainedX = ((pointerX - this.lineStartPx) / this.lineWidthPx) * this.LINE_WIDTH + this.LINE_START;
        this.updateHandlePosition(constrainedX);
      }
    }
  }

  protected onPointerUp(e: PointerEvent) {
    this.isDragStarted = false;
  }

  protected onPointerLeave(e: Event) {
    this.isDragStarted = false;
  }

  // Draw the title on the canvas
  // this is called when the widget is resized, and when the title changes
  drawTitle() {
    const displayName = this.widgetProperties.config.displayName;
    if (!displayName) {
      return;
    }

    const maxTextWidth = Math.floor(this.canvasLabelElement.nativeElement.width * 0.94);
    const maxTextHeight = Math.floor(this.canvasLabelElement.nativeElement.height * 0.1);
    const fontSize = this.calculateOptimalFontSize(displayName, "normal", maxTextWidth, maxTextHeight, this.canvasLabelCtx);

    this.canvasLabelCtx.font = `normal ${fontSize}px ${this.fontString}`;
    this.canvasLabelCtx.textAlign = 'left';
    this.canvasLabelCtx.textBaseline = 'top';
    this.canvasLabelCtx.fillStyle = this.labelColor;
    this.canvasLabelCtx.fillText(
      displayName,
      Math.floor(this.canvasLabelElement.nativeElement.width * 0.03),
      Math.floor(this.canvasLabelElement.nativeElement.height * 0.03),
      maxTextWidth
    );
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

  private getColors(color: string): void {
    const colors = this.colorMap.get(color) || this.colorMap.get("contrast");
    this.labelColor = colors.label;
    this.barColor = colors.bar;
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
    this.skRequestSub?.unsubscribe();
    if (this.canvasLabelCtx) {
      this.canvasLabelCtx.clearRect(0, 0, this.canvasLabelElement.nativeElement.width, this.canvasLabelElement.nativeElement.height);
    }
  }
}
