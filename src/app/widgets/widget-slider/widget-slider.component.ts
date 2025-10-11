import { Component, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild, input, untracked } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { Subscription, Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { AppService } from '../../core/services/app-service';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { ITheme } from '../../core/services/app-service';

@Component({
  selector: 'widget-slider',
  imports: [ NgxResizeObserverModule, WidgetTitleComponent ],
  templateUrl: './widget-slider.component.html',
  styleUrl: './widget-slider.component.scss'
})
export class WidgetSliderComponent implements OnInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme|null>();
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Slider Label',
    filterSelfPaths: true,
    paths: {
      'gaugePath': {
        description: 'PUT Supported Numeric Path. IMPORTANT: Format must be set to (base)',
        path: null,
        source: null,
        pathType: 'number',
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
      type: 'linear'
    },
    enableTimeout: false,
    dataTimeout: 5,
    color: 'contrast'
  };
  protected readonly runtime = inject(WidgetRuntimeDirective); // public for template access
  private readonly streams = inject(WidgetStreamsDirective);
  private svgElement = viewChild.required<ElementRef<SVGElement>>('svgSlider');
  protected readonly dashboard = inject(DashboardService);
  private readonly signalkRequestsService = inject(SignalkRequestsService);
  private readonly appService = inject(AppService);
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
  private colorMap: Map<string, { label: string; bar: string }> | null = null;

  private valueChange$ = new Subject<number>();

  constructor() {
    // Theme + color reaction
    effect(() => {
      const theme = this.theme();
      const cfg = this.runtime.options();
      if (!cfg || !theme) return;
      untracked(() => {
        this.ensureColorMap();
        this.getColors(cfg.color);
      });
    });

    effect(() => {
      const cfg = this.runtime.options();
      const path = cfg?.paths?.['gaugePath']?.path;
      if (!cfg || !path) return; // nothing to observe yet

      untracked(() => {
        this.calculateLineBounds();

        this.streams.observe('gaugePath', (newValue) => {
          if (!newValue || !newValue.data) {
            this.handlePosition = this.mapValueToPosition(cfg.displayScale.lower);
            return;
          }
          this.updateHandlePosition(this.mapValueToPosition(newValue.data.value as number));
        });
      });
    });
  }

  ngOnInit(): void {
    const cfg = this.runtime.options();

    if (cfg) {
      this.getColors(cfg.color);
    }

    this.skRequestSub?.unsubscribe();
    this.subscribeSKRequest();

    this.valueChange$
      .pipe(
        map((value) => {
          const cfg = this.runtime.options();
          if (!cfg) return value;
          // Check if the value is within 1% of the lower or upper bounds
          if (this.isWithinMargin(value, cfg.displayScale.lower, cfg)) {
            return cfg.displayScale.lower; // Exact lower bound
          } else if (this.isWithinMargin(value, cfg.displayScale.upper, cfg)) {
            return cfg.displayScale.upper; // Exact upper bound
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

  private mapValueToPosition(value: number): number {
    const cfg = this.runtime.options();
    if (!cfg) return value;
    const scaleRange = cfg.displayScale.upper - cfg.displayScale.lower;
    const lineRange = this.LINE_WIDTH;
    return ((value - cfg.displayScale.lower) / scaleRange) * lineRange + this.LINE_START;
  }

  private mapPositionToValue(position: number): number {
    const cfg = this.runtime.options();
    if (!cfg) return position;
    const scaleRange = cfg.displayScale.upper - cfg.displayScale.lower;
    const lineRange = this.LINE_WIDTH;
    return ((position - this.LINE_START) / lineRange) * scaleRange + cfg.displayScale.lower;
  }

  private isWithinMargin(value: number, target: number, cfg: IWidgetSvcConfig): boolean {
    const margin = (cfg.displayScale.upper - cfg.displayScale.lower) * 0.01; // 1% margin
    return Math.abs(value - target) <= margin;
  }

  private subscribeSKRequest(): void {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.id()) {
        const cfg = this.runtime.options();
        let errMsg = `Toggle Widget ${cfg?.displayName}: `;
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
    const path = this.runtime.options()?.paths?.['gaugePath']?.path;
    this.signalkRequestsService.putRequest(
      path,
      value,
      this.id()
    );
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

        const cfg = this.runtime.options();
        if (cfg && this.handlePosition <= this.LINE_START) {
          this.pathValue = cfg.displayScale.lower; // Exact lower bound
        } else if (cfg && this.handlePosition >= this.LINE_START + this.LINE_WIDTH) {
          this.pathValue = cfg.displayScale.upper; // Exact upper bound
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
    this.ensureColorMap();
    if (!this.colorMap) return;
    const colors = this.colorMap.get(color) || this.colorMap.get("contrast");
    this.labelColor.set(colors.label);
    this.barColor.set(colors.bar);
  }

  private ensureColorMap(): void {
    const theme = this.theme();
    if (!theme) return; // inputs not yet set
    this.colorMap = new Map<string, { label: string; bar: string }>([
      ["contrast", { label: theme.contrastDim, bar: theme.contrast }],
      ["blue", { label: theme.blueDim, bar: theme.blue }],
      ["green", { label: theme.greenDim, bar: theme.green }],
      ["pink", { label: theme.pinkDim, bar: theme.pink }],
      ["orange", { label: theme.orangeDim, bar: theme.orange }],
      ["purple", { label: theme.purpleDim, bar: theme.purple }],
      ["grey", { label: theme.greyDim, bar: theme.grey }],
      ["yellow", { label: theme.yellowDim, bar: theme.yellow }],
    ]);
  }

  ngOnDestroy(): void {
    this.skRequestSub?.unsubscribe();
    this.valueChange$.complete(); // Complete the Subject to clean up resources
    clearTimeout(this.debounceTimeout);
    clearTimeout(this.resizeTimeout);
  }
}
