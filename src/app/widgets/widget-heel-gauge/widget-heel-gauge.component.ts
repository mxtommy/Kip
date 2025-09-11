import { Component, OnInit, OnDestroy, computed, effect, signal, viewChild, ElementRef, inject, NgZone, AfterViewInit } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { Subscription } from 'rxjs';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { getColors } from '../../core/utils/themeColors.utils';
import { ITheme } from '../../core/services/app-service';

// Internal helper interfaces
interface ITickPoint { x1: number; y1: number; x2: number; y2: number; major: boolean; }
interface ILabelPoint { x: number; y: number; text: string; value: number; }

@Component({
  selector: 'widget-heel-gauge',
  templateUrl: './widget-heel-gauge.component.html',
  styleUrls: ['./widget-heel-gauge.component.scss'],
  imports: [WidgetHostComponent],
})

export class WidgetHeelGaugeComponent extends BaseWidgetComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly ngZone = inject(NgZone);
  // Paths for fine and coarse scales
  private readonly finePathRef = viewChild<ElementRef<SVGPathElement>>('finePath');
  private readonly coarsePathRef = viewChild<ElementRef<SVGPathElement>>('coarsePath');

  protected readonly angleDeg = signal<number | null>(null);
  protected readonly absAngle = computed(() => {
    const v = this.angleDeg();
    return v == null ? null : Math.abs(v);
  });
  protected readonly angleSide = computed(() => {
    const v = this.angleDeg();
    if (v == null) return '';
    return v > 0 ? 'Stbd' : v < 0 ? 'Port' : 'Level';
  });
  protected readonly displayValue = computed(() => {
    const v = this.angleDeg();
    if (v == null) return '--';
    const dec = this.widgetProperties?.config?.numDecimal ?? 1;
    return v.toFixed(dec);
  });

  protected themeColor = signal('contrast');

  // Ready flag after initial frame to enable CSS transitions if needed
  protected readonly ready = signal(false);

  // Generated tick & label arrays
  protected readonly fineTicks = signal<ITickPoint[]>([]);
  protected readonly fineInnerTicks = signal<ITickPoint[]>([]);
  protected readonly fineLabels = signal<ILabelPoint[]>([]);
  protected readonly coarseTicks = signal<ITickPoint[]>([]);
  protected readonly coarseInnerTicks = signal<ITickPoint[]>([]);
  protected readonly coarseLabels = signal<ILabelPoint[]>([]);

  // Pointer transforms
  protected readonly finePointerTransform = computed(() => this.computePointerTransform(this.angleDeg(), 'fine'));
  protected readonly coarsePointerTransform = computed(() => this.computePointerTransform(this.angleDeg(), 'coarse'));

  // (Legacy) Zones metadata subscription – retained for potential future adaptation
  private metaSub: Subscription | null = null;
  // Horizontal variant currently does not render zones visually
  protected readonly zoneHighlights = signal<[]>([]);

  constructor() {
    super();

    this.defaultConfig = {
      displayName: "Heel",
      filterSelfPaths: true,
      paths: {
        "angle": {
          description: "Heel / Roll / Other Angle",
          path: "self.navigation.attitude.roll",
          source: "default",
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "deg",
          sampleTime: 1000,
          pathRequired: true
        }
      },
      gauge: {
        type: 'angle',
        invertAngle: false
      },
      numInt: 2,
      numDecimal: 0,
      color: "contrast",
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    };

    // Trigger recalculations if theme changes (e.g., for dynamic colors)
    effect(() => {
      const t = this.theme();
      this.setColors(t);
    });
  }

  ngOnInit(): void {
    this.validateConfig();
    this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.unsubscribeMetaStream();
    this.metaSub?.unsubscribe();

    this.observeDataStream("angle", newValue => {
      if (!newValue || !newValue.data) {
        this.angleDeg.set(null);
        return;
      }
      const val = this.widgetProperties.config.gauge.invertAngle ? -newValue.data.value : newValue.data.value;
      this.angleDeg.set(val);
    });

    // Zones not visualized; ensure empty
    this.zoneHighlights.set([]);
  }

  private setColors(theme: ITheme): void {
    this.themeColor.set(getColors(this.widgetProperties.config.color, theme).color);
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.setColors(this.theme());
    this.startWidget();
  }

  private computePointerTransform(angle: number | null, scale: 'fine' | 'coarse'): string {
    if (angle == null) return '';
    const pathEl = scale === 'fine' ? this.finePathRef()?.nativeElement : this.coarsePathRef()?.nativeElement;
    if (!pathEl) return '';
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
    return `translate(${cx}, ${cy}) rotate(${tangentAngle})`;
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
        this.ready.set(true);
        // Initialize to 0° if no data yet so pointers start centered
        if (this.angleDeg() == null) {
          this.angleDeg.set(0);
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.unsubscribeDataStream();
    this.unsubscribeMetaStream();
    this.metaSub?.unsubscribe();
  }
}
