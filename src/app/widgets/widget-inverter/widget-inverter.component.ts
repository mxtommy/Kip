import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as d3 from 'd3';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import type { ITheme } from '../../core/services/app-service';
import { States, TState } from '../../core/interfaces/signalk-interfaces';
import type { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { UnitsService } from '../../core/services/units.service';
import { getColors, resolveZoneAwareColor } from '../../core/utils/themeColors.utils';
import { getElectricalWidgetFamilyDescriptor } from '../../core/contracts/electrical-widget-family.contract';
import {
  ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT,
  ELECTRICAL_DIRECT_CARD_FULL_LAYOUT,
  ELECTRICAL_DIRECT_CARD_GAP,
  ELECTRICAL_DIRECT_CARD_HEIGHT,
  ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH,
  ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT
} from '../shared/electrical-card-layout.constants';
import type { InverterDisplayModel, InverterSnapshot, InverterWidgetConfig, ElectricalGroupConfig } from './widget-inverter.types';

interface InverterRenderSnapshot {
  inverters: InverterSnapshot[];
  displayModels: Record<string, InverterDisplayModel>;
  widgetColors: ReturnType<typeof getColors>;
}

@Component({
  selector: 'widget-inverter',
  templateUrl: './widget-inverter.component.html',
  styleUrl: './widget-inverter.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetInverterComponent implements AfterViewInit, OnDestroy {
  private static readonly INVERTER_DESCRIPTOR = getElectricalWidgetFamilyDescriptor('widget-inverter');
  private static readonly ROOT_PATTERN = `${WidgetInverterComponent.INVERTER_DESCRIPTOR?.selfRootPath ?? 'self.electrical.inverters'}.*`;
  private static readonly ROOT_PATTERN_LEGACY = 'self.electrical.inverter.*';
  private static readonly VIEWBOX_WIDTH = ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH;
  private static readonly CARD_HEIGHT = ELECTRICAL_DIRECT_CARD_HEIGHT;
  private static readonly COMPACT_CARD_HEIGHT = ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT;
  private static readonly CARD_GAP = ELECTRICAL_DIRECT_CARD_GAP;
  private static readonly PATH_BATCH_WINDOW_MS = 500;

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    color: 'contrast',
    ignoreZones: false,
    inverter: {
      trackedIds: [],
      groups: [],
      optionsById: {}
    }
  };

  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

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
  protected readonly trackedInverterIds = signal<string[]>([]);
  protected readonly groups = signal<InverterWidgetConfig['groups']>([]);
  protected readonly optionsById = signal<InverterWidgetConfig['optionsById']>({});
  protected readonly cardMode = signal<{ enabled: boolean; displayMode: 'full' | 'card'; metrics: string[] }>({
    enabled: false,
    displayMode: 'full',
    metrics: ['dcVoltage', 'dcCurrent', 'acVoltage', 'acFrequency']
  });
  protected readonly invertersById = signal<Record<string, InverterSnapshot>>({});

  protected readonly visibleInverterIds = computed(() => {
    const tracked = this.trackedInverterIds();
    return tracked.length ? tracked : this.discoveredInverterIds();
  });

  protected readonly visibleInverters = computed<InverterSnapshot[]>(() => {
    const ids = this.visibleInverterIds();
    const map = this.invertersById();
    return ids.map(id => map[id]).filter((item): item is InverterSnapshot => !!item);
  });

  protected readonly hasInverters = computed(() => this.visibleInverters().length > 0);
  protected readonly isCompactCardMode = computed(() => this.cardMode().enabled && this.cardMode().displayMode === 'card');
  protected readonly colorRole = computed(() => this.runtime.options()?.color);
  protected readonly ignoreZones = computed(() => this.runtime.options()?.ignoreZones);

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

    const models: Record<string, InverterDisplayModel> = {};
    for (const inverter of inverters) {
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

      models[inverter.id] = {
        id: inverter.id,
        titleText: this.displayName(inverter),
        modeText: this.isCompactCardMode() ? '' : (inverter.inverterMode ? `Mode ${inverter.inverterMode}` : 'Mode -'),
        busText: this.isCompactCardMode() ? '' : (inverter.associatedBus || inverter.location || '-'),
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
      this.data.subscribePathTreeWithInitial(WidgetInverterComponent.ROOT_PATTERN),
      this.data.subscribePathTreeWithInitial(WidgetInverterComponent.ROOT_PATTERN_LEGACY)
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
    this.trackedInverterIds.set(inverterCfg.trackedIds);
    this.groups.set(inverterCfg.groups);
    this.optionsById.set(inverterCfg.optionsById);
    this.cardMode.set(this.normalizeCardMode(inverterCfg.cardMode));
  }

  private resolveInverterConfig(cfg: IWidgetSvcConfig): InverterWidgetConfig {
    const inverter = cfg.inverter;
    return {
      trackedIds: this.normalizeStringList(inverter?.trackedIds),
      groups: this.normalizeGroups(inverter?.groups),
      optionsById: this.normalizeOptionsById(inverter?.optionsById),
      cardMode: this.normalizeCardMode(inverter?.cardMode)
    };
  }

  private normalizeCardMode(value: unknown): { enabled: boolean; displayMode: 'full' | 'card'; metrics: string[] } {
    const candidate = (value && typeof value === 'object') ? value as { enabled?: unknown; displayMode?: unknown; metrics?: unknown } : null;
    const metrics = this.normalizeStringList(candidate?.metrics);
    return {
      enabled: candidate?.enabled === true,
      displayMode: candidate?.displayMode === 'card' ? 'card' : 'full',
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

  private normalizeGroups(value: unknown): ElectricalGroupConfig[] {
    if (!Array.isArray(value)) return [];
    return value
      .map(group => {
        const id = this.normalizeOptionalString((group as { id?: unknown })?.id) ?? '';
        const name = this.normalizeOptionalString((group as { name?: unknown })?.name) ?? id;
        const memberIds = this.normalizeStringList((group as { memberIds?: unknown })?.memberIds);
        if (!id) return null;
        return {
          id, name, memberIds,
          connectionMode: (group as { connectionMode?: unknown })?.connectionMode === 'series' ? 'series' : 'parallel'
        } as ElectricalGroupConfig;
      })
      .filter((item): item is ElectricalGroupConfig => !!item);
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
    const strictMatch = path.match(/^self\.electrical\.inverters\.([^.]+)\.(.+)$/);
    if (strictMatch) return { id: strictMatch[1], key: strictMatch[2] };

    const legacyMatch = path.match(/^self\.electrical\.inverter\.([^.]+)(?:\.(.+))?$/);
    if (!legacyMatch) return null;
    return { id: legacyMatch[1], key: legacyMatch[2] ?? '__root__' };
  }

  private flushPendingPathUpdates(): void {
    if (!this.pendingPathUpdates.size) return;
    const updates = Array.from(this.pendingPathUpdates.values());
    this.pendingPathUpdates.clear();

    const uniqueIds = new Set(updates.map(update => update.id));
    uniqueIds.forEach(id => this.trackDiscoveredInverter(id));

    this.invertersById.update(current => {
      let nextState = current;
      let changed = false;

      for (const update of updates) {
        const existing = nextState[update.id] ?? { id: update.id };
        const next = { ...existing } as InverterSnapshot;
        const fieldChanged = this.applyValue(next, update.key, update.value, update.state);
        if (!fieldChanged && update.key === '__root__' && !nextState[update.id]) {
          if (!changed) {
            nextState = { ...nextState };
            changed = true;
          }
          nextState[update.id] = next;
          continue;
        }

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
        nextState[update.id] = next;
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
      case '__root__': return false;
      case 'name': return this.setValue(snapshot, 'name', this.toStringValue(value));
      case 'location': return this.setValue(snapshot, 'location', this.toStringValue(value));
      case 'associatedBus': return this.setValue(snapshot, 'associatedBus', this.toStringValue(value));
      case 'dc.voltage': return this.setMetricValue(snapshot, 'dcVoltage', 'dcVoltageState', this.toNumber(value, 'V'), state);
      case 'dc.current': return this.setMetricValue(snapshot, 'dcCurrent', 'dcCurrentState', this.toNumber(value, 'A'), state);
      case 'ac.voltage': return this.setMetricValue(snapshot, 'acVoltage', 'acVoltageState', this.toNumber(value, 'V'), state);
      case 'ac.current': return this.setMetricValue(snapshot, 'acCurrent', 'acCurrentState', this.toNumber(value, 'A'), state);
      case 'ac.frequency': return this.setMetricValue(snapshot, 'acFrequency', 'acFrequencyState', this.toNumber(value, 'Hz'), state);
      case 'inverterMode': return this.setMetricValue(snapshot, 'inverterMode', 'inverterModeState', this.toStringValue(value), state);
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
      id: inverter.id,
      inverter,
      y: index * (cardHeight + WidgetInverterComponent.CARD_GAP)
    }));

    const contentHeight = cards.length ? cards[cards.length - 1].y + cardHeight : cardHeight;
    this.svg.attr('viewBox', `0 0 ${WidgetInverterComponent.VIEWBOX_WIDTH} ${contentHeight}`);

    const selection = this.layer
      .selectAll<SVGGElement, { id: string; inverter: InverterSnapshot; y: number }>('g.inverter-card')
      .data(cards, item => item.id);

    const enter = selection.enter().append('g').attr('class', 'inverter-card');
    enter.append('rect').attr('class', 'inverter-card-bg');
    enter.append('rect').attr('class', 'inverter-state-bar');
    enter.append('text').attr('class', 'inverter-title');
    enter.append('text').attr('class', 'inverter-id');
    enter.append('text').attr('class', 'inverter-mode');
    enter.append('text').attr('class', 'inverter-bus');
    enter.append('text').attr('class', 'inverter-metrics-1');
    enter.append('text').attr('class', 'inverter-metrics-2');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, { id: string; inverter: InverterSnapshot; y: number }, SVGGElement, unknown>);

    merged.attr('transform', item => `translate(0, ${item.y})`);

    merged.select('rect.inverter-card-bg')
      .attr('x', 0.5).attr('y', 0.5).attr('rx', layout.cardCornerRadius).attr('ry', layout.cardCornerRadius)
      .attr('width', WidgetInverterComponent.VIEWBOX_WIDTH - 1).attr('height', cardHeight - 1)
      .attr('stroke', 'var(--mat-sys-outline-variant)').attr('stroke-width', 0.5).attr('fill', 'none');

    merged.select('rect.inverter-state-bar')
      .attr('x', 1.5).attr('y', 1.5).attr('rx', layout.stateBarCornerRadius).attr('ry', layout.stateBarCornerRadius)
      .attr('width', 3).attr('height', cardHeight - 3)
      .attr('fill', item => snapshot.displayModels[item.id]?.stateBarColor ?? snapshot.widgetColors.dim);

    merged.select('text.inverter-title')
      .attr('x', layout.titleX).attr('y', layout.titleY).attr('font-size', layout.titleFontSize)
      .attr('fill', item => snapshot.displayModels[item.id]?.titleTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.id]?.titleText ?? this.displayName(item.inverter));

    merged.select('text.inverter-id')
      .attr('x', layout.idX).attr('y', layout.idY).attr('text-anchor', 'end').attr('font-size', layout.idFontSize)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.inverter.id);

    merged.select('text.inverter-mode')
      .attr('x', layout.metaLeftX).attr('y', layout.metaY).attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.id]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.id]?.modeText ?? '');

    merged.select('text.inverter-bus')
      .attr('x', layout.metaRightX).attr('y', layout.metaY).attr('text-anchor', 'end').attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.id]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.id]?.busText ?? '');

    merged.select('text.inverter-metrics-1')
      .attr('x', layout.lineOneX).attr('y', layout.lineOneY).attr('font-size', layout.lineOneFontSize)
      .attr('fill', item => snapshot.displayModels[item.id]?.primaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.id]?.metricsLineOne ?? '');

    merged.select('text.inverter-metrics-2')
      .attr('x', layout.lineTwoX).attr('y', layout.lineTwoY).attr('font-size', layout.lineTwoFontSize)
      .attr('opacity', 0.85)
      .attr('fill', item => snapshot.displayModels[item.id]?.secondaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.id]?.metricsLineTwo ?? '');

    selection.exit().remove();
  }

  private displayName(inverter: InverterSnapshot): string {
    return inverter.name?.trim() || inverter.id;
  }

  private buildMetricRows(inverter: InverterSnapshot): [string, string] {
    const mode = this.cardMode();
    if (!mode.enabled || mode.displayMode === 'full') {
      return [
        `DC ${this.formatValue(inverter.dcVoltage, 'V')}  ${this.formatValue(inverter.dcCurrent, 'A')}`,
        `AC ${this.formatValue(inverter.acVoltage, 'V')}  ${this.formatValue(inverter.acFrequency, 'Hz')}`
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
      case 'temperature': return `T ${this.formatTemperature(inverter.temperature)}`;
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
}
