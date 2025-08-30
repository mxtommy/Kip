import { AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { DashboardService } from '../../core/services/dashboard.service';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { AppService } from '../../core/services/app-service';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';

@Component({
  selector: 'widget-slider',
  imports: [ WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent ],
  templateUrl: './widget-slider.component.html',
  styleUrl: './widget-slider.component.scss'
})
export class WidgetSliderComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private svgElement = viewChild.required<ElementRef<SVGElement>>('svgSlider');
  protected dashboard = inject(DashboardService);
  private signalkRequestsService = inject(SignalkRequestsService);
  private appService = inject(AppService);
  protected labelColor = signal<string>(undefined)
  protected barColor = signal<string>(undefined);
  private skRequestSub = new Subscription; // Request result observer

  private lineStartPx: number;
  private lineWidthPx: number;
  private lineEndPx: number;
  private resizeTimeout: NodeJS.Timeout;
  private debounceTimeout: NodeJS.Timeout;
  protected handlePosition = 20;
  protected pathValue = 0;
  private lineStart = this.handlePosition;
  private isDragStarted = false;
  protected lineWidth = '0px';
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
      displayName: 'Slider Label',
      filterSelfPaths: true,
      paths: {
        'gaugePath': {
          description: 'PUT Supported Numeric Path. IMPORTANT: Format must be set to (base)',
          path: null,
          source: null,
          pathType: "number",
          isPathConfigurable: true,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: null,
          showConvertUnitTo: false,
          convertUnitTo: null,
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
    this.startWidget();
  }

  protected startWidget(): void {
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

  public sendValue(value: unknown): void {
    const path = this.widgetProperties.config.paths['gaugePath'].path;
    this.signalkRequestsService.putRequest(
      path,
      value,
      this.widgetProperties.uuid
    );
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.getColors(this.widgetProperties.config.color);
    this.calculateLineBounds(); // Recalculate line bounds on config update
    this.startWidget();
  }

  protected onResized(): void {
    clearTimeout(this.resizeTimeout);
    this.resizeTimeout = setTimeout(() => {
      this.calculateLineBounds(); // Recalculate line bounds on resize
    }, 200); // Adjust debounce time as needed
  }

  private calculateLineBounds(): void {
    if (!this.svgElement()?.nativeElement) {
      console.warn('[Slider Widget] SVG element is not initialized yet.');
      return;
    }

    const svgRect = this.svgElement().nativeElement.getBoundingClientRect();
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
    return e.clientX - this.svgElement().nativeElement.getBoundingClientRect().left;
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

  protected onPointerUp() {
    this.isDragStarted = false;

    // Emit the raw value immediately
    this.valueChange$.next(this.pathValue);
  }

  protected onPointerLeave() {
    if (this.isDragStarted) {
      this.isDragStarted = false;

      // Emit the raw value immediately
      this.valueChange$.next(this.pathValue);
    }
  }

  private getColors(color: string): void {
    const colors = this.colorMap.get(color) || this.colorMap.get("contrast");
    this.labelColor.set(colors.label);
    this.barColor.set(colors.bar);
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
    this.skRequestSub?.unsubscribe();
    this.valueChange$.complete(); // Complete the Subject to clean up resources
    clearTimeout(this.debounceTimeout);
    clearTimeout(this.resizeTimeout);
  }
}
