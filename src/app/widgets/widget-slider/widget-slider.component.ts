import { Component, effect, ElementRef, inject, OnDestroy, OnInit, signal, viewChild, input, untracked, ChangeDetectionStrategy, computed } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { ToastService } from '../../core/services/toast.service';
import type { IWidgetPath, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';
import { ITheme } from '../../core/services/app-service';
import { KipResizeObserverDirective } from '../../core/directives/kip-resize-observer.directive';

@Component({
  selector: 'widget-slider',
  imports: [ KipResizeObserverDirective, WidgetTitleComponent ],
  templateUrl: './widget-slider.component.html',
  styleUrl: './widget-slider.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WidgetSliderComponent implements OnInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme>();
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    supportAutomaticHistoricalSeries: false,
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
        convertUnitTo: undefined,
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
  private readonly toast = inject(ToastService);

  protected labelColor = signal<string>('')
  protected barColor = signal<string>('');

  private lineStartPx = 0;
  private lineWidthPx = 0;
  private lineEndPx = 0;

  private resizeTimeout: ReturnType<typeof setTimeout> | null = null;

  protected readonly handlePositionView = signal<number>(20);
  protected readonly lineWidthView = computed(() => `${Math.max(0, this.handlePositionView() - this.LINE_START)}px`);
  protected pathValue = 0;
  private lineStart = 20;
  private isDragStarted = false;
  private readonly VIEWBOX_WIDTH = 200;
  private readonly LINE_START = 20;
  private readonly LINE_WIDTH = 160;
  private colorMap: Map<string, { label: string; bar: string }> | null = null;
  protected readonly cfg = computed<IWidgetSvcConfig>(() => this.runtime.options() ?? WidgetSliderComponent.DEFAULT_CONFIG);
  private readonly gaugePathConfig = computed<IWidgetPath | undefined>(() => {
    const paths = this.cfg().paths as Record<string, IWidgetPath> | undefined;
    return paths?.gaugePath;
  });
  protected readonly displayNameSafe = computed(() => this.cfg().displayName ?? 'Slider Label');
  private readonly displayScale = computed(() => {
    const scale = this.cfg().displayScale ?? WidgetSliderComponent.DEFAULT_CONFIG.displayScale!;
    return {
      ...scale,
      lower: scale.lower ?? 0,
      upper: scale.upper ?? 1,
    };
  });

  private valueChange$ = new Subject<number>();

  constructor() {
    // Theme + color reaction
    effect(() => {
      const theme = this.theme();
      const cfg = this.cfg();
      if (!cfg || !theme) return;
      untracked(() => {
        this.ensureColorMap();
        this.getColors(cfg.color ?? 'contrast');
      });
    });

    effect(() => {
      const cfg = this.cfg();
      const gaugePath = this.gaugePathConfig();
      if (!gaugePath?.path) return; // nothing to observe yet

      untracked(() => {
        this.calculateLineBounds();

        this.streams.observe('gaugePath', (newValue) => {
          if (!newValue || !newValue.data) {
            queueMicrotask(() => this.updateHandlePosition(this.mapValueToPosition(this.displayScale().lower)));
            return;
          }
          queueMicrotask(() => this.updateHandlePosition(this.mapValueToPosition(newValue.data.value as number)));
        });
      });
    });
  }

  ngOnInit(): void {
    const cfg = this.cfg();

    if (cfg) {
      this.getColors(cfg.color ?? 'contrast');
    }

    this.valueChange$
      .pipe(
        map((value) => {
          const cfg = this.cfg();
          const scale = this.displayScale();
          if (!cfg) return value;
          // Check if the value is within 1% of the lower or upper bounds
          if (this.isWithinMargin(value, scale.lower, cfg)) {
            return scale.lower; // Exact lower bound
          } else if (this.isWithinMargin(value, scale.upper, cfg)) {
            return scale.upper; // Exact upper bound
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
    const cfg = this.cfg();
    const scale = this.displayScale();
    if (!cfg) return value;
    const scaleRange = scale.upper - scale.lower;
    const lineRange = this.LINE_WIDTH;
    return ((value - scale.lower) / scaleRange) * lineRange + this.LINE_START;
  }

  private mapPositionToValue(position: number): number {
    const cfg = this.cfg();
    const scale = this.displayScale();
    if (!cfg) return position;
    const scaleRange = scale.upper - scale.lower;
    const lineRange = this.LINE_WIDTH;
    return ((position - this.LINE_START) / lineRange) * scaleRange + scale.lower;
  }

  private isWithinMargin(value: number, target: number, cfg: IWidgetSvcConfig): boolean {
    const scale = this.displayScale();
    const margin = (scale.upper - scale.lower) * 0.01; // 1% margin
    return Math.abs(value - target) <= margin;
  }

  public sendValue(value: unknown): void {
    const path = this.gaugePathConfig()?.path;
    if (!path) {
      return;
    }
    this.signalkRequestsService.putRequest(
      path,
      value,
      this.id()
    );
  }

  protected onResized(): void {
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
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
    const constrained = Math.max(this.LINE_START, Math.min(this.LINE_START + this.LINE_WIDTH, position));
    this.handlePositionView.set(constrained);
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
        const handlePosition = this.handlePositionView();

        const scale = this.displayScale();
        if (handlePosition <= this.LINE_START) {
          this.pathValue = scale.lower; // Exact lower bound
        } else if (handlePosition >= this.LINE_START + this.LINE_WIDTH) {
          this.pathValue = scale.upper; // Exact upper bound
        } else {
          this.pathValue = this.mapPositionToValue(handlePosition);
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
    if (!colors) return;
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
    this.valueChange$.complete(); // Complete the Subject to clean up resources
    if (this.resizeTimeout) clearTimeout(this.resizeTimeout);
  }
}
