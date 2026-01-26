import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewEncapsulation, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { IKipResizeEvent, KipResizeObserverDirective } from '../../core/directives/kip-resize-observer.directive';
import { AisProcessingService, AisTrack } from '../../core/services/ais-processing.service';
import { DialogService } from '../../core/services/dialog.service';
import { DialogAisTargetComponent } from '../../core/components/dialog-ais-target/dialog-ais-target.component';

type ViewMode = 'north-up' | 'course-up';

interface AisRadarConfig extends IWidgetSvcConfig {
  radar?: {
    viewMode?: ViewMode;
    rangeRings?: number[];
    rangeIndex?: number;
    showTrails?: boolean;
    showMotionVectors?: boolean;
    showHeadingLineClassB?: boolean;
    showLostTargets?: boolean;
    showUnconfirmedTargets?: boolean;
    trailSeconds?: number;
    sweepSeconds?: number;
  };
}

interface RadarSize {
  width: number;
  height: number;
}

interface RenderState {
  size: RadarSize;
  cfg: AisRadarConfig;
  targets: AisTrack[];
  ownShip: {
    position?: { lat: number; lon: number } | null;
    headingTrue?: number | null;
    courseOverGroundTrue?: number | null;
  };
}

interface RenderTarget {
  id: string;
  raw: AisTrack;
  x: number;
  y: number;
  heading: number;
  status: string;
  aisClass: string | null;
  type: string;
  shape: 'triangle' | 'diamond' | 'circle' | 'square' | 'plus';
  label: string | null;
  scaleY: number;
  navState: string | null;
  sog: number | null;
  cog: number | null;
}

interface VectorLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  className: string;
}

@Component({
  selector: 'widget-ais-radar',
  imports: [KipResizeObserverDirective],
  templateUrl: './widget-ais-radar.component.html',
  styleUrls: ['./widget-ais-radar.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetAisRadarComponent implements AfterViewInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  protected readonly runtime = inject(WidgetRuntimeDirective);
  private readonly ais = inject(AisProcessingService);
  private readonly dialog = inject(DialogService);
  private readonly ngZone = inject(NgZone);

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    filterSelfPaths: false,
    enableTimeout: false,
    dataTimeout: 5,
    radar: {
      viewMode: 'course-up',
      rangeRings: [3, 6, 12, 24, 48],
      rangeIndex: 2,
      showTrails: true,
      showMotionVectors: true,
      showHeadingLineClassB: true,
      showLostTargets: true,
      showUnconfirmedTargets: true,
      trailSeconds: 300,
      sweepSeconds: 4
    }
  } as AisRadarConfig;

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('radarSvg');
  private readonly hostSize = signal<RadarSize | null>(null);
  private renderState: RenderState | null = null;
  private selectedId = signal<string | null>(null);

  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private root?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private ringsLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private trailsLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private vectorsLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private targetsLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private selectedLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;

  private renderFrame: number | null = null;

  constructor() {
    effect(() => {
      const size = this.hostSize();
      const cfg = this.runtime.options() as AisRadarConfig | undefined;
      const theme = this.theme();
      const targets = this.ais.targets();
      const ownShip = this.ais.ownShip();
      if (!size || !cfg || !theme || !cfg) return;
      untracked(() => {
        this.renderState = { size, cfg, targets, ownShip };
      });
    });
  }

  ngAfterViewInit(): void {
    this.initSvg();
    this.startRenderLoop();
  }

  protected onResized(event: IKipResizeEvent): void {
    this.hostSize.set({ width: event.width, height: event.height });
  }

  private initSvg(): void {
    this.svg = d3.select(this.svgRef().nativeElement);
    this.svg.attr('class', 'ais-radar');

    this.root = this.svg.append('g').attr('class', 'radar-root');
    this.ringsLayer = this.root.append('g').attr('class', 'radar-rings');
    this.trailsLayer = this.root.append('g').attr('class', 'radar-trails');
    this.vectorsLayer = this.root.append('g').attr('class', 'radar-vectors');
    this.targetsLayer = this.root.append('g').attr('class', 'radar-targets');
    this.selectedLayer = this.root.append('g').attr('class', 'radar-selected');

    this.svg.on('click', () => this.selectedId.set(null));
  }

  private startRenderLoop(): void {
    this.ngZone.runOutsideAngular(() => {
      const loop = () => {
        this.render();
        this.renderFrame = requestAnimationFrame(loop);
      };
      loop();
    });
  }

  private render(): void {
    if (!this.renderState || !this.svg || !this.root) return;

    const { size, cfg, targets, ownShip } = this.renderState;
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);
    const radius = Math.min(width, height) / 2;

    const radarCfg = (cfg.radar ?? {}) as NonNullable<AisRadarConfig['radar']>;
    const rangeRings = radarCfg.rangeRings?.length ? radarCfg.rangeRings : [3, 6, 12, 24, 48];
    const rangeIndex = Math.min(Math.max(radarCfg.rangeIndex ?? 0, 0), rangeRings.length - 1);
    const rangeNm = rangeRings[rangeIndex] ?? rangeRings[0];
    const viewMode: ViewMode = radarCfg.viewMode ?? 'course-up';
    const viewRotation = viewMode === 'course-up'
      ? (ownShip.courseOverGroundTrue ?? ownShip.headingTrue ?? 0)
      : 0;

    this.svg
      .attr('viewBox', `${-radius} ${-radius} ${radius * 2} ${radius * 2}`);

    this.renderRings(rangeRings, rangeNm, radius);

    if (!ownShip.position) return;

    const renderTargets = this.buildTargets(targets, ownShip.position, rangeNm, radius, viewRotation, radarCfg);
    this.renderTrails(renderTargets, rangeNm, radius, viewRotation, radarCfg);
    this.renderVectors(renderTargets, rangeNm, radius, viewRotation, radarCfg);
    this.renderTargets(renderTargets, radius);
    this.renderSelected(renderTargets, radius);
  }

  private renderRings(rangeRings: number[], rangeNm: number, radius: number): void {
    if (!this.ringsLayer) return;

    const rings = rangeRings
      .filter(r => r <= rangeNm)
      .map(value => ({ value, radius: (value / rangeNm) * radius }));

    const selection = this.ringsLayer
      .selectAll<SVGCircleElement, { value: number; radius: number }>('circle.ring')
      .data(rings, d => d.value.toString());

    selection.enter()
      .append('circle')
      .attr('class', 'ring')
      .merge(selection as d3.Selection<SVGCircleElement, { value: number; radius: number }, SVGGElement, unknown>)
      .attr('r', d => d.radius);

    selection.exit().remove();
  }

  private buildTargets(
    tracks: AisTrack[],
    origin: { lat: number; lon: number },
    rangeNm: number,
    radius: number,
    viewRotation: number,
    cfg: NonNullable<AisRadarConfig['radar']>
  ): RenderTarget[] {
    const showLost = cfg.showLostTargets ?? true;
    const showUnconfirmed = cfg.showUnconfirmedTargets ?? true;

    return tracks
      .filter(track => Boolean(track.position))
      .filter(track => (track.status === 'lost' ? showLost : true))
      .filter(track => (track.status === 'unconfirmed' ? showUnconfirmed : true))
      .map(track => {
        const distance = this.distanceNm(origin, track.position!);
        if (distance > rangeNm) return null;

        const bearing = this.bearingDeg(origin, track.position!);
        const angle = this.wrapDegrees(bearing - viewRotation);
        const { x, y } = this.polarToCartesian(angle, distance, rangeNm, radius);

        const heading = this.wrapDegrees((track.headingTrue ?? track.courseOverGroundTrue ?? 0) - viewRotation);
        const { shape, label, scaleY } = this.resolveShape(track);

        return {
          id: track.id,
          raw: track,
          x,
          y,
          heading,
          status: track.status,
          aisClass: track.aisClass,
          type: track.type,
          shape,
          label,
          scaleY,
          navState: track.navState ?? null,
          sog: track.speedOverGround ?? null,
          cog: track.courseOverGroundTrue ?? null
        } as RenderTarget;
      })
      .filter((target): target is RenderTarget => Boolean(target));
  }

  private renderTrails(
    targets: RenderTarget[],
    rangeNm: number,
    radius: number,
    viewRotation: number,
    cfg: NonNullable<AisRadarConfig['radar']>
  ): void {
    if (!this.trailsLayer) return;
    if (!cfg.showTrails) {
      this.trailsLayer.selectAll('*').remove();
      return;
    }

    const origin = this.renderState?.ownShip.position;
    if (!origin) return;

    const now = Date.now();
    const trailSeconds = Math.max(10, cfg.trailSeconds ?? 300);

    const trailData = targets.map(target => {
      const points = target.raw.trail
        .filter(point => now - point.ts <= trailSeconds * 1000)
        .map(point => {
          const distance = this.distanceNm(origin, point);
          const bearing = this.bearingDeg(origin, point);
          const angle = this.wrapDegrees(bearing - viewRotation);
          const coord = this.polarToCartesian(angle, distance, rangeNm, radius);
          return { x: coord.x, y: coord.y };
        })
        .filter(coord => Number.isFinite(coord.x) && Number.isFinite(coord.y));

      return { id: target.id, points, className: this.buildClassName(target) };
    });

    const line = d3.line<{ x: number; y: number }>()
      .x(d => d.x)
      .y(d => d.y);

    const selection = this.trailsLayer
      .selectAll<SVGPathElement, { id: string; points: { x: number; y: number }[]; className: string }>('path.trail')
      .data(trailData, d => d.id);

    selection.enter()
      .append('path')
      .attr('class', d => `trail ${d.className}`)
      .merge(selection as d3.Selection<SVGPathElement, { id: string; points: { x: number; y: number }[]; className: string }, SVGGElement, unknown>)
      .attr('d', d => line(d.points));

    selection.exit().remove();
  }

  private renderVectors(
    targets: RenderTarget[],
    rangeNm: number,
    radius: number,
    viewRotation: number,
    cfg: NonNullable<AisRadarConfig['radar']>
  ): void {
    if (!this.vectorsLayer) return;

    const motionEnabled = cfg.showMotionVectors ?? true;
    const headingEnabled = cfg.showHeadingLineClassB ?? true;
    const baseSize = Math.max(6, radius * 0.04);

    const motionData: VectorLine[] = [];
    const headingData: VectorLine[] = [];

    for (const target of targets) {
      if (target.raw.type !== 'vessel') continue;
      const heading = this.wrapDegrees((target.raw.headingTrue ?? target.raw.courseOverGroundTrue ?? 0) - viewRotation);
      const tip = this.offsetPoint(target.x, target.y, heading, baseSize * 0.8);

      if (motionEnabled && target.sog !== null) {
        const distanceNm = (target.sog * 5) / 60;
        const vectorLength = (distanceNm / rangeNm) * radius;
        const end = this.offsetPoint(tip.x, tip.y, heading, vectorLength);
        motionData.push({
          id: target.id,
          x1: tip.x,
          y1: tip.y,
          x2: end.x,
          y2: end.y,
          className: this.buildClassName(target)
        });
      }

      if (headingEnabled && target.raw.aisClass === 'B') {
        const end = this.offsetPoint(target.x, target.y, heading, baseSize * 1.6);
        headingData.push({
          id: target.id,
          x1: target.x,
          y1: target.y,
          x2: end.x,
          y2: end.y,
          className: this.buildClassName(target)
        });
      }
    }

    this.renderVectorLines('motion-vector', motionData);
    this.renderVectorLines('heading-line', headingData);
  }

  private renderVectorLines(className: string, data: VectorLine[]): void {
    if (!this.vectorsLayer) return;
    const selection = this.vectorsLayer
      .selectAll<SVGLineElement, VectorLine>(`line.${className}`)
      .data(data, d => d.id);

    selection.enter()
      .append('line')
      .attr('class', d => `${className} ${d.className}`)
      .merge(selection as d3.Selection<SVGLineElement, VectorLine, SVGGElement, unknown>)
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.x2)
      .attr('y2', d => d.y2);

    selection.exit().remove();
  }

  private renderTargets(targets: RenderTarget[], radius: number): void {
    if (!this.targetsLayer) return;

    const baseSize = Math.max(6, radius * 0.04);
    const symbol = d3.symbol();

    const selection = this.targetsLayer
      .selectAll<SVGGElement, RenderTarget>('g.target')
      .data(targets, d => d.id);

    const enter = selection.enter()
      .append('g')
      .attr('class', d => `target ${this.buildClassName(d)}`)
      .on('click', (event, d) => {
        event.stopPropagation();
        this.selectTarget(d);
      });

    enter.append('path')
      .attr('class', 'target-shape');

    enter.append('text')
      .attr('class', 'target-label');

    enter.append('title');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, RenderTarget, SVGGElement, unknown>);

    merged
      .attr('transform', d => `translate(${d.x}, ${d.y}) rotate(${d.heading}) scale(1, ${d.scaleY})`)
      .attr('class', d => `target ${this.buildClassName(d)}`);

    merged.select<SVGPathElement>('path.target-shape')
      .attr('d', d => {
        const symbolType = this.symbolTypeForShape(d.shape);
        symbol.type(symbolType).size(baseSize * baseSize * 1.2);
        return symbol() ?? '';
      });

    merged.select<SVGTextElement>('text.target-label')
      .text(d => d.label ?? '')
      .attr('y', baseSize * 0.3);

    merged.select('title')
      .text(d => `${d.raw.name ?? d.raw.mmsi ?? 'AIS Target'}`);

    selection.exit().remove();
  }

  private renderSelected(targets: RenderTarget[], radius: number): void {
    if (!this.selectedLayer) return;
    const selected = targets.filter(t => t.id === this.selectedId());
    const baseSize = Math.max(6, radius * 0.04);

    const selection = this.selectedLayer
      .selectAll<SVGCircleElement, RenderTarget>('circle.selected-ring')
      .data(selected, d => d.id);

    selection.enter()
      .append('circle')
      .attr('class', 'selected-ring')
      .merge(selection as d3.Selection<SVGCircleElement, RenderTarget, SVGGElement, unknown>)
      .attr('cx', d => d.x)
      .attr('cy', d => d.y)
      .attr('r', baseSize * 1.4);

    selection.exit().remove();
  }

  private selectTarget(target: RenderTarget): void {
    this.selectedId.set(target.id);
    this.dialog.openFrameDialog({
      title: 'AIS Target',
      component: 'ais-target',
      componentType: DialogAisTargetComponent,
      payload: { target: target.raw }
    }, false).subscribe();
  }

  private resolveShape(track: AisTrack): { shape: RenderTarget['shape']; label: string | null; scaleY: number } {
    const navState = (track.navState ?? '').toLowerCase();
    const typeName = String(track.aisShipType ?? '').toLowerCase();

    if (navState.includes('moored') || navState.includes('anchored')) {
      return { shape: 'diamond', label: null, scaleY: 1 };
    }

    if (navState.includes('man overboard') || navState.includes('mob')) {
      return { shape: 'plus', label: null, scaleY: 1 };
    }

    if (track.type === 'aton') {
      return { shape: 'circle', label: null, scaleY: 1 };
    }

    if (typeName.includes('tanker')) {
      return { shape: 'triangle', label: 'T', scaleY: 1 };
    }

    if (typeName.includes('fishing')) {
      return { shape: 'triangle', label: 'F', scaleY: 1 };
    }

    if (typeName.includes('passenger')) {
      return { shape: 'triangle', label: null, scaleY: 1.4 };
    }

    return { shape: 'triangle', label: null, scaleY: 1 };
  }

  private symbolTypeForShape(shape: RenderTarget['shape']): d3.SymbolType {
    switch (shape) {
      case 'diamond':
        return d3.symbolDiamond;
      case 'circle':
        return d3.symbolCircle;
      case 'square':
        return d3.symbolSquare;
      case 'plus':
        return d3.symbolCross;
      default:
        return d3.symbolTriangle;
    }
  }

  private buildClassName(target: RenderTarget): string {
    const classes = [
      `status-${target.status}`,
      `type-${target.type}`,
      target.aisClass ? `class-${target.aisClass.toLowerCase()}` : 'class-unknown'
    ];

    if (target.navState) {
      const nav = target.navState.toLowerCase();
      if (nav.includes('moored')) classes.push('state-moored');
      if (nav.includes('anchored')) classes.push('state-anchored');
    }

    if (target.id === this.selectedId()) {
      classes.push('is-selected');
    }

    return classes.join(' ');
  }

  private polarToCartesian(angleDeg: number, distanceNm: number, rangeNm: number, radius: number) {
    const theta = (angleDeg * Math.PI) / 180;
    const r = (distanceNm / rangeNm) * radius;
    return {
      x: r * Math.sin(theta),
      y: -r * Math.cos(theta)
    };
  }

  private offsetPoint(x: number, y: number, angleDeg: number, distance: number) {
    const theta = (angleDeg * Math.PI) / 180;
    return {
      x: x + distance * Math.sin(theta),
      y: y - distance * Math.cos(theta)
    };
  }

  private wrapDegrees(angle: number): number {
    const normalized = angle % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }

  private bearingDeg(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const phi1 = a.lat * Math.PI / 180;
    const phi2 = b.lat * Math.PI / 180;
    const dLon = (b.lon - a.lon) * Math.PI / 180;

    const y = Math.sin(dLon) * Math.cos(phi2);
    const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLon);
    const bearing = Math.atan2(y, x) * 180 / Math.PI;
    return this.wrapDegrees(bearing);
  }

  private distanceNm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const R = 6371e3; // meters
    const phi1 = a.lat * Math.PI / 180;
    const phi2 = b.lat * Math.PI / 180;
    const dPhi = (b.lat - a.lat) * Math.PI / 180;
    const dLambda = (b.lon - a.lon) * Math.PI / 180;

    const sinDP = Math.sin(dPhi / 2);
    const sinDL = Math.sin(dLambda / 2);
    const h = sinDP * sinDP + Math.cos(phi1) * Math.cos(phi2) * sinDL * sinDL;
    const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
    const meters = R * c;
    return meters / 1852;
  }

  ngOnDestroy(): void {
    if (this.renderFrame) {
      cancelAnimationFrame(this.renderFrame);
      this.renderFrame = null;
    }
  }
}
