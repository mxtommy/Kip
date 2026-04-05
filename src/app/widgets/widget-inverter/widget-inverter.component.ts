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
import type { InverterDisplayModel, InverterSnapshot, InverterWidgetConfig, ElectricalCardModeConfig } from './widget-inverter.types';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

interface InverterRenderSnapshot {
  inverters: InverterSnapshot[];
  displayModels: Record<string, InverterDisplayModel>;
  widgetColors: ReturnType<typeof getColors>;
}

@Component({
  selector: 'widget-inverter',
  templateUrl: './widget-inverter.component.html',
  styleUrl: './widget-inverter.component.scss',
  imports: [WidgetTitleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetInverterComponent implements AfterViewInit, OnDestroy {
  private static readonly INVERTER_DESCRIPTOR = getElectricalWidgetFamilyDescriptor('widget-inverter');
  private static readonly SELF_ROOT_PATH = (() => {
    const root = WidgetInverterComponent.INVERTER_DESCRIPTOR?.selfRootPath;
    if (!root) throw new Error('[WidgetInverterComponent] Descriptor missing or selfRootPath not set; check widget registration.');
    return root;
  })();
  private static readonly ROOT_PATTERN = `${WidgetInverterComponent.SELF_ROOT_PATH}.*`;
  private static readonly PATH_REGEX = new RegExp(`^${escapeRegex(WidgetInverterComponent.SELF_ROOT_PATH)}\\.([^.]+)\\.(.+)$`);
  private static readonly VIEWBOX_WIDTH = ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH;
  private static readonly CARD_HEIGHT = ELECTRICAL_DIRECT_CARD_HEIGHT;
  private static readonly COMPACT_CARD_HEIGHT = ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT;
  private static readonly CARD_GAP = ELECTRICAL_DIRECT_CARD_GAP;
  private static readonly PATH_BATCH_WINDOW_MS = 500;

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    color: 'contrast',
    ignoreZones: false,
    inverter: {
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

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('inverterSvg');
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private layer?: d3.Selection<SVGGElement, unknown, null, undefined>;

  private readonly pendingPathUpdates = new Map<string, { id: string; key: string; value: unknown; state: TState | null }>();
  private pathBatchTimerId: number | null = null;
  private initialPathPaintDone = false;
  private renderFrameId: number | null = null;
  private pendingRenderSnapshot: InverterRenderSnapshot | null = null;

  protected readonly discoveredInverterIds = signal<string[]>([]);
  protected readonly trackedDevices = signal<ElectricalTrackedDevice[]>([]);
  protected readonly optionsById = signal<InverterWidgetConfig['optionsById']>({});
  protected readonly cardMode = signal<ElectricalCardModeConfig>({
    displayMode: 'full',
    metrics: ['dcVoltage', 'dcCurrent', 'acVoltage', 'acFrequency']
  });
  protected readonly invertersByKey = signal<Record<string, InverterSnapshot>>({});

  protected readonly visibleInverterKeys = computed(() => {
    const tracked = this.trackedDevices();
    if (tracked.length) return tracked.map(d => d.key);
    // No tracking: return every key in invertersByKey that belongs to a discovered id
    // (keys may be plain ids or deviceKeys depending on whether tracking was ever configured)
    const map = this.invertersByKey();
    const ids = new Set(this.discoveredInverterIds());
    return Object.keys(map)
      .filter(key => { const s = map[key]; return !!s && ids.has(s.id); })
      .sort((a, b) => a.localeCompare(b));
  });

  protected readonly visibleInverters = computed<InverterSnapshot[]>(() => {
    const keys = this.visibleInverterKeys();
    const map = this.invertersByKey();
    return keys.map(key => map[key]).filter((item): item is InverterSnapshot => !!item);
  });

  protected readonly hasInverters = computed(() => this.visibleInverters().length > 0);
  protected readonly activeDisplayMode = computed<ElectricalCardDisplayMode>(() => this.renderMode() ?? this.cardMode().displayMode ?? 'full');
  protected readonly isCompactCardMode = computed(() => this.activeDisplayMode() === 'compact');
  protected readonly colorRole = computed(() => this.runtime.options()?.color ?? 'contrast');
  protected readonly ignoreZones = computed(() => this.runtime.options()?.ignoreZones ?? false);
  protected readonly displayLabel = computed(() => {
    const inverters = this.visibleInverters();
    if (inverters.length !== 1) {
      return 'Inverters';
    }

    return this.resolveTitleText(inverters[0]);
  });
  protected readonly labelColor = computed(() => {
    const theme = this.theme();
    return theme ? getColors(this.colorRole(), theme).dim : 'var(--kip-contrast-dim-color)';
  });

  protected readonly widgetColors = computed(() => {
    const theme = this.theme();
    if (!theme) return null;
    return getColors(this.colorRole(), theme);
  });

  protected readonly displayModels = computed<Record<string, InverterDisplayModel>>(() => {
    const inverters = this.visibleInverters();
    const theme = this.theme();
    const widgetColors = this.widgetColors();
    const ignoreZones = this.ignoreZones();

    // Detect device ids that appear across multiple source-keyed snapshots
    const idCount = new Map<string, number>();
    inverters.forEach(inv => idCount.set(inv.id, (idCount.get(inv.id) ?? 0) + 1));
    const duplicateIds = new Set<string>(
      [...idCount.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    );

    const models: Record<string, InverterDisplayModel> = {};
    for (const inverter of inverters) {
      const modelKey = inverter.deviceKey ?? inverter.id;
      const showSource = !!inverter.source && duplicateIds.has(inverter.id);
      const aggregateState = this.resolveMostSevereState(
        inverter.dcVoltageState ?? null,
        inverter.dcCurrentState ?? null,
        inverter.acVoltageState ?? null,
        inverter.acCurrentState ?? null,
        inverter.acFrequencyState ?? null,
        inverter.temperatureState ?? null,
        inverter.inverterModeState ?? null
      );
      const primaryState = this.resolveMostSevereState(inverter.dcVoltageState ?? null, inverter.dcCurrentState ?? null);
      const secondaryState = this.resolveMostSevereState(inverter.acVoltageState ?? null, inverter.acCurrentState ?? null, inverter.acFrequencyState ?? null);
      const [metricsLineOne, metricsLineTwo] = this.buildMetricRows(inverter);

      models[modelKey] = {
        id: inverter.id,
        source: inverter.source ?? null,
        deviceKey: inverter.deviceKey,
        titleText: this.resolveTitleText(inverter),
        modeText: this.isCompactCardMode() ? '' : (inverter.inverterMode ? `Mode ${inverter.inverterMode}` : 'Mode -'),
        busText: this.isCompactCardMode() ? '' : (
          showSource ? (inverter.source ?? '-') : (inverter.associatedBus || inverter.location || '-')
        ),
        metricsLineOne,
        metricsLineTwo,
        stateBarColor: resolveZoneAwareColor(aggregateState, widgetColors?.dim ?? 'var(--kip-contrast-color)', theme, ignoreZones),
        titleTextColor: resolveZoneAwareColor(aggregateState, 'var(--kip-contrast-color)', theme, ignoreZones),
        metaTextColor: resolveZoneAwareColor(inverter.inverterModeState ?? null, 'var(--kip-contrast-dim-color)', theme, ignoreZones),
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
      const inverters = this.visibleInverters();
      const widgetColors = this.widgetColors();
      if (!this.svg || !widgetColors) return;
      this.requestRender({ inverters, displayModels: models, widgetColors });
    });

    const inverterTrees = [
      this.data.subscribePathTreeWithInitial(WidgetInverterComponent.ROOT_PATTERN)
    ];

    let hasInitialUpdates = false;
    for (const tree of inverterTrees) {
      if (!tree.initial.length) {
        continue;
      }

      hasInitialUpdates = true;
      for (const update of tree.initial) {
        this.enqueuePathUpdate(update, true);
      }
    }

    if (hasInitialUpdates) {
      this.flushPendingPathUpdates();
      this.initialPathPaintDone = true;
    }

    for (const tree of inverterTrees) {
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
      .attr('viewBox', `0 0 ${WidgetInverterComponent.VIEWBOX_WIDTH} ${WidgetInverterComponent.CARD_HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Inverter View');
    this.layer = this.svg.append('g').attr('class', 'inverter-layer');
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const inverterCfg = this.resolveInverterConfig(cfg);
    this.trackedDevices.set(inverterCfg.trackedDevices ?? []);
    this.reprojectSnapshotsToDeviceKeys(inverterCfg.trackedDevices ?? []);
    this.optionsById.set(inverterCfg.optionsById);
    this.cardMode.set(this.normalizeCardMode(inverterCfg.cardMode));
  }

  /**
   * Re-projects any id-keyed snapshots already in `invertersByKey` to their
   * proper deviceKey entries when tracked devices are configured after the fact
   * (e.g., initial path data arrives before the config effect fires).
   */
  private reprojectSnapshotsToDeviceKeys(devices: ElectricalTrackedDevice[]): void {
    if (!devices.length) return;

    const idToKeys = new Map<string, string[]>();
    devices.forEach(d => {
      const existing = idToKeys.get(d.id) ?? [];
      existing.push(d.key);
      idToKeys.set(d.id, existing);
    });

    this.invertersByKey.update(current => {
      let next = current;
      let changed = false;

      idToKeys.forEach((keys, id) => {
        const sourceSnapshot = current[id];
        if (!sourceSnapshot) return;

        for (const deviceKey of keys) {
          if (current[deviceKey]) continue; // already keyed — don't overwrite live data
          const trackedDevice = devices.find(d => d.key === deviceKey);
          if (!changed) { next = { ...current }; changed = true; }
          next[deviceKey] = { ...sourceSnapshot, source: trackedDevice?.source ?? null, deviceKey };
        }

        // Remove the stale plain-id entry now that deviceKey entries exist
        if (changed && next[id]?.deviceKey === undefined) {
          delete next[id];
        }
      });

      return changed ? next : current;
    });
  }

  private resolveInverterConfig(cfg: IWidgetSvcConfig): InverterWidgetConfig {
    const inverter = cfg.inverter;
    return {
      trackedDevices: this.normalizeTrackedDevices(inverter?.trackedDevices),
      optionsById: this.normalizeOptionsById(inverter?.optionsById),
      cardMode: this.normalizeCardMode(inverter?.cardMode)
    };
  }

  private normalizeTrackedDevices(value: unknown): ElectricalTrackedDevice[] {
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
      metrics: metrics.length ? metrics : ['dcVoltage', 'dcCurrent', 'acVoltage', 'acFrequency']
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

  private normalizeOptionsById(value: unknown): InverterWidgetConfig['optionsById'] {
    if (!value || typeof value !== 'object') return {};
    const next: InverterWidgetConfig['optionsById'] = {};
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

    this.pathBatchTimerId = window.setTimeout(() => {
      this.pathBatchTimerId = null;
      this.flushPendingPathUpdates();
    }, WidgetInverterComponent.PATH_BATCH_WINDOW_MS);
  }

  private parsePath(path: string): { id: string; key: string } | null {
    const match = path.match(WidgetInverterComponent.PATH_REGEX);
    if (!match) return null;
    return { id: match[1], key: match[2] };
  }

  private flushPendingPathUpdates(): void {
    if (!this.pendingPathUpdates.size) return;
    const updates = Array.from(this.pendingPathUpdates.values());
    this.pendingPathUpdates.clear();

    const uniqueIds = new Set(updates.map(update => update.id));
    uniqueIds.forEach(id => this.trackDiscoveredInverter(id));

    const idToKeys = this.buildIdToDeviceKeysMap();

    this.invertersByKey.update(current => {
      let nextState = current;
      let changed = false;

      for (const update of updates) {
        // Resolve target device keys: tracked keys for this id, or id itself as fallback
        const keysForId = idToKeys.get(update.id);
        const targetKeys: string[] = keysForId?.length ? keysForId : [update.id];

        for (const deviceKey of targetKeys) {
          const isTracked = !!(keysForId?.length);
          const trackedDevice = isTracked ? this.trackedDevices().find(d => d.key === deviceKey) : null;
          const existing = nextState[deviceKey] ?? {
            id: update.id,
            source: trackedDevice?.source ?? null,
            deviceKey: isTracked ? deviceKey : undefined
          };
          const next = { ...existing } as InverterSnapshot;
          const fieldChanged = this.applyValue(next, update.key, update.value, update.state);

          if (!fieldChanged) continue;

          // Derive DC power when not explicit
          if (next.dcVoltage != null && next.dcCurrent != null) {
            const derived = next.dcVoltage * next.dcCurrent;
            next.dcPower = Number.isFinite(derived) ? derived : null;
            next.dcPowerState = this.resolveMostSevereState(next.dcVoltageState ?? null, next.dcCurrentState ?? null);
          } else {
            next.dcPower = null;
            next.dcPowerState = null;
          }

          if (!changed) { nextState = { ...nextState }; changed = true; }
          nextState[deviceKey] = next;
        }
      }

      return changed ? nextState : current;
    });
  }

  private trackDiscoveredInverter(id: string): void {
    const ids = this.discoveredInverterIds();
    if (ids.includes(id)) return;
    this.discoveredInverterIds.set([...ids, id].sort((a, b) => a.localeCompare(b)));
  }

  private applyValue(snapshot: InverterSnapshot, key: string, value: unknown, state: TState | null): boolean {
    switch (key) {
      case 'name': return this.setValue(snapshot, 'name', this.toStringValue(value));
      case 'location': return this.setValue(snapshot, 'location', this.toStringValue(value));
      case 'associatedBus': return this.setValue(snapshot, 'associatedBus', this.toStringValue(value));
      case 'dc.voltage': return this.setMetricValue(snapshot, 'dcVoltage', 'dcVoltageState', this.toNumber(value, 'V'), state);
      case 'dc.current': return this.setMetricValue(snapshot, 'dcCurrent', 'dcCurrentState', this.toNumber(value, 'A'), state);
      case 'acin.voltage': return this.setMetricValue(snapshot, 'acInVoltage', 'acInVoltageState', this.toNumber(value, 'V'), state);
      case 'acin.current': return this.setMetricValue(snapshot, 'acInCurrent', 'acInCurrentState', this.toNumber(value, 'A'), state);
      case 'acin.frequency': return this.setMetricValue(snapshot, 'acInFrequency', 'acInFrequencyState', this.toNumber(value, 'Hz'), state);
      case 'acin.power': return this.setMetricValue(snapshot, 'acInPower', 'acInPowerState', this.toNumber(value, 'W'), state);
      case 'acin.1.currentLimit': return this.setMetricValue(snapshot, 'acIn1CurrentLimit', 'acIn1CurrentLimitState', this.toNumber(value, 'A'), state);
      case 'acin.currentLimit': return this.setMetricValue(snapshot, 'acInCurrentLimit', 'acInCurrentLimitState', this.toNumber(value, 'A'), state);
      case 'acState.acIn1Available': return this.setMetricValue(snapshot, 'acIn1Available', 'acIn1AvailableState', this.toBoolean(value), state);
      case 'acState.ignoreAcIn1.state': return this.setMetricValue(snapshot, 'ignoreAcIn1', 'ignoreAcIn1State', this.toBoolean(value), state);
      case 'ac.voltage': return this.setMetricValue(snapshot, 'acVoltage', 'acVoltageState', this.toNumber(value, 'V'), state);
      case 'ac.current': return this.setMetricValue(snapshot, 'acCurrent', 'acCurrentState', this.toNumber(value, 'A'), state);
      case 'ac.frequency': return this.setMetricValue(snapshot, 'acFrequency', 'acFrequencyState', this.toNumber(value, 'Hz'), state);
      case 'acout.voltage': return this.setMetricValue(snapshot, 'acOutVoltage', 'acOutVoltageState', this.toNumber(value, 'V'), state);
      case 'acout.current': return this.setMetricValue(snapshot, 'acOutCurrent', 'acOutCurrentState', this.toNumber(value, 'A'), state);
      case 'acout.frequency': return this.setMetricValue(snapshot, 'acOutFrequency', 'acOutFrequencyState', this.toNumber(value, 'Hz'), state);
      case 'acout.power': return this.setMetricValue(snapshot, 'acOutPower', 'acOutPowerState', this.toNumber(value, 'W'), state);
      case 'inverterMode': return this.setMetricValue(snapshot, 'inverterMode', 'inverterModeState', this.toStringValue(value), state);
      case 'inverterModeNumber': return this.setMetricValue(snapshot, 'inverterModeNumber', 'inverterModeNumberState', this.toNumber(value, ''), state);
      case 'preferRenewableEnergy': return this.setMetricValue(snapshot, 'preferRenewableEnergy', 'preferRenewableEnergyState', this.toBoolean(value), state);
      case 'preferRenewableEnergyActive': return this.setMetricValue(snapshot, 'preferRenewableEnergyActive', 'preferRenewableEnergyActiveState', this.toBoolean(value), state);
      case 'temperature': return this.setMetricValue(snapshot, 'temperature', 'temperatureState', this.toNumber(value, this.units.getDefaults().Temperature), state);
      default: return false;
    }
  }

  private setValue<K extends keyof InverterSnapshot>(target: InverterSnapshot, key: K, nextValue: InverterSnapshot[K]): boolean {
    if (Object.is(target[key], nextValue)) return false;
    target[key] = nextValue;
    return true;
  }

  private setMetricValue<K extends keyof InverterSnapshot, S extends keyof InverterSnapshot>(
    target: InverterSnapshot, key: K, stateKey: S, nextValue: InverterSnapshot[K], state: TState | null
  ): boolean {
    const valueChanged = !Object.is(target[key], nextValue);
    const stateChanged = !Object.is(target[stateKey], state);
    if (!valueChanged && !stateChanged) return false;
    target[key] = nextValue;
    target[stateKey] = state as InverterSnapshot[S];
    return true;
  }

  private requestRender(snapshot?: InverterRenderSnapshot): void {
    const widgetColors = this.widgetColors();
    if (!this.svg || !widgetColors) return;

    this.pendingRenderSnapshot = snapshot ?? {
      inverters: this.visibleInverters(),
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

  private render(snapshot: InverterRenderSnapshot): void {
    if (!this.layer || !this.svg) return;

    const compact = this.isCompactCardMode();
    const layout = compact ? ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT : ELECTRICAL_DIRECT_CARD_FULL_LAYOUT;
    const cardHeight = compact ? WidgetInverterComponent.COMPACT_CARD_HEIGHT : WidgetInverterComponent.CARD_HEIGHT;
    const cards = snapshot.inverters.map((inverter, index) => ({
      key: inverter.deviceKey ?? inverter.id,
      inverter,
      y: index * (cardHeight + WidgetInverterComponent.CARD_GAP)
    }));

    const contentHeight = cards.length ? cards[cards.length - 1].y + cardHeight : cardHeight;
    this.svg.attr('viewBox', `0 0 ${WidgetInverterComponent.VIEWBOX_WIDTH} ${contentHeight}`);

    const selection = this.layer
      .selectAll<SVGGElement, { key: string; inverter: InverterSnapshot; y: number }>('g.inverter-card')
      .data(cards, item => item.key);

    const enter = selection.enter().append('g').attr('class', 'inverter-card');
    enter.append('rect').attr('class', 'inverter-card-bg');
    enter.append('rect').attr('class', 'inverter-state-bar');
    enter.append('text').attr('class', 'inverter-title');
    enter.append('text').attr('class', 'inverter-id');
    enter.append('text').attr('class', 'inverter-mode');
    enter.append('text').attr('class', 'inverter-bus');
    enter.append('text').attr('class', 'inverter-metrics-1');
    enter.append('text').attr('class', 'inverter-metrics-2');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, { key: string; inverter: InverterSnapshot; y: number }, SVGGElement, unknown>);

    merged.attr('transform', item => `translate(0, ${item.y})`);

    merged.select('rect.inverter-card-bg')
      .attr('x', 0.5).attr('y', 0.5).attr('rx', layout.cardCornerRadius).attr('ry', layout.cardCornerRadius)
      .attr('width', WidgetInverterComponent.VIEWBOX_WIDTH - 1).attr('height', cardHeight - 1)
      .attr('stroke', 'var(--mat-sys-outline-variant)').attr('stroke-width', 0.5).attr('fill', 'none');

    merged.select('rect.inverter-state-bar')
      .attr('x', 1.5).attr('y', 1.5).attr('rx', layout.stateBarCornerRadius).attr('ry', layout.stateBarCornerRadius)
      .attr('width', 3).attr('height', cardHeight - 3)
      .attr('fill', item => snapshot.displayModels[item.key]?.stateBarColor ?? snapshot.widgetColors.dim);

    if (snapshot.inverters.length > 1) {
      merged.select('text.inverter-title')
        .attr('x', layout.titleX).attr('y', layout.titleY).attr('font-size', layout.titleFontSize)
        .attr('fill', item => snapshot.displayModels[item.key]?.titleTextColor ?? 'var(--kip-contrast-color)')
        .text(item => snapshot.displayModels[item.key]?.titleText ?? this.resolveTitleText(item.inverter));
    } else {
      merged.select('text.inverter-title').text('');
    }

    merged.select('text.inverter-id')
      .attr('x', layout.idX).attr('y', layout.idY).attr('text-anchor', 'end').attr('font-size', layout.idFontSize)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.inverter.id);

    merged.select('text.inverter-mode')
      .attr('x', layout.metaLeftX).attr('y', layout.metaY).attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.key]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.key]?.modeText ?? '');

    merged.select('text.inverter-bus')
      .attr('x', layout.metaRightX).attr('y', layout.metaY).attr('text-anchor', 'end').attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.key]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.key]?.busText ?? '');

    merged.select('text.inverter-metrics-1')
      .attr('x', layout.lineOneX).attr('y', layout.lineOneY).attr('font-size', layout.lineOneFontSize)
      .attr('fill', item => snapshot.displayModels[item.key]?.primaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.key]?.metricsLineOne ?? '');

    merged.select('text.inverter-metrics-2')
      .attr('x', layout.lineTwoX).attr('y', layout.lineTwoY).attr('font-size', layout.lineTwoFontSize)
      .attr('opacity', 0.85)
      .attr('fill', item => snapshot.displayModels[item.key]?.secondaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.key]?.metricsLineTwo ?? '');

    selection.exit().remove();
  }

  private displayName(inverter: InverterSnapshot): string {
    return inverter.name?.trim() || inverter.id;
  }

  private resolveTitleText(inverter: InverterSnapshot): string {
    return inverter.name || `Inverter ${inverter.id}`;
  }

  private buildMetricRows(inverter: InverterSnapshot): [string, string] {
    const mode = this.cardMode();
    if (this.activeDisplayMode() === 'full') {
      // Show AC input metrics if available, otherwise show AC output metrics
      const hasAcInData = inverter.acInVoltage != null || inverter.acInCurrent != null;
      const acInVoltageStr = this.formatValue(inverter.acInVoltage, 'V');
      const acInCurrentStr = this.formatValue(inverter.acInCurrent, 'A');
      const acOutVoltageStr = this.formatValue(inverter.acOutVoltage ?? inverter.acVoltage, 'V');
      const acOutFreqStr = this.formatValue(inverter.acOutFrequency ?? inverter.acFrequency, 'Hz');

      return [
        `DC ${this.formatValue(inverter.dcVoltage, 'V')}  ${this.formatValue(inverter.dcCurrent, 'A')}`,
        hasAcInData
          ? `ACin ${acInVoltageStr}  ${acInCurrentStr}`
          : `AC ${acOutVoltageStr}  ${acOutFreqStr}`
      ];
    }

    const metricLabels = mode.metrics
      .map(metric => this.toMetricLabel(metric, inverter))
      .filter((label): label is string => !!label);

    if (!metricLabels.length) return ['DC -  -', 'AC -  -'];
    return [metricLabels.slice(0, 2).join('   ') || ' ', metricLabels.slice(2, 4).join('   ') || ' '];
  }

  private toMetricLabel(metric: string, inverter: InverterSnapshot): string | null {
    switch (metric) {
      case 'dcVoltage': return `DC V ${this.formatValue(inverter.dcVoltage, 'V')}`;
      case 'dcCurrent': return `DC A ${this.formatValue(inverter.dcCurrent, 'A')}`;
      case 'dcPower': return `DC P ${this.formatValue(inverter.dcPower, 'W')}`;
      case 'acVoltage': return `AC V ${this.formatValue(inverter.acVoltage, 'V')}`;
      case 'acCurrent': return `AC A ${this.formatValue(inverter.acCurrent, 'A')}`;
      case 'acFrequency': return `Hz ${this.formatValue(inverter.acFrequency, 'Hz')}`;
      case 'acInVoltage': return `ACin V ${this.formatValue(inverter.acInVoltage, 'V')}`;
      case 'acInCurrent': return `ACin A ${this.formatValue(inverter.acInCurrent, 'A')}`;
      case 'acInFrequency': return `ACin Hz ${this.formatValue(inverter.acInFrequency, 'Hz')}`;
      case 'acInPower': return `ACin P ${this.formatValue(inverter.acInPower, 'W')}`;
      case 'acOutVoltage': return `ACout V ${this.formatValue(inverter.acOutVoltage, 'V')}`;
      case 'acOutCurrent': return `ACout A ${this.formatValue(inverter.acOutCurrent, 'A')}`;
      case 'acOutFrequency': return `ACout Hz ${this.formatValue(inverter.acOutFrequency, 'Hz')}`;
      case 'acOutPower': return `ACout P ${this.formatValue(inverter.acOutPower, 'W')}`;
      case 'acIn1CurrentLimit': return `ACin1 Lim ${this.formatValue(inverter.acIn1CurrentLimit, 'A')}`;
      case 'acInCurrentLimit': return `ACin Lim ${this.formatValue(inverter.acInCurrentLimit, 'A')}`;
      case 'temperature': return `T ${this.formatTemperature(inverter.temperature)}`;
      case 'inverterModeNumber': return `Mode# ${inverter.inverterModeNumber?.toString() ?? '-'}`;
      default: return null;
    }
  }

  private formatValue(value: number | null | undefined, unit: string): string {
    if (value == null || Number.isNaN(value)) return '-';
    return `${value.toFixed(1)} ${unit}`;
  }

  private formatTemperature(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) return '-';
    return `${value.toFixed(1)} ${this.units.getDefaults().Temperature === 'celsius' ? '°C' : '°F'}`;
  }

  private toStringValue(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
  }

  private resolveMostSevereState(...states: (TState | null | undefined)[]): TState | null {
    if (states.some(s => s === States.Alert)) return States.Alert;
    if (states.some(s => s === States.Alarm)) return States.Alarm;
    if (states.some(s => s === States.Warn)) return States.Warn;
    if (states.some(s => s === States.Normal)) return States.Normal;
    return null;
  }

  private toNumber(value: unknown, unitHint: string): number | null {
    if (value == null || typeof value === 'boolean') return null;
    const rawNumber = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(rawNumber)) return null;
    const converted = this.units.convertToUnit(unitHint, rawNumber);
    return typeof converted === 'number' && Number.isFinite(converted) ? converted : null;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'number') {
      if (value === 1) return true;
      if (value === 0) return false;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === '1' || normalized === 'on') return true;
      if (normalized === 'false' || normalized === '0' || normalized === 'off') return false;
    }

    return null;
  }
}
