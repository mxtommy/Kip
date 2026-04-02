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
import type { AlternatorDisplayModel, AlternatorSnapshot, AlternatorWidgetConfig, ElectricalGroupConfig } from './widget-alternator.types';

interface AlternatorRenderSnapshot {
  alternators: AlternatorSnapshot[];
  displayModels: Record<string, AlternatorDisplayModel>;
  widgetColors: ReturnType<typeof getColors>;
}

@Component({
  selector: 'widget-alternator',
  templateUrl: './widget-alternator.component.html',
  styleUrl: './widget-alternator.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetAlternatorComponent implements AfterViewInit, OnDestroy {
  private static readonly ALTERNATOR_DESCRIPTOR = getElectricalWidgetFamilyDescriptor('widget-alternator');
  private static readonly ROOT_PATTERN = `${WidgetAlternatorComponent.ALTERNATOR_DESCRIPTOR?.selfRootPath ?? 'self.electrical.alternators'}.*`;
  private static readonly ROOT_PATTERN_LEGACY = 'self.electrical.alternator.*';
  private static readonly VIEWBOX_WIDTH = ELECTRICAL_DIRECT_CARD_VIEWBOX_WIDTH;
  private static readonly CARD_HEIGHT = ELECTRICAL_DIRECT_CARD_HEIGHT;
  private static readonly COMPACT_CARD_HEIGHT = ELECTRICAL_DIRECT_COMPACT_CARD_HEIGHT;
  private static readonly CARD_GAP = ELECTRICAL_DIRECT_CARD_GAP;
  private static readonly PATH_BATCH_WINDOW_MS = 500;

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    color: 'contrast',
    ignoreZones: false,
    alternator: {
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

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('alternatorSvg');
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private layer?: d3.Selection<SVGGElement, unknown, null, undefined>;

  private readonly pendingPathUpdates = new Map<string, { id: string; key: string; value: unknown; state: TState | null }>();
  private pathBatchTimerId: number | null = null;
  private initialPathPaintDone = false;
  private renderFrameId: number | null = null;
  private pendingRenderSnapshot: AlternatorRenderSnapshot | null = null;

  protected readonly discoveredAlternatorIds = signal<string[]>([]);
  protected readonly trackedAlternatorIds = signal<string[]>([]);
  protected readonly groups = signal<AlternatorWidgetConfig['groups']>([]);
  protected readonly optionsById = signal<AlternatorWidgetConfig['optionsById']>({});
  protected readonly cardMode = signal<{ enabled: boolean; displayMode: 'full' | 'card'; metrics: string[] }>({
    enabled: false,
    displayMode: 'full',
    metrics: ['voltage', 'current', 'power', 'revolutions']
  });
  protected readonly alternatorsById = signal<Record<string, AlternatorSnapshot>>({});

  protected readonly visibleAlternatorIds = computed(() => {
    const tracked = this.trackedAlternatorIds();
    return tracked.length ? tracked : this.discoveredAlternatorIds();
  });

  protected readonly visibleAlternators = computed<AlternatorSnapshot[]>(() => {
    const ids = this.visibleAlternatorIds();
    const map = this.alternatorsById();
    return ids.map(id => map[id]).filter((item): item is AlternatorSnapshot => !!item);
  });

  protected readonly hasAlternators = computed(() => this.visibleAlternators().length > 0);
  protected readonly isCompactCardMode = computed(() => this.cardMode().enabled && this.cardMode().displayMode === 'card');
  protected readonly colorRole = computed(() => this.runtime.options()?.color);
  protected readonly ignoreZones = computed(() => this.runtime.options()?.ignoreZones);

  protected readonly widgetColors = computed(() => {
    const theme = this.theme();
    if (!theme) return null;
    return getColors(this.colorRole(), theme);
  });

  protected readonly displayModels = computed<Record<string, AlternatorDisplayModel>>(() => {
    const alternators = this.visibleAlternators();
    const theme = this.theme();
    const widgetColors = this.widgetColors();
    const ignoreZones = this.ignoreZones();

    const models: Record<string, AlternatorDisplayModel> = {};
    for (const alternator of alternators) {
      const aggregateState = this.resolveMostSevereState(
        alternator.powerState ?? null,
        alternator.currentState ?? null,
        alternator.voltageState ?? null,
        alternator.temperatureState ?? null,
        alternator.chargingModeState ?? null,
        alternator.revolutionsState ?? null,
        alternator.fieldDriveState ?? null,
        alternator.regulatorTemperatureState ?? null
      );
      const primaryState = this.resolveMostSevereState(alternator.voltageState ?? null, alternator.currentState ?? null);
      const secondaryState = this.resolveMostSevereState(
        alternator.powerState ?? null,
        alternator.revolutionsState ?? null,
        alternator.temperatureState ?? null,
        alternator.regulatorTemperatureState ?? null
      );
      const [metricsLineOne, metricsLineTwo] = this.buildMetricRows(alternator);

      models[alternator.id] = {
        id: alternator.id,
        titleText: this.displayName(alternator),
        modeText: this.isCompactCardMode() ? '' : this.resolveModeText(alternator),
        busText: this.isCompactCardMode() ? '' : (alternator.associatedBus || alternator.location || '-'),
        metricsLineOne,
        metricsLineTwo,
        stateBarColor: resolveZoneAwareColor(aggregateState, widgetColors?.dim ?? 'var(--kip-contrast-color)', theme, ignoreZones),
        titleTextColor: resolveZoneAwareColor(aggregateState, 'var(--kip-contrast-color)', theme, ignoreZones),
        metaTextColor: resolveZoneAwareColor(
          this.resolveMostSevereState(alternator.chargingModeState ?? null, alternator.fieldDriveState ?? null),
          'var(--kip-contrast-dim-color)',
          theme,
          ignoreZones
        ),
        primaryMetricsTextColor: resolveZoneAwareColor(primaryState, 'var(--kip-contrast-color)', theme, ignoreZones),
        secondaryMetricsTextColor: resolveZoneAwareColor(secondaryState, 'var(--kip-contrast-color)', theme, ignoreZones)
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
      const alternators = this.visibleAlternators();
      const widgetColors = this.widgetColors();
      if (!this.svg || !widgetColors) return;
      this.requestRender({ alternators, displayModels: models, widgetColors });
    });

    const alternatorTrees = [
      this.data.subscribePathTreeWithInitial(WidgetAlternatorComponent.ROOT_PATTERN),
      this.data.subscribePathTreeWithInitial(WidgetAlternatorComponent.ROOT_PATTERN_LEGACY)
    ];

    let hasInitialUpdates = false;
    for (const tree of alternatorTrees) {
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

    for (const tree of alternatorTrees) {
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
      .attr('viewBox', `0 0 ${WidgetAlternatorComponent.VIEWBOX_WIDTH} ${WidgetAlternatorComponent.CARD_HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Alternator View');

    this.layer = this.svg.append('g').attr('class', 'alternator-layer');
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const alternatorCfg = this.resolveAlternatorConfig(cfg);
    this.trackedAlternatorIds.set(alternatorCfg.trackedIds);
    this.groups.set(alternatorCfg.groups);
    this.optionsById.set(alternatorCfg.optionsById);
    this.cardMode.set(this.normalizeCardMode(alternatorCfg.cardMode));
  }

  private resolveAlternatorConfig(cfg: IWidgetSvcConfig): AlternatorWidgetConfig {
    const alternator = cfg.alternator;
    const groups = this.normalizeGroups((alternator as { groups?: unknown; banks?: unknown } | undefined)?.groups
      ?? (alternator as { banks?: unknown } | undefined)?.banks);
    const optionsById = this.normalizeOptionsById(
      (alternator as { optionsById?: unknown; alternatorOptionsById?: unknown } | undefined)?.optionsById
      ?? (alternator as { alternatorOptionsById?: unknown } | undefined)?.alternatorOptionsById
    );

    return {
      trackedIds: this.normalizeStringList(alternator?.trackedIds),
      groups,
      optionsById,
      cardMode: this.normalizeCardMode(alternator?.cardMode)
    };
  }

  private normalizeCardMode(value: unknown): { enabled: boolean; displayMode: 'full' | 'card'; metrics: string[] } {
    const candidate = (value && typeof value === 'object') ? value as { enabled?: unknown; displayMode?: unknown; metrics?: unknown } : null;
    if (!candidate) {
      return {
        enabled: false,
        displayMode: 'full',
        metrics: ['voltage', 'current', 'power', 'revolutions']
      };
    }

    const metrics = this.normalizeStringList(candidate?.metrics);
    return {
      enabled: candidate.enabled !== false,
      displayMode: candidate?.displayMode === 'card' ? 'card' : 'full',
      metrics: metrics.length ? metrics : ['voltage', 'current', 'power', 'revolutions']
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

  private normalizeGroups(value: unknown): ElectricalGroupConfig[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .map(group => {
        const id = this.normalizeOptionalString((group as { id?: unknown })?.id) ?? '';
        const name = this.normalizeOptionalString((group as { name?: unknown })?.name) ?? id;
        const memberIds = this.normalizeStringList((group as { memberIds?: unknown })?.memberIds);

        if (!id) {
          return null;
        }

        return {
          id,
          name,
          memberIds,
          connectionMode: (group as { connectionMode?: unknown })?.connectionMode === 'series' ? 'series' : 'parallel'
        } as ElectricalGroupConfig;
      })
      .filter((item): item is ElectricalGroupConfig => !!item);
  }

  private normalizeOptionsById(value: unknown): AlternatorWidgetConfig['optionsById'] {
    if (!value || typeof value !== 'object') {
      return {};
    }

    const next: AlternatorWidgetConfig['optionsById'] = {};
    Object.entries(value as Record<string, unknown>).forEach(([id]) => {
      const normalizedId = this.normalizeOptionalString(id);
      if (!normalizedId) {
        return;
      }

      next[normalizedId] = {};
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
    const updateKey = `${parsed.id}::${parsed.key}`;
    this.pendingPathUpdates.set(updateKey, { id: parsed.id, key: parsed.key, value, state });

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
    }, WidgetAlternatorComponent.PATH_BATCH_WINDOW_MS);
  }

  private parsePath(path: string): { id: string; key: string } | null {
    const match = path.match(/self\.electrical\.alternators?\.([^.]+)(?:\.(.+))?$/);
    if (!match) {
      return null;
    }

    return { id: match[1], key: match[2] ?? '__root__' };
  }

  private flushPendingPathUpdates(): void {
    if (!this.pendingPathUpdates.size) {
      return;
    }

    const updates = Array.from(this.pendingPathUpdates.values());
    this.pendingPathUpdates.clear();

    const uniqueIds = new Set(updates.map(update => update.id));
    uniqueIds.forEach(id => this.trackDiscoveredAlternator(id));

    this.alternatorsById.update(current => {
      let nextState = current;
      let changed = false;

      for (const update of updates) {
        const existing = nextState[update.id] ?? { id: update.id };
        const next = { ...existing } as AlternatorSnapshot;
        const fieldChanged = this.applyValue(next, update.key, update.value, update.state);

        if (!fieldChanged && update.key === '__root__' && !nextState[update.id]) {
          if (!changed) {
            nextState = { ...nextState };
            changed = true;
          }
          nextState[update.id] = next;
          continue;
        }

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

        nextState[update.id] = next;
      }

      return changed ? nextState : current;
    });
  }

  private trackDiscoveredAlternator(id: string): void {
    const ids = this.discoveredAlternatorIds();
    if (ids.includes(id)) {
      return;
    }

    this.discoveredAlternatorIds.set([...ids, id].sort((left, right) => left.localeCompare(right)));
  }

  private applyValue(snapshot: AlternatorSnapshot, key: string, value: unknown, state: TState | null): boolean {
    switch (key) {
      case '__root__':
        return false;
      case 'name':
        return this.setValue(snapshot, 'name', this.toStringValue(value));
      case 'location':
        return this.setValue(snapshot, 'location', this.toStringValue(value));
      case 'associatedBus':
        return this.setValue(snapshot, 'associatedBus', this.toStringValue(value));
      case 'chargingMode':
        return this.setMetricValue(snapshot, 'chargingMode', 'chargingModeState', this.toStringValue(value), state);
      case 'voltage':
        return this.setMetricValue(snapshot, 'voltage', 'voltageState', this.toNumber(value, 'V'), state);
      case 'current':
        return this.setMetricValue(snapshot, 'current', 'currentState', this.toNumber(value, 'A'), state);
      case 'power':
      case 'realPower':
        return this.setMetricValue(snapshot, 'rawPower', 'powerState', this.toNumber(value, 'W'), state);
      case 'temperature':
        return this.setMetricValue(snapshot, 'temperature', 'temperatureState', this.toNumber(value, this.units.getDefaults().Temperature), state);
      case 'revolutions':
        return this.setMetricValue(snapshot, 'revolutions', 'revolutionsState', this.toNumber(value, 'Hz'), state);
      case 'fieldDrive':
        return this.setMetricValue(snapshot, 'fieldDrive', 'fieldDriveState', this.toNumber(value, '%'), state);
      case 'regulatorTemperature':
        return this.setMetricValue(snapshot, 'regulatorTemperature', 'regulatorTemperatureState', this.toNumber(value, this.units.getDefaults().Temperature), state);
      case 'setpointVoltage':
        return this.setMetricValue(snapshot, 'setpointVoltage', 'setpointVoltageState', this.toNumber(value, 'V'), state);
      case 'setpointCurrent':
        return this.setMetricValue(snapshot, 'setpointCurrent', 'setpointCurrentState', this.toNumber(value, 'A'), state);
      default:
        return false;
    }
  }

  private setValue<K extends keyof AlternatorSnapshot>(target: AlternatorSnapshot, key: K, nextValue: AlternatorSnapshot[K]): boolean {
    if (Object.is(target[key], nextValue)) {
      return false;
    }

    target[key] = nextValue;
    return true;
  }

  private setMetricValue<K extends keyof AlternatorSnapshot, S extends keyof AlternatorSnapshot>(
    target: AlternatorSnapshot,
    key: K,
    stateKey: S,
    nextValue: AlternatorSnapshot[K],
    state: TState | null
  ): boolean {
    const valueChanged = !Object.is(target[key], nextValue);
    const stateChanged = !Object.is(target[stateKey], state);
    if (!valueChanged && !stateChanged) {
      return false;
    }

    target[key] = nextValue;
    target[stateKey] = state as AlternatorSnapshot[S];
    return true;
  }

  private requestRender(snapshot?: AlternatorRenderSnapshot): void {
    const widgetColors = this.widgetColors();
    if (!this.svg || !widgetColors) {
      return;
    }

    this.pendingRenderSnapshot = snapshot ?? {
      alternators: this.visibleAlternators(),
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

  private render(snapshot: AlternatorRenderSnapshot): void {
    if (!this.layer || !this.svg) {
      return;
    }

    const compact = this.isCompactCardMode();
    const layout = compact ? ELECTRICAL_DIRECT_CARD_COMPACT_LAYOUT : ELECTRICAL_DIRECT_CARD_FULL_LAYOUT;
    const cardHeight = compact ? WidgetAlternatorComponent.COMPACT_CARD_HEIGHT : WidgetAlternatorComponent.CARD_HEIGHT;
    const cards = snapshot.alternators.map((alternator, index) => ({
      id: alternator.id,
      alternator,
      y: index * (cardHeight + WidgetAlternatorComponent.CARD_GAP)
    }));

    const contentHeight = cards.length
      ? cards[cards.length - 1].y + cardHeight
      : cardHeight;

    this.svg.attr('viewBox', `0 0 ${WidgetAlternatorComponent.VIEWBOX_WIDTH} ${contentHeight}`);

    const selection = this.layer
      .selectAll<SVGGElement, { id: string; alternator: AlternatorSnapshot; y: number }>('g.alternator-card')
      .data(cards, item => item.id);

    const enter = selection.enter().append('g').attr('class', 'alternator-card');
    enter.append('rect').attr('class', 'alternator-card-bg');
    enter.append('rect').attr('class', 'alternator-state-bar');
    enter.append('text').attr('class', 'alternator-title');
    enter.append('text').attr('class', 'alternator-id');
    enter.append('text').attr('class', 'alternator-mode');
    enter.append('text').attr('class', 'alternator-bus');
    enter.append('text').attr('class', 'alternator-metrics-1');
    enter.append('text').attr('class', 'alternator-metrics-2');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, { id: string; alternator: AlternatorSnapshot; y: number }, SVGGElement, unknown>);

    merged.attr('transform', item => `translate(0, ${item.y})`);
    merged.select('rect.alternator-card-bg')
      .attr('x', 0.5)
      .attr('y', 0.5)
      .attr('rx', layout.cardCornerRadius)
      .attr('ry', layout.cardCornerRadius)
      .attr('width', WidgetAlternatorComponent.VIEWBOX_WIDTH - 1)
      .attr('height', cardHeight - 1)
      .attr('stroke', 'var(--mat-sys-outline-variant)')
      .attr('stroke-width', 0.5)
      .attr('fill', 'none');

    merged.select('rect.alternator-state-bar')
      .attr('x', 1.5)
      .attr('y', 1.5)
      .attr('rx', layout.stateBarCornerRadius)
      .attr('ry', layout.stateBarCornerRadius)
      .attr('width', 3)
      .attr('height', cardHeight - 3)
      .attr('fill', item => snapshot.displayModels[item.id]?.stateBarColor ?? snapshot.widgetColors.dim);

    merged.select('text.alternator-title')
      .attr('x', layout.titleX)
      .attr('y', layout.titleY)
      .attr('font-size', layout.titleFontSize)
      .attr('fill', item => snapshot.displayModels[item.id]?.titleTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.id]?.titleText ?? this.displayName(item.alternator));

    merged.select('text.alternator-id')
      .attr('x', layout.idX)
      .attr('y', layout.idY)
      .attr('text-anchor', 'end')
      .attr('font-size', layout.idFontSize)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.alternator.id);

    merged.select('text.alternator-mode')
      .attr('x', layout.metaLeftX)
      .attr('y', layout.metaY)
      .attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.id]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.id]?.modeText ?? '');

    merged.select('text.alternator-bus')
      .attr('x', layout.metaRightX)
      .attr('y', layout.metaY)
      .attr('text-anchor', 'end')
      .attr('font-size', layout.metaFontSize)
      .attr('opacity', 0.8)
      .attr('fill', item => snapshot.displayModels[item.id]?.metaTextColor ?? 'var(--kip-contrast-dim-color)')
      .text(item => snapshot.displayModels[item.id]?.busText ?? '');

    merged.select('text.alternator-metrics-1')
      .attr('x', layout.lineOneX)
      .attr('y', layout.lineOneY)
      .attr('font-size', layout.lineOneFontSize)
      .attr('fill', item => snapshot.displayModels[item.id]?.primaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.id]?.metricsLineOne ?? '');

    merged.select('text.alternator-metrics-2')
      .attr('x', layout.lineTwoX)
      .attr('y', layout.lineTwoY)
      .attr('font-size', layout.lineTwoFontSize)
      .attr('opacity', 0.85)
      .attr('fill', item => snapshot.displayModels[item.id]?.secondaryMetricsTextColor ?? 'var(--kip-contrast-color)')
      .text(item => snapshot.displayModels[item.id]?.metricsLineTwo ?? '');

    selection.exit().remove();
  }

  private displayName(alternator: AlternatorSnapshot): string {
    return alternator.name?.trim() || alternator.id;
  }

  private resolveModeText(alternator: AlternatorSnapshot): string {
    if (alternator.chargingMode) {
      return `Mode ${alternator.chargingMode}`;
    }

    if (alternator.fieldDrive != null) {
      return `Field ${alternator.fieldDrive.toFixed(0)} %`;
    }

    return 'Mode -';
  }

  private buildMetricRows(alternator: AlternatorSnapshot): [string, string] {
    const mode = this.cardMode();
    if (!mode.enabled || mode.displayMode === 'full') {
      return [
        `V ${this.formatValue(alternator.voltage, 'V')}   A ${this.formatValue(alternator.current, 'A')}`,
        `P ${this.formatValue(alternator.power, 'W')}   RPM ${this.formatRevolutions(alternator.revolutions)}`
      ];
    }

    const metricLabels = mode.metrics
      .map(metric => this.toMetricLabel(metric, alternator))
      .filter((label): label is string => !!label);

    if (!metricLabels.length) {
      return ['V -   A -', 'P -   RPM -'];
    }

    const first = metricLabels.slice(0, 2).join('   ');
    const second = metricLabels.slice(2, 4).join('   ');
    return [first || ' ', second || ' '];
  }

  private toMetricLabel(metric: string, alternator: AlternatorSnapshot): string | null {
    switch (metric) {
      case 'voltage':
        return `V ${this.formatValue(alternator.voltage, 'V')}`;
      case 'current':
        return `A ${this.formatValue(alternator.current, 'A')}`;
      case 'power':
        return `P ${this.formatValue(alternator.power, 'W')}`;
      case 'temperature':
        return `T ${this.formatTemperature(alternator.temperature)}`;
      case 'revolutions':
        return `RPM ${this.formatRevolutions(alternator.revolutions)}`;
      case 'fieldDrive':
        return `FD ${this.formatPercent(alternator.fieldDrive)}`;
      case 'regulatorTemperature':
        return `RT ${this.formatTemperature(alternator.regulatorTemperature)}`;
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

  private formatRevolutions(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return Math.round(value * 60).toString();
  }

  private formatPercent(value: number | null | undefined): string {
    if (value == null || Number.isNaN(value)) {
      return '-';
    }

    return `${value.toFixed(0)} %`;
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
