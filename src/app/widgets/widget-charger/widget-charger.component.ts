import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as d3 from 'd3';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { States, TState } from '../../core/interfaces/signalk-interfaces';
import { UnitsService } from '../../core/services/units.service';
import { getColors, resolveZoneAwareColor } from '../../core/utils/themeColors.utils';
import { getElectricalWidgetFamilyDescriptor } from '../../core/contracts/electrical-widget-family.contract';
import type { ElectricalCardDisplayMode } from '../../core/contracts/electrical-topology-card.contract';
import type { ElectricalTrackedDevice, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';
import type { ChargerDisplayModel, ChargerSnapshot, ChargerWidgetConfig, ElectricalCardModeConfig } from './widget-charger.types';
import { ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT, ELECTRICAL_DIRECT_CARD_FULL_LAYOUT, ELECTRICAL_DIRECT_CARD_GAP, ELECTRICAL_DIRECT_CARD_HEIGHT, ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH, ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT } from '../shared/electrical-card-layout.constants';

interface ChargerRenderSnapshot {
  chargers: ChargerSnapshot[];
  displayModels: Record<string, ChargerDisplayModel>;
  widgetColors: ReturnType<typeof getColors>;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Component({
  selector: 'widget-charger',
  templateUrl: './widget-charger.component.html',
  styleUrl: './widget-charger.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetChargerComponent implements AfterViewInit, OnDestroy {
  private static readonly CHARGER_DESCRIPTOR = getElectricalWidgetFamilyDescriptor('widget-charger');
  private static readonly SELF_ROOT_PATH = (() => {
    const root = WidgetChargerComponent.CHARGER_DESCRIPTOR?.selfRootPath;
    if (!root) throw new Error('[WidgetChargerComponent] Descriptor missing or selfRootPath not set; check widget registration.');
    return root;
  })();
  private static readonly ROOT_PATTERN = `${WidgetChargerComponent.SELF_ROOT_PATH}.*`;
  private static readonly PATH_REGEX = new RegExp(`^${escapeRegex(WidgetChargerComponent.SELF_ROOT_PATH)}\\.([^.]+)\\.(.+)$`);
  private static readonly VIEWBOX_WIDTH = ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH;
  private static readonly CARD_HEIGHT = ELECTRICAL_DIRECT_CARD_HEIGHT;
  private static readonly COMPACT_CARD_HEIGHT = ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT;
  private static readonly CARD_GAP = ELECTRICAL_DIRECT_CARD_GAP;
  private static readonly PATH_BATCH_WINDOW_MS = 500;

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    color: 'contrast',
    ignoreZones: false,
    charger: {
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

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('chargerSvg');
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private layer?: d3.Selection<SVGGElement, unknown, null, undefined>;

  private readonly pendingPathUpdates = new Map<string, { id: string; key: string; source: string | null; value: unknown; state: TState | null }>();
  private pathBatchTimerId: number | null = null;
  private initialPathPaintDone = false;
  private renderFrameId: number | null = null;
  private pendingRenderSnapshot: ChargerRenderSnapshot | null = null;

  protected readonly discoveredChargerIds = signal<string[]>([]);
  protected readonly trackedDevices = signal<ElectricalTrackedDevice[]>([]);
  protected readonly optionsById = signal<ChargerWidgetConfig['optionsById']>({});
  protected readonly cardMode = signal<ElectricalCardModeConfig>({ displayMode: 'full', metrics: ['voltage', 'current', 'power', 'temperature'] });
  protected readonly chargersByKey = signal<Record<string, ChargerSnapshot>>({});

  protected readonly visibleChargerKeys = computed(() => {
    const tracked = this.trackedDevices();
    if (tracked.length) return tracked.map(d => d.key);
    const map = this.chargersByKey();
    const ids = new Set(this.discoveredChargerIds());
    const keys = Object.keys(map)
      .filter(key => {
        const snapshot = map[key];
        return !!snapshot && ids.has(snapshot.id);
      })
      .sort((a, b) => a.localeCompare(b));

    // If a source-qualified key exists for an id, suppress the legacy plain-id key.
    const hasQualifiedKeyById = new Map<string, boolean>();
    keys.forEach(key => {
      const snapshot = map[key];
      if (!snapshot) return;
      if (key !== snapshot.id) {
        hasQualifiedKeyById.set(snapshot.id, true);
      }
    });

    return keys.filter(key => {
      const snapshot = map[key];
      if (!snapshot) return false;
      if (key !== snapshot.id) return true;
      return !hasQualifiedKeyById.get(snapshot.id);
    });
  });

  protected readonly visibleChargers = computed<ChargerSnapshot[]>(() => {
    const keys = this.visibleChargerKeys();
    const map = this.chargersByKey();
    return keys.map(key => map[key]).filter((item): item is ChargerSnapshot => !!item);
  });

  protected readonly hasChargers = computed(() => this.visibleChargers().length > 0);
  protected readonly activeDisplayMode = computed<ElectricalCardDisplayMode>(() => this.renderMode() ?? this.cardMode().displayMode ?? 'full');
  protected readonly isCompactCardMode = computed(() => this.activeDisplayMode() === 'compact');
  protected readonly colorRole = computed(() => this.runtime.options()?.color ?? 'contrast');
  protected readonly ignoreZones = computed(() => this.runtime.options()?.ignoreZones ?? false);

  protected readonly widgetColors = computed(() => {
    const theme = this.theme();
    if (!theme) return null;
    return getColors(this.colorRole(), theme);
  });

  protected readonly displayModels = computed<Record<string, ChargerDisplayModel>>(() => {
    const chargers = this.visibleChargers();
    const theme = this.theme();
    const widgetColors = this.widgetColors();
    const ignoreZones = this.ignoreZones();

    const idCount = new Map<string, number>();
    chargers.forEach(charger => idCount.set(charger.id, (idCount.get(charger.id) ?? 0) + 1));
    const duplicateIds = new Set<string>(
      [...idCount.entries()].filter(([, count]) => count > 1).map(([id]) => id)
    );

    const models: Record<string, ChargerDisplayModel> = {};
    for (const charger of chargers) {
      const modelKey = charger.deviceKey ?? charger.id;
      const showSource = !!charger.source && duplicateIds.has(charger.id);
      const aggregateState = this.resolveMostSevereState(
        charger.powerState ?? null,
        charger.currentState ?? null,
        charger.voltageState ?? null,
        charger.temperatureState ?? null,
        charger.chargingModeState ?? null,
        charger.modeState ?? null,
        charger.stateState ?? null,
        charger.errorState ?? null,
        charger.offReasonState ?? null
      );
      const primaryState = this.resolveMostSevereState(charger.voltageState ?? null, charger.currentState ?? null);
      const secondaryState = this.resolveMostSevereState(charger.powerState ?? null, charger.temperatureState ?? null);
      const [metricsLineOne, metricsLineTwo] = this.buildMetricRows(charger);

      models[modelKey] = {
        id: charger.id,
        source: charger.source ?? null,
        deviceKey: charger.deviceKey,
        titleText: this.displayName(charger),
        modeText: this.isCompactCardMode() ? '' : this.resolveModeText(charger),
        busText: this.isCompactCardMode() ? '' : (
          showSource ? (charger.source ?? '-') : (charger.associatedBus || charger.location || '-')
        ),
        metricsLineOne,
        metricsLineTwo,
        stateBarColor: resolveZoneAwareColor(
          aggregateState,
          widgetColors?.dim ?? 'var(--kip-contrast-color)',
          theme,
          ignoreZones
        ),
        titleTextColor: resolveZoneAwareColor(
          aggregateState,
          'var(--kip-contrast-color)',
          theme,
          ignoreZones
        ),
        metaTextColor: resolveZoneAwareColor(
          this.resolveMostSevereState(charger.chargingModeState ?? null, charger.modeState ?? null),
          'var(--kip-contrast-dim-color)',
          theme,
          ignoreZones
        ),
        primaryMetricsTextColor: resolveZoneAwareColor(
          primaryState,
          'var(--kip-contrast-color)',
          theme,
          ignoreZones
        ),
        secondaryMetricsTextColor: resolveZoneAwareColor(
          secondaryState,
          'var(--kip-contrast-color)',
          theme,
          ignoreZones
        )
      };
    }

    return models;
  });

  constructor() {
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) {
        return;
      }

      untracked(() => this.applyConfig(cfg));
    });

    effect(() => {
      const models = this.displayModels();
      const chargers = this.visibleChargers();
      const widgetColors = this.widgetColors();
      if (!this.svg || !widgetColors) return;
      this.requestRender({ chargers, displayModels: models, widgetColors });
    });

    const chargerTrees = [
      this.data.subscribePathTreeWithInitial(WidgetChargerComponent.ROOT_PATTERN)
    ];

    let hasInitialUpdates = false;
    for (const tree of chargerTrees) {
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

    for (const tree of chargerTrees) {
      tree.live$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(update => {
          this.enqueuePathUpdate(update);
        });
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
      .attr('viewBox', `0 0 ${WidgetChargerComponent.VIEWBOX_WIDTH} ${WidgetChargerComponent.CARD_HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Charger View');

    this.layer = this.svg.append('g').attr('class', 'charger-layer');
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const chargerCfg = this.resolveChargerConfig(cfg);
    this.trackedDevices.set(chargerCfg.trackedDevices ?? []);
    this.reprojectSnapshotsToDeviceKeys(chargerCfg.trackedDevices ?? []);
    this.optionsById.set(chargerCfg.optionsById);
    this.cardMode.set(this.normalizeCardMode(chargerCfg.cardMode));
  }

  private resolveChargerConfig(cfg: IWidgetSvcConfig): ChargerWidgetConfig {
    const charger = cfg.charger;
    return {
      trackedDevices: this.normalizeTrackedDevices(charger?.trackedDevices),
      optionsById: this.normalizeOptionsById(charger?.optionsById),
      cardMode: this.normalizeCardMode(charger?.cardMode)
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

  private reprojectSnapshotsToDeviceKeys(devices: ElectricalTrackedDevice[]): void {
    if (!devices.length) return;

    const idToKeys = new Map<string, string[]>();
    const devicesByKey = new Map<string, ElectricalTrackedDevice>();
    devices.forEach(d => {
      const existing = idToKeys.get(d.id) ?? [];
      existing.push(d.key);
      idToKeys.set(d.id, existing);
      devicesByKey.set(d.key, d);
    });

    this.chargersByKey.update(current => {
      let next = current;
      let changed = false;

      idToKeys.forEach((keys, id) => {
        const sourceSnapshot = current[id];
        if (!sourceSnapshot) return;

        for (const deviceKey of keys) {
          if (current[deviceKey]) continue;
          const trackedDevice = devicesByKey.get(deviceKey);
          if (!changed) { next = { ...current }; changed = true; }
          next[deviceKey] = { ...sourceSnapshot, source: trackedDevice?.source ?? null, deviceKey };
        }

        if (next[id] && (next[id].deviceKey === undefined || next[id].deviceKey === id)) {
          if (!changed) {
            next = { ...current };
            changed = true;
          }
          delete next[id];
        }
      });

      return changed ? next : current;
    });
  }

  private normalizeCardMode(value: unknown): ElectricalCardModeConfig {
    const candidate = (value && typeof value === 'object') ? value as { displayMode?: unknown; metrics?: unknown } : null;
    const metrics = this.normalizeStringList(candidate?.metrics);
    return {
      displayMode: candidate?.displayMode === 'compact' ? 'compact' : 'full',
      metrics: metrics.length ? metrics : ['voltage', 'current', 'power', 'temperature']
    };
  }

  private normalizeStringList(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    const ids = new Set<string>();
    value.forEach(item => {
      if (typeof item !== 'string') {
        return;
      }

      const normalized = item.trim();
      if (normalized.length > 0) {
        ids.add(normalized);
      }
    });

    return [...ids].sort((left, right) => left.localeCompare(right));
  }

  private normalizeOptionsById(value: unknown): ChargerWidgetConfig['optionsById'] {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const entries = Object.entries(value as Record<string, unknown>);
    const next: ChargerWidgetConfig['optionsById'] = {};
    entries.forEach(([id, option]) => {
      const normalizedId = this.normalizeOptionalString(id);
      if (!normalizedId) {
        return;
      }

      next[normalizedId] = (option && typeof option === 'object') ? {} : {};
    });

    return next;
  }

  private normalizeOptionalString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private enqueuePathUpdate(update: IPathUpdateWithPath, fromInitial = false): void {
    const parsed = this.parsePath(update.path);
    if (!parsed) {
      return;
    }

    const value = update.update?.data?.value ?? null;
    const state = update.update?.state ?? null;
    const source = this.extractUpdateSource(update);
    const updateKey = `${parsed.id}::${source ?? '*'}::${parsed.key}`;
    this.pendingPathUpdates.set(updateKey, { id: parsed.id, key: parsed.key, source, value, state });

    if (fromInitial) {
      return;
    }

    if (!this.initialPathPaintDone) {
      this.initialPathPaintDone = true;
      this.flushPendingPathUpdates();
      return;
    }

    if (this.pathBatchTimerId !== null) {
      return;
    }

    this.pathBatchTimerId = window.setTimeout(() => {
      this.pathBatchTimerId = null;
      this.flushPendingPathUpdates();
    }, WidgetChargerComponent.PATH_BATCH_WINDOW_MS);
  }

  private parsePath(path: string): { id: string; key: string } | null {
    const match = path.match(WidgetChargerComponent.PATH_REGEX);
    if (!match) {
      return null;
    }

    return { id: match[1], key: match[2] };
  }

  private flushPendingPathUpdates(): void {
    if (!this.pendingPathUpdates.size) {
      return;
    }

    const updates = Array.from(this.pendingPathUpdates.values());
    this.pendingPathUpdates.clear();

    const uniqueIds = new Set(updates.map(update => update.id));
    uniqueIds.forEach(id => this.trackDiscoveredCharger(id));

    const idToKeys = this.buildIdToDeviceKeysMap();
    const trackedDevicesByKey = new Map<string, ElectricalTrackedDevice>();
    this.trackedDevices().forEach(device => trackedDevicesByKey.set(device.key, device));

    this.chargersByKey.update(current => {
      let nextState = current;
      let changed = false;

      for (const update of updates) {
        const affectedKeys = idToKeys.get(update.id);
        const isTracked = !!affectedKeys?.length;
        let keysToUpdate: string[] = [];

        if (isTracked) {
          if (update.source) {
            const exactDeviceKey = `${update.id}||${update.source}`;
            keysToUpdate = affectedKeys?.includes(exactDeviceKey) ? [exactDeviceKey] : [];
          } else {
            keysToUpdate = affectedKeys ?? [];
          }
        } else {
          keysToUpdate = [update.source ? `${update.id}||${update.source}` : update.id];
        }

        for (const key of keysToUpdate) {
          const trackedDevice = isTracked ? trackedDevicesByKey.get(key) : null;
          const existing = nextState[key] ?? {
            id: update.id,
            source: trackedDevice?.source ?? update.source ?? null,
            deviceKey: isTracked || update.source ? key : undefined
          };
          const next = { ...existing } as ChargerSnapshot;
          const fieldChanged = this.applyValue(next, update.key, update.value, update.state);

          if (!fieldChanged) {
            continue;
          }

          const derivedPower = next.rawPower != null
            ? next.rawPower
            : (next.voltage != null && next.current != null ? next.voltage * next.current : null);
          if (derivedPower != null) {
            next.power = Number.isFinite(derivedPower) ? derivedPower : null;
          } else {
            next.power = null;
          }

          if (next.rawPower == null) {
            next.powerState = this.resolveMostSevereState(next.voltageState ?? null, next.currentState ?? null);
          }

          if (!changed) {
            nextState = { ...nextState };
            changed = true;
          }

          nextState[key] = next;
        }
      }

      return changed ? nextState : current;
    });
  }

  private extractUpdateSource(update: IPathUpdateWithPath): string | null {
    const sourceFromUpdate = this.normalizeOptionalString((update as { source?: unknown }).source);
    if (sourceFromUpdate) {
      return sourceFromUpdate;
    }

    const sourceFromData = this.normalizeOptionalString((update.update?.data as { source?: unknown } | undefined)?.source);
    return sourceFromData ?? null;
  }

  private trackDiscoveredCharger(id: string): void {
    const ids = this.discoveredChargerIds();
    if (ids.includes(id)) {
      return;
    }

    this.discoveredChargerIds.set([...ids, id].sort((left, right) => left.localeCompare(right)));
  }

  private applyValue(snapshot: ChargerSnapshot, key: string, value: unknown, state: TState | null): boolean {
    switch (key) {
      case 'name':
        return this.setValue(snapshot, 'name', this.toStringValue(value));
      case 'location':
        return this.setValue(snapshot, 'location', this.toStringValue(value));
      case 'associatedBus':
        return this.setValue(snapshot, 'associatedBus', this.toStringValue(value));
      case 'state':
        return this.setMetricValue(snapshot, 'state', 'stateState', this.toStringValue(value), state);
      case 'offReason':
        return this.setMetricValue(snapshot, 'offReason', 'offReasonState', this.toStringValue(value), state);
      case 'error':
        return this.setMetricValue(snapshot, 'error', 'errorState', this.toStringValue(value), state);
      case 'mode':
        return this.setMetricValue(snapshot, 'mode', 'modeState', this.toStringValue(value), state);
      case 'modeState':
        return this.setMetricValue(snapshot, 'mode', 'modeState', this.toStringValue(value), state);
      case 'modeNumber':
        return this.setMetricValue(snapshot, 'modeNumber', 'modeNumberState', this.toNumber(value, ''), state);
      case 'chargingMode':
        return this.setMetricValue(snapshot, 'chargingMode', 'chargingModeState', this.toStringValue(value), state);
      case 'chargingModeNumber':
        return this.setMetricValue(snapshot, 'chargingModeNumber', 'chargingModeNumberState', this.toNumber(value, ''), state);
      case 'output.voltage': {
        const nextVoltage = this.toNumber(value, 'V');
        const outputChanged = this.setMetricValue(snapshot, 'outputVoltage', 'outputVoltageState', nextVoltage, state);
        const voltageChanged = this.setMetricValue(snapshot, 'voltage', 'voltageState', nextVoltage, state);
        return outputChanged || voltageChanged;
      }
      case 'input.voltage':
        return this.setMetricValue(snapshot, 'inputVoltage', 'inputVoltageState', this.toNumber(value, 'V'), state);
      case 'voltage':
        return this.setMetricValue(snapshot, 'voltage', 'voltageState', this.toNumber(value, 'V'), state);
      case 'current':
        return this.setMetricValue(snapshot, 'current', 'currentState', this.toNumber(value, 'A'), state);
      case 'power':
        return this.setMetricValue(snapshot, 'rawPower', 'powerState', this.toNumber(value, 'W'), state);
      case 'temperature':
        return this.setMetricValue(snapshot, 'temperature', 'temperatureState', this.toNumber(value, this.units.getDefaults().Temperature), state);
      case 'leds.absorption':
        return this.setMetricValue(snapshot, 'ledsAbsorption', 'ledsAbsorptionState', this.toBoolean(value), state);
      case 'leds.bulk':
        return this.setMetricValue(snapshot, 'ledsBulk', 'ledsBulkState', this.toBoolean(value), state);
      case 'leds.float':
        return this.setMetricValue(snapshot, 'ledsFloat', 'ledsFloatState', this.toBoolean(value), state);
      case 'leds.inverter':
        return this.setMetricValue(snapshot, 'ledsInverter', 'ledsInverterState', this.toBoolean(value), state);
      case 'leds.lowBattery':
        return this.setMetricValue(snapshot, 'ledsLowBattery', 'ledsLowBatteryState', this.toBoolean(value), state);
      case 'leds.mains':
        return this.setMetricValue(snapshot, 'ledsMains', 'ledsMainsState', this.toBoolean(value), state);
      case 'leds.overload':
        return this.setMetricValue(snapshot, 'ledsOverload', 'ledsOverloadState', this.toBoolean(value), state);
      case 'leds.temperature':
        return this.setMetricValue(snapshot, 'ledsTemperature', 'ledsTemperatureState', this.toBoolean(value), state);
      default:
        return false;
    }
  }

  private setValue<K extends keyof ChargerSnapshot>(
    target: ChargerSnapshot,
    key: K,
    nextValue: ChargerSnapshot[K]
  ): boolean {
    if (Object.is(target[key], nextValue)) {
      return false;
    }

    target[key] = nextValue;
    return true;
  }

  private setMetricValue<K extends keyof ChargerSnapshot, S extends keyof ChargerSnapshot>(
    target: ChargerSnapshot,
    key: K,
    stateKey: S,
    nextValue: ChargerSnapshot[K],
    state: TState | null
  ): boolean {
    const valueChanged = !Object.is(target[key], nextValue);
    const stateChanged = !Object.is(target[stateKey], state);
    if (!valueChanged && !stateChanged) {
      return false;
    }

    target[key] = nextValue;
    target[stateKey] = state as ChargerSnapshot[S];
    return true;
  }

  private requestRender(snapshot?: ChargerRenderSnapshot): void {
    const widgetColors = this.widgetColors();
    if (!this.svg || !widgetColors) {
      return;
    }

    this.pendingRenderSnapshot = snapshot ?? {
      chargers: this.visibleChargers(),
      displayModels: this.displayModels(),
      widgetColors
    };
    if (this.renderFrameId !== null) {
      return;
    }

    this.renderFrameId = requestAnimationFrame(() => {
      this.renderFrameId = null;
      const nextSnapshot = this.pendingRenderSnapshot;
      this.pendingRenderSnapshot = null;
      if (!nextSnapshot) {
        return;
      }

      this.render(nextSnapshot);
    });
  }

  private render(snapshot: ChargerRenderSnapshot): void {
    if (!this.layer || !this.svg) {
      return;
    }

    const compact = this.isCompactCardMode();
    const layout = compact ? ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT : ELECTRICAL_DIRECT_CARD_FULL_LAYOUT;
    const cardHeight = compact ? WidgetChargerComponent.COMPACT_CARD_HEIGHT : WidgetChargerComponent.CARD_HEIGHT;
    const cards = snapshot.chargers.map((charger, index) => ({
      key: charger.deviceKey ?? charger.id,
      id: charger.id,
      charger,
      y: index * (cardHeight + WidgetChargerComponent.CARD_GAP)
    }));
    const contentHeight = cards.length
      ? cards[cards.length - 1].y + cardHeight
      : cardHeight;

    this.svg.attr('viewBox', `0 0 ${WidgetChargerComponent.VIEWBOX_WIDTH} ${contentHeight}`);

    const selection = this.layer
      .selectAll<SVGGElement, { key: string; id: string; charger: ChargerSnapshot; y: number }>('g.charger-card')
      .data(cards, item => item.key);

    const enter = selection.enter().append('g').attr('class', 'charger-card');
    enter.append('rect').attr('class', 'charger-card-bg');
    enter.append('rect').attr('class', 'charger-state-bar');
    enter.append('text').attr('class', 'charger-title');
    enter.append('text').attr('class', 'charger-id');
    enter.append('text').attr('class', 'charger-mode');
    enter.append('text').attr('class', 'charger-bus');
    enter.append('text').attr('class', 'charger-metrics-1');
    enter.append('text').attr('class', 'charger-metrics-2');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, { key: string; id: string; charger: ChargerSnapshot; y: number }, SVGGElement, unknown>);

    merged.attr('transform', item => `translate(0, ${item.y})`);
    merged.select('rect.charger-card-bg')
      .attr('x', 0.5)
      .attr('y', 0.5)
      .attr('rx', layout.cardCornerRadius)
      .attr('ry', layout.cardCornerRadius)
      .attr('width', WidgetChargerComponent.VIEWBOX_WIDTH - 1)
      .attr('height', cardHeight - 1)
      .attr('stroke', 'var(--mat-sys-outline-variant)')
      .attr('stroke-width', 0.5)
      .attr('fill', 'none');

    merged.select('rect.charger-state-bar')
      .attr('x', 1.5)
      .attr('y', 1.5)
      .attr('rx', layout.stateBarCornerRadius)
      .attr('ry', layout.stateBarCornerRadius)
      .attr('width', 3)
      .attr('height', cardHeight - 3)
      .attr('fill', item => snapshot.displayModels[item.key]?.stateBarColor ?? snapshot.widgetColors.dim);

    merged.select('text.charger-title')
      .attr('x', layout.titleX)
      .attr('y', layout.titleY)
      .attr('font-size', layout.titleFontSize)
      .attr('fill', item => snapshot.displayModels[item.key]?.titleTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.key]?.titleText ?? this.displayName(item.charger));

    merged.select('text.charger-id')
      .attr('x', layout.idX)
      .attr('y', layout.idY)
      .attr('text-anchor', 'end')
      .attr('font-size', layout.idFontSize)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.charger.id);

    merged.select('text.charger-mode')
      .attr('x', layout.metaLeftX)
      .attr('y', layout.metaY)
      .attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.key]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.key]?.modeText ?? '');

    merged.select('text.charger-bus')
      .attr('x', layout.metaRightX)
      .attr('y', layout.metaY)
      .attr('text-anchor', 'end')
      .attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.key]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.key]?.busText ?? '');

    merged.select('text.charger-metrics-1')
      .attr('x', layout.lineOneX)
      .attr('y', layout.lineOneY)
      .attr('font-size', layout.lineOneFontSize)
      .attr('fill', item => snapshot.displayModels[item.key]?.primaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.key]?.metricsLineOne ?? '');

    merged.select('text.charger-metrics-2')
      .attr('x', layout.lineTwoX)
      .attr('y', layout.lineTwoY)
      .attr('font-size', layout.lineTwoFontSize)
      .attr('opacity', 0.85)
      .attr('fill', item => snapshot.displayModels[item.key]?.secondaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.key]?.metricsLineTwo ?? '');

    selection.exit().remove();
  }

  private displayName(charger: ChargerSnapshot): string {
    return charger.name?.trim() || charger.id;
  }

  private resolveModeText(charger: ChargerSnapshot): string {
    if (charger.chargingMode) {
      return `Mode ${charger.chargingMode}`;
    }

    if (charger.mode) {
      return `Mode ${charger.mode}`;
    }

    const ledModes: { active: boolean | null | undefined; label: string }[] = [
      { active: charger.ledsAbsorption, label: 'Absorption' },
      { active: charger.ledsBulk, label: 'Bulk' },
      { active: charger.ledsFloat, label: 'Float' },
      { active: charger.ledsInverter, label: 'Inverter' },
      { active: charger.ledsLowBattery, label: 'Low Battery' },
      { active: charger.ledsMains, label: 'Mains' },
      { active: charger.ledsOverload, label: 'Overload' },
      { active: charger.ledsTemperature, label: 'Temperature' }
    ];

    const activeLabels = ledModes
      .filter(item => item.active === true)
      .map(item => item.label);

    if (activeLabels.length) {
      return `Mode ${activeLabels.join(' / ')}`;
    }

    return 'Mode -';
  }

  private buildMetricRows(charger: ChargerSnapshot): [string, string] {
    const mode = this.cardMode();
    if (this.activeDisplayMode() === 'full') {
      return [
        `V ${this.formatValue(charger.voltage, 'V')}   A ${this.formatValue(charger.current, 'A')}`,
        `P ${this.formatValue(charger.power, 'W')}   T ${this.formatTemperature(charger.temperature)}`
      ];
    }

    const metricLabels = mode.metrics
      .map(metric => this.toMetricLabel(metric, charger))
      .filter((label): label is string => !!label);

    if (!metricLabels.length) {
      return ['V -   A -', 'P -   T -'];
    }

    const first = metricLabels.slice(0, 2).join('   ');
    const second = metricLabels.slice(2, 4).join('   ');
    return [first || ' ', second || ' '];
  }

  private toMetricLabel(metric: string, charger: ChargerSnapshot): string | null {
    switch (metric) {
      case 'voltage':
        return `V ${this.formatValue(charger.voltage, 'V')}`;
      case 'current':
        return `A ${this.formatValue(charger.current, 'A')}`;
      case 'power':
        return `P ${this.formatValue(charger.power, 'W')}`;
      case 'temperature':
        return `T ${this.formatTemperature(charger.temperature)}`;
      default:
        return null;
    }
  }

  private formatValue(value: number | null | undefined, unit: string): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toFixed(1)} ${unit}`;
  }

  private formatTemperature(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toFixed(1)} ${this.units.getDefaults().Temperature === 'celsius' ? '°C' : '°F'}`;
  }

  private toStringValue(value: unknown): string | null {
    return typeof value === 'string' ? value : null;
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

  private resolveMostSevereState(...states: (TState | null | undefined)[]): TState | null {
    if (states.some(state => state === States.Alert)) return States.Alert;
    if (states.some(state => state === States.Alarm)) return States.Alarm;
    if (states.some(state => state === States.Warn)) return States.Warn;
    if (states.some(state => state === States.Normal)) return States.Normal;
    return null;
  }

  private toNumber(value: unknown, unitHint: string): number | null {
    if (value == null || typeof value === 'boolean') {
      return null;
    }

    const rawNumber = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(rawNumber)) {
      return null;
    }

    const converted = this.units.convertToUnit(unitHint, rawNumber);
    return Number.isFinite(converted) ? converted : rawNumber;
  }
}
