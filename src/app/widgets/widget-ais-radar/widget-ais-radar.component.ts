import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, NgZone, OnDestroy, ViewEncapsulation, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { IKipResizeEvent, KipResizeObserverDirective } from '../../core/directives/kip-resize-observer.directive';
import { MatButtonModule } from '@angular/material/button';
import { AisAton, AisProcessingService, AisSar, AisTrack, AisVessel, Position } from '../../core/services/ais-processing.service';
import { DialogService } from '../../core/services/dialog.service';
import { DialogAisTargetComponent } from './dialog-ais-target/dialog-ais-target.component';
import { UnitsService } from '../../core/services/units.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { resolveIconKey, resolveOwnShipIconDataUrl, resolveThemedIconDataUrl, VESSEL_ICON_KEYS, VesselIconKey } from '../../core/utils/ais-icon-registry';
import { COLLISION_RISK_HIGH_THRESHOLD, COLLISION_RISK_LOW_THRESHOLD } from '../../core/utils/ais-svg-icon.util';

type ViewMode = 'north-up' | 'course-up';
type RadarFilterKey = 'anchoredMoored' | 'noCollisionRisk' | 'allAton' | 'allButSar' | 'allVessels';

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
    position?: Position;
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
  stroke?: string;
}

interface CachedTargetSeed {
  signature: string;
  distanceNm: number;
  bearing: number;
  trackHeading: number | null;
  trackCog: number | null;
}

interface RingCache {
  key: string;
  rings: { value: number; radius: number }[];
  labels: { key: string; value: number; x: number; y: number }[];
}

interface RenderSignature {
  sizeKey: string;
  viewMode: ViewMode;
  rangeIndex: number;
  rangesKey: string;
  showSelf: boolean;
  showCogVectors: boolean;
  showLostTargets: boolean;
  showUnconfirmedTargets: boolean;
  filtersKey: string;
  selectedId: string | null;
  targetsRef: AisTrack[];
  ownShipRef: RenderState['ownShip'];
  themeRef: ITheme;
  color: string | undefined;
}

interface TargetMenuItem {
  id: string;
  label: string;
  iconHref: string | null;
  target: AisTrack;
}

interface RadarFilterState {
  anchoredMoored: boolean;
  noCollisionRisk: boolean;
  allAton: boolean;
  allButSar: boolean;
  allVessels: boolean;
  vesselTypes: Set<VesselIconKey>;
}

@Component({
  selector: 'widget-ais-radar',
  imports: [KipResizeObserverDirective, MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './widget-ais-radar.component.html',
  styleUrls: ['./widget-ais-radar.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetAisRadarComponent implements AfterViewInit, OnDestroy {
  private static readonly TARGET_ICON_SIZE_PX = 16;
  private static readonly OWN_SHIP_ICON_SIZE_PX = 84;
  private static readonly HIT_RADIUS_PX = 28;

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
      filters: {
        anchoredMoored: false,
        noCollisionRisk: false,
        allAton: false,
        allButSar: false,
        allVessels: false,
        vesselTypes: []
      },
      viewMode: 'course-up',
      rangeRings: [1, 3, 6, 12, 24, 48],
      rangeIndex: '3',
      showCogVectors: true,
      cogVectorsMinutes: 10,
      showLostTargets: true,
      showUnconfirmedTargets: true,
      showSelf: true
    },
    color: 'grey'
  };

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('radarSvg');
  private readonly menuAnchorRef = viewChild.required<ElementRef<HTMLButtonElement>>('menuAnchor');
  private readonly menuTrigger = viewChild.required<MatMenuTrigger>('menuTrigger');
  private readonly hostSize = signal<RadarSize | null>(null);
  private renderState: RenderState | null = null;
  private selectedId = signal<string | null>(null);
  private readonly localViewMode = signal<ViewMode | null>(null);
  private readonly localRangeIndex = signal<number | null>(null);
  protected readonly effectiveViewMode = computed<ViewMode>(() => {
    return this.localViewMode() ?? (this.runtime.options()?.ais?.viewMode ?? 'course-up');
  });
  protected readonly effectiveRangeIndex = computed<number>(() => {
    const cfgIndex = this.resolveRangeIndex(this.runtime.options()?.ais);
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
  private ownShipLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private viewRotationSmoothed: number | null = null;
  private lastRotationAt: number | null = null;

  private renderFrame: number | null = null;
  private readonly iconCache = new Map<string, { signature: string; icon: { href: string | null; scale: number } }>();
  private readonly targetCache = new Map<string, CachedTargetSeed>();
  private lastOriginKey: string | null = null;
  private ringCache: RingCache | null = null;
  private ownShipIconHref: string | null = null;
  protected readonly menuItems = signal<TargetMenuItem[]>([]);
  private menuPoint: { x: number; y: number } | null = null;
  private lastRenderTargets: RenderTarget[] = [];
  private lastRenderScale = 1;
  private lastRenderSize: RadarSize | null = null;
  private readonly hitRadiusPx = WidgetAisRadarComponent.HIT_RADIUS_PX;
  private lastFiltersSignature: string | null = null;
  private lastRenderSignature: RenderSignature | null = null;
  private readonly filterState = signal<RadarFilterState>({
    anchoredMoored: false,
    noCollisionRisk: false,
    allAton: false,
    allButSar: false,
    allVessels: false,
    vesselTypes: new Set<VesselIconKey>()
  });
  protected readonly vesselTypeFilters = VESSEL_ICON_KEYS
    .filter(key => key !== 'vessel/self' && key !== 'vessel/unknown' && key !== 'vessel/spare');
  protected readonly hasActiveFilters = computed(() => {
    const filters = this.filterState();
    return filters.anchoredMoored
      || filters.allAton
      || filters.allButSar
      || filters.allVessels
      || filters.vesselTypes.size > 0;
  });

  protected readonly hasCollisionRiskData = this.ais.hasCollisionRiskData;

  constructor() {
    this.loadOwnShipIcon();
    effect(() => {
      const size = this.hostSize();
      const cfg = this.runtime.options();
      const theme = this.theme();
      const targets = this.ais.targets();
      const ownShip = this.ais.ownShip();
      if (!size || !cfg || !theme) return;
      untracked(() => {
        this.renderState = { size, cfg, theme, targets, ownShip };
        this.syncFiltersFromConfig(cfg);
      });
      this.scheduleRender();
    });

    effect(() => {
      this.localViewMode();
      this.localRangeIndex();
      this.selectedId();
      this.filterState();
      untracked(() => {
        this.scheduleRender();
      });
    });
  }

  private loadOwnShipIcon(): void {
    void resolveOwnShipIconDataUrl().then(href => {
      this.ownShipIconHref = href;
      this.scheduleRender();
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
    this.ownShipLayer = this.root.append('g').attr('class', 'radar-ownship-layer');

    this.svg.on('click', () => {
      this.selectedId.set(null);
      this.closeTargetMenu();
    });
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
    const rotationPending = this.viewRotationSmoothed !== null
      && Math.abs(this.shortestAngleDelta(this.viewRotationSmoothed, targetRotation)) > 0.5;
    const filtersKey = this.buildFilterStateSignature(this.filterState());
    const signature: RenderSignature = {
      sizeKey: `${width}x${height}`,
      viewMode,
      rangeIndex,
      rangesKey: availableRanges.join(','),
      showSelf: radarCfg.showSelf ?? true,
      showCogVectors: radarCfg.showCogVectors ?? true,
      showLostTargets: radarCfg.showLostTargets ?? true,
      showUnconfirmedTargets: radarCfg.showUnconfirmedTargets ?? true,
      filtersKey,
      selectedId: this.selectedId(),
      targetsRef: targets,
      ownShipRef: ownShip,
      themeRef: theme,
      color: cfg.color
    };
    const last = this.lastRenderSignature;
    if (!rotationPending && last
      && last.sizeKey === signature.sizeKey
      && last.viewMode === signature.viewMode
      && last.rangeIndex === signature.rangeIndex
      && last.rangesKey === signature.rangesKey
      && last.showSelf === signature.showSelf
      && last.showCogVectors === signature.showCogVectors
      && last.showLostTargets === signature.showLostTargets
      && last.showUnconfirmedTargets === signature.showUnconfirmedTargets
      && last.filtersKey === signature.filtersKey
      && last.selectedId === signature.selectedId
      && last.targetsRef === signature.targetsRef
      && last.ownShipRef === signature.ownShipRef
      && last.themeRef === signature.themeRef
      && last.color === signature.color) {
      return;
    }
    this.lastRenderSignature = signature;
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
    this.renderRings(ringCount, rangeNm, radius, maxRingRadius, viewRotation, scale, radarCfg.showSelf ?? true, ownShipRotation, ringColor);

    if (!ownShip.position || !this.hasValidPosition(ownShip.position)) return;

    const maxRangeNm = (maxRingRadius / radius) * rangeNm;
    const renderTargets = this.buildTargets(targets, ownShip.position, rangeNm, maxRangeNm, radius, viewRotation, radarCfg);
    this.lastRenderTargets = renderTargets;
    this.lastRenderScale = scale;
    this.lastRenderSize = size;
    this.renderVectors(renderTargets, rangeNm, radius, viewRotation, radarCfg, ownShip);
    this.renderTargets(renderTargets, scale);
    this.renderSelected(renderTargets, scale);
    this.raiseOwnshipAndVector();

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
    scale: number,
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

    const ownShipSelection = this.ownShipLayer
      .selectAll<SVGGElement, { size: number }>('g.radar-ownship')
      .data(showSelf ? [{ size: this.resolveOwnShipBaseSize(scale) }] : []);

    const ownShipEnter = ownShipSelection.enter()
      .append('g')
      .attr('class', 'radar-ownship');

    ownShipEnter.append('image')
      .attr('class', 'ownship-icon')
      .attr('href', this.ownShipIconHref ?? null)
      .attr('xlink:href', this.ownShipIconHref ?? null);

    const ownShipMerged = ownShipEnter.merge(ownShipSelection as d3.Selection<SVGGElement, { size: number }, SVGGElement, unknown>);

    ownShipMerged
      .attr('transform', `rotate(${ownShipRotation})`);

    ownShipMerged.select<SVGImageElement>('image.ownship-icon')
      .attr('href', this.ownShipIconHref ?? null)
      .attr('xlink:href', this.ownShipIconHref ?? null)
      .attr('display', this.ownShipIconHref ? null : 'none')
      .attr('width', d => d.size)
      .attr('height', d => d.size)
      .attr('x', d => -d.size / 2)
      .attr('y', d => -d.size / 2);

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

  protected toggleFilter(key: RadarFilterKey): void {
    this.filterState.update(state => ({
      ...state,
      [key]: !state[key]
    }));
  }

  protected toggleVesselTypeFilter(key: VesselIconKey): void {
    this.filterState.update(state => {
      const next = new Set(state.vesselTypes);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return { ...state, vesselTypes: next };
    });
  }

  protected isFilterEnabled(key: RadarFilterKey): boolean {
    return this.filterState()[key];
  }

  protected isVesselTypeFilterEnabled(key: VesselIconKey): boolean {
    return this.filterState().vesselTypes.has(key);
  }

  protected formatVesselTypeLabel(key: VesselIconKey): string {
    const shortKey = key.replace('vessel/', '');
    switch (shortKey) {
      case 'pleasurecraft':
        return 'Pleasure Craft';
      case 'highspeed':
        return 'High Speed';
      case 'sar':
        return 'SAR';
      case 'law':
        return 'Law Enforcement';
      default:
        return `${shortKey.charAt(0).toUpperCase()}${shortKey.slice(1)}`;
    }
  }

  private syncFiltersFromConfig(cfg: IWidgetSvcConfig): void {
    const filters = cfg.ais?.filters;
    if (!filters) return;
    const signature = this.buildFilterSignature(filters);
    if (signature === this.lastFiltersSignature) return;
    this.lastFiltersSignature = signature;
    this.filterState.set({
      anchoredMoored: filters.anchoredMoored ?? false,
      noCollisionRisk: filters.noCollisionRisk ?? false,
      allAton: filters.allAton ?? false,
      allButSar: filters.allButSar ?? false,
      allVessels: filters.allVessels ?? false,
      vesselTypes: new Set((filters.vesselTypes ?? []) as VesselIconKey[])
    });
  }

  private buildFilterSignature(filters: NonNullable<IWidgetSvcConfig['ais']>['filters']): string {
    const vesselTypes = [...(filters?.vesselTypes ?? [])].sort();
    return JSON.stringify({
      anchoredMoored: filters?.anchoredMoored ?? false,
      noCollisionRisk: filters?.noCollisionRisk ?? false,
      allAton: filters?.allAton ?? false,
      allButSar: filters?.allButSar ?? false,
      allVessels: filters?.allVessels ?? false,
      vesselTypes
    });
  }

  private buildFilterStateSignature(filters: RadarFilterState): string {
    const vesselTypes = [...filters.vesselTypes].sort();
    return JSON.stringify({
      anchoredMoored: filters.anchoredMoored,
      noCollisionRisk: filters.noCollisionRisk,
      allAton: filters.allAton,
      allButSar: filters.allButSar,
      allVessels: filters.allVessels,
      vesselTypes
    });
  }

  private resolveRingCountForRange(rangeNm: number): number {
    const candidates = [3];
    return candidates.find(count => this.isNiceStep(rangeNm / count)) ?? 4;
  }

  private isNiceStep(step: number): boolean {
    const niceSteps = [0.5, 1, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 25];
    return niceSteps.some(value => Math.abs(step - value) < 1e-6);
  }

  private resolveRangeIndex(cfg: IWidgetSvcConfig['ais'] | undefined): number {
    return cfg ? Number(cfg.rangeIndex) : 0;
  }

  private buildTargets(
    tracks: AisTrack[],
    origin: Position,
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
    for (const track of tracks) {
      trackIds.add(track.id);
    }

    for (const cachedId of this.targetCache.keys()) {
      if (!trackIds.has(cachedId)) this.targetCache.delete(cachedId);
    }
    for (const cachedId of this.iconCache.keys()) {
      if (!trackIds.has(cachedId)) this.iconCache.delete(cachedId);
    }

    const results: RenderTarget[] = [];
    for (const track of tracks) {
      if (track.ais.status === 'remove') {
        this.targetCache.delete(track.id);
        this.iconCache.delete(track.id);
        if (this.selectedId() === track.id) {
          this.selectedId.set(null);
        }
      }
    }

    const candidates = tracks.filter(track => {
      if (track.ais.status === 'remove') return false;
      if (track.ais.status === 'lost' && !showLost) return false;
      if (track.ais.status === 'unconfirmed' && !showUnconfirmed) return false;
      if (!track.position || !this.hasValidPosition(track.position)) return false;
      return !this.shouldFilterTarget(track);
    });

    for (const track of candidates) {
      const signature = this.buildTrackSignature(track);
      let cached = this.targetCache.get(track.id);
      if (!cached || cached.signature !== signature) {
        const distance = this.distanceNm(origin, track.position);
        const bearing = this.ais.getBearingTrue(origin, track.position) ?? 0;
        const trackHeading = this.toDegreesIfRadians(this.isVesselLike(track) ? track.headingTrue : null);
        const trackCog = this.toDegreesIfRadians(this.isVesselLike(track) ? track.courseOverGroundTrue : null);
        cached = {
          signature,
          distanceNm: distance,
          bearing,
          trackHeading,
          trackCog
        };
        this.targetCache.set(track.id, cached);
      }

      if (cached.distanceNm > maxRangeNm) continue;

      const { href: iconHref, scale: iconScale } = this.resolveIconCached(track);
      const angle = this.wrapDegrees(cached.bearing - viewRotation);
      const { x, y } = this.polarToCartesian(angle, cached.distanceNm, rangeNm, radius);
      const heading = track.type === 'aton' || track.type === 'basestation'
        ? 0
        : this.wrapDegrees((cached.trackHeading ?? cached.trackCog ?? 0) - viewRotation);
      const className = this.buildClassName({
        id: track.id,
        status: track.ais.status,
        aisClass: track.ais.class,
        type: track.type,
        navState: this.isVesselLike(track) ? track.navState : undefined
      });

      results.push({
        id: track.id,
        raw: track,
        x,
        y,
        heading,
        status: track.ais.status,
        aisClass: track.ais.class,
        type: track.type,
        iconHref,
        iconScale,
        navState: this.isVesselLike(track) ? track.navState : undefined,
        sog: this.isVesselLike(track) ? track.speedOverGround : undefined,
        cog: cached.trackCog ?? null,
        className
      });
    }

    return results;
  }

  private renderVectors(
    targets: RenderTarget[],
    rangeNm: number,
    radius: number,
    viewRotation: number,
    cfg: NonNullable<IWidgetSvcConfig['ais']>,
    ownShip: RenderState['ownShip']
  ): void {
    if (!this.vectorsLayer || !this.ownShipLayer) return;
    const motionEnabled = cfg.showCogVectors ?? true;
    const baseSize = Math.max(6, radius * 0.04);
    const durationSeconds = (cfg.cogVectorsMinutes ?? 5) * 60;
    const tipOffset = baseSize * 0.8;

    const motionData: VectorLine[] = [];
    const ownShipMotionData: VectorLine[] = [];

    for (const target of targets) {
      if (!this.isVesselLike(target.raw)) continue;
      if (this.isStationaryNavState(target.raw.navState)) continue;
      if (motionEnabled && typeof target.sog === 'number' && typeof target.cog === 'number') {
        const motionAngle = this.wrapDegrees(target.cog - viewRotation);
        const tip = this.offsetPoint(target.x, target.y, motionAngle, tipOffset);
        const distanceNm = (target.sog * durationSeconds) / 1852;
        const vectorLength = Math.max(0, (distanceNm / rangeNm) * radius - tipOffset);
        if (vectorLength <= 0) continue;
        const end = this.offsetPoint(tip.x, tip.y, motionAngle, vectorLength);
        const stroke = this.resolveTargetVectorStroke(target.raw);
        motionData.push({
          id: target.id,
          x1: tip.x,
          y1: tip.y,
          x2: end.x,
          y2: end.y,
          className: target.className,
          stroke
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
        if (vectorLength <= 0) return;
        const end = this.offsetPoint(tip.x, tip.y, motionAngle, vectorLength);
        ownShipMotionData.push({
          id: 'ownship',
          x1: tip.x,
          y1: tip.y,
          x2: end.x,
          y2: end.y,
          className: 'ownship-vector',
          stroke: 'var(--kip-orange-color)'
        });
      }
    }

    this.renderVectorLines(this.vectorsLayer, 'motion-vector', motionData);
    this.renderVectorLines(this.ownShipLayer, 'ownship-vector', ownShipMotionData);
  }

  private renderVectorLines(
    layer: d3.Selection<SVGGElement, unknown, null, undefined>,
    className: string,
    data: VectorLine[]
  ): void {
    const selection = layer
      .selectAll<SVGLineElement, VectorLine>(`line.${className}`)
      .data(data, d => d.id);

    selection.enter()
      .append('line')
      .attr('class', d => `${className} ${d.className}`)
      .merge(selection as d3.Selection<SVGLineElement, VectorLine, SVGGElement, unknown>)
      .attr('x1', d => d.x1)
      .attr('y1', d => d.y1)
      .attr('x2', d => d.x2)
      .attr('y2', d => d.y2)
      .style('stroke', d => d.stroke ?? '#50505f')
      .style('stroke-width', 2)
      .style('opacity', 1)
      .style('stroke-dasharray', '15, 7');

    selection.exit().remove();

    const tipSelection = layer
      .selectAll<SVGCircleElement, VectorLine>(`circle.${className}-tip`)
      .data(data, d => d.id);

    tipSelection.enter()
      .append('circle')
      .attr('class', d => `${className}-tip ${d.className}`)
      .merge(tipSelection as d3.Selection<SVGCircleElement, VectorLine, SVGGElement, unknown>)
      .attr('cx', d => d.x2)
      .attr('cy', d => d.y2)
      .attr('r', 2.5)
      .style('fill', d => d.stroke ?? '#50505f')
      .style('stroke', d => d.stroke ?? '#50505f')
      .style('stroke-width', 2)
      .style('opacity', 1)
      .style('stroke-dasharray', '15, 7');

    tipSelection.exit().remove();
  }

  private renderTargets(targets: RenderTarget[], scale: number): void {
    if (!this.targetsLayer) return;

    const baseSize = this.resolveTargetBaseSize(scale);
    const selection = this.targetsLayer
      .selectAll<SVGGElement, RenderTarget>('g.target')
      .data(targets, d => d.id);

    const enter = selection.enter()
      .append('g')
      .on('click', (event, d) => {
        event.stopPropagation();
        this.handleTargetClick(event as MouseEvent, d);
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

  private renderSelected(targets: RenderTarget[], scale: number): void {
    if (!this.selectedLayer) return;
    const selected = targets.filter(t => t.id === this.selectedId());
    const baseSize = this.resolveTargetBaseSize(scale);
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

  private resolveTargetBaseSize(scale: number): number {
    const safeScale = Math.max(0.2, scale);
    return WidgetAisRadarComponent.TARGET_ICON_SIZE_PX / safeScale;
  }

  private resolveOwnShipBaseSize(scale: number): number {
    const safeScale = Math.max(0.2, scale);
    return WidgetAisRadarComponent.OWN_SHIP_ICON_SIZE_PX / safeScale;
  }

  private raiseOwnshipAndVector(): void {
    this.ownShipLayer?.raise();
  }

  protected onMenuItemSelect(item: TargetMenuItem): void {
    this.openTargetDialog(item.target, item.iconHref);
    this.selectedId.set(null);
    this.closeTargetMenu();
  }

  private handleTargetClick(event: MouseEvent, target: RenderTarget): void {
    const menuItems = this.resolveMenuItems(event, target);
    if (menuItems.length <= 1) {
      this.openTargetDialog(target.raw, target.iconHref);
      return;
    }

    this.menuItems.set(menuItems);
    this.menuPoint = this.resolveMenuPoint(event);
    this.positionMenuAnchor();
    this.menuTrigger().openMenu();
  }

  private openTargetDialog(target: AisTrack, iconHref: string | null): void {
    this.selectedId.set(target.id);
    this.dialog.openAisDetailDialog({
      title: this.buildTargetTitle(target),
      iconHref: iconHref ?? undefined,
      component: 'ais-target',
      componentType: DialogAisTargetComponent,
      payload: { target }
    }).subscribe();
  }

  private resolveMenuItems(event: MouseEvent, target: RenderTarget): TargetMenuItem[] {
    const hits = this.findTargetsNearEvent(event, target);
    return hits.map(hit => ({
      id: hit.id,
      label: this.buildTargetMenuLabel(hit.raw),
      iconHref: hit.iconHref,
      target: hit.raw
    }));
  }

  private findTargetsNearEvent(event: MouseEvent, fallback: RenderTarget): RenderTarget[] {
    const targets = this.lastRenderTargets.length ? this.lastRenderTargets : [fallback];
    const point = this.eventToRadarPoint(event);
    if (!point) return [fallback];

    const hitRadius = this.hitRadiusPx / this.lastRenderScale;
    const hits = targets
      .map((candidate, index) => {
        const dx = candidate.x - point.x;
        const dy = candidate.y - point.y;
        const distance = Math.hypot(dx, dy);
        return { candidate, distance, index };
      })
      .filter(entry => entry.distance <= hitRadius)
      .sort((a, b) => a.distance - b.distance || a.index - b.index)
      .map(entry => entry.candidate);

    return hits.length ? hits : [fallback];
  }

  private eventToRadarPoint(event: MouseEvent): { x: number; y: number } | null {
    const size = this.lastRenderSize;
    if (!size) return null;

    const svgEl = this.svgRef().nativeElement;
    const rect = svgEl.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    const x = (offsetX - rect.width / 2) / this.lastRenderScale;
    const y = (offsetY - rect.height / 2) / this.lastRenderScale;
    return { x, y };
  }

  private resolveMenuPoint(event: MouseEvent): { x: number; y: number } | null {
    const container = this.svgRef().nativeElement.closest('.ais-radar-container') as HTMLElement | null;
    if (!container) return null;
    const rect = container.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  }

  private positionMenuAnchor(): void {
    const anchor = this.menuAnchorRef().nativeElement;
    if (!this.menuPoint) return;
    anchor.style.left = `${this.menuPoint.x}px`;
    anchor.style.top = `${this.menuPoint.y}px`;
  }

  protected closeTargetMenu(): void {
    this.resetTargetMenuState();
    if (this.menuTrigger().menuOpen) {
      this.menuTrigger().closeMenu();
    }
  }

  protected resetTargetMenuState(): void {
    this.menuItems.set([]);
    this.menuPoint = null;
  }

  private buildTargetMenuLabel(target: AisTrack): string {
    if (this.isAton(target) && target.typeName) return target.typeName;
    return target.name ?? target.mmsi ?? 'AIS Target';
  }

  private buildTargetTitle(target: AisTrack): string {
    const base = this.isAton(target) && target.typeName
      ? target.typeName
      : (target.name ?? target.type ?? 'AIS Target');
    const status = target.ais.status;
    return status === 'unconfirmed' || status === 'lost' || status === 'remove'
      ? `${base} - ${status}`
      : base;
  }

  private resolveIconCached(track: AisTrack): { href: string | null; scale: number } {
    const signature = this.buildIconSignature(track);
    const cached = this.iconCache.get(track.id);
    if (cached && cached.signature === signature) return cached.icon;

    const scale = this.resolveIconScale(track.type);
    const pendingIcon = { href: cached?.icon.href ?? null, scale };
    this.iconCache.set(track.id, { signature, icon: pendingIcon });

    const iconStatus = track.ais.status === 'remove' ? undefined : track.ais.status;
    void resolveThemedIconDataUrl({
      mmsi: track.mmsi ?? '',
      type: track.type,
      navState: this.isVesselLike(track) ? track.navState : undefined,
      aisShipTypeId: this.isVesselLike(track) ? track.design?.aisShipType?.id : undefined,
      atonVirtual: this.isAton(track) ? track.virtual : undefined,
      atonTypeId: this.isAton(track) ? track.typeId : undefined,
      status: iconStatus,
      collisionRiskRating: this.isVesselLike(track) ? track.closestApproach?.collisionRiskRating : undefined
    }).then(href => {
      const current = this.iconCache.get(track.id);
      if (!current || current.signature !== signature) return;
      current.icon = { href, scale };
      this.scheduleRender();
    });

    return pendingIcon;
  }

  private resolveIconScale(type: AisTrack['type']): number {
    switch (type) {
      case 'aton':
        return 3.5;
      case 'basestation':
        return 3;
      case 'sar':
        return 2.4;
      case 'vessel':
        return 3;
      default:
        return 2.4;
    }
  }

  private buildIconSignature(track: AisTrack): string {
    const signatureStatus = track.ais.status === 'lost' ? 'unconfirmed' : track.ais.status;
    return [
      track.mmsi,
      track.type,
      this.isVesselLike(track) ? track.navState : undefined,
      this.isVesselLike(track) ? track.design?.aisShipType?.id : undefined,
      this.isAton(track) ? track.virtual : undefined,
      this.isAton(track) ? track.typeId : undefined,
      signatureStatus,
      this.isVesselLike(track) ? track.closestApproach?.collisionRiskRating : undefined
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

  private resolveTargetVectorStroke(track: AisVessel | AisSar): string {
    if (track.ais.status !== 'confirmed') return '#50505f';
    const rating = track.closestApproach?.collisionRiskRating;
    const numericRating = typeof rating === 'number' ? rating : Number(rating);
    if (!Number.isFinite(numericRating)) return '#50505f';
    if (numericRating < COLLISION_RISK_HIGH_THRESHOLD) return 'red';
    if (numericRating < COLLISION_RISK_LOW_THRESHOLD) return 'yellow';
    return '#50505f';
  }

  private shouldFilterTarget(track: AisTrack): boolean {
    const filters = this.filterState();
    if (!filters.anchoredMoored
      && !filters.noCollisionRisk
      && !filters.allAton
      && !filters.allButSar
      && !filters.allVessels
      && filters.vesselTypes.size === 0) {
      return false;
    }

    if (filters.anchoredMoored && this.isVesselLike(track) && this.isStationaryNavState(track.navState)) {
      return true;
    }

    if (filters.noCollisionRisk && this.isVesselLike(track)) {
      if (track.ais.status !== 'confirmed') return true;
      if (this.isStationaryNavState(track.navState)) return true;
      if (this.isNoCollisionRisk(track)) return true;
    }

    if (filters.allAton && track.type === 'aton') {
      return true;
    }

    if (filters.allButSar && track.type !== 'sar') {
      return true;
    }

    if (filters.allVessels && this.isVesselLike(track)) {
      return true;
    }

    if (filters.vesselTypes.size > 0 && this.isVesselLike(track)) {
      const key = this.resolveVesselIconKey(track);
      if (key && filters.vesselTypes.has(key)) {
        return true;
      }
    }

    return false;
  }

  private isNoCollisionRisk(track: AisVessel | AisSar): boolean {
    const rating = track.closestApproach?.collisionRiskRating;
    if (!Object.prototype.hasOwnProperty.call(track.closestApproach ?? {}, 'collisionRiskRating')) {
      return false;
    }
    if (rating === null || rating === undefined) return true;
    const numericRating = typeof rating === 'number' ? rating : Number(rating);
    if (!Number.isFinite(numericRating)) return true;
    return numericRating >= COLLISION_RISK_LOW_THRESHOLD;
  }

  private resolveVesselIconKey(track: AisTrack): VesselIconKey | null {
    if (!this.isVesselLike(track)) return null;
    const key = resolveIconKey({
      mmsi: track.mmsi ?? track.id ?? '',
      type: track.type,
      aisShipTypeId: track.design?.aisShipType?.id
    });
    return key.startsWith('vessel/') ? (key as VesselIconKey) : null;
  }

  private polarToCartesian(angleDeg: number, distanceNm: number, rangeNm: number, radius: number) {
    const theta = (angleDeg * Math.PI) / 180;
    const r = (distanceNm / rangeNm) * radius;
    return {
      x: r * Math.sin(theta),
      y: -r * Math.cos(theta)
    };
  }

  private hasValidPosition(position: Position | null | undefined): position is Position {
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

  private isStationaryNavState(value: string | number | null | undefined): boolean {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value === 1 || value === 5;
    }
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase().replace(/\s+/g, ' ');
    if (!normalized.length) return false;
    const numeric = Number(normalized);
    if (Number.isFinite(numeric)) return numeric === 1 || numeric === 5;
    return normalized.includes('moored') || normalized.includes('anchored') || normalized.includes('at anchor');
  }

  private shortestAngleDelta(from: number, to: number): number {
    return ((to - from + 540) % 360) - 180;
  }

  private buildTrackSignature(track: AisTrack): string {
    const position = track.position ?? {};
    return [
      position.latitude,
      position.longitude,
      this.isVesselLike(track) ? track.headingTrue : undefined,
      this.isVesselLike(track) ? track.courseOverGroundTrue : undefined
    ].join('|');
  }

  private isVesselLike(track: AisTrack): track is AisVessel | AisSar {
    return track.type === 'vessel' || track.type === 'sar';
  }

  private isAton(track: AisTrack): track is AisAton {
    return track.type === 'aton';
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

  private distanceNm(a: Position, b: Position): number {
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
