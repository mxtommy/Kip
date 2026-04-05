import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as d3 from 'd3';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { States, TState } from '../../core/interfaces/signalk-interfaces';
import { UnitsService } from '../../core/services/units.service';
import { getColors } from '../../core/utils/themeColors.utils';
import { getElectricalWidgetFamilyDescriptor } from '../../core/contracts/electrical-widget-family.contract';
import type { ElectricalCardDisplayMode } from '../../core/contracts/electrical-topology-card.contract';
import type { ElectricalTrackedDevice, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';
import type { ChargerDisplayModel, ChargerSnapshot } from './widget-charger.types';
import { ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT, ELECTRICAL_DIRECT_CARD_FULL_LAYOUT, ELECTRICAL_DIRECT_CARD_GAP, ELECTRICAL_DIRECT_CARD_HEIGHT, ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH, ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT } from '../shared/electrical-card-layout.constants';
import { WidgetTitleComponent } from '../../core/components/widget-title/widget-title.component';

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
  imports: [WidgetTitleComponent],
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
  private static readonly CHARGER_DISPLAY_BASE_WIDTH = 145;
  private static readonly CHARGER_DISPLAY_BASE_HEIGHT = 37;
  private static readonly CHARGER_DISPLAY_HORIZONTAL_MARGIN = 40;

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
  protected readonly isCompactCardMode = computed(() => this.renderMode() === 'compact');
  protected readonly colorRole = computed(() => this.runtime.options()?.color ?? 'contrast');
  protected readonly ignoreZones = computed(() => this.runtime.options()?.ignoreZones ?? false);
  protected readonly displayLabel = computed(() => {
    const chargers = this.visibleChargers();
    if (chargers.length !== 1) {
      return 'Chargers';
    }

    return this.resolveTitleText(chargers[0]);
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

  protected readonly displayModels = computed<Record<string, ChargerDisplayModel>>(() => {
    const chargers = this.visibleChargers();

    const idCount = new Map<string, number>();
    chargers.forEach(charger => idCount.set(charger.id, (idCount.get(charger.id) ?? 0) + 1));
    const duplicateIds = new Set<string>(
      [...idCount.entries()].filter(([, count]) => count > 1).map(([id]) => id)
    );

    const models: Record<string, ChargerDisplayModel> = {};
    for (const charger of chargers) {
      const modelKey = charger.deviceKey ?? charger.id;
      const showSource = !!charger.source && duplicateIds.has(charger.id);
      const [voltageText, currentText, powerText, temperatureText] = this.buildMetricRows(charger);

      models[modelKey] = {
        id: charger.id,
        source: charger.source ?? null,
        deviceKey: charger.deviceKey,
        titleText: this.resolveTitleText(charger, showSource),
        modeText: this.isCompactCardMode() ? '' : this.resolveModeText(charger),
        voltageText,
        currentText,
        powerText,
        temperatureText
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
    const trackedDevices = this.normalizeTrackedDevices(cfg.charger?.trackedDevices);
    this.trackedDevices.set(trackedDevices);
    this.reprojectSnapshotsToDeviceKeys(trackedDevices);
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
    const targetDisplayWidth = WidgetChargerComponent.VIEWBOX_WIDTH - WidgetChargerComponent.CHARGER_DISPLAY_HORIZONTAL_MARGIN;
    const displayScale = targetDisplayWidth / WidgetChargerComponent.CHARGER_DISPLAY_BASE_WIDTH;
    const displayWidth = targetDisplayWidth;
    const displayX = (WidgetChargerComponent.VIEWBOX_WIDTH - displayWidth) / 2;
    const titleY = compact ? 8 : layout.titleY;
    const displayY = compact ? 33 : 60;


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
    const shapeGroupEnter = enter.append('g')
      .attr('class', 'charger-display-group');
    /* shapeGroupEnter.insert('rect', ':first-child')
      .attr('class', 'charger-shape-background')
      .attr('x', -6)
      .attr('y', -1)
      .attr('rx', 2)
      .attr('ry', 2)
      .attr('width', WidgetChargerComponent.CHARGER_DISPLAY_BASE_WIDTH + 10)
      .attr('height', WidgetChargerComponent.CHARGER_DISPLAY_BASE_HEIGHT)
      .attr('fill', 'var(--kip-contrast-dimmer-color)')
      .attr('fill-opacity', 0.8)
      .attr('stroke', 'var(--kip-contrast-dimmer-color)')
      .attr('stroke-width', 0)
      .lower(); */
    shapeGroupEnter.append('path')
      .attr('class', 'charger-shape-bulk')
      .attr('d', 'm 39.280608,10.70371 1.604609,-3.7808024 c 0.06926,-0.1631805 0.314475,-0.553581 0.314475,-0.4368876 v 27.475177 c 0,0.116694 -0.142713,0.210638 -0.319983,0.210638 H 9.2681756 c -0.1772706,0 -0.3711555,-0.105758 -0.319983,-0.210638 l 1.2797184,-2.622833 c 1.150699,-2.358403 3.86281,-5.455024 6.286778,-6.406312 3.251217,-1.275942 7.834296,-2.821704 11.746419,-4.103315 4.312764,-1.412861 9.246151,-5.946636 11.0195,-10.125027 z')
      .attr('transform', 'matrix(1.1068428,0,0,1.1601894,-8.804611,-6.1382561)')
      .attr('fill', 'var(--mat-sys-background)')
      .attr('stroke', snapshot.widgetColors.color)
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'miter')
      .attr('stroke-miterlimit', 0)
      .attr('paint-order', 'markers stroke fill');
    shapeGroupEnter.append('rect')
      .attr('class', 'charger-shape-absorption')
      .attr('width', 19.67485)
      .attr('height', 32.383526)
      .attr('x', 40.545158)
      .attr('y', 1.1331999)
      .attr('rx', 0.19520389)
      .attr('ry', 0.24451913)
      .attr('fill', 'var(--mat-sys-background)')
      .attr('stroke', snapshot.widgetColors.color)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'butt')
      .attr('stroke-linejoin', 'miter')
      .attr('stroke-miterlimit', 0)
      .attr('paint-order', 'markers stroke fill');
    shapeGroupEnter.append('path')
      .attr('class', 'charger-shape-float')
      .attr('d', 'm 66.03898,6.4101715 4.16646,3.2472635 c 1.876083,1.462185 5.139444,3.529899 7.448846,4.069504 5.055358,1.181215 11.386089,1.251612 11.38595,1.349059 l -0.02667,18.73082 c 0,0.127151 -0.103075,0.230227 -0.230226,0.230227 H 66.03898 c -0.127151,0 -0.230226,-0.103076 -0.230226,-0.230227 V 6.6403978 c 0,-0.1271504 0.103076,-0.2302261 0.230226,-0.2302263 z')
      .attr('transform', 'matrix(1.1068428,0,0,1.1601894,-8.7228087,-6.1382561)')
      .attr('fill', 'var(--mat-sys-background)')
      .attr('stroke', snapshot.widgetColors.color)
      .attr('stroke-width', 2)
      .attr('stroke-linecap', 'butt')
      .attr('stroke-linejoin', 'miter')
      .attr('stroke-miterlimit', 0)
      .attr('paint-order', 'markers stroke fill');
    shapeGroupEnter.append('path')
      .attr('class', 'charger-shape-storage')
      .attr('d', 'm 93.39395,15.253553 c 2.347866,2.587905 8.59059,4.802212 13.94479,4.852641 11.92289,0.112298 30.60094,0.205911 30.60096,0.259031 l 0.006,13.361558 c 3e-5,0.07786 -0.19912,0.140548 -0.44645,0.140548 h -44.1053 c -0.247332,0 -0.446448,-0.06269 -0.446448,-0.140548 V 15.394101 c 0,-0.07786 0.280259,-0.323728 0.446448,-0.140548 z')
      .attr('transform', 'matrix(1.1077284,0,0,1.1178939,-8.9068494,-4.6850995)')
      .attr('fill', 'var(--mat-sys-background)')
      .attr('stroke', snapshot.widgetColors.color)
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'miter')
      .attr('stroke-miterlimit', 0)
      .attr('paint-order', 'markers stroke fill');
    enter.append('text').attr('class', 'charger-title');
    enter.append('text').attr('class', 'charger-mode');
    const chargerVoltage = enter.append('text').attr('class', 'charger-voltage')
    chargerVoltage.append('tspan').attr('class', 'voltage-metric-value');
    chargerVoltage.append('tspan').attr('class', 'voltage-metric-unit');
    const chargerCurrent = enter.append('text').attr('class', 'charger-current');
    chargerCurrent.append('tspan').attr('class', 'current-metric-value');
    chargerCurrent.append('tspan').attr('class', 'current-metric-unit');
    const chargerPower = enter.append('text').attr('class', 'charger-power');
    chargerPower.append('tspan').attr('class', 'power-metric-value');
    chargerPower.append('tspan').attr('class', 'power-metric-unit');
    const chargerTemperature = enter.append('text').attr('class', 'charger-temperature');
    chargerTemperature.append('tspan').attr('class', 'temperature-metric-value');
    chargerTemperature.append('tspan').attr('class', 'temperature-metric-unit');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, { key: string; id: string; charger: ChargerSnapshot; y: number }, SVGGElement, unknown>);

    merged.attr('transform', item => `translate(0, ${item.y})`);
    merged.select('g.charger-display-group')
      .attr('transform', `translate(${displayX}, ${displayY}) scale(${displayScale})`)
      .each((item, _index, nodes) => {
        const mode = this.resolveShapeMode(item.charger);
        const isPowerSupply = this.isShapeMode(mode, 'power supply');
        const fillOnColor = snapshot.widgetColors.dim;
        const fillOffColor = 'var(--mat-sys-background)';

        const strokeColor = this.isShapeMode(mode, 'sustain') || isPowerSupply
          ? 'none'
          : this.isShapeMode(mode, 'equalization')
            ? 'var(--kip-zone-alert-color)'
            : this.isShapeMode(mode, 'overload')
              ? 'var(--kip-zone-alarm-color)'
              : snapshot.widgetColors.color;

        const shapeGroup = d3.select(nodes[_index]);
        shapeGroup.select('path.charger-shape-bulk')
          .attr('fill', this.isShapeMode(mode, 'bulk') || this.isShapeMode(mode, 'boost') || isPowerSupply ? fillOnColor : fillOffColor)
          .attr('stroke', strokeColor);
        shapeGroup.select('rect.charger-shape-absorption')
          .attr('fill', this.isShapeMode(mode, 'absorption') || isPowerSupply ? fillOnColor : fillOffColor)
          .attr('stroke', strokeColor);
        shapeGroup.select('path.charger-shape-float')
          .attr('fill', this.isShapeMode(mode, 'float') || isPowerSupply ? fillOnColor : fillOffColor)
          .attr('stroke', strokeColor);
        shapeGroup.select('path.charger-shape-storage')
          .attr('fill', this.isShapeMode(mode, 'storage') || isPowerSupply ? fillOnColor : fillOffColor)
          .attr('stroke', strokeColor);
      });

    if (snapshot.chargers.length > 1) {
      merged.select('text.charger-title')
        .attr('x', layout.titleX)
        .attr('y', titleY)
        .attr('font-size', layout.titleFontSize)
        .attr('fill', 'var(--kip-contrast-dim-color)')
        .text(item => snapshot.displayModels[item.key]?.titleText ?? this.resolveTitleText(item.charger));
    } else {
      merged.select('text.charger-title').text('');
    }

    merged.select('text.charger-voltage')
      .attr('x', 197)
      .attr('y', 25)
      .attr('text-anchor', 'end')
      .attr('font-size', layout.primaryFontSize)
      .attr('font-weight', layout.primaryFontWeight)
      .attr('fill', 'var(--kip-contrast-color)');

    merged.select('tspan.voltage-metric-value')
      .text(item => snapshot.displayModels[item.key]?.voltageText ?? '');

    merged.select('tspan.voltage-metric-unit')
      .attr('dx', 1)
      .attr('font-size', 22)
      .attr('font-weight', 500)
      .attr('fill', 'var(--kip-contrast-color)')
      .text('V');

    merged.select('text.charger-current')
      .attr('x', 197)
      .attr('y', 48)
      .attr('text-anchor', 'end')
      .attr('font-size', layout.lineOneFontSize)
      .attr('fill', 'var(--kip-contrast-color)');

    merged.select('tspan.current-metric-value')
      .text(item => snapshot.displayModels[item.key]?.currentText ?? '');

    merged.select('tspan.current-metric-unit')
      .attr('dx', 1)
      .attr('font-size', 12)
      .attr('fill', 'var(--kip-contrast-color)')
      .text('A');

    merged.select('text.charger-power')
      .attr('x', 5)
      .attr('y', 22)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('font-size', 10);

    merged.select('tspan.power-metric-value')
      .text(item => snapshot.displayModels[item.key]?.powerText ?? '');

    merged.select('tspan.power-metric-unit')
      .attr('dx', 1)
      .attr('font-size', 6)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text('W');

    merged.select('text.charger-temperature')
      .attr('x', 5)
      .attr('y', 34)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('font-size', 10);

    merged.select('tspan.temperature-metric-value')
      .text(item => snapshot.displayModels[item.key]?.temperatureText ?? '');

    merged.select('tspan.temperature-metric-unit')
      .attr('dx', 1)
      .attr('font-size', 6)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(`${this.units.getDefaults().Temperature === 'celsius' ? '°C' : '°F'}`);

    merged.select('text.charger-mode')
      .attr('x', 5)
      .attr('y', 46)
      .attr('font-size', 10)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.key]?.modeText ?? '');

    selection.exit().remove();
  }

  private resolveTitleText(charger: ChargerSnapshot, includeSource = false): string {
    const baseTitle = charger.name || `Charger ${charger.id}`;
    if (!includeSource || !charger.source) {
      return baseTitle;
    }

    return `${baseTitle} [${charger.source}]`;
  }

  private resolveModeText(charger: ChargerSnapshot): string {
    if (charger.chargingMode) {
      return `Mode: ${charger.chargingMode.charAt(0).toUpperCase() + charger.chargingMode.slice(1)}`;
    }

    if (charger.mode) {
      return `Mode: ${charger.mode}`;
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
      return `Mode: ${activeLabels.join(' / ')}`;
    }

    return 'Mode --';
  }

  private resolveShapeMode(charger: ChargerSnapshot): string {
    const mode = charger.chargingMode ?? charger.mode ?? '';
    return mode.trim().toLowerCase();
  }

  private isShapeMode(mode: string, expected: string): boolean {
    if (!mode || !expected) {
      return false;
    }

    return mode === expected || mode.includes(expected);
  }

  private buildMetricRows(charger: ChargerSnapshot): [string, string, string, string] {
    if (this.renderMode() === 'full' || this.renderMode() === null) {
      return [
        `${this.formatValue(charger.voltage, 1)}`,
        `${this.formatValue(charger.current, 1)}`,
        `Power: ${this.formatValue(charger.power, 0)}`,
        `Temp: ${this.formatTemperature(charger.temperature)}`
      ];
    } else {
      return [
        `${this.formatValue(charger.voltage, 1)}`,
        `${this.formatValue(charger.current, 1)}`,
        `P: ${this.formatValue(charger.power, 0)}`,
        `T: ${this.formatTemperature(charger.temperature)}`
      ];
    }
  }

  private formatValue(value: number | null | undefined, decimal: number): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toFixed(decimal)}`;
  }

  private formatTemperature(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toFixed(0)}`;
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
