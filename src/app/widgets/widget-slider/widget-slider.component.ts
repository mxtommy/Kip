import { AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { DashboardService } from '../../core/services/dashboard.service';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { AppService } from '../../core/services/app-service';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';

@Component({
  selector: 'widget-slider',
  imports: [ WidgetHostComponent, NgxResizeObserverModule ],
  templateUrl: './widget-slider.component.html',
  styleUrl: './widget-slider.component.scss'
})
export class WidgetSliderComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('canvasLabel', {static: true}) canvasLabelElement: ElementRef<HTMLCanvasElement>;
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
  private debounceTimeout: any
  protected handlePosition = 20;
  protected pathValue: number = 0;
  private lineStart = this.handlePosition;
  private isDragStarted: boolean = false;
  protected lineWidth: string = '0px';
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

  private valueChange$ = new Subject<number>();

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
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: "unitless",
          supportsPut: true,
          sampleTime: 500
        }
      },
      displayScale: {
        lower: 0,
        upper: 1,
        type: "linear",
      },
      enableTimeout: false,
      dataTimeout: 5,
      color: "contrast",
    };

    effect(() => {
      if (this.theme()) {
        this.getColors(this.widgetProperties.config.color);
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();

    // Subscribe to value changes with rounding, debouncing, and distinct filtering
    this.valueChange$
      .pipe(
        map((value) => {
          // Check if the value is within 1% of the lower or upper bounds
          if (this.isWithinMargin(value, this.widgetProperties.config.displayScale.lower)) {
            return this.widgetProperties.config.displayScale.lower; // Exact lower bound
          } else if (this.isWithinMargin(value, this.widgetProperties.config.displayScale.upper)) {
            return this.widgetProperties.config.displayScale.upper; // Exact upper bound
          }
          return parseFloat(value.toFixed(2)); // Round to 2 decimal places
        }),
        debounceTime(200), // Debounce updates by 200ms
        distinctUntilChanged() // Only emit if the value has changed
      )
      .subscribe((value) => {
        this.sendValue(value); // Send the rounded or exact value only if it has changed
      });
  }

  ngAfterViewInit(): void {
    this.canvasLabelCtx = this.canvasLabelElement.nativeElement.getContext('2d');
    this.startWidget();
  }

  private mapValueToPosition(value: number): number {
    const scaleRange = this.widgetProperties.config.displayScale.upper - this.widgetProperties.config.displayScale.lower;
    const lineRange = this.LINE_WIDTH;
    return ((value - this.widgetProperties.config.displayScale.lower) / scaleRange) * lineRange + this.LINE_START;
  }

  private mapPositionToValue(position: number): number {
    const scaleRange = this.widgetProperties.config.displayScale.upper - this.widgetProperties.config.displayScale.lower;
    const lineRange = this.LINE_WIDTH;
    return ((position - this.LINE_START) / lineRange) * scaleRange + this.widgetProperties.config.displayScale.lower;
  }

  private isWithinMargin(value: number, target: number): boolean {
    const margin = (this.widgetProperties.config.displayScale.upper - this.widgetProperties.config.displayScale.lower) * 0.01; // 1% margin
    return Math.abs(value - target) <= margin;
  }

  protected startWidget(): void {
    this.getColors(this.widgetProperties.config.color);

    this.unsubscribeDataStream();
    this.observeDataStream('gaugePath', newValue => {
      if (!newValue || !newValue.data) {
        this.handlePosition = this.mapValueToPosition(this.widgetProperties.config.displayScale.lower); // Default to lower bound
        return;
      }
      this.updateHandlePosition(this.mapValueToPosition(newValue.data.value));
    });

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

  public sendValue(value): void {
    const path = this.widgetProperties.config.paths['gaugePath'].path;
    this.signalkRequestsService.putRequest(
      path,
      value,
      this.widgetProperties.uuid
    );
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.calculateLineBounds(); // Recalculate line bounds on config update
    this.startWidget();
    this.drawTitle();
  }

  protected onResized(event: ResizeObserverEntry): void {
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
        this.drawTitle();
      }
    }
  }

  private calculateLineBounds(): void {
    if (!this.svgElement?.nativeElement) {
      console.warn('[Slider Widget] SVG element is not initialized yet.');
      return;
    }

    const svgRect = this.svgElement.nativeElement.getBoundingClientRect();
    const lineStartPx = (this.LINE_START / this.VIEWBOX_WIDTH) * svgRect.width;
    const lineWidthPx = (this.LINE_WIDTH / this.VIEWBOX_WIDTH) * svgRect.width;

    this.lineStartPx = lineStartPx;
    this.lineWidthPx = lineWidthPx;
    this.lineEndPx = this.lineStartPx + this.lineWidthPx;
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

        if (this.handlePosition <= this.LINE_START) {
          this.pathValue = this.widgetProperties.config.displayScale.lower; // Exact lower bound
        } else if (this.handlePosition >= this.LINE_START + this.LINE_WIDTH) {
          this.pathValue = this.widgetProperties.config.displayScale.upper; // Exact upper bound
        } else {
          this.pathValue = this.mapPositionToValue(this.handlePosition);
        }

        // Emit the raw value to the Subject
        this.valueChange$.next(this.pathValue);
      }
    }
  }

  protected onPointerUp(e: PointerEvent) {
    this.isDragStarted = false;

    // Emit the raw value immediately
    this.valueChange$.next(this.pathValue);
  }

  protected onPointerLeave(e: Event) {
    if (this.isDragStarted) {
      this.isDragStarted = false;

      // Emit the raw value immediately
      this.valueChange$.next(this.pathValue);
    }
  }

  // Draw the title on the canvas
  // this is called when the widget is resized, and when the title changes
  drawTitle() {
    this.canvasLabelCtx.clearRect(0, 0, this.canvasLabelElement.nativeElement.width, this.canvasLabelElement.nativeElement.height);
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
    this.valueChange$.complete(); // Complete the Subject to clean up resources
    if (this.canvasLabelCtx) {
      this.canvasLabelCtx.clearRect(0, 0, this.canvasLabelElement.nativeElement.width, this.canvasLabelElement.nativeElement.height);
    }
    clearTimeout(this.debounceTimeout);
    clearTimeout(this.resizeTimeout);
  }
}
