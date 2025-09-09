import { Component, OnInit, OnDestroy, computed, effect, signal, viewChild, ElementRef, inject, NgZone } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { animateRotation } from '../../core/utils/svg-animate.util';
import { Subscription } from 'rxjs';
import { getHighlights } from '../../core/utils/zones-highlight.utils';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';

interface IArcHighlight { path: string; fill: string; width: number; }

@Component({
  selector: 'widget-heel-gauge',
  templateUrl: './widget-heel-gauge.component.html',
  styleUrls: ['./widget-heel-gauge.component.scss'],
  imports: [WidgetHostComponent],
})
export class WidgetHeelGaugeComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  private readonly ngZone = inject(NgZone);
  private readonly needleGroup = viewChild<ElementRef<SVGGElement>>('needleGroup');

  protected readonly heelDeg = signal<number | null>(null);
  protected readonly absHeel = computed(() => {
    const v = this.heelDeg();
    return v == null ? null : Math.abs(v);
  });
  protected readonly heelSide = computed(() => {
    const v = this.heelDeg();
    if (v == null) return '';
    return v > 0 ? 'Stbd' : v < 0 ? 'Port' : 'Level';
  });
  protected readonly displayValue = computed(() => {
    const v = this.heelDeg();
    if (v == null) return '--';
    const dec = this.widgetProperties?.config?.numDecimal ?? 1;
    return v.toFixed(dec);
  });

  protected readonly needleAngle = signal(0); // rotation relative center (0 = up)
  private previousAngle = 0;
  private needleAnimFrames = new WeakMap<SVGGElement, number>();

  // Dial tick marks (every 15° across -45..45, with longer major ticks every 30°)
  protected readonly majorTicks = computed(() => {
    const ticks: { x1: number; y1: number; x2: number; y2: number; tx: number; ty: number; label: string }[] = [];
    const min = -45, max = 45;
    const centerX = 100, centerY = 100, outerR = 88, innerRMinor = 82, innerRMajor = 78, labelR = 70;
    for (let v = min; v <= max; v += 15) {
      const angle = this.valueToDialAngle(v, min, max); // -90..90
      const rad = (angle - 90) * Math.PI / 180;
      const isMajor = (v - min) % 30 === 0;
      const innerR = isMajor ? innerRMajor : innerRMinor;
      const xOuter = centerX + outerR * Math.cos(rad);
      const yOuter = centerY + outerR * Math.sin(rad);
      const xInner = centerX + innerR * Math.cos(rad);
      const yInner = centerY + innerR * Math.sin(rad);
      const xLabel = centerX + labelR * Math.cos(rad);
      const yLabel = centerY + labelR * Math.sin(rad) + 4; // small vertical tweak
      ticks.push({
        x1: xInner,
        y1: yInner,
        x2: xOuter,
        y2: yOuter,
        tx: xLabel,
        ty: yLabel,
        label: isMajor ? `${Math.abs(v)}` : ''
      });
    }
    return ticks;
  });

  // Zones metadata subscription
  private metaSub: Subscription | null = null;
  protected readonly zoneHighlights = signal<IArcHighlight[]>([]);
  protected readonly valueColor = signal<string>('');
  protected readonly needleColor = signal<string>('');

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Heel',
      filterSelfPaths: true,
      paths: {
        heelAngle: {
          description: 'Heel / Roll Angle',
            path: 'navigation.attitude.roll',
            source: '',
            pathType: 'number',
            isPathConfigurable: true,
            convertUnitTo: 'deg',
            sampleTime: 1000,
            pathRequired: true
        }
      },
      numInt: 2,
      numDecimal: 1,
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    };

    effect(() => {
      if (this.theme()) {
        this.valueColor.set(this.theme().contrast);
        this.needleColor.set(this.theme().contrast);
      }
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

    this.observeDataStream('heelAngle', newValue => {
      if (!newValue || !newValue.data || newValue.data.value == null) {
        this.heelDeg.set(null);
        return;
      }
      const val = newValue.data.value;
      this.heelDeg.set(val);
      this.animateNeedle(val);
    });

    if (!this.widgetProperties.config.ignoreZones) {
      this.observeMetaStream();
      this.metaSub = this.zones$.subscribe(zones => {
        if (zones && zones.length > 0) {
          // Convert zones to highlight arcs (simplified: map ranges to arc sectors)
          const lower = -45; // visualization domain
          const upper = 45;
          const min = lower; const max = upper;
          const highlightsRaw = getHighlights(zones, this.theme(), this.widgetProperties.config.paths['heelAngle'].convertUnitTo, this.unitsService, min, max, false);
          const arcs: IArcHighlight[] = [];
          for (const z of highlightsRaw) {
            if (z.from == null || z.to == null) continue;
            const clampedFrom = Math.max(min, Math.min(max, z.from));
            const clampedTo = Math.max(min, Math.min(max, z.to));
            const startAngle = this.valueToDialAngle(clampedFrom, min, max);
            const endAngle = this.valueToDialAngle(clampedTo, min, max);
            arcs.push({ path: this.describeArc(100, 100, 80, startAngle, endAngle), fill: z.color, width: 6 });
          }
          this.zoneHighlights.set(arcs);
        } else {
          this.zoneHighlights.set([]);
        }
      });
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  private animateNeedle(val: number) {
    const clamped = Math.max(-45, Math.min(45, val));
    const targetAngle = this.valueToDialAngle(clamped, -45, 45);
    const el = this.needleGroup()?.nativeElement;
    if (!el) {
      this.needleAngle.set(targetAngle);
      this.previousAngle = targetAngle;
      return;
    }
    animateRotation(el, this.previousAngle, targetAngle, 600, () => this.previousAngle = targetAngle, this.needleAnimFrames, [100,100], this.ngZone);
    this.needleAngle.set(targetAngle);
  }

  private valueToDialAngle(value: number, min: number, max: number): number {
    // Map value range [-45,45] to dial arc [-90, 90]
    const pct = (value - min) / (max - min); // 0..1
    return -90 + pct * 180;
  }

  // SVG arc helper
  private polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  }
  private describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
    const start = this.polarToCartesian(x, y, radius, endAngle);
    const end = this.polarToCartesian(x, y, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    const d = ["M", start.x, start.y, "A", radius, radius, 0, largeArcFlag, 0, end.x, end.y].join(" ");
    return d;
  }

  ngOnDestroy(): void {
    this.unsubscribeDataStream();
    this.unsubscribeMetaStream();
    this.metaSub?.unsubscribe();
    const el = this.needleGroup()?.nativeElement;
    if (el) {
      const id = this.needleAnimFrames.get(el);
      if (id) cancelAnimationFrame(id);
    }
  }
}
