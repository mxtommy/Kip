import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getColors } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { UnitsService } from '../../core/services/units.service';
import type { ITheme } from '../../core/services/app-service';
import { States, TState } from '../../core/interfaces/signalk-interfaces';
import type { IWidgetSvcConfig, SolarChargerOptionConfig, SolarChargerWidgetConfig } from '../../core/interfaces/widgets-interface';
import type { SolarChargerDisplayModel, SolarChargerSnapshot } from './solar-charger.types';

interface SolarRenderSnapshot {
  chargers: SolarChargerSnapshot[];
  displayModels: Record<string, SolarChargerDisplayModel>;
  widgetColors: ReturnType<typeof getColors>;
}

@Component({
  selector: 'widget-solar-charger',
  templateUrl: './widget-solar-charger.component.html',
  styleUrl: './widget-solar-charger.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetSolarChargerComponent implements AfterViewInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    color: 'contrast',
    ignoreZones: false,
    solarCharger: {
      trackedChargerIds: [],
      chargerOptionsById: {}
    }
  };

  private static readonly VIEWBOX_WIDTH = 200;
  private static readonly CARD_HEIGHT = 92;
  private static readonly CARD_GAP = 8;
  private static readonly GAUGE_RADIUS = 38;
  private static readonly GAUGE_BG_STROKE = 8;
  private static readonly GAUGE_VALUE_STROKE = 8;
  private static readonly PATH_BATCH_WINDOW_MS = 500;

  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly data = inject(DataService);
  private readonly units = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('solarSvg');
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private layer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private readonly gaugeBackgroundPath = this.buildSemiGaugeArcPath(WidgetSolarChargerComponent.GAUGE_RADIUS, 1);

  private renderFrameId: number | null = null;
  private pendingRenderSnapshot: SolarRenderSnapshot | null = null;
  private pathBatchTimerId: number | null = null;
  private initialPathPaintDone = false;
  private readonly pendingPathUpdates = new Map<string, { id: string; key: string; value: unknown; state: TState | null }>();

  protected readonly discoveredChargerIds = signal<string[]>([]);
  protected readonly trackedChargerIds = signal<string[]>([]);
  protected readonly chargerOptionsById = signal<Record<string, SolarChargerOptionConfig>>({});
  protected readonly chargers = signal<Record<string, SolarChargerSnapshot>>({});

  protected readonly visibleChargerIds = computed(() => {
    const tracked = this.trackedChargerIds();
    if (tracked.length) return tracked;
    return this.discoveredChargerIds();
  });

  protected readonly visibleChargers = computed<SolarChargerSnapshot[]>(() => {
    const ids = this.visibleChargerIds();
    const map = this.chargers();
    return ids.map(id => map[id]).filter((item): item is SolarChargerSnapshot => !!item);
  });

  protected readonly colorRole = computed(() => this.runtime.options()?.color ?? WidgetSolarChargerComponent.DEFAULT_CONFIG.color);
  protected readonly ignoreZones = computed(() => this.runtime.options()?.ignoreZones ?? false);

  protected readonly widgetColors = computed(() => {
    const theme = this.theme();
    if (!theme) return null;
    return getColors(this.colorRole(), theme);
  });

  protected readonly displayModels = computed<Record<string, SolarChargerDisplayModel>>(() => {
    const chargers = this.visibleChargers();
    const options = this.chargerOptionsById();
    const theme = this.theme();
    const widgetColors = this.widgetColors();
    const ignoreZones = this.ignoreZones();

    const models: Record<string, SolarChargerDisplayModel> = {};
    for (const charger of chargers) {
      const ratedPower = options[charger.id]?.arrayRatedPowerW ?? null;
      const panelPower = charger.panelPower ?? null;
      const panelPowerDisplay = this.formatPowerAuto(panelPower);
      const progress = ratedPower && ratedPower > 0 && panelPower != null
        ? Math.max(0, Math.min(1, panelPower / ratedPower))
        : 0;

      const panelState = charger.panelCurrentState ?? null;
      const batteryState = charger.currentState ?? null;
      const panelPowerColor = WidgetSolarChargerComponent.resolveZoneAwareColor(
        panelState,
        widgetColors?.color ?? 'var(--kip-contrast-color)',
        theme,
        ignoreZones
      );
      const panelSectionColor = WidgetSolarChargerComponent.resolveZoneAwareColor(
        panelState,
        widgetColors?.color ?? 'var(--kip-contrast-color)',
        theme,
        ignoreZones
      );
      const batterySectionColor = WidgetSolarChargerComponent.resolveZoneAwareColor(
        batteryState,
        widgetColors?.color ?? 'var(--kip-contrast-color)',
        theme,
        ignoreZones
      );

      models[charger.id] = {
        id: charger.id,
        titleText: charger.name || `Controller ${charger.id}`,
        busText: charger.associatedBus ? `Bus: ${charger.associatedBus}` : 'Bus: --',
        panelPowerText: panelPowerDisplay.value,
        panelPowerUnitText: panelPowerDisplay.unit,
        panelPowerColor,
        gaugeProgress: progress,
        gaugeValuePath: this.buildSemiGaugeArcPath(WidgetSolarChargerComponent.GAUGE_RADIUS, progress),
        gaugeValueColor: panelPowerColor,
        gaugeSectionText: `${this.formatVoltage(charger.panelVoltage)}` + (charger.panelCurrent ? `, ${this.formatCurrent(charger.panelCurrent)}` : '') + (charger.panelTemperature ? `, ${this.formatTemperature(charger.panelTemperature)}` : ''),
        panelSectionColor,
        batterySectionText: `${this.formatVoltage(charger.voltage)} ${this.formatCurrent(charger.current)}`,
        batterySectionColor,
        charger: `${this.valueOrDash(charger.controllerMode)} mode, ${this.formatTemperature(charger.temperature)}`,
        chargerMetadata: `Location ${this.valueOrDash(charger.location)}`,
        relaySectionText: `State ${this.formatRelayState(charger.load)}   Current ${this.formatCurrent(charger.loadCurrent)}`
      };
    }

    return models;
  });

  protected readonly hasChargers = computed(() => this.visibleChargers().length > 0);

  constructor() {
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      untracked(() => this.applyConfig(cfg));
    });

    effect(() => {
      const models = this.displayModels();
      const chargers = this.visibleChargers();
      const widgetColors = this.widgetColors();
      if (!this.svg || !widgetColors) return;
      this.requestRender({ chargers, displayModels: models, widgetColors });
    });

    const solarTree = this.data.subscribePathTreeWithInitial('self.electrical.solar.*');

    if (solarTree.initial.length) {
      for (const update of solarTree.initial) {
        this.enqueuePathUpdate(update, true);
      }
      this.flushPendingPathUpdates();
      this.initialPathPaintDone = true;
    }

    solarTree.live$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => {
        this.enqueuePathUpdate(update);
      });
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
      .attr('viewBox', `0 0 ${WidgetSolarChargerComponent.VIEWBOX_WIDTH} ${WidgetSolarChargerComponent.CARD_HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Solar Charger View');

    this.layer = this.svg.append('g').attr('class', 'solar-layer');
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const solarCfg = this.resolveSolarConfig(cfg);
    this.trackedChargerIds.set(solarCfg.trackedChargerIds);
    this.chargerOptionsById.set(solarCfg.chargerOptionsById);
  }

  private resolveSolarConfig(cfg: IWidgetSvcConfig): SolarChargerWidgetConfig {
    const solar = cfg.solarCharger;
    const chargerOptionsById = solar?.chargerOptionsById ?? {};
    return {
      trackedChargerIds: Array.isArray(solar?.trackedChargerIds) ? solar.trackedChargerIds : [],
      chargerOptionsById
    };
  }

  private enqueuePathUpdate(update: IPathUpdateWithPath, fromInitial = false): void {
    const match = this.parseSolarPath(update.path);
    if (!match) return;

    const { id, key } = match;
    const value = update.update?.data?.value ?? null;
    const state = update.update?.state ?? null;
    const updateKey = `${id}::${key}`;
    this.pendingPathUpdates.set(updateKey, { id, key, value, state });

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
    }, WidgetSolarChargerComponent.PATH_BATCH_WINDOW_MS);
  }

  private flushPendingPathUpdates(): void {
    if (!this.pendingPathUpdates.size) return;

    const updates = Array.from(this.pendingPathUpdates.values());
    this.pendingPathUpdates.clear();

    const uniqueIds = new Set(updates.map(update => update.id));
    uniqueIds.forEach(id => this.trackDiscoveredCharger(id));

    this.chargers.update(current => {
      let nextState = current;
      let hasChanges = false;

      for (const update of updates) {
        const existing = nextState[update.id] ?? { id: update.id } as SolarChargerSnapshot;
        const next = { ...existing } as SolarChargerSnapshot;
        const changed = this.applyChargerValue(next, update.key, update.value, update.state);

        let derivedChanged = false;
        const batteryPower = this.resolvePowerValue(next.rawBatteryPower, next.voltage, next.current);
        if (!Object.is(next.power, batteryPower)) {
          next.power = batteryPower;
          derivedChanged = true;
        }

        const panelPower = this.resolvePowerValue(next.rawPanelPower, next.panelVoltage, next.panelCurrent);
        if (!Object.is(next.panelPower, panelPower)) {
          next.panelPower = panelPower;
          derivedChanged = true;
        }

        if (!changed && !derivedChanged) continue;

        if (!hasChanges) {
          nextState = { ...nextState };
          hasChanges = true;
        }

        nextState[update.id] = next;
      }

      return hasChanges ? nextState : current;
    });
  }

  private parseSolarPath(path: string): { id: string; key: string } | null {
    const match = path.match(/self\.electrical\.solar\.([^.]+)\.(.+)$/);
    if (!match) return null;
    return { id: match[1], key: match[2] };
  }

  private trackDiscoveredCharger(id: string): void {
    const ids = this.discoveredChargerIds();
    if (ids.includes(id)) return;
    this.discoveredChargerIds.set([...ids, id].sort());
  }

  private applyChargerValue(charger: SolarChargerSnapshot, key: string, value: unknown, state: TState | null): boolean {
    switch (key) {
      case 'name': return this.setValue(charger, 'name', this.toStringValue(value));
      case 'location': return this.setValue(charger, 'location', this.toStringValue(value));
      case 'associatedBus': return this.setValue(charger, 'associatedBus', this.toStringValue(value));
      case 'voltage': return this.setValue(charger, 'voltage', this.toNumber(value, 'V'));
      case 'current': {
        const nextValue = this.toNumber(value, 'A');
        const stateChanged = !Object.is(charger.currentState ?? null, state ?? null);
        if (Object.is(charger.current, nextValue) && !stateChanged) return false;
        charger.current = nextValue;
        charger.currentState = state;
        return true;
      }
      case 'power': return this.setPowerPathValue(charger, 'rawBatteryPower', value);
      case 'temperature': return this.setValue(charger, 'temperature', this.toNumber(value, this.units.getDefaults().Temperature));
      case 'chargingAlgorithm': return this.setValue(charger, 'chargingAlgorithm', this.toStringValue(value));
      case 'chargerRole': return this.setValue(charger, 'chargerRole', this.toStringValue(value));
      case 'chargingMode': return this.setValue(charger, 'chargingMode', this.toStringValue(value));
      case 'setpointVoltage': return this.setValue(charger, 'setpointVoltage', this.toNumber(value, 'V'));
      case 'setpointCurrent': return this.setValue(charger, 'setpointCurrent', this.toNumber(value, 'A'));
      case 'controllerMode': return this.setValue(charger, 'controllerMode', this.toStringValue(value));
      case 'panelVoltage': return this.setValue(charger, 'panelVoltage', this.toNumber(value, 'V'));
      case 'panelCurrent': {
        const nextValue = this.toNumber(value, 'A');
        const stateChanged = !Object.is(charger.panelCurrentState ?? null, state ?? null);
        if (Object.is(charger.panelCurrent, nextValue) && !stateChanged) return false;
        charger.panelCurrent = nextValue;
        charger.panelCurrentState = state;
        return true;
      }
      case 'panelPower': return this.setPowerPathValue(charger, 'rawPanelPower', value);
      case 'panelTemperature': return this.setValue(charger, 'panelTemperature', this.toNumber(value, this.units.getDefaults().Temperature));
      case 'load': return this.setValue(charger, 'load', value as string | number | boolean | null);
      case 'loadCurrent': return this.setValue(charger, 'loadCurrent', this.toNumber(value, 'A'));
      default:
        return false;
    }
  }

  private setPowerPathValue(charger: SolarChargerSnapshot, key: 'rawBatteryPower' | 'rawPanelPower', value: unknown): boolean {
    const parsedValue = this.toNumber(value, 'W');
    return this.setValue(charger, key, parsedValue);
  }

  private setValue<K extends keyof SolarChargerSnapshot>(snapshot: SolarChargerSnapshot, key: K, value: SolarChargerSnapshot[K]): boolean {
    if (Object.is(snapshot[key], value)) return false;
    snapshot[key] = value;
    return true;
  }

  private resolvePowerValue(pathPower: number | null | undefined, voltage: number | null | undefined, current: number | null | undefined): number | undefined {
    if (pathPower != null) {
      return pathPower;
    }

    if (voltage != null && current != null) {
      return voltage * current;
    }

    return undefined;
  }

  private requestRender(snapshot?: SolarRenderSnapshot): void {
    if (!this.svg) return;

    this.pendingRenderSnapshot = snapshot ?? this.buildRenderSnapshot();
    if (!this.pendingRenderSnapshot) return;
    if (this.renderFrameId !== null) return;

    this.renderFrameId = requestAnimationFrame(() => {
      this.renderFrameId = null;
      const nextSnapshot = this.pendingRenderSnapshot;
      this.pendingRenderSnapshot = null;
      if (!nextSnapshot) return;

      this.ngZone.runOutsideAngular(() => this.render(nextSnapshot));
    });
  }

  private buildRenderSnapshot(): SolarRenderSnapshot | null {
    const widgetColors = this.widgetColors();
    if (!widgetColors) return null;

    return {
      chargers: this.visibleChargers(),
      displayModels: this.displayModels(),
      widgetColors
    };
  }

  private render(snapshot: SolarRenderSnapshot): void {
    if (!this.layer || !this.svg) return;

    const cards = snapshot.chargers.map((charger, index) => ({
      id: charger.id,
      model: snapshot.displayModels[charger.id],
      y: index * (WidgetSolarChargerComponent.CARD_HEIGHT + WidgetSolarChargerComponent.CARD_GAP)
    }));

    const contentHeight = cards.length
      ? cards[cards.length - 1].y + WidgetSolarChargerComponent.CARD_HEIGHT
      : WidgetSolarChargerComponent.CARD_HEIGHT;

    this.svg.attr('viewBox', `0 0 ${WidgetSolarChargerComponent.VIEWBOX_WIDTH} ${contentHeight}`);

    const selection = this.layer
      .selectAll<SVGGElement, { id: string; model: SolarChargerDisplayModel; y: number }>('g.solar-card')
      .data(cards, item => item.id);

    const enter = selection.enter().append('g').attr('class', 'solar-card');
    enter.append('rect').attr('class', 'solar-card-bg');
    enter.append('text').attr('class', 'solar-title');
    enter.append('text').attr('class', 'solar-charger');
    enter.append('text').attr('class', 'solar-battery-label').text('Charger Output');
    enter.append('text').attr('class', 'solar-battery-values');
    enter.append('text').attr('class', 'solar-relay-label').text('Relay');
    enter.append('text').attr('class', 'solar-relay-values');

    const solarPanelIconEnter = enter.append('g').attr('class', 'solar-panel-icon');
    solarPanelIconEnter.append('path').attr('d', 'M16.40666666666667 53.66666666666667h59.18666666666667a3.8333333333333335 3.8333333333333335 0 0 0 3.7183333333333333 -4.764833333333334l-5.75 -23A3.8333333333333335 3.8333333333333335 0 0 0 69.84333333333333 23H22.15666666666667a3.8333333333333335 3.8333333333333335 0 0 0 -3.7183333333333333 2.9018333333333333l-5.75 23A3.8333333333333335 3.8333333333333335 0 0 0 16.40666666666667 53.66666666666667z M15.333333333333334 38.333333333333336h61.333333333333336 M38.333333333333336 23l-3.8333333333333335 30.666666666666668 M53.66666666666667 23l3.8333333333333335 30.666666666666668 M46 53.66666666666667v15.333333333333334 M26.833333333333336 69h38.333333333333336');

    const gaugeEnter = enter.append('g').attr('class', 'solar-gauge');
    gaugeEnter.append('path').attr('class', 'solar-gauge-bg');
    gaugeEnter.append('path').attr('class', 'solar-gauge-value');
    gaugeEnter.append('text').attr('class', 'solar-gauge-power');
    gaugeEnter.append('text').attr('class', 'solar-panel-values');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, { id: string; model: SolarChargerDisplayModel; y: number }, SVGGElement, unknown>);

    merged.attr('transform', item => `translate(0, ${item.y})`);
    merged.select('rect.solar-card-bg')
      .attr('x', 0)
      .attr('y', 0)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('width', WidgetSolarChargerComponent.VIEWBOX_WIDTH)
      .attr('height', WidgetSolarChargerComponent.CARD_HEIGHT)
      .attr('fill', 'var(--mat-sys-background)')
      .attr('stroke', 'var(--kip-widget-card-border-color)');

    merged.select('text.solar-title')
      .attr('x', 5)
      .attr('y', 16)
      .attr('font-size', 15.5)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.model.titleText);

    merged.select('text.solar-battery-label')
      .attr('x', 100)
      .attr('y', 16)
      .attr('font-size', 8)
      .attr('fill', 'var(--kip-contrast-dim-color)');

    merged.select('text.solar-charger')
      .attr('x', 100)
      .attr('y', 26)
      .attr('font-size', 6)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.model.charger);

    merged.select('text.solar-battery-values')
      .attr('x', 100)
      .attr('y', 36)
      .attr('font-size', 6)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.model.batterySectionText);

    merged.select('text.solar-relay-label')
      .attr('x', 100)
      .attr('y', 76)
      .attr('font-size', 8)
      .attr('fill', 'var(--kip-contrast-dim-color)');

    merged.select('text.solar-relay-values')
      .attr('x', 100)
      .attr('y', 86)
      .attr('font-size', 6)
      .attr('fill', 'var(--kip-contrast-color)')
      .text(item => item.model.relaySectionText);

    merged.select('g.solar-panel-icon')
      .attr('transform', 'translate(100, 0)')
      .attr('fill', 'none')
      .attr('stroke', item => item.model.panelPowerColor)
      .attr('stroke-opacity', 0.5)
      .attr('stroke-width', 1)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');

    merged.select('g.solar-gauge').attr('transform', 'translate(50, 70)');

    merged.select('path.solar-gauge-bg')
      .attr('d', this.gaugeBackgroundPath)
      .attr('fill', 'none')
      .attr('stroke', 'var(--kip-contrast-dimmer-color)')
      .attr('stroke-width', WidgetSolarChargerComponent.GAUGE_BG_STROKE)
      .attr('stroke-linecap', 'round');

    merged.select('path.solar-gauge-value')
      .attr('d', item => item.model.gaugeValuePath)
      .attr('fill', 'none')
      .attr('stroke', item => item.model.gaugeValueColor)
      .attr('stroke-width', WidgetSolarChargerComponent.GAUGE_VALUE_STROKE)
      .attr('stroke-linecap', 'round');

    merged.select('text.solar-gauge-power')
      .attr('x', 0)
      .attr('y', 0)
      .attr('text-anchor', 'middle')
      .attr('font-size', 25)
      .attr('font-weight', 700)
      .attr('fill', 'var(--kip-contrast-color)')
      .each((item, index, nodes) => {
        const text = d3.select(nodes[index]);
        text.selectAll('*').remove();
        text.append('tspan')
          .attr('class', 'solar-gauge-power-value')
          .text(item.model.panelPowerText);

        if (!item.model.panelPowerUnitText) {
          return;
        }

        text.append('tspan')
          .attr('class', 'solar-gauge-power-unit')
          .attr('dx', 0)
          .attr('font-size', 11)
          .attr('font-weight', 500)
          .attr('fill', 'var(--kip-contrast-dim-color)')
          .text(item.model.panelPowerUnitText);
      });

    merged.select('text.solar-panel-values')
      .attr('x', 0)
      .attr('y', 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', 6)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.model.gaugeSectionText);

    selection.exit().remove();
  }

  private buildSemiGaugeArcPath(radius: number, ratio: number | null | undefined): string {
    const normalizedRatio = Math.max(0, Math.min(1, ratio ?? 0));
    const safeRatio = normalizedRatio >= 0.999 ? 1 : normalizedRatio;
    const startAngle = -Math.PI * 0.55;
    const fullRange = Math.PI * 1.1;
    const endAngle = startAngle + fullRange * safeRatio;

    if (safeRatio <= 0) {
      const x = radius * Math.cos(startAngle);
      const y = radius * Math.sin(startAngle);
      return `M ${x} ${y}`;
    }

    return d3.arc()({
      innerRadius: radius,
      outerRadius: radius,
      startAngle,
      endAngle
    }) ?? '';
  }

  private toNumber(value: unknown, unit: string): number | null {
    if (value == null || typeof value !== 'number') return null;
    return this.units.convertToUnit(unit, value) ?? value;
  }

  private toStringValue(value: unknown): string | null {
    if (typeof value === 'string') return value;
    if (value == null) return null;
    return `${value}`;
  }

  private valueOrDash(value: string | null | undefined): string {
    if (value === null) return '--';
    if (value === undefined) return '';
    return value;
  }

  private formatVoltage(value: number | null | undefined): string {
    if (value === null) return '--';
    if (value === undefined) return '';
    return `${value.toFixed(1)}V`;
  }

  private formatCurrent(value: number | null | undefined): string {
    if (value === null) return '--';
    if (value === undefined) return '';
    return `${value.toFixed(1)}A`;
  }

  private formatTemperature(value: number | null | undefined): string {
    if (value === null) return '--';
    if (value === undefined) return '';
    return `${value.toFixed(1)} ${this.units.getDefaults().Temperature === 'celsius' ? '°C' : '°F'}`;
  }

  private formatRelayState(value: string | number | boolean | null | undefined): string {
    if (value === null) return '--';
    if (value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'On' : 'Off';
    if (typeof value === 'number') return value > 0 ? 'On' : 'Off';
    return value;
  }

  private formatPowerAuto(value: number | null | undefined): { value: string; unit: string } {
    if (value === null) return { value: '--', unit: '' };
    if (value === undefined) return { value: '', unit: '' };
    const absValue = Math.abs(value);
    if (absValue >= 1000) {
      return { value: (value / 1000).toFixed(2), unit: 'kW' };
    }
    return { value: value.toFixed(0), unit: 'W' };
  }

  private static resolveZoneAwareColor(state: TState | null | undefined, fallbackColor: string, theme: ITheme | null, ignoreZones: boolean): string {
    if (ignoreZones) return fallbackColor;
    if (!state) return fallbackColor;
    if (!theme) return fallbackColor;

    switch (state) {
      case States.Alarm:
        return theme.zoneAlarm;
      case States.Warn:
        return theme.zoneWarn;
      case States.Normal:
        return theme.zoneNominal;
      default:
        return fallbackColor;
    }
  }
}
