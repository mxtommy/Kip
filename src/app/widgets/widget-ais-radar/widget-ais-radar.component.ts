import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewEncapsulation, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { IKipResizeEvent, KipResizeObserverDirective } from '../../core/directives/kip-resize-observer.directive';
import { MatButtonModule } from '@angular/material/button';
import { AisProcessingService, AisTrack, AisTrackPosition } from '../../core/services/ais-processing.service';
import { DialogService } from '../../core/services/dialog.service';
import { DialogAisTargetComponent } from '../../core/components/dialog-ais-target/dialog-ais-target.component';
import { UnitsService } from '../../core/services/units.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { MatIconModule } from "@angular/material/icon";

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
    position?: AisTrackPosition;
    headingTrue?: number;
    courseOverGroundTrue?: number;
    speedOverGround?: number;
  };
}

interface RenderTarget {
  id: string;
  raw: AisTrack;
  x: number;
  y: number;
  heading: number;
  status: string;
  aisClass: string | undefined;
  type: string;
  iconHref: string | null;
  iconScale: number;
  navState: string | undefined;
  sog: number | undefined;
  cog: number | null;
  className: string;
}

interface VectorLine {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  className: string;
}

interface CachedTargetSeed {
  signature: string;
  distanceNm: number;
  bearing: number;
  trackHeading: number | null;
  trackCog: number | null;
  iconHref: string | null;
  iconScale: number;
  navState: string | undefined;
  status: string;
  aisClass: string | undefined;
  type: string;
  sog: number | undefined;
 }

interface RingCache {
  key: string;
  rings: { value: number; radius: number }[];
  labels: { key: string; value: number; x: number; y: number }[];
}

@Component({
  selector: 'widget-ais-radar',
  imports: [KipResizeObserverDirective, MatButtonModule, MatIconModule],
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
  protected readonly dashboard = inject(DashboardService);

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    filterSelfPaths: false,
    enableTimeout: false,
    dataTimeout: 5,
    ais: {
      viewMode: 'course-up',
      rangeRings: [3, 6, 12, 24, 48],
      rangeIndex: 3,
      showCogVectors: true,
      cogVectorsMinutes: 120,
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
  private readonly localViewMode = signal<ViewMode | null>(null);
  private readonly localRangeIndex = signal<number | null>(null);
  protected readonly effectiveViewMode = computed<ViewMode>(() => {
    return this.localViewMode() ?? (this.runtime.options()?.ais?.viewMode ?? 'course-up');
  });
  protected readonly effectiveRangeIndex = computed<number>(() => {
    const cfgIndex = this.runtime.options()?.ais?.rangeIndex ?? 0;
    const ranges = this.runtime.options()?.ais?.rangeRings ?? [3, 6, 12, 24, 48];
    const maxIndex = Math.max(0, ranges.length - 1);
    const index = this.localRangeIndex() ?? cfgIndex;
    return Math.min(Math.max(index, 0), maxIndex);
  });

  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private root?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private ringsLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private vectorsLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private targetsLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private selectedLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private viewRotationSmoothed: number | null = null;
  private lastRotationAt: number | null = null;

  private renderFrame: number | null = null;
  private readonly iconCache = new Map<string, { signature: string; icon: { href: string | null; scale: number } }>();
  private readonly targetCache = new Map<string, CachedTargetSeed>();
  private readonly missingIconLogged = new Set<string>();
  private lastOriginKey: string | null = null;
  private ringCache: RingCache | null = null;

  constructor() {
    effect(() => {
      const size = this.hostSize();
      const cfg = this.runtime.options();
      const theme = this.theme();
      const targets = this.ais.targets();
      const ownShip = this.ais.ownShip();
      if (!size || !cfg || !theme) return;
      untracked(() => {
        this.renderState = { size, cfg, theme, targets, ownShip };
      });
      this.scheduleRender();
    });

    effect(() => {
      this.localViewMode();
      this.localRangeIndex();
      this.selectedId();
      untracked(() => {
        this.scheduleRender();
      });
    });
  }

  ngAfterViewInit(): void {
    this.initSvg();
    this.scheduleRender();
  }

  protected onResized(event: IKipResizeEvent): void {
    this.hostSize.set({ width: event.width, height: event.height });
  }

  private initSvg(): void {
    this.svg = d3.select(this.svgRef().nativeElement);
    this.svg.attr('class', 'ais-radar');

    this.root = this.svg.append('g').attr('class', 'radar-root');
    this.ringsLayer = this.root.append('g').attr('class', 'radar-rings');
    this.vectorsLayer = this.root.append('g').attr('class', 'radar-vectors');
    this.targetsLayer = this.root.append('g').attr('class', 'radar-targets');
    this.selectedLayer = this.root.append('g').attr('class', 'radar-selected');

    this.svg.on('click', () => this.selectedId.set(null));
  }

  private scheduleRender(): void {
    if (this.renderFrame !== null) return;
    this.ngZone.runOutsideAngular(() => {
      this.renderFrame = requestAnimationFrame(() => {
        this.renderFrame = null;
        this.render();
      });
    });
  }

  private render(): void {
    if (!this.renderState || !this.svg || !this.root) return;
    const { size, cfg, theme, targets, ownShip } = this.renderState;
    const width = Math.max(1, size.width);
    const height = Math.max(1, size.height);
    const radius = Math.min(width, height) / 2;
    const scale = (Math.min(width, height) - 35) / Math.min(width, height);
    const maxRingRadius = Math.hypot(width, height) / 2 / scale;

    const radarCfg = (cfg.ais ?? {}) as NonNullable<IWidgetSvcConfig['ais']>;
    const availableRanges = radarCfg.rangeRings?.length ? radarCfg.rangeRings : [3, 6, 12, 24, 48];
    const rangeIndex = this.effectiveRangeIndex();
    const rangeNm = availableRanges[rangeIndex] ?? availableRanges[0];
    const ringCount = this.resolveRingCountForRange(rangeNm);
    const viewMode: ViewMode = this.localViewMode() ?? radarCfg.viewMode ?? 'course-up';
    const ownCog = this.toDegreesIfRadians(ownShip.courseOverGroundTrue);
    const ownHeading = this.toDegreesIfRadians(ownShip.headingTrue);
    const targetRotation = viewMode === 'course-up'
      ? (ownCog ?? ownHeading ?? 0)
      : 0;
    const viewRotation = viewMode === 'course-up'
      ? this.smoothRotation(targetRotation)
      : 0;
    const remainingRotation = viewMode === 'course-up'
      ? Math.abs(this.shortestAngleDelta(viewRotation, targetRotation))
      : 0;

    this.svg
      .attr('viewBox', `${-width / 2} ${-height / 2} ${width} ${height}`);

    this.root.attr('transform', `scale(${scale})`);

    const ownShipRotation = this.wrapDegrees((ownCog ?? ownHeading ?? 0) - viewRotation);
    const ringColor = getColors(cfg.color, theme).dim;
    this.renderRings(ringCount, rangeNm, radius, maxRingRadius, viewRotation, radarCfg.showSelf ?? true, ownShipRotation, ringColor);

    if (!ownShip.position || !this.hasValidPosition(ownShip.position)) return;

    const maxRangeNm = (maxRingRadius / radius) * rangeNm;
    const renderTargets = this.buildTargets(targets, ownShip.position, rangeNm, maxRangeNm, radius, viewRotation, radarCfg);
    this.renderVectors(renderTargets, rangeNm, maxRangeNm, radius, viewRotation, radarCfg, ownShip);
    this.renderTargets(renderTargets, radius);
    this.renderSelected(renderTargets, radius);

    if (remainingRotation > 0.5) {
      this.scheduleRender();
    }
  }

  private renderRings(
    ringCount: number,
    rangeNm: number,
    radius: number,
    maxRadius: number,
    viewRotation: number,
    showSelf: boolean,
    ownShipRotation: number,
    ringColor: string
  ): void {
    if (!this.ringsLayer) return;

    const ringKey = `${rangeNm.toFixed(3)}|${radius.toFixed(3)}|${maxRadius.toFixed(3)}|${ringCount}`;
    if (!this.ringCache || this.ringCache.key !== ringKey) {
      const ringStep = rangeNm / Math.max(1, ringCount);
      const maxRingValue = (maxRadius / radius) * rangeNm;
      const ringValues: number[] = [];
      for (let value = ringStep; value <= maxRingValue + 1e-6; value += ringStep) {
        ringValues.push(value);
      }

      const rings = ringValues
        .map(value => ({ value, radius: (value / rangeNm) * radius }))
        .filter(ring => ring.radius <= maxRadius + 1e-6);

      const labelOffset = 20;
      const labels = rings.flatMap(ring => ([
        { key: `${ring.value}-top`, value: ring.value, x: 0, y: -ring.radius + labelOffset },
        { key: `${ring.value}-bottom`, value: ring.value, x: 0, y: ring.radius - labelOffset }
      ]));

      this.ringCache = { key: ringKey, rings, labels };
    }

    const ringCache = this.ringCache;
    if (!ringCache) return;
    const rings = ringCache.rings;

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

    const labelData = ringCache.labels;

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

  protected toggleViewMode(): void {
    const current = this.localViewMode() ?? (this.runtime.options()?.ais?.viewMode ?? 'course-up');
    this.localViewMode.set(current === 'course-up' ? 'north-up' : 'course-up');
  }

  protected incrementRange(): void {
    this.localRangeIndex.set(Math.max(this.effectiveRangeIndex() - 1, 0));
  }

  protected decrementRange(): void {
    const ranges = this.runtime.options()?.ais?.rangeRings ?? [3, 6, 12, 24, 48];
    const maxIndex = Math.max(0, ranges.length - 1);
    this.localRangeIndex.set(Math.min(this.effectiveRangeIndex() + 1, maxIndex));
  }

  private resolveRingCountForRange(rangeNm: number): number {
    const candidates = [3];
    return candidates.find(count => this.isNiceStep(rangeNm / count)) ?? 4;
  }

  private isNiceStep(step: number): boolean {
    const niceSteps = [0.5, 1, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25];
    return niceSteps.some(value => Math.abs(step - value) < 1e-6);
  }

  private buildTargets(
    tracks: AisTrack[],
    origin: AisTrackPosition,
    rangeNm: number,
    maxRangeNm: number,
    radius: number,
    viewRotation: number,
    cfg: NonNullable<IWidgetSvcConfig['ais']>
  ): RenderTarget[] {
    const showLost = cfg.showLostTargets ?? true;
    const showUnconfirmed = cfg.showUnconfirmedTargets ?? true;

    const originKey = `${origin.latitude?.toFixed(6)}|${origin.longitude?.toFixed(6)}`;
    if (this.lastOriginKey !== originKey) {
      this.targetCache.clear();
      this.lastOriginKey = originKey;
    }

    const trackIds = new Set<string>();
    const activeMmsi = new Set<string>();
    for (const track of tracks) {
      trackIds.add(track.id);
      if (track.mmsi !== undefined) {
        activeMmsi.add(String(track.mmsi));
      }
    }

    for (const cachedId of this.targetCache.keys()) {
      if (!trackIds.has(cachedId)) this.targetCache.delete(cachedId);
    }
    for (const cachedId of this.iconCache.keys()) {
      if (!trackIds.has(cachedId)) this.iconCache.delete(cachedId);
    }
    if (this.missingIconLogged.size) {
      for (const key of this.missingIconLogged) {
        const parts = key.split('|');
        const mmsi = parts[parts.length - 1] ?? '';
        if (mmsi && !activeMmsi.has(mmsi)) {
          this.missingIconLogged.delete(key);
        } else if (!mmsi && trackIds.size === 0) {
          this.missingIconLogged.delete(key);
        }
      }
    }

    const results: RenderTarget[] = [];
    for (const track of tracks) {
      if (!track.position || !this.hasValidPosition(track.position)) continue;
      if (track.status === 'lost' && !showLost) continue;
      if (track.status === 'unconfirmed' && !showUnconfirmed) continue;

      const signature = this.buildTrackSignature(track);
      let cached = this.targetCache.get(track.id);
      if (!cached || cached.signature !== signature) {
        const distance = this.distanceNm(origin, track.position);
        const bearing = this.ais.getBearingTrue(origin, track.position) ?? 0;
        const trackHeading = this.toDegreesIfRadians(track.headingTrue);
        const trackCog = this.toDegreesIfRadians(track.courseOverGroundTrue);
        const { href: iconHref, scale: iconScale } = this.resolveIconCached(track);
        cached = {
          signature,
          distanceNm: distance,
          bearing,
          trackHeading,
          trackCog,
          iconHref,
          iconScale,
          navState: track.navState,
          status: track.status,
          aisClass: track.aisClass,
          type: track.type,
          sog: track.speedOverGround
        };
        this.targetCache.set(track.id, cached);
      }

      if (cached.distanceNm > maxRangeNm) continue;

      const angle = this.wrapDegrees(cached.bearing - viewRotation);
      const { x, y } = this.polarToCartesian(angle, cached.distanceNm, rangeNm, radius);
      const heading = track.type === 'aton' || track.type === 'basestation'
        ? 0
        : this.wrapDegrees((cached.trackHeading ?? cached.trackCog ?? 0) - viewRotation);
      const className = this.buildClassName({
        id: track.id,
        status: cached.status,
        aisClass: cached.aisClass,
        type: cached.type,
        navState: cached.navState
      });

      results.push({
        id: track.id,
        raw: track,
        x,
        y,
        heading,
        status: cached.status,
        aisClass: cached.aisClass,
        type: cached.type,
        iconHref: cached.iconHref,
        iconScale: cached.iconScale,
        navState: cached.navState,
        sog: cached.sog,
        cog: cached.trackCog ?? null,
        className
      });
    }

    return results;
  }

  private renderVectors(
    targets: RenderTarget[],
    rangeNm: number,
    maxRangeNm: number,
    radius: number,
    viewRotation: number,
    cfg: NonNullable<IWidgetSvcConfig['ais']>,
    ownShip: RenderState['ownShip']
  ): void {
    if (!this.vectorsLayer) return;

    const motionEnabled = cfg.showCogVectors ?? true;
    const baseSize = Math.max(6, radius * 0.04);
    const durationSeconds = (cfg.cogVectorsMinutes ?? 5) * 60;
    const tipOffset = baseSize * 0.8;

    const motionData: VectorLine[] = [];

    for (const target of targets) {
      if (target.raw.type !== 'vessel') continue;
      if (motionEnabled && typeof target.sog === 'number' && typeof target.cog === 'number') {
        const motionAngle = this.wrapDegrees(target.cog - viewRotation);
        const tip = this.offsetPoint(target.x, target.y, motionAngle, tipOffset);
        const distanceNm = (target.sog * durationSeconds) / 1852;
        const vectorLength = Math.max(0, (distanceNm / rangeNm) * radius - tipOffset);
        const end = this.offsetPoint(tip.x, tip.y, motionAngle, vectorLength);
        motionData.push({
          id: target.id,
          x1: tip.x,
          y1: tip.y,
          x2: end.x,
          y2: end.y,
          className: target.className
        });
      }

    }

    if (cfg.showSelf ?? true) {
      const ownCog = this.toDegreesIfRadians(ownShip.courseOverGroundTrue);
      const ownSog = ownShip.speedOverGround;
      if (ownCog !== null && typeof ownSog === 'number') {
        const motionAngle = this.wrapDegrees(ownCog - viewRotation);
        const tip = this.offsetPoint(0, 0, motionAngle, tipOffset);
        const distanceNm = (ownSog * durationSeconds) / 1852;
        const vectorLength = Math.max(0, (distanceNm / rangeNm) * radius - tipOffset);
        const end = this.offsetPoint(tip.x, tip.y, motionAngle, vectorLength);
        motionData.push({
          id: 'ownship',
          x1: tip.x,
          y1: tip.y,
          x2: end.x,
          y2: end.y,
          className: 'ownship-vector'
        });
      }
    }

    this.renderVectorLines('motion-vector', motionData);
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
    const selection = this.targetsLayer
      .selectAll<SVGGElement, RenderTarget>('g.target')
      .data(targets, d => d.id);

    const enter = selection.enter()
      .append('g')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.clickTarget(d);
      });

    enter.append('image')
      .attr('class', 'target-icon');

    enter.append('title');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, RenderTarget, SVGGElement, unknown>);

    merged
      .attr('transform', d => `translate(${d.x}, ${d.y}) rotate(${d.heading})`)
      .attr('class', d => `target ${d.className}`);

    merged.select<SVGImageElement>('image.target-icon')
      .attr('href', d => d.iconHref ?? null)
      .attr('xlink:href', d => d.iconHref ?? null)
      .attr('display', d => (d.iconHref ? null : 'none'))
      .attr('width', d => baseSize * d.iconScale)
      .attr('height', d => baseSize * d.iconScale)
      .attr('x', d => -(baseSize * d.iconScale) / 2)
      .attr('y', d => -(baseSize * d.iconScale) / 2);

    merged.select('title')
      .text(d => `${d.raw.name ?? d.raw.mmsi ?? 'AIS Target'}`);

    selection.exit().remove();
  }

  private renderSelected(targets: RenderTarget[], radius: number): void {
    if (!this.selectedLayer) return;
    const selected = targets.filter(t => t.id === this.selectedId());
    const baseSize = Math.max(6, radius * 0.04);
    const halfSize = baseSize * 1.4;
    const cornerSize = Math.min(halfSize, Math.max(4, baseSize * 0.6));
    const cornerPath = this.buildCornerBoxPath(halfSize, cornerSize);

    const selection = this.selectedLayer
      .selectAll<SVGPathElement, RenderTarget>('path.selected-ring')
      .data(selected, d => d.id);

    selection.enter()
      .append('path')
      .attr('class', 'selected-ring')
      .merge(selection as d3.Selection<SVGPathElement, RenderTarget, SVGGElement, unknown>)
      .attr('transform', d => `translate(${d.x}, ${d.y})`)
      .attr('d', cornerPath);

    selection.exit().remove();
  }

  private clickTarget(target: RenderTarget): void {
    this.selectedId.set(target.id);
    this.dialog.openAisDetailDialog({
      title: this.buildTargetTitle(target.raw),
      component: 'ais-target',
      componentType: DialogAisTargetComponent,
      payload: { target: target.raw }
    }).subscribe();
  }

  private buildTargetTitle(target: AisTrack): string {
    const base = target.name ?? target.type ?? 'AIS Target';
    const status = target.status;
    return status === 'unconfirmed' || status === 'lost'
      ? `${base} - ${status}`
      : base;
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

    const missingKey = this.buildMissingIconKey(track);
    if (!this.missingIconLogged.has(missingKey)) {
      this.missingIconLogged.add(missingKey);
      console.warn('[AIS Radar Widget] Missing icon mapping', {
        id: track.id,
        type: track.type,
        aisShipTypeId: track.design?.aisShipType?.id,
        aisShipTypeName: track.design?.aisShipType?.name,
        mmsi: track.mmsi
      });
    }
    return { href: 'assets/svg/vessels/ais_unknown.svg', scale: 2.4 };
  }

  private resolveBeaconIcon(track: AisTrack): string | null {
    const mmsi = track.mmsi ?? '';
    for (const entry of AIS_BEACON_ICON_PREFIXES) {
      if (mmsi.startsWith(entry.mmsiPrefix)) return entry.icon;
    }
    return null;
  }

  private resolveIconCached(track: AisTrack): { href: string | null; scale: number } {
    const signature = this.buildIconSignature(track);
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

    const shipTypeId = track.design?.aisShipType?.id;
    const iconFromRange = typeof shipTypeId === 'number' ? this.resolveIconFromShipTypeId(shipTypeId) : null;
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

  private buildIconSignature(track: AisTrack): string {
    return [
      track.mmsi,
      track.type,
      track.navState,
      track.design?.aisShipType?.id,
      track.design?.aisShipType?.name,
      track.atonVirtual,
      track.atonType?.name
    ].join('|');
  }

  private buildMissingIconKey(track: AisTrack): string {
    return [
      track.type,
      track.design?.aisShipType?.id,
      track.design?.aisShipType?.name,
      track.mmsi
    ].join('|');
  }

  private buildClassName(target: { status: string; type: string; aisClass: string | undefined; navState: string | undefined; id: string }): string {
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

  private hasValidPosition(position: AisTrackPosition | null | undefined): position is AisTrackPosition {
    return typeof position?.latitude === 'number'
      && Number.isFinite(position.latitude)
      && typeof position?.longitude === 'number'
      && Number.isFinite(position.longitude);
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

  private buildTrackSignature(track: AisTrack): string {
    const position = track.position ?? {};
    const atonName = track.atonType?.name ?? '';
    return [
      track.id,
      position.latitude,
      position.longitude,
      track.headingTrue,
      track.courseOverGroundTrue,
      track.status,
      track.aisClass,
      track.type,
      track.navState,
      track.design?.aisShipType?.name,
      track.aisType,
      track.design?.aisShipType?.id,
      track.atonVirtual,
      atonName,
      track.mmsi,
      track.speedOverGround
    ].join('|');
  }

  private buildCornerBoxPath(halfSize: number, cornerSize: number): string {
    const h = halfSize;
    const c = Math.min(Math.max(cornerSize, 0), h);
    return [
      `M ${-h} ${-h} h ${c}`,
      `M ${-h} ${-h} v ${c}`,
      `M ${h} ${-h} h ${-c}`,
      `M ${h} ${-h} v ${c}`,
      `M ${-h} ${h} h ${c}`,
      `M ${-h} ${h} v ${-c}`,
      `M ${h} ${h} h ${-c}`,
      `M ${h} ${h} v ${-c}`
    ].join(' ');
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

  private distanceNm(a: AisTrackPosition, b: AisTrackPosition): number {
    const R = 6371e3; // meters
    const phi1 = a.latitude * Math.PI / 180;
    const phi2 = b.latitude * Math.PI / 180;
    const dPhi = (b.latitude - a.latitude) * Math.PI / 180;
    const dLambda = (b.longitude - a.longitude) * Math.PI / 180;

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
