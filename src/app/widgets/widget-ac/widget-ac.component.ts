import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as d3 from 'd3';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import type { ITheme } from '../../core/services/app-service';
import { States, TState } from '../../core/interfaces/signalk-interfaces';
import type { ElectricalTrackedDevice, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { UnitsService } from '../../core/services/units.service';
import { getColors, resolveZoneAwareColor } from '../../core/utils/themeColors.utils';
import { getElectricalWidgetFamilyDescriptor } from '../../core/contracts/electrical-widget-family.contract';
import type { ElectricalCardDisplayMode } from '../../core/contracts/electrical-topology-card.contract';
import {
  ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT,
  ELECTRICAL_DIRECT_CARD_FULL_LAYOUT,
  ELECTRICAL_DIRECT_CARD_GAP,
  ELECTRICAL_DIRECT_CARD_HEIGHT,
  ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH,
  ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT
} from '../shared/electrical-card-layout.constants';
import type { AcDisplayModel, AcSnapshot, AcWidgetConfig, ElectricalCardModeConfig } from './widget-ac.types';

interface AcRenderSnapshot {
  buses: AcSnapshot[];
  displayModels: Record<string, AcDisplayModel>;
  widgetColors: ReturnType<typeof getColors>;
}

@Component({
  selector: 'widget-ac',
  templateUrl: './widget-ac.component.html',
  styleUrl: './widget-ac.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetAcComponent implements AfterViewInit, OnDestroy {
  private static readonly AC_DESCRIPTOR = getElectricalWidgetFamilyDescriptor('widget-ac');
  private static readonly SELF_ROOT_PATH = (() => {
    const root = WidgetAcComponent.AC_DESCRIPTOR?.selfRootPath;
    if (!root) throw new Error('[WidgetAcComponent] Descriptor missing or selfRootPath not set; check widget registration.');
    return root;
  })();
  private static readonly ROOT_PATTERN = `${WidgetAcComponent.SELF_ROOT_PATH}.*`;
  private static readonly ROOT_PREFIX = `${WidgetAcComponent.SELF_ROOT_PATH}.`;
  private static readonly VIEWBOX_WIDTH = ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH;
  private static readonly CARD_HEIGHT = ELECTRICAL_DIRECT_CARD_HEIGHT;
  private static readonly COMPACT_CARD_HEIGHT = ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT;
  private static readonly CARD_GAP = ELECTRICAL_DIRECT_CARD_GAP;
  private static readonly PATH_BATCH_WINDOW_MS = 500;
  private static readonly RESERVED_AC_AGGREGATE_IDS = new Set(['totalCurrent', 'totalPower']);

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    color: 'contrast',
    ignoreZones: false,
    ac: {
      trackedDevices: [],
      optionsById: {}
    }
  };

  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();
  public renderMode = input<ElectricalCardDisplayMode | null>(null);

  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly data = inject(DataService);
  private readonly units = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('acSvg');
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private layer?: d3.Selection<SVGGElement, unknown, null, undefined>;

  private readonly pendingPathUpdates = new Map<string, { id: string; key: string; value: unknown; state: TState | null }>();
  private pathBatchTimerId: ReturnType<typeof setTimeout> | null = null;
  private initialPathPaintDone = false;
  private renderFrameId: number | null = null;
  private pendingRenderSnapshot: AcRenderSnapshot | null = null;

  protected readonly discoveredBusIds = signal<string[]>([]);
  protected readonly trackedDevices = signal<ElectricalTrackedDevice[]>([]);
  protected readonly optionsById = signal<AcWidgetConfig['optionsById']>({});
  protected readonly cardMode = signal<ElectricalCardModeConfig>({
    displayMode: 'full',
    metrics: ['line1Voltage', 'line1Current', 'line1Frequency', 'line2Voltage']
  });
  protected readonly busesByKey = signal<Record<string, AcSnapshot>>({});

  protected readonly visibleBusKeys = computed(() => {
    const tracked = this.trackedDevices();
    if (tracked.length) return tracked.map(device => device.key);
    const map = this.busesByKey();
    const ids = new Set(this.discoveredBusIds());
    return Object.keys(map)
      .filter(key => {
        const snapshot = map[key];
        return !!snapshot && ids.has(snapshot.id);
      })
      .sort((left, right) => left.localeCompare(right));
  });

  protected readonly visibleBuses = computed<AcSnapshot[]>(() => {
    const keys = this.visibleBusKeys();
    const map = this.busesByKey();
    return keys.map(key => map[key]).filter((item): item is AcSnapshot => !!item);
  });

  protected readonly hasBuses = computed(() => this.visibleBuses().length > 0);
  protected readonly activeDisplayMode = computed<ElectricalCardDisplayMode>(() => this.renderMode() ?? this.cardMode().displayMode ?? 'full');
  protected readonly isCompactCardMode = computed(() => this.activeDisplayMode() === 'compact');
  protected readonly colorRole = computed(() => this.runtime.options()?.color ?? 'contrast');
  protected readonly ignoreZones = computed(() => this.runtime.options()?.ignoreZones ?? false);

  protected readonly widgetColors = computed(() => {
    const theme = this.theme();
    if (!theme) return null;
    return getColors(this.colorRole(), theme);
  });

  protected readonly displayModels = computed<Record<string, AcDisplayModel>>(() => {
    const buses = this.visibleBuses();
    const theme = this.theme();
    const widgetColors = this.widgetColors();
    const ignoreZones = this.ignoreZones();

    const idCount = new Map<string, number>();
    buses.forEach(bus => idCount.set(bus.id, (idCount.get(bus.id) ?? 0) + 1));
    const duplicateIds = new Set<string>(
      [...idCount.entries()].filter(([, count]) => count > 1).map(([id]) => id)
    );

    const models: Record<string, AcDisplayModel> = {};
    for (const bus of buses) {
      const modelKey = bus.deviceKey ?? bus.id;
      const showSource = !!bus.source && duplicateIds.has(bus.id);
      const aggregateState = this.resolveMostSevereState(
        bus.line1VoltageState ?? null,
        bus.line1CurrentState ?? null,
        bus.line2VoltageState ?? null,
        bus.line2CurrentState ?? null,
        bus.line3VoltageState ?? null,
        bus.line3CurrentState ?? null,
        bus.modeState ?? null
      );
      const primaryState = this.resolveMostSevereState(
        bus.line1VoltageState ?? null,
        bus.line1CurrentState ?? null,
        bus.line1FrequencyState ?? null
      );
      const secondaryState = this.resolveMostSevereState(
        bus.line2VoltageState ?? null,
        bus.line2CurrentState ?? null,
        bus.line3VoltageState ?? null,
        bus.line3CurrentState ?? null
      );
      const [metricsLineOne, metricsLineTwo] = this.buildMetricRows(bus);

      models[modelKey] = {
        id: bus.id,
        titleText: this.displayName(bus),
        modeText: this.isCompactCardMode() ? '' : this.resolveModeText(bus),
        busText: this.isCompactCardMode() ? '' : (
          showSource ? (bus.source ?? '-') : (bus.associatedBus || bus.location || '-')
        ),
        metricsLineOne,
        metricsLineTwo,
        stateBarColor: resolveZoneAwareColor(aggregateState, widgetColors?.dim ?? 'var(--kip-contrast-color)', theme, ignoreZones),
        titleTextColor: resolveZoneAwareColor(aggregateState, 'var(--kip-contrast-color)', theme, ignoreZones),
        metaTextColor: resolveZoneAwareColor(bus.modeState ?? null, 'var(--kip-contrast-dim-color)', theme, ignoreZones),
        primaryMetricsTextColor: resolveZoneAwareColor(primaryState, 'var(--kip-contrast-color)', theme, ignoreZones),
        secondaryMetricsTextColor: resolveZoneAwareColor(secondaryState, 'var(--kip-contrast-color)', theme, ignoreZones)
      };
    }

    return models;
  });

  constructor() {
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      untracked(() => this.applyConfig(cfg));
    });

    effect(() => {
      const models = this.displayModels();
      const buses = this.visibleBuses();
      const widgetColors = this.widgetColors();
      if (!this.svg || !widgetColors) return;
      this.requestRender({ buses, displayModels: models, widgetColors });
    });

    const acTrees = [
      this.data.subscribePathTreeWithInitial(WidgetAcComponent.ROOT_PATTERN)
    ];

    let hasInitialUpdates = false;
    for (const tree of acTrees) {
      if (!tree.initial.length) continue;
      hasInitialUpdates = true;
      for (const update of tree.initial) {
        this.enqueuePathUpdate(update, true);
      }
    }

    if (hasInitialUpdates) {
      this.flushPendingPathUpdates();
      this.initialPathPaintDone = true;
    }

    for (const tree of acTrees) {
      tree.live$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(update => this.enqueuePathUpdate(update));
    }
  }

  ngAfterViewInit(): void {
    this.initializeSvg();
    this.requestRender();
  }

  ngOnDestroy(): void {
    if (this.pathBatchTimerId !== null) {
      clearTimeout(this.pathBatchTimerId);
      this.pathBatchTimerId = null;
    }
    if (this.renderFrameId !== null) {
      cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }
    this.pendingRenderSnapshot = null;
  }

  private initializeSvg(): void {
    this.svg = d3.select(this.svgRef().nativeElement);
    this.svg
      .attr('viewBox', `0 0 ${WidgetAcComponent.VIEWBOX_WIDTH} ${WidgetAcComponent.CARD_HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'AC View');
    this.layer = this.svg.append('g').attr('class', 'ac-layer');
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const acCfg = this.resolveAcConfig(cfg);
    this.trackedDevices.set(acCfg.trackedDevices ?? []);
    this.reprojectSnapshotsToDeviceKeys(acCfg.trackedDevices ?? []);
    this.optionsById.set(acCfg.optionsById);
    this.cardMode.set(this.normalizeCardMode(acCfg.cardMode));
  }

  private reprojectSnapshotsToDeviceKeys(devices: ElectricalTrackedDevice[]): void {
    if (!devices.length) return;

    const idToKeys = new Map<string, string[]>();
    devices.forEach(device => {
      const existing = idToKeys.get(device.id) ?? [];
      existing.push(device.key);
      idToKeys.set(device.id, existing);
    });

    this.busesByKey.update(current => {
      let next = current;
      let changed = false;

      idToKeys.forEach((keys, id) => {
        const sourceSnapshot = current[id];
        if (!sourceSnapshot) return;

        for (const deviceKey of keys) {
          if (current[deviceKey]) continue;
          const trackedDevice = devices.find(device => device.key === deviceKey);
          if (!changed) {
            next = { ...current };
            changed = true;
          }
          next[deviceKey] = { ...sourceSnapshot, source: trackedDevice?.source ?? null, deviceKey };
        }

        if (changed && next[id]?.deviceKey === undefined) {
          delete next[id];
        }
      });

      return changed ? next : current;
    });
  }

  private resolveAcConfig(cfg: IWidgetSvcConfig): AcWidgetConfig {
    const ac = cfg.ac;
    return {
      trackedDevices: this.normalizeAcTrackedDevices(ac?.trackedDevices),
      optionsById: this.normalizeOptionsById(ac?.optionsById),
      cardMode: this.normalizeCardMode(ac?.cardMode)
    };
  }

  private normalizeAcTrackedDevices(value: unknown): ElectricalTrackedDevice[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const devices = new Map<string, ElectricalTrackedDevice>();
    value.forEach(item => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const candidate = item as { id?: unknown; source?: unknown; key?: unknown };
      const id = this.normalizeOptionalString(candidate.id);
      const source = this.normalizeOptionalString(candidate.source);
      if (!id || !source) {
        return;
      }

      if (WidgetAcComponent.RESERVED_AC_AGGREGATE_IDS.has(id)) {
        return;
      }

      const key = this.normalizeOptionalString(candidate.key) ?? `${id}||${source}`;
      devices.set(key, { id, source, key });
    });

    return [...devices.values()].sort((left, right) => left.key.localeCompare(right.key));
  }

  private buildIdToDeviceKeysMap(): Map<string, string[]> {
    const map = new Map<string, string[]>();
    this.trackedDevices().forEach(device => {
      const existing = map.get(device.id) ?? [];
      existing.push(device.key);
      map.set(device.id, existing);
    });
    return map;
  }

  private normalizeCardMode(value: unknown): ElectricalCardModeConfig {
    const candidate = (value && typeof value === 'object') ? value as { displayMode?: unknown; metrics?: unknown } : null;
    const metrics = this.normalizeStringList(candidate?.metrics);
    return {
      displayMode: candidate?.displayMode === 'compact' ? 'compact' : 'full',
      metrics: metrics.length ? metrics : ['line1Voltage', 'line1Current', 'line1Frequency', 'line2Voltage']
    };
  }

  private normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    const ids = new Set<string>();
    value.forEach(item => {
      if (typeof item !== 'string') return;
      const normalized = item.trim();
      if (normalized.length > 0) ids.add(normalized);
    });
    return [...ids].sort((a, b) => a.localeCompare(b));
  }

  private normalizeOptionsById(value: unknown): AcWidgetConfig['optionsById'] {
    if (!value || typeof value !== 'object') return {};
    const next: AcWidgetConfig['optionsById'] = {};
    Object.entries(value as Record<string, unknown>).forEach(([id]) => {
      const normalizedId = this.normalizeOptionalString(id);
      if (normalizedId) next[normalizedId] = {};
    });
    return next;
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private enqueuePathUpdate(update: IPathUpdateWithPath, fromInitial = false): void {
    const parsed = this.parsePath(update.path);
    if (!parsed) return;

    const value = update.update?.data?.value ?? null;
    const state = update.update?.state ?? null;
    this.pendingPathUpdates.set(`${parsed.id}::${parsed.key}`, { id: parsed.id, key: parsed.key, value, state });

    if (fromInitial) return;
    if (!this.initialPathPaintDone) {
      this.initialPathPaintDone = true;
      this.flushPendingPathUpdates();
      return;
    }

    if (this.pathBatchTimerId !== null) return;
    this.pathBatchTimerId = setTimeout(() => {
      this.pathBatchTimerId = null;
      this.flushPendingPathUpdates();
    }, WidgetAcComponent.PATH_BATCH_WINDOW_MS);
  }

  private flushPendingPathUpdates(): void {
    if (!this.pendingPathUpdates.size) return;

    const updates = Array.from(this.pendingPathUpdates.values());
    this.pendingPathUpdates.clear();

    const uniqueIds = new Set(updates.map(item => item.id));
    uniqueIds.forEach(id => this.trackDiscoveredBus(id));

    const idToKeys = this.buildIdToDeviceKeysMap();

    this.busesByKey.update(current => {
      let next = current;
      let changed = false;

      for (const update of updates) {
        const keysForId = idToKeys.get(update.id);
        const targetKeys: string[] = keysForId?.length ? keysForId : [update.id];

        for (const deviceKey of targetKeys) {
          const isTracked = !!(keysForId?.length);
          const trackedDevice = isTracked ? this.trackedDevices().find(device => device.key === deviceKey) : null;
          const existing = next[deviceKey] ?? {
            id: update.id,
            source: trackedDevice?.source ?? null,
            deviceKey: isTracked ? deviceKey : undefined
          };
          const snapshot = { ...existing } as AcSnapshot;
          const fieldChanged = this.applyValue(snapshot, update.key, update.value, update.state);

          if (!fieldChanged) continue;

          if (!changed) {
            next = { ...next };
            changed = true;
          }
          next[deviceKey] = snapshot;
        }
      }

      return changed ? next : current;
    });
  }

  private parsePath(path: string): { id: string; key: string } | null {
    if (!path.startsWith(WidgetAcComponent.ROOT_PREFIX)) return null;

    const relative = path.slice(WidgetAcComponent.ROOT_PREFIX.length);

    const firstDot = relative.indexOf('.');
    if (firstDot <= 0 || firstDot === relative.length - 1) return null;

    return {
      id: relative.slice(0, firstDot),
      key: relative.slice(firstDot + 1)
    };
  }

  private normalizeMetricKey(key: string): string | null {
    const phaseMatch = key.match(/^phase\.([^.]+)\.(current|frequency|lineNeutralVoltage|realPower)$/);
    if (phaseMatch) {
      const line = this.resolveLineKey(phaseMatch[1]);
      if (!line) return null;

      const metric = phaseMatch[2];
      if (metric === 'current') return `${line}.current`;
      if (metric === 'frequency') return `${line}.frequency`;
      if (metric === 'lineNeutralVoltage') return `${line}.voltage`;
      return `${line}.realPower`;
    }

    if (key === 'total.realPower') {
      return 'power';
    }

    return key;
  }

  private resolveLineKey(phase: string): 'line1' | 'line2' | 'line3' | null {
    const normalized = phase.trim().toLowerCase();

    if (['0', '1', 'l1', 'line1', 'phase1', 'a'].includes(normalized)) return 'line1';
    if (['2', 'l2', 'line2', 'phase2', 'b'].includes(normalized)) return 'line2';
    if (['3', 'l3', 'line3', 'phase3', 'c'].includes(normalized)) return 'line3';

    return null;
  }

  private trackDiscoveredBus(id: string): void {
    const ids = this.discoveredBusIds();
    if (ids.includes(id)) return;
    this.discoveredBusIds.set([...ids, id].sort((a, b) => a.localeCompare(b)));
  }

  private applyValue(snapshot: AcSnapshot, key: string, value: unknown, state: TState | null): boolean {
    const normalizedKey = this.normalizeMetricKey(key);
    if (!normalizedKey) {
      return false;
    }

    switch (normalizedKey) {
      case 'name': return this.setValue(snapshot, 'name', this.toStringValue(value));
      case 'location': return this.setValue(snapshot, 'location', this.toStringValue(value));
      case 'associatedBus': return this.setValue(snapshot, 'associatedBus', this.toStringValue(value));
      case 'mode': return this.setMetricValue(snapshot, 'mode', 'modeState', this.toStringValue(value), state);
      // Backward-compatible flat AC keys map to line 1 when source data is single-phase per id.
      case 'voltage': return this.setMetricValue(snapshot, 'line1Voltage', 'line1VoltageState', this.toNumber(value, 'V'), state);
      case 'current': return this.setMetricValue(snapshot, 'line1Current', 'line1CurrentState', this.toNumber(value, 'A'), state);
      case 'frequency': return this.setMetricValue(snapshot, 'line1Frequency', 'line1FrequencyState', this.toNumber(value, 'Hz'), state);
      case 'line1.voltage': return this.setMetricValue(snapshot, 'line1Voltage', 'line1VoltageState', this.toNumber(value, 'V'), state);
      case 'line1.current': return this.setMetricValue(snapshot, 'line1Current', 'line1CurrentState', this.toNumber(value, 'A'), state);
      case 'line1.frequency': return this.setMetricValue(snapshot, 'line1Frequency', 'line1FrequencyState', this.toNumber(value, 'Hz'), state);
      case 'line1.realPower': return this.setMetricValue(snapshot, 'power', 'line1CurrentState', this.toNumber(value, 'W'), state);
      case 'line2.voltage': return this.setMetricValue(snapshot, 'line2Voltage', 'line2VoltageState', this.toNumber(value, 'V'), state);
      case 'line2.current': return this.setMetricValue(snapshot, 'line2Current', 'line2CurrentState', this.toNumber(value, 'A'), state);
      case 'line2.frequency': return this.setMetricValue(snapshot, 'line2Frequency', 'line2FrequencyState', this.toNumber(value, 'Hz'), state);
      case 'line2.realPower': return this.setMetricValue(snapshot, 'power', 'line2CurrentState', this.toNumber(value, 'W'), state);
      case 'line3.voltage': return this.setMetricValue(snapshot, 'line3Voltage', 'line3VoltageState', this.toNumber(value, 'V'), state);
      case 'line3.current': return this.setMetricValue(snapshot, 'line3Current', 'line3CurrentState', this.toNumber(value, 'A'), state);
      case 'line3.frequency': return this.setMetricValue(snapshot, 'line3Frequency', 'line3FrequencyState', this.toNumber(value, 'Hz'), state);
      case 'line3.realPower': return this.setMetricValue(snapshot, 'power', 'line3CurrentState', this.toNumber(value, 'W'), state);
      case 'power': return this.setMetricValue(snapshot, 'power', 'line1CurrentState', this.toNumber(value, 'W'), state);
      default:
        return false;
    }
  }

  private setValue<K extends keyof AcSnapshot>(target: AcSnapshot, key: K, nextValue: AcSnapshot[K]): boolean {
    if (Object.is(target[key], nextValue)) return false;
    target[key] = nextValue;
    return true;
  }

  private setMetricValue<K extends keyof AcSnapshot, S extends keyof AcSnapshot>(
    target: AcSnapshot,
    key: K,
    stateKey: S,
    nextValue: AcSnapshot[K],
    state: TState | null
  ): boolean {
    const valueChanged = !Object.is(target[key], nextValue);
    const stateChanged = !Object.is(target[stateKey], state);
    if (!valueChanged && !stateChanged) return false;

    target[key] = nextValue;
    target[stateKey] = state as AcSnapshot[S];
    return true;
  }

  private requestRender(snapshot?: AcRenderSnapshot): void {
    const widgetColors = this.widgetColors();
    if (!this.svg || !widgetColors) return;

    this.pendingRenderSnapshot = snapshot ?? {
      buses: this.visibleBuses(),
      displayModels: this.displayModels(),
      widgetColors
    };

    if (this.renderFrameId !== null) return;

    this.renderFrameId = requestAnimationFrame(() => {
      this.renderFrameId = null;
      const nextSnapshot = this.pendingRenderSnapshot;
      this.pendingRenderSnapshot = null;
      if (!nextSnapshot) return;
      this.render(nextSnapshot);
    });
  }

  private render(snapshot: AcRenderSnapshot): void {
    if (!this.layer || !this.svg) return;

    const compact = this.isCompactCardMode();
    const layout = compact ? ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT : ELECTRICAL_DIRECT_CARD_FULL_LAYOUT;
    const cardHeight = compact ? WidgetAcComponent.COMPACT_CARD_HEIGHT : WidgetAcComponent.CARD_HEIGHT;
    const cards = snapshot.buses.map((bus, index) => ({
      key: bus.deviceKey ?? bus.id,
      bus,
      y: index * (cardHeight + WidgetAcComponent.CARD_GAP)
    }));

    const contentHeight = cards.length ? cards[cards.length - 1].y + cardHeight : cardHeight;
    this.svg.attr('viewBox', `0 0 ${WidgetAcComponent.VIEWBOX_WIDTH} ${contentHeight}`);

    const selection = this.layer
      .selectAll<SVGGElement, { key: string; bus: AcSnapshot; y: number }>('g.ac-card')
      .data(cards, item => item.key);

    const enter = selection.enter().append('g').attr('class', 'ac-card');
    enter.append('rect').attr('class', 'ac-card-bg');
    enter.append('rect').attr('class', 'ac-state-bar');
    enter.append('text').attr('class', 'ac-title');
    enter.append('text').attr('class', 'ac-id');
    enter.append('text').attr('class', 'ac-mode');
    enter.append('text').attr('class', 'ac-bus');
    enter.append('text').attr('class', 'ac-metrics-1');
    enter.append('text').attr('class', 'ac-metrics-2');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, { key: string; bus: AcSnapshot; y: number }, SVGGElement, unknown>);

    merged.attr('transform', item => `translate(0, ${item.y})`);
    merged.select('rect.ac-card-bg')
      .attr('x', 0.5)
      .attr('y', 0.5)
      .attr('rx', layout.cardCornerRadius)
      .attr('ry', layout.cardCornerRadius)
      .attr('width', WidgetAcComponent.VIEWBOX_WIDTH - 1)
      .attr('height', cardHeight - 1)
      .attr('stroke', 'var(--mat-sys-outline-variant)')
      .attr('stroke-width', 0.5)
      .attr('fill', 'none');

    merged.select('rect.ac-state-bar')
      .attr('x', 1.5)
      .attr('y', 1.5)
      .attr('rx', layout.stateBarCornerRadius)
      .attr('ry', layout.stateBarCornerRadius)
      .attr('width', 3)
      .attr('height', cardHeight - 3)
      .attr('fill', item => snapshot.displayModels[item.key]?.stateBarColor ?? snapshot.widgetColors.dim);

    merged.select('text.ac-title')
      .attr('x', layout.titleX)
      .attr('y', layout.titleY)
      .attr('font-size', layout.titleFontSize)
      .attr('fill', item => snapshot.displayModels[item.key]?.titleTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.key]?.titleText ?? this.displayName(item.bus));

    merged.select('text.ac-id')
      .attr('x', layout.idX)
      .attr('y', layout.idY)
      .attr('text-anchor', 'end')
      .attr('font-size', layout.idFontSize)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.bus.id);

    merged.select('text.ac-mode')
      .attr('x', layout.metaLeftX)
      .attr('y', layout.metaY)
      .attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.key]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.key]?.modeText ?? '');

    merged.select('text.ac-bus')
      .attr('x', layout.metaRightX)
      .attr('y', layout.metaY)
      .attr('text-anchor', 'end')
      .attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.key]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.key]?.busText ?? '');

    merged.select('text.ac-metrics-1')
      .attr('x', layout.lineOneX)
      .attr('y', layout.lineOneY)
      .attr('font-size', layout.lineOneFontSize)
      .attr('fill', item => snapshot.displayModels[item.key]?.primaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.key]?.metricsLineOne ?? '');

    merged.select('text.ac-metrics-2')
      .attr('x', layout.lineTwoX)
      .attr('y', layout.lineTwoY)
      .attr('font-size', layout.lineTwoFontSize)
      .attr('opacity', 0.85)
      .attr('fill', item => snapshot.displayModels[item.key]?.secondaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.key]?.metricsLineTwo ?? '');

    selection.exit().remove();
  }

  private displayName(bus: AcSnapshot): string {
    return bus.name?.trim() || bus.id;
  }

  private resolveModeText(bus: AcSnapshot): string {
    if (bus.mode) return `Mode ${bus.mode}`;
    return 'Mode -';
  }

  private buildMetricRows(bus: AcSnapshot): [string, string] {
    const mode = this.cardMode();
    const metricLabels = (mode.metrics.length ? mode.metrics : WidgetAcComponent.DEFAULT_CONFIG.ac?.cardMode?.metrics ?? [])
      .map(metric => this.toMetricLabel(metric, bus))
      .filter((label): label is string => !!label);

    if (!metricLabels.length) {
      return ['L1 - - -', 'L2 - -  L3 - -'];
    }

    const first = metricLabels.slice(0, 2).join('   ');
    const second = metricLabels.slice(2, 4).join('   ');
    return [first || ' ', second || ' '];
  }

  private toMetricLabel(metric: string, bus: AcSnapshot): string | null {
    switch (metric) {
      case 'line1Voltage': return `L1V ${this.formatValue(bus.line1Voltage, 'V')}`;
      case 'line1Current': return `L1A ${this.formatValue(bus.line1Current, 'A')}`;
      case 'line1Frequency': return `L1Hz ${this.formatValue(bus.line1Frequency, 'Hz')}`;
      case 'line2Voltage': return `L2V ${this.formatValue(bus.line2Voltage, 'V')}`;
      case 'line2Current': return `L2A ${this.formatValue(bus.line2Current, 'A')}`;
      case 'line2Frequency': return `L2Hz ${this.formatValue(bus.line2Frequency, 'Hz')}`;
      case 'line3Voltage': return `L3V ${this.formatValue(bus.line3Voltage, 'V')}`;
      case 'line3Current': return `L3A ${this.formatValue(bus.line3Current, 'A')}`;
      case 'line3Frequency': return `L3Hz ${this.formatValue(bus.line3Frequency, 'Hz')}`;
      default: return null;
    }
  }

  private formatValue(value: number | null | undefined, unit: string): string {
    if (value == null || Number.isNaN(value)) return '-';
    return `${value.toFixed(1)} ${unit}`;
  }

  private toStringValue(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private resolveMostSevereState(...states: (TState | null | undefined)[]): TState | null {
    if (states.some(state => state === States.Alert)) return States.Alert;
    if (states.some(state => state === States.Alarm)) return States.Alarm;
    if (states.some(state => state === States.Warn)) return States.Warn;
    if (states.some(state => state === States.Normal)) return States.Normal;
    return null;
  }

  private toNumber(value: unknown, unitHint: string): number | null {
    if (value == null || typeof value === 'boolean') return null;

    const rawNumber = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(rawNumber)) return null;

    const converted = this.units.convertToUnit(unitHint, rawNumber);
    return typeof converted === 'number' && Number.isFinite(converted) ? converted : null;
  }
}
