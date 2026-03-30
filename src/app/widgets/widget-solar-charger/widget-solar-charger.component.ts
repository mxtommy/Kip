import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getColors, resolveZoneAwareColor } from '../../core/utils/themeColors.utils';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { UnitsService } from '../../core/services/units.service';
import type { ITheme } from '../../core/services/app-service';
import { States, TState } from '../../core/interfaces/signalk-interfaces';
import type { IWidgetSvcConfig, SolarOptionConfig, SolarWidgetConfig } from '../../core/interfaces/widgets-interface';
import type { SolarChargerDisplayModel, SolarChargerSnapshot } from './solar-charger.types';

interface SolarRenderSnapshot {
  solarUnits: SolarChargerSnapshot[];
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
      trackedSolarIds: [],
      solarOptionsById: {}
    }
  };

  private static readonly VIEWBOX_WIDTH = 200;
  private static readonly CARD_HEIGHT = 92;
  private static readonly CARD_GAP = 8;
  private static readonly SOLAR_PANEL_X = 135;
  private static readonly SOLAR_PANEL_Y = 0;
  private static readonly PATH_BATCH_WINDOW_MS = 500;

  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly data = inject(DataService);
  private readonly units = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('solarSvg');
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private layer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private glowFilterId = '';

  private renderFrameId: number | null = null;
  private pendingRenderSnapshot: SolarRenderSnapshot | null = null;
  private pathBatchTimerId: number | null = null;
  private initialPathPaintDone = false;
  private readonly pendingPathUpdates = new Map<string, { id: string; key: string; value: unknown; state: TState | null }>();

  protected readonly discoveredSolarIds = signal<string[]>([]);
  protected readonly trackedSolarIds = signal<string[]>([]);
  protected readonly solarOptionsById = signal<Record<string, SolarOptionConfig>>({});
  protected readonly chargers = signal<Record<string, SolarChargerSnapshot>>({});

  protected readonly visibleSolarIds = computed(() => {
    const tracked = this.trackedSolarIds();
    if (tracked.length) return tracked;
    return this.discoveredSolarIds();
  });

  protected readonly visibleSolarUnits = computed<SolarChargerSnapshot[]>(() => {
    const ids = this.visibleSolarIds();
    const map = this.chargers();
    return ids.map(id => map[id]).filter((item): item is SolarChargerSnapshot => !!item);
  });

  protected readonly colorRole = computed(() => this.runtime.options()?.color);
  protected readonly ignoreZones = computed(() => this.runtime.options()?.ignoreZones);

  protected readonly widgetColors = computed(() => {
    const theme = this.theme();
    if (!theme) return null;
    return getColors(this.colorRole(), theme);
  });

  protected readonly displayModels = computed<Record<string, SolarChargerDisplayModel>>(() => {
    const solarUnits = this.visibleSolarUnits();
    const options = this.solarOptionsById();
    const theme = this.theme();
    const widgetColors = this.widgetColors();
    const ignoreZones = this.ignoreZones();

    const models: Record<string, SolarChargerDisplayModel> = {};
    for (const solar of solarUnits) {
      const ratedPower = options[solar.id]?.arrayRatedPowerW ?? null;
      const panelPower = solar.panelPower ?? null;
      const panelPowerDisplay = this.formatPowerAuto(panelPower);
      const progress = ratedPower && ratedPower > 0 && panelPower != null
        ? Math.max(0, Math.min(1, panelPower / ratedPower))
        : 0;

      const panelPowerState = solar.panelPowerState ?? solar.panelCurrentState ?? null;
      const chargerCurrentState = solar.currentState ?? null;
      const panelPowerColor = resolveZoneAwareColor(
        panelPowerState,
        widgetColors?.dim ?? 'var(--kip-contrast-dim-color)',
        theme,
        ignoreZones
      );
      const panelPowerGlowEnabled = !ignoreZones && (
        panelPowerState === States.Warn
        || panelPowerState === States.Alarm
        || panelPowerState === States.Alert
      );
      const chargerCurrentTextColor = resolveZoneAwareColor(
        chargerCurrentState,
        'var(--kip-contrast-color)',
        theme,
        ignoreZones
      );
      const chargerMetaState = this.resolveMostSevereState(
        solar.voltageState ?? null,
        solar.temperatureState ?? null
      );
      const chargerMetaTextColor = resolveZoneAwareColor(
        chargerMetaState,
        'var(--kip-contrast-color)',
        theme,
        ignoreZones
      );
      const panelValuesState = this.resolveMostSevereState(
        solar.panelCurrentState ?? null,
        solar.panelVoltageState ?? null,
        solar.panelTemperatureState ?? null
      );
      const panelValuesTextColor = resolveZoneAwareColor(
        panelValuesState,
        'var(--kip-contrast-color)',
        theme,
        ignoreZones
      );
      const panelValuesGlowEnabled = !ignoreZones && (
        panelValuesState === States.Warn
        || panelValuesState === States.Alarm
        || panelValuesState === States.Alert
      );
      const relayValuesTextColor = resolveZoneAwareColor(
        solar.loadCurrentState ?? null,
        'var(--kip-contrast-color)',
        theme,
        ignoreZones
      );
      const mode = this.valueOrDash(solar.controllerMode);
      const relaySectionVisible = this.isRelayActive(solar.load);
      const relaySectionText = relaySectionVisible
        ? `${this.formatRelayState(solar.load)}\u00A0\u00A0\u00A0\u00A0${this.formatCurrent(solar.loadCurrent)}`.trim()
        : '';

      models[solar.id] = {
        id: solar.id,
        titleText: solar.name || `Controller ${solar.id}`,
        panelPowerText: panelPowerDisplay.value,
        panelPowerUnitText: panelPowerDisplay.unit,
        panelPowerColor,
        panelPowerGlowEnabled,
        chargerCurrentTextColor,
        chargerMetaTextColor,
        panelValuesTextColor,
        panelValuesGlowEnabled,
        gaugeProgress: progress,
        gaugeSectionText: `${this.formatVoltage(solar.panelVoltage)}` + (solar.panelCurrent != null ? `, ${this.formatCurrent(solar.panelCurrent)}` : '') + (solar.panelTemperature != null ? `, ${this.formatTemperature(solar.panelTemperature)}` : ''),
        chargerSectionCurrent: `${this.formatCurrent(solar.current)}`,
        chargerMode: `${mode.charAt(0).toUpperCase() + mode.slice(1)} mode`,
        chargerSectionMetadata: `${solar.voltage != null ? this.formatVoltage(solar.voltage) : ''}\u00A0\u00A0\u00A0\u00A0${solar.temperature != null ? this.formatTemperature(solar.temperature) : ''}`.trim(),
        relaySectionVisible,
        relaySectionText,
        relayValuesTextColor
      };
    }

    return models;
  });

  protected readonly hasChargers = computed(() => this.visibleSolarUnits().length > 0);

  constructor() {
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
      untracked(() => this.applyConfig(cfg));
    });

    effect(() => {
      const models = this.displayModels();
      const solarUnits = this.visibleSolarUnits();
      const widgetColors = this.widgetColors();
      if (!this.svg || !widgetColors) return;
      this.requestRender({ solarUnits, displayModels: models, widgetColors });
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

    this.glowFilterId = `solar-panel-glow-${this.id()}`;

    const defs = this.svg.append('defs');
    const glowFilter = defs.append('filter')
      .attr('id', this.glowFilterId)
      .attr('x', '-30%').attr('y', '-30%')
      .attr('width', '160%').attr('height', '160%');
    glowFilter.append('feFlood')
      .attr('class', 'solar-panel-glow-flood')
      .attr('flood-color', 'var(--kip-widget-card-background-color)')
      .attr('flood-opacity', 0.9)
      .attr('result', 'color');
    glowFilter.append('feComposite')
      .attr('in', 'color')
      .attr('in2', 'SourceGraphic')
      .attr('operator', 'in')
      .attr('result', 'coloredGlow');
    glowFilter.append('feGaussianBlur')
      .attr('in', 'coloredGlow')
      .attr('stdDeviation', 2)
      .attr('result', 'blur');
    const merge = glowFilter.append('feMerge');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'blur');
    merge.append('feMergeNode').attr('in', 'SourceGraphic');

    this.layer = this.svg.append('g').attr('class', 'solar-layer');
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const solarCfg = this.resolveSolarConfig(cfg);
    this.trackedSolarIds.set(solarCfg.trackedSolarIds);
    this.solarOptionsById.set(solarCfg.solarOptionsById);
  }

  private resolveSolarConfig(cfg: IWidgetSvcConfig): SolarWidgetConfig {
    const solar = cfg.solarCharger;
    const solarOptionsById = solar?.solarOptionsById ?? {};
    return {
      trackedSolarIds: Array.isArray(solar?.trackedSolarIds) ? solar.trackedSolarIds : [],
      solarOptionsById
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
    uniqueIds.forEach(id => this.trackDiscoveredSolar(id));

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

  private trackDiscoveredSolar(id: string): void {
    const ids = this.discoveredSolarIds();
    if (ids.includes(id)) return;
    this.discoveredSolarIds.set([...ids, id].sort());
  }

  private applyChargerValue(charger: SolarChargerSnapshot, key: string, value: unknown, state: TState | null): boolean {
    switch (key) {
      case 'name': return this.setValue(charger, 'name', this.toStringValue(value));
      case 'location': return this.setValue(charger, 'location', this.toStringValue(value));
      case 'associatedBus': return this.setValue(charger, 'associatedBus', this.toStringValue(value));
      case 'voltage': {
        const nextValue = this.toNumber(value, 'V');
        const stateChanged = !Object.is(charger.voltageState ?? null, state ?? null);
        if (Object.is(charger.voltage, nextValue) && !stateChanged) return false;
        charger.voltage = nextValue;
        charger.voltageState = state;
        return true;
      }
      case 'current': {
        const nextValue = this.toNumber(value, 'A');
        const stateChanged = !Object.is(charger.currentState ?? null, state ?? null);
        if (Object.is(charger.current, nextValue) && !stateChanged) return false;
        charger.current = nextValue;
        charger.currentState = state;
        return true;
      }
      case 'power': return this.setPowerPathValue(charger, 'rawBatteryPower', value);
      case 'temperature': {
        const nextValue = this.toNumber(value, this.units.getDefaults().Temperature);
        const stateChanged = !Object.is(charger.temperatureState ?? null, state ?? null);
        if (Object.is(charger.temperature, nextValue) && !stateChanged) return false;
        charger.temperature = nextValue;
        charger.temperatureState = state;
        return true;
      }
      case 'chargingAlgorithm': return this.setValue(charger, 'chargingAlgorithm', this.toStringValue(value));
      case 'chargerRole': return this.setValue(charger, 'chargerRole', this.toStringValue(value));
      case 'chargingMode': return this.setValue(charger, 'chargingMode', this.toStringValue(value));
      case 'setpointVoltage': return this.setValue(charger, 'setpointVoltage', this.toNumber(value, 'V'));
      case 'setpointCurrent': return this.setValue(charger, 'setpointCurrent', this.toNumber(value, 'A'));
      case 'controllerMode': return this.setValue(charger, 'controllerMode', this.toStringValue(value));
      case 'panelVoltage': {
        const nextValue = this.toNumber(value, 'V');
        const stateChanged = !Object.is(charger.panelVoltageState ?? null, state ?? null);
        if (Object.is(charger.panelVoltage, nextValue) && !stateChanged) return false;
        charger.panelVoltage = nextValue;
        charger.panelVoltageState = state;
        return true;
      }
      case 'panelCurrent': {
        const nextValue = this.toNumber(value, 'A');
        const stateChanged = !Object.is(charger.panelCurrentState ?? null, state ?? null);
        if (Object.is(charger.panelCurrent, nextValue) && !stateChanged) return false;
        charger.panelCurrent = nextValue;
        charger.panelCurrentState = state;
        return true;
      }
      case 'panelPower': {
        const nextValue = this.toNumber(value, 'W');
        const stateChanged = !Object.is(charger.panelPowerState ?? null, state ?? null);
        if (Object.is(charger.rawPanelPower, nextValue) && !stateChanged) return false;
        charger.rawPanelPower = nextValue;
        charger.panelPowerState = state;
        return true;
      }
      case 'panelTemperature': {
        const nextValue = this.toNumber(value, this.units.getDefaults().Temperature);
        const stateChanged = !Object.is(charger.panelTemperatureState ?? null, state ?? null);
        if (Object.is(charger.panelTemperature, nextValue) && !stateChanged) return false;
        charger.panelTemperature = nextValue;
        charger.panelTemperatureState = state;
        return true;
      }
      case 'load':
      case 'loadState':
      case 'load.state':
        return this.setValue(charger, 'load', value as string | number | boolean | null);
      case 'loadCurrent': {
        const nextValue = this.toNumber(value, 'A');
        const stateChanged = !Object.is(charger.loadCurrentState ?? null, state ?? null);
        if (Object.is(charger.loadCurrent, nextValue) && !stateChanged) return false;
        charger.loadCurrent = nextValue;
        charger.loadCurrentState = state;
        return true;
      }
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
      solarUnits: this.visibleSolarUnits(),
      displayModels: this.displayModels(),
      widgetColors
    };
  }

  private render(snapshot: SolarRenderSnapshot): void {
    if (!this.layer || !this.svg) return;

    const cards = snapshot.solarUnits.map((solar, index) => ({
      id: solar.id,
      model: snapshot.displayModels[solar.id],
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
    enter.append('text').attr('class', 'solar-charger-current');
    enter.append('text').attr('class', 'solar-charger-meta');
    enter.append('text').attr('class', 'solar-relay-label');
    enter.append('text').attr('class', 'solar-relay-values');

    const solarPanelIconEnter = enter.append('g').attr('class', 'solar-panel-icon');

    // Background layer
    solarPanelIconEnter.append('use')
      .attr('class', 'solar-panel-bg')
      .attr('href', 'assets/svg/symbols.svg#solar-panel-cells')
      .attr('x', WidgetSolarChargerComponent.SOLAR_PANEL_X)
      .attr('y', WidgetSolarChargerComponent.SOLAR_PANEL_Y);

    // Progress layer with clip path
    const progressGroup = solarPanelIconEnter.append('g').attr('class', 'solar-panel-progress');
    progressGroup.append('defs')
      .append('clipPath')
      .attr('clipPathUnits', 'objectBoundingBox')
      .attr('id', item => `solar-panel-clip-${this.id()}-${item.id}`)
      .append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', 1)
      .attr('width', 0);

    progressGroup.append('use')
      .attr('class', 'solar-panel-colored')
      .attr('href', 'assets/svg/symbols.svg#solar-panel-cells')
      .attr('x', WidgetSolarChargerComponent.SOLAR_PANEL_X)
      .attr('y', WidgetSolarChargerComponent.SOLAR_PANEL_Y)
      .attr('clip-path', item => `url(#solar-panel-clip-${this.id()}-${item.id})`);
    const panelPowerText = progressGroup.append('text').attr('class', 'solar-panel-power');
    panelPowerText.append('tspan').attr('class', 'solar-panel-power-value');
    panelPowerText.append('tspan').attr('class', 'solar-panel-power-unit');
    progressGroup.append('text').attr('class', 'solar-panel-values');

    const merged = enter.merge(selection as d3.Selection<SVGGElement, { id: string; model: SolarChargerDisplayModel; y: number }, SVGGElement, unknown>);

    merged.attr('transform', item => `translate(0, ${item.y})`);
    merged.select('rect.solar-card-bg')
      .attr('x', 0.5)
      .attr('y', 0.5)
      .attr('rx', 4)
      .attr('ry', 4)
      .attr('width', WidgetSolarChargerComponent.VIEWBOX_WIDTH - 1)
      .attr('height', WidgetSolarChargerComponent.CARD_HEIGHT - 1)
      .attr('stroke', 'var(--mat-sys-outline-variant)')
      .attr('stroke-width', 0.5)
      .attr('fill', 'none');

    merged.select('text.solar-title')
      .attr('x', 5)
      .attr('y', 16)
      .attr('font-size', 15.5)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .text(item => item.model.titleText);

    merged.select('text.solar-charger-current')
      .attr('x', 10)
      .attr('y', 37)
      .attr('font-size', 16)
      .attr('fill', item => item.model.chargerCurrentTextColor)
      .text(item => item.model.chargerSectionCurrent);

    merged.select('text.solar-charger')
      .attr('x', 10)
      .attr('y', 47)
      .attr('fill', 'var(--kip-contrast-color)')
      .attr('font-size', 6)
      .attr('opacity', 0.8)
      .text(item => item.model.chargerMode);

    merged.select('text.solar-charger-meta')
      .attr('x', 10)
      .attr('y', 53)
      .attr('font-size', 6)
      .attr('opacity', 0.8)
      .attr('fill', item => item.model.chargerMetaTextColor)
      .text(item => item.model.chargerSectionMetadata);

    merged.select('text.solar-relay-label')
      .attr('x', 10)
      .attr('y', 74)
      .attr('font-size', 8)
      .text(item => item.model.relaySectionVisible ? 'Load Output' : '');

    merged.select('text.solar-relay-values')
      .attr('x', 15)
      .attr('y', 83)
      .attr('font-size', 6)
      .attr('fill', item => item.model.relayValuesTextColor)
      .attr('opacity', item => item.model.relaySectionVisible ? 0.8 : 0)
      .text(item => item.model.relaySectionText);

    merged.select('g.solar-panel-icon')
      .attr('transform', 'translate(-3, 25) scale(0.63)');

    merged.select('use.solar-panel-bg')
      .attr('color', 'var(--kip-contrast-dimmer-color)');

    merged.select('g.solar-panel-progress')
      .each((item, index, nodes) => {
        const progressGroup = d3.select(nodes[index]);
        progressGroup.select('rect')
          .attr('width', item.model.gaugeProgress);
      });

    merged.select('use.solar-panel-colored')
      .attr('color', item => item.model.panelPowerColor);

    merged.select('text.solar-panel-power')
      .attr('x', 235)
      .attr('y', 58)
      .attr('text-anchor', 'middle')
      .attr('font-size', 40)
      .attr('font-weight', 700)
      .attr('filter', item => item.model.panelPowerGlowEnabled ? `url(#${this.glowFilterId})` : null)
      .attr('fill', 'var(--kip-contrast-color)');

    merged.select('tspan.solar-panel-power-value')
      .text(item => item.model.panelPowerText);

    merged.select('tspan.solar-panel-power-unit')
      .attr('dx', item => item.model.panelPowerUnitText ? 1 : 0)
      .attr('font-size', 22)
      .attr('font-weight', 500)
      .attr('fill', 'var(--kip-contrast-color)')
      .attr('opacity', item => item.model.panelPowerUnitText ? 1 : 0)
      .text(item => item.model.panelPowerUnitText);

    merged.select('text.solar-panel-values')
      .attr('x', 235)
      .attr('y', 76)
      .attr('text-anchor', 'middle')
      .attr('font-size', 12)
      .attr('font-weight', 500)
      .attr('opacity', 0.8)
      .attr('filter', item => item.model.panelValuesGlowEnabled ? `url(#${this.glowFilterId})` : null)
      .attr('fill', item => item.model.panelValuesTextColor)
      .text(item => item.model.gaugeSectionText);

    selection.exit().remove();
  }

  private toNumber(value: unknown, unit: string): number | null {
    if (value == null || typeof value !== 'number') return null;
    return this.units.convertToUnit(unit, value) ?? value;
  }

  private isRelayActive(value: string | number | boolean | null | undefined): boolean {
    if (value == null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;

    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (normalized === 'off' || normalized === 'false' || normalized === '0') return false;
    return true;
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

  private resolveMostSevereState(...states: (TState | null | undefined)[]): TState | null {
    let current: TState | null = null;
    const rank: Record<TState, number> = {
      [States.Normal]: 0,
      [States.Nominal]: 1,
      [States.Alert]: 2,
      [States.Warn]: 3,
      [States.Alarm]: 4,
      [States.Emergency]: 5
    };

    for (const state of states) {
      if (!state) continue;
      if (!current || rank[state] > rank[current]) {
        current = state;
      }
    }

    return current;
  }

}
