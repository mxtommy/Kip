import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewEncapsulation, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { IKipResizeEvent, KipResizeObserverDirective } from '../../core/directives/kip-resize-observer.directive';
import { AisProcessingService, AisTrack } from '../../core/services/ais-processing.service';
import { DialogService } from '../../core/services/dialog.service';
import { DialogAisTargetComponent } from '../../core/components/dialog-ais-target/dialog-ais-target.component';
import { UnitsService } from '../../core/services/units.service';

type ViewMode = 'north-up' | 'course-up';

interface AisShipTypeIconRange {
  min: number;
  max: number;
  icon: string;
}

interface AisBeaconIconPrefix {
  mmsiPrefix: string;
  icon: string;
}

const AIS_VESSEL_ICON_RANGES: AisShipTypeIconRange[] = [
  { min: 0, max: 9, icon: '' }, // Reserved for future use
  { min: 10, max: 19, icon: 'assets/svg/vessels/ais_active.svg' }, // Unspecified
  { min: 20, max: 29, icon: 'assets/svg/vessels/ais_active.svg' }, // Wing-in-ground aircraft
  { min: 30, max: 30, icon: 'assets/svg/vessels/ais_active.svg' }, // Fishing
  { min: 31, max: 31, icon: 'assets/svg/vessels/ais_active.svg' }, // Towing
  { min: 32, max: 32, icon: 'assets/svg/vessels/ais_active.svg' }, // Towing: length exceeds 200m or breadth exceeds 25m
  { min: 33, max: 33, icon: 'assets/svg/vessels/ais_active.svg' }, // Dredging or underwater ops
  { min: 34, max: 34, icon: 'assets/svg/vessels/ais_active.svg' }, // Diving ops
  { min: 35, max: 35, icon: 'assets/svg/vessels/ais_active.svg' }, // Military ops
  { min: 36, max: 36, icon: 'assets/svg/vessels/ais_active.svg' }, // Sailing
  { min: 37, max: 37, icon: 'assets/svg/vessels/ais_active.svg' }, // Pleasure Craft
  { min: 38, max: 39, icon: 'assets/svg/vessels/ais_active.svg' }, // Reserved for future use
  { min: 40, max: 49, icon: 'assets/svg/vessels/ais_highspeed.svg' }, // High Speed Vessel
  { min: 50, max: 50, icon: 'assets/svg/vessels/ais_special.svg' }, // Pilot Vessel
  { min: 51, max: 51, icon: 'assets/svg/vessels/ais_special.svg' }, // Search and Rescue vessel
  { min: 52, max: 52, icon: 'assets/svg/vessels/ais_special.svg' }, // Tug
  { min: 53, max: 53, icon: 'assets/svg/vessels/ais_special.svg' }, // Port Tender
  { min: 54, max: 54, icon: 'assets/svg/vessels/ais_special.svg' }, // Anti-pollution equipment
  { min: 55, max: 55, icon: 'assets/svg/vessels/ais_special.svg' }, // Law Enforcement
  { min: 56, max: 56, icon: 'assets/svg/vessels/ais_special.svg' }, // Spare - Local Vessel
  { min: 57, max: 57, icon: 'assets/svg/vessels/ais_special.svg' }, // Spare - Local Vessel
  { min: 58, max: 58, icon: 'assets/svg/vessels/ais_special.svg' }, // Medical Transport
  { min: 59, max: 59, icon: 'assets/svg/vessels/ais_special.svg' }, // Noncombatant ship according to RR Resolution No. 18
  { min: 60, max: 69, icon: 'assets/svg/vessels/ais_passenger.svg' }, // Passenger Vessel
  { min: 70, max: 79, icon: 'assets/svg/vessels/ais_cargo.svg' }, // Cargo Vessel
  { min: 80, max: 89, icon: 'assets/svg/vessels/ais_tanker.svg' }, // Tanker Vessel
  { min: 90, max: 99, icon: 'assets/svg/vessels/ais_other.svg' } // Other
];

const AIS_BEACON_ICON_PREFIXES: AisBeaconIconPrefix[] = [
  { mmsiPrefix: '970', icon: 'assets/svg/vessels/ais_special.svg' }, // SART
  { mmsiPrefix: '972', icon: 'assets/svg/vessels/ais_special.svg' }, // MOB
  { mmsiPrefix: '974', icon: 'assets/svg/vessels/ais_special.svg' }  // EPIRB
];

interface RadarSize {
  width: number;
  height: number;
}

interface RenderState {
  size: RadarSize;
  cfg: IWidgetSvcConfig;
  theme: ITheme;
  targets: AisTrack[];
  ownShip: {
    position?: { lat: number | null; lon: number | null } | null;
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
  iconHref: string | null;
  iconScale: number;
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
  private readonly units = inject(UnitsService);

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    filterSelfPaths: false,
    enableTimeout: false,
    dataTimeout: 5,
    ais: {
      viewMode: 'course-up',
      rangeRings: [3, 6, 12, 24, 48],
      rangeIndex: 3,
      showVesselsTrail: true,
      vesselsTrailMinutes: 120,
      showCogVectors: true,
      cogVectorsMinutes: 120,
      showHeadingLineClassB: true,
      showLostTargets: true,
      showUnconfirmedTargets: true,
      showSelf: true
    },
    color: 'grey'
  };

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
  private viewRotationSmoothed: number | null = null;
  private lastRotationAt: number | null = null;

  private renderFrame: number | null = null;
  private lastRenderAt: number | null = null;
  private readonly minRenderIntervalMs = 100;
  private readonly iconCache = new Map<string, { signature: string; icon: { href: string | null; scale: number } }>();

  constructor() {
    effect(() => {
      const size = this.hostSize();
      const cfg = this.runtime.options();
      const theme = this.theme();
      const targets = this.ais.targets();
      const ownShip = this.ais.ownShip();
      if (!size || !cfg || !theme || !cfg) return;
      untracked(() => {
        this.renderState = { size, cfg, theme, targets, ownShip };
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
        const now = performance.now();
        if (this.lastRenderAt === null || now - this.lastRenderAt >= this.minRenderIntervalMs) {
          this.lastRenderAt = now;
          this.render();
        }
        this.renderFrame = requestAnimationFrame(loop);
      };
      loop();
    });
  }

  private render(): void {
    if (!this.renderState || !this.svg || !this.root) return;

    const { size, cfg, theme, targets, ownShip } = this.renderState;
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);
    const radius = Math.min(width, height) / 2;
    const scale = (Math.min(width, height) - 35) / Math.min(width, height);

    const radarCfg = (cfg.ais ?? {}) as NonNullable<IWidgetSvcConfig['ais']>;
    const availableRanges = radarCfg.rangeRings?.length ? radarCfg.rangeRings : [3, 6, 12, 24, 48];
    const rangeIndex = Math.min(Math.max(radarCfg.rangeIndex ?? 0, 0), availableRanges.length - 1);
    const rangeNm = availableRanges[rangeIndex] ?? availableRanges[0];
    const ringCount = this.resolveRingCountForRange(rangeNm);
    const rangeRings = this.buildRangeRings(rangeNm, ringCount);
    const viewMode: ViewMode = radarCfg.viewMode ?? 'course-up';
    const ownCog = this.toDegreesIfRadians(ownShip.courseOverGroundTrue);
    const ownHeading = this.toDegreesIfRadians(ownShip.headingTrue);
    const targetRotation = viewMode === 'course-up'
      ? (ownCog ?? ownHeading ?? 0)
      : 0;
    const viewRotation = viewMode === 'course-up'
      ? this.smoothRotation(targetRotation)
      : 0;

    this.svg
      .attr('viewBox', `${-radius} ${-radius} ${radius * 2} ${radius * 2}`);

    this.root.attr('transform', `scale(${scale})`);

    const ownShipRotation = this.wrapDegrees((ownCog ?? ownHeading ?? 0) - viewRotation);
    const ringColor = getColors(cfg.color, theme).dim;
    this.renderRings(rangeRings, rangeNm, radius, viewRotation, radarCfg.showSelf ?? true, ownShipRotation, ringColor);

    if (!ownShip.position || !this.hasValidPosition(ownShip.position)) return;

    const renderTargets = this.buildTargets(targets, ownShip.position, rangeNm, radius, viewRotation, radarCfg);
    this.renderTrails(renderTargets, rangeNm, radius, viewRotation, radarCfg);
    this.renderVectors(renderTargets, rangeNm, radius, viewRotation, radarCfg);
    this.renderTargets(renderTargets, radius);
    this.renderSelected(renderTargets, radius);
  }

  private renderRings(
    rangeRings: number[],
    rangeNm: number,
    radius: number,
    viewRotation: number,
    showSelf: boolean,
    ownShipRotation: number,
    ringColor: string
  ): void {
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
      .attr('r', d => d.radius)
      .attr('stroke', ringColor);

    selection.exit().remove();

    const labelOffset = 20;
    const labelData = rings.flatMap(ring => ([
      { key: `${ring.value}-top`, value: ring.value, x: 0, y: -ring.radius + labelOffset },
      { key: `${ring.value}-bottom`, value: ring.value, x: 0, y: ring.radius - labelOffset }
    ]));

    const labelSelection = this.ringsLayer
      .selectAll<SVGTextElement, { key: string; value: number; x: number; y: number }>('text.ring-label')
      .data(labelData, d => d.key);

    labelSelection.enter()
      .append('text')
      .attr('class', 'ring-label')
      .merge(labelSelection as d3.Selection<SVGTextElement, { key: string; value: number; x: number; y: number }, SVGGElement, unknown>)
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text(d => `${d.value}`);

    labelSelection.exit().remove();

    const northInset = -12; // position on the ring
    const northAngle = this.wrapDegrees(-viewRotation);
    const theta = (northAngle * Math.PI) / 180;
    const northX = (radius - northInset) * Math.sin(theta);
    const northY = -(radius - northInset) * Math.cos(theta);

    const northSelection = this.ringsLayer
      .selectAll<SVGTextElement, { x: number; y: number }>('text.ring-north')
      .data([{ x: northX, y: northY }]);

    northSelection.enter()
      .append('text')
      .attr('class', 'ring-north')
      .merge(northSelection as d3.Selection<SVGTextElement, { x: number; y: number }, SVGGElement, unknown>)
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .text('N');

    northSelection.exit().remove();

    const centerSelection = this.ringsLayer
      .selectAll<SVGCircleElement, { r: number }>('circle.radar-center')
      .data(showSelf ? [] : [{ r: Math.max(3, radius * 0.01) }]);

    centerSelection.enter()
      .append('circle')
      .attr('class', 'radar-center')
      .merge(centerSelection as d3.Selection<SVGCircleElement, { r: number }, SVGGElement, unknown>)
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', d => d.r)
      .attr('fill', ringColor);

    centerSelection.exit().remove();

    const ownShipSelection = this.ringsLayer
      .selectAll<SVGGElement, { size: number }>('g.radar-ownship')
      .data(showSelf ? [{ size: Math.max(8, radius * 0.04) }] : []);

    const ownShipEnter = ownShipSelection.enter()
      .append('g')
      .attr('class', 'radar-ownship');

    ownShipEnter.append('path')
      .attr('class', 'ownship-shape');

    const ownShipMerged = ownShipEnter.merge(ownShipSelection as d3.Selection<SVGGElement, { size: number }, SVGGElement, unknown>);
    const shipSymbol = d3.symbol().type(d3.symbolTriangle);

    ownShipMerged.select<SVGPathElement>('path.ownship-shape')
      .attr('d', d => shipSymbol.size(d.size * d.size)() ?? '')
      .attr('transform', `rotate(${ownShipRotation}) scale(1, 1.5)`);

    ownShipSelection.exit().remove();
  }

  private resolveRingCountForRange(rangeNm: number): number {
    const candidates = [3];
    return candidates.find(count => this.isNiceStep(rangeNm / count)) ?? 4;
  }

  private isNiceStep(step: number): boolean {
    const niceSteps = [0.5, 1, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25];
    return niceSteps.some(value => Math.abs(step - value) < 1e-6);
  }

  private buildRangeRings(rangeNm: number, ringCount: number): number[] {
    const step = rangeNm / ringCount;
    return Array.from({ length: ringCount }, (_, index) => step * (index + 1));
  }

  private buildTargets(
    tracks: AisTrack[],
    origin: { lat: number; lon: number },
    rangeNm: number,
    radius: number,
    viewRotation: number,
    cfg: NonNullable<IWidgetSvcConfig['ais']>
  ): RenderTarget[] {
    const showLost = cfg.showLostTargets ?? true;
    const showUnconfirmed = cfg.showUnconfirmedTargets ?? true;

    return tracks
      .filter(track => Boolean(track.position) && this.hasValidPosition(track.position!))
      .filter(track => (track.status === 'lost' ? showLost : true))
      .filter(track => (track.status === 'unconfirmed' ? showUnconfirmed : true))
      .map(track => {
        const distance = this.distanceNm(origin, track.position!);
        if (distance > rangeNm) return null;

        const bearing = this.bearingDeg(origin, track.position!);
        const angle = this.wrapDegrees(bearing - viewRotation);
        const { x, y } = this.polarToCartesian(angle, distance, rangeNm, radius);

        const trackHeading = this.toDegreesIfRadians(track.headingTrue);
        const trackCog = this.toDegreesIfRadians(track.courseOverGroundTrue);
        const heading = track.type === 'aton' || track.type === 'basestation' ? 0 : this.wrapDegrees((trackHeading ?? trackCog ?? 0) - viewRotation);
        const { shape, label, scaleY } = this.resolveShape(track);
        const { href: iconHref, scale: iconScale } = this.resolveIconCached(track);
        const finalScaleY = iconHref ? 1 : scaleY;

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
          scaleY: finalScaleY,
          iconHref,
          iconScale,
          navState: track.navState ?? null,
          sog: track.speedOverGround ?? null,
          cog: trackCog ?? null
        } as RenderTarget;
      })
      .filter((target): target is RenderTarget => Boolean(target));
  }

  private renderTrails(
    targets: RenderTarget[],
    rangeNm: number,
    radius: number,
    viewRotation: number,
    cfg: NonNullable<IWidgetSvcConfig['ais']>
  ): void {
    if (!this.trailsLayer) return;
    if (!cfg.showVesselsTrail) {
      this.trailsLayer.selectAll('*').remove();
      return;
    }

    const origin = this.renderState?.ownShip.position;
    if (!origin || !this.hasValidPosition(origin)) return;

    const now = Date.now();
    const trailMinutes = Math.max(10, (cfg.vesselsTrailMinutes ?? 300) * 60);

    const trailData = targets.map(target => {
      const points = target.raw.trail
        .filter(point => now - point.ts <= trailMinutes * 1000)
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
    cfg: NonNullable<IWidgetSvcConfig['ais']>
  ): void {
    if (!this.vectorsLayer) return;

    const motionEnabled = cfg.showCogVectors ?? true;
    const headingEnabled = cfg.showHeadingLineClassB ?? true;
    const baseSize = Math.max(6, radius * 0.04);

    const motionData: VectorLine[] = [];
    const headingData: VectorLine[] = [];

    for (const target of targets) {
      if (target.raw.type !== 'vessel') continue;
      const trackHeading = this.toDegreesIfRadians(target.raw.headingTrue);
      const trackCog = this.toDegreesIfRadians(target.raw.courseOverGroundTrue);

      if (motionEnabled && target.sog !== null && trackCog !== null) {
        const motionAngle = this.wrapDegrees(trackCog - viewRotation);
        const tip = this.offsetPoint(target.x, target.y, motionAngle, baseSize * 0.8);
        const durationSeconds = (cfg.cogVectorsMinutes ?? 5) * 60;
        const distanceNm = (target.sog * durationSeconds) / 1852;
        const vectorLength = (distanceNm / rangeNm) * radius;
        const end = this.offsetPoint(tip.x, tip.y, motionAngle, vectorLength);
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
        const headingAngle = this.wrapDegrees((trackHeading ?? trackCog ?? 0) - viewRotation);
        const end = this.offsetPoint(target.x, target.y, headingAngle, baseSize * 1.6);
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

    enter.append('image')
      .attr('class', 'target-icon');

    enter.append('path')
      .attr('class', 'target-shape');

    enter.append('text')
      .attr('class', 'target-label');

    enter.append('title');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, RenderTarget, SVGGElement, unknown>);

    merged
      .attr('transform', d => `translate(${d.x}, ${d.y}) rotate(${d.heading}) scale(1, ${d.scaleY})`)
      .attr('class', d => `target ${this.buildClassName(d)}`);

    merged.select<SVGImageElement>('image.target-icon')
      .attr('href', d => d.iconHref ?? null)
      .attr('xlink:href', d => d.iconHref ?? null)
      .attr('display', d => (d.iconHref ? null : 'none'))
      .attr('width', d => baseSize * d.iconScale)
      .attr('height', d => baseSize * d.iconScale)
      .attr('x', d => -(baseSize * d.iconScale) / 2)
      .attr('y', d => -(baseSize * d.iconScale) / 2);

    merged.select<SVGPathElement>('path.target-shape')
      .attr('display', d => (d.iconHref ? 'none' : null))
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
    const typeName = String(track.aisShipTypeName ?? track.aisType ?? '').toLowerCase();

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
      return { shape: 'triangle', label: 'T', scaleY: 1.3 };
    }

    if (typeName.includes('fishing')) {
      return { shape: 'triangle', label: 'F', scaleY: 1.3 };
    }

    if (typeName.includes('passenger')) {
      return { shape: 'triangle', label: null, scaleY: 1.6 };
    }

    return { shape: 'triangle', label: null, scaleY: 1.3 };
  }

  private resolveIcon(track: AisTrack): { href: string | null; scale: number } {
    const beaconIcon = this.resolveBeaconIcon(track);
    if (beaconIcon) return { href: beaconIcon, scale: 2.4 };

    if (track.type === 'aton') {
      return { href: this.resolveAtonIcon(track), scale: 2 };
    }

    if (track.type === 'basestation') {
      return { href: 'assets/svg/atons/basestation.svg', scale: 3 };
    }

    if (track.type === 'sar') {
      return { href: 'assets/svg/vessels/ais_special.svg', scale: 2.4 };
    }

    if (track.type === 'vessel') {
      return { href: this.resolveVesselIcon(track), scale: 3 };
    }

    return { href: null, scale: 2.4 };
  }

  private resolveBeaconIcon(track: AisTrack): string | null {
    const mmsi = track.mmsi ?? '';
    for (const entry of AIS_BEACON_ICON_PREFIXES) {
      if (mmsi.startsWith(entry.mmsiPrefix)) return entry.icon;
    }
    return null;
  }

  private resolveIconCached(track: AisTrack): { href: string | null; scale: number } {
    const signature = track.mmsi;
    const cached = this.iconCache.get(track.id);
    if (cached && cached.signature === signature) return cached.icon;

    const resolved = this.resolveIcon(track);
    this.iconCache.set(track.id, { signature, icon: resolved });
    return resolved;
  }

  private resolveVesselIcon(track: AisTrack): string | null {
    const navState = (track.navState ?? '').toLowerCase();
    if (navState.includes('moored') || navState.includes('anchored')) {
      return 'assets/svg/vessels/ais_inactive.svg';
    }

    const shipTypeId = track.aisShipTypeId ?? null;
    const iconFromRange = shipTypeId !== null ? this.resolveIconFromShipTypeId(shipTypeId) : null;
    if (iconFromRange) return iconFromRange;

    return 'assets/svg/vessels/ais_active.svg';
  }

  private resolveIconFromShipTypeId(shipTypeId: number): string | null {
    for (const entry of AIS_VESSEL_ICON_RANGES) {
      if (shipTypeId >= entry.min && shipTypeId <= entry.max) return entry.icon;
    }
    return null;
  }

  private resolveAtonIcon(track: AisTrack): string | null {
    const isVirtual = track.atonVirtual ?? false;
    const prefix = isVirtual ? 'virtual' : 'real';
    const name = (track.atonType?.name ?? '').toLowerCase();

    if (name.includes('north')) return `assets/svg/atons/${prefix}-north.svg`;
    if (name.includes('south')) return `assets/svg/atons/${prefix}-south.svg`;
    if (name.includes('east')) return `assets/svg/atons/${prefix}-east.svg`;
    if (name.includes('west')) return `assets/svg/atons/${prefix}-west.svg`;
    if (name.includes('port')) return `assets/svg/atons/${prefix}-port.svg`;
    if (name.includes('starboard')) return `assets/svg/atons/${prefix}-starboard.svg`;
    if (name.includes('safe')) return `assets/svg/atons/${prefix}-safe.svg`;
    if (name.includes('special')) return `assets/svg/atons/${prefix}-special.svg`;
    if (name.includes('danger')) return `assets/svg/atons/${prefix}-danger.svg`;

    return `assets/svg/atons/${prefix}-aton.svg`;
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

  private hasValidPosition(position: { lat: number | null; lon: number | null }): position is { lat: number; lon: number } {
    return typeof position.lat === 'number'
      && Number.isFinite(position.lat)
      && typeof position.lon === 'number'
      && Number.isFinite(position.lon);
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

  private shortestAngleDelta(from: number, to: number): number {
    return ((to - from + 540) % 360) - 180;
  }

  private smoothRotation(targetRotation: number): number {
    const now = performance.now();
    if (this.viewRotationSmoothed === null || this.lastRotationAt === null) {
      this.viewRotationSmoothed = this.wrapDegrees(targetRotation);
      this.lastRotationAt = now;
      return this.viewRotationSmoothed;
    }

    const dt = Math.min(250, Math.max(0, now - this.lastRotationAt));
    const alpha = Math.min(1, dt / 200);
    const delta = this.shortestAngleDelta(this.viewRotationSmoothed, targetRotation);
    this.viewRotationSmoothed = this.wrapDegrees(this.viewRotationSmoothed + delta * alpha);
    this.lastRotationAt = now;
    return this.viewRotationSmoothed;
  }

  private toDegreesIfRadians(value: number | null | undefined): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return this.units.convertToUnit('deg', value);
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
