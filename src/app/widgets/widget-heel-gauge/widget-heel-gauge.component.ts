import { Component, computed, effect, signal, viewChild, ElementRef, inject, NgZone, AfterViewInit, input, untracked } from '@angular/core';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { getColors } from '../../core/utils/themeColors.utils';
import { ITheme } from '../../core/services/app-service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from '../../core/directives/widget-streams.directive';

// Internal helper interfaces
interface ITickPoint { x1: number; y1: number; x2: number; y2: number; major: boolean; }
interface ILabelPoint { x: number; y: number; text: string; value: number; }

@Component({
  selector: 'widget-heel-gauge',
  templateUrl: './widget-heel-gauge.component.html',
  styleUrls: ['./widget-heel-gauge.component.scss']
})
export class WidgetHeelGaugeComponent implements AfterViewInit {
  // Functional Host2 inputs
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  // Runtime + streams directives (injected)
  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly streams = inject(WidgetStreamsDirective);
  private readonly ngZone = inject(NgZone);
  // Paths for fine and coarse scales
  private readonly finePathRef = viewChild<ElementRef<SVGPathElement>>('finePath');
  private readonly coarsePathRef = viewChild<ElementRef<SVGPathElement>>('coarsePath');

  protected angleDeg = signal<number | null>(0);
  protected readonly absAngle = computed(() => {
    const v = this.angleDeg();
    return v == null ? null : Math.abs(v);
  });
  protected readonly angleSide = computed(() => {
    const v = this.angleDeg();
    if (v == null) return '';
    const side = v > 0 ? 'Stbd' : v < 0 ? 'Port' : 'Level';
    return this.runtime.options()?.gauge?.sideLabel ? side : '';
  });
  protected readonly displayValue = computed(() => {
    const v = this.absAngle();
    if (v == null) return '--';
    const dec = this.runtime.options()?.numDecimal ?? 1;
    return v.toFixed(dec);
  });

  protected themeColorValue = signal('contrast');
  // Ready flag after initial frame to enable CSS transitions if needed
  protected readonly ready = signal(false);
  protected readonly pointerTransition = computed(() => {
    const ms = this.runtime.options()?.paths?.['angle']?.sampleTime ?? 1000;
    const duration = Math.max(100, ms * 0.95);
    return `transform ${duration}ms ease-in-out`;
  });

  // Generated tick & label arrays
  protected readonly fineTicks = signal<ITickPoint[]>([]);
  protected readonly fineInnerTicks = signal<ITickPoint[]>([]);
  protected readonly fineLabels = signal<ILabelPoint[]>([]);
  protected readonly coarseTicks = signal<ITickPoint[]>([]);
  protected readonly coarseInnerTicks = signal<ITickPoint[]>([]);
  protected readonly coarseLabels = signal<ILabelPoint[]>([]);

  protected readonly finePointerTransform = this.makePointerTransform('fine');
  protected readonly coarsePointerTransform = this.makePointerTransform('coarse');
  // Display name signal (fallback to Heel)
  protected readonly displayName = computed(() => this.runtime.options()?.displayName || 'Heel');

  // Static Host2 default config (parity with legacy defaultConfig)
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    displayName: 'Heel',
    filterSelfPaths: true,
    paths: {
      angle: {
        description: 'Heel / Roll / Other Angle',
        path: 'self.navigation.attitude.roll',
        source: 'default',
        pathType: 'number',
        isPathConfigurable: true,
        convertUnitTo: 'deg',
        sampleTime: 1000,
        pathRequired: true
      }
    },
    gauge: {
      type: 'angle',
      invertAngle: false,
      sideLabel: true
    },
    numInt: 2,
    numDecimal: 0,
    color: 'contrast',
    enableTimeout: false,
    dataTimeout: 5
  };

  constructor() {
    // Observe angle path when config present
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      const angleCfg = cfg.paths?.['angle'];
      if (!angleCfg?.path) return; // nothing to observe if path empty
      // Establish observation outside reactive tracking of angle updates
      untracked(() => this.streams.observe('angle', pkt => {
        const raw = (pkt?.data?.value as number | undefined);
        if (raw == null) {
          this.angleDeg.set(null);
          return;
        }
        const inv = cfg.gauge?.invertAngle ? -raw : raw;
        this.angleDeg.set(inv);
      }));
    });

    // Theme + color config effect
    effect(() => {
      const t = this.theme();
      const cfg = this.runtime.options();
      if (!t || !cfg) return;
      this.themeColorValue.set(getColors(cfg.color || 'contrast', t).color);
    });
  }

  ngAfterViewInit(): void {
    // Build scales once view paths are available
    this.ngZone.runOutsideAngular(() => {
      requestAnimationFrame(() => {
        const finePath = this.finePathRef()?.nativeElement;
        const coarsePath = this.coarsePathRef()?.nativeElement;
        if (finePath) {
          const s = this.buildScale(finePath, -5, 5, 1, 0.5);
          this.fineTicks.set(s.ticks);
          this.fineInnerTicks.set(s.innerTicks);
          this.fineLabels.set(s.labels);
        }
        if (coarsePath) {
          const s2 = this.buildScale(coarsePath, -40, 40, 10, 5);
          this.coarseTicks.set(s2.ticks);
          this.coarseInnerTicks.set(s2.innerTicks);
          this.coarseLabels.set(s2.labels);
        }
        // Initialize to 0° if no data yet so pointers start centered
        if (this.angleDeg() == null) {
          this.angleDeg.set(0);
        }
        this.ready.set(true);
      });
    });
  }

  // Pointer transforms
  private makePointerTransform(scale: 'fine' | 'coarse') {
    return computed(() => this.computePointerTransform(this.angleDeg(), scale));
  }

  private setColors(theme: ITheme | null | undefined): void {
    const cfg = this.runtime.options();
    if (!theme || !cfg) return;
    this.themeColorValue.set(getColors(cfg.color || 'contrast', theme).color);
  }

  private computePointerTransform(angleValue: number | null, scale: 'fine' | 'coarse'): string {
    const angle = angleValue ?? 0;
    const pathEl = scale === 'fine' ? this.finePathRef()?.nativeElement : this.coarsePathRef()?.nativeElement;
    if (!pathEl) {
      // Fallback center position before paths are measurable (improves first paint)
      // Provide CSS transform with units for transition compatibility
      return scale === 'fine' ? 'translate(200px, 20px) rotate(0deg)' : 'translate(200px, 10px) rotate(0deg)';
    }
    const domain = scale === 'fine' ? { min: -5, max: 5 } : { min: -40, max: 40 };
    const val = Math.max(domain.min, Math.min(domain.max, angle));
    const pathLength = pathEl.getTotalLength();
    const pct = (val - domain.min) / (domain.max - domain.min);
    const distance = pct * pathLength;
    const point = pathEl.getPointAtLength(distance);
    // Tangent computation (adaptive delta near ends)
    const delta = distance < 10 || distance > pathLength - 10 ? 5 : 1;
    const before = pathEl.getPointAtLength(Math.max(0, distance - delta));
    const after = pathEl.getPointAtLength(Math.min(pathLength, distance + delta));
    const tx = after.x - before.x;
    const ty = after.y - before.y;
    const tangentAngle = Math.atan2(ty, tx) * 180 / Math.PI;
    // Normal (perpendicular) vector (normalized)
    const len = Math.hypot(tx, ty) || 1;
    const nx = -ty / len; // rotate tangent -90° for outward (depending on path orientation)
    const ny = tx / len;
    // Offset ellipse center along normal instead of fixed vertical to keep consistent spacing across curvature
    const normalOffset = -10; // negative to move "up" relative to visual layout; adjust if inverted
    const cx = point.x + nx * normalOffset;
    const cy = point.y + ny * normalOffset;
  return `translate(${cx}px, ${cy}px) rotate(${tangentAngle}deg)`;
  }

  private buildScale(pathEl: SVGPathElement, min: number, max: number, majorStep: number, minorStep: number) {
    const pathLength = pathEl.getTotalLength();
    const ticks: ITickPoint[] = [];
    const innerTicks: ITickPoint[] = [];
    const labels: ILabelPoint[] = [];
    const span = max - min;
    const steps = Math.round(span / minorStep);
    const majorEvery = Math.round(majorStep / minorStep);
    for (let i = 0; i <= steps; i++) {
      const v = min + i * minorStep;
      const pct = i / steps; // exact 0..1
      const distance = i === steps ? pathLength : pct * pathLength;
      const point = pathEl.getPointAtLength(distance);
      const before = pathEl.getPointAtLength(Math.max(0, distance - 1));
      const after = pathEl.getPointAtLength(Math.min(pathLength, distance + 1));
      const angle = Math.atan2(after.y - before.y, after.x - before.x) * 180 / Math.PI;
      const isMajor = (i % majorEvery === 0) || Math.abs(v) < 1e-9; // ensure 0 labeled even if rounding
      const outerLen = isMajor ? 8 : 4;
      const innerLen = isMajor ? 6 : 3;
      const outerStart = this.pointFromAngle(point, angle + 90, 0);
      const outerEnd = this.pointFromAngle(point, angle + 90, outerLen);
      ticks.push({ x1: outerStart.x, y1: outerStart.y, x2: outerEnd.x, y2: outerEnd.y, major: isMajor });
      const innerStart = this.pointFromAngle(point, angle - 90, 0);
      const innerEnd = this.pointFromAngle(point, angle - 90, innerLen);
      innerTicks.push({ x1: innerStart.x, y1: innerStart.y, x2: innerEnd.x, y2: innerEnd.y, major: isMajor });
      if (isMajor) {
        const labelPoint = this.pointFromAngle(point, angle + 90, outerLen + 8);
        labels.push({ x: labelPoint.x, y: labelPoint.y, text: `${Math.abs(v)}`, value: v });
      }
    }
    return { ticks, innerTicks, labels };
  }

  private pointFromAngle(point: { x: number; y: number }, angle: number, distance: number) {
    const rad = angle * Math.PI / 180;
    return { x: point.x + Math.cos(rad) * distance, y: point.y + Math.sin(rad) * distance };
  }
}
