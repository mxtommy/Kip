import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs/operators';
import { getColors, resolveZoneAwareColor } from '../../core/utils/themeColors.utils';
import { BmsBankConfig, BmsBankConnectionMode, BmsWidgetConfig, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { UnitsService } from '../../core/services/units.service';
import type { ITheme } from '../../core/services/app-service';
import { States, TState } from '../../core/interfaces/signalk-interfaces';
import type {
  BmsBankDisplayModel,
  BmsBankSummary,
  BmsBatteryDisplayModel,
  BmsBatterySnapshot
} from './bms.types';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';

interface BmsRenderBank extends BmsBankSummary {
  displayModel: BmsBankDisplayModel;
  x: number;
  y: number;
  width: number;
  height: number;
  batteries: BmsRenderBattery[];
}

interface BmsRenderBattery extends BmsBatterySnapshot {
  displayModel: BmsBatteryDisplayModel;
  key: string;
  x: number;
  y: number;
  scale: number;
  compact: boolean;
}

interface BmsRenderLayout {
  banks: BmsRenderBank[];
  unassignedBatteries: BmsRenderBattery[];
  contentHeight: number;
}

interface BmsRenderSnapshot {
  banks: BmsBankSummary[];
  batteries: BmsBatterySnapshot[];
  batteryDisplayModels: Record<string, BmsBatteryDisplayModel>;
  bankDisplayModels: Record<string, BmsBankDisplayModel>;
  widgetColors: ReturnType<typeof getColors>;
}

@Component({
  selector: 'widget-bms',
  templateUrl: './widget-bms.component.html',
  styleUrl: './widget-bms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule]
})
export class WidgetBmsComponent implements AfterViewInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    color: 'contrast',
    ignoreZones: false,
    bms: {
      trackedBatteryIds: [],
      banks: []
    }
  };

  private static readonly VIEWBOX_WIDTH = 200;
  private static readonly MIN_VIEWBOX_HEIGHT = 1;
  private static readonly BANK_CARD_WIDTH = 200;
  private static readonly BATTERY_CARD_HEIGHT = 50;
  private static readonly BATTERY_CARD_WIDTH = 195;
  private static readonly CARD_GAP = 8;
  private static readonly BANK_HEADER_HEIGHT = 80;
  private static readonly BANK_MIN_HEIGHT = 75;
  private static readonly IN_BANK_COLUMNS = 2;
  private static readonly IN_BANK_COLUMN_GAP = 5;
  private static readonly IN_BANK_PADDING_X = 5;
  private static readonly BANK_GAUGE_RADIUS = 45;
  private static readonly BANK_GAUGE_BG_STROKE = 10;
  private static readonly BANK_GAUGE_VALUE_STROKE = 10;
  private static readonly PATH_BATCH_WINDOW_MS = 500;

  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly data = inject(DataService);
  private readonly units = inject(UnitsService);
  private readonly iconRegistry = inject(MatIconRegistry);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('bmsSvg');
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private root?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private bankLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private batteryLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private readonly bankGaugeBackgroundPath = this.buildSemiGaugeArcPath(WidgetBmsComponent.BANK_GAUGE_RADIUS, 1);

  private glowFilterId = '';
  private renderFrameId: number | null = null;
  private pendingRenderSnapshot: BmsRenderSnapshot | null = null;
  private pathBatchTimerId: number | null = null;
  private initialPathPaintDone = false;
  private readonly pendingPathUpdates = new Map<string, { id: string; key: string; value: unknown; state: TState | null }>();
  private powerAvailableIconTemplate: SVGElement | null = null;
  private powerRenewalIconTemplate: SVGElement | null = null;

  protected readonly discoveredBatteryIds = signal<string[]>([]);
  protected readonly trackedBatteryIds = signal<string[]>([]);
  protected readonly banks = signal<BmsBankConfig[]>([]);
  protected readonly batteries = signal<Record<string, BmsBatterySnapshot>>({});

  protected readonly visibleBatteryIds = computed(() => {
    const tracked = this.trackedBatteryIds();
    if (tracked.length) return tracked;
    return this.discoveredBatteryIds();
  });

  protected readonly visibleBatteries = computed<BmsBatterySnapshot[]>(() => {
    const ids = this.visibleBatteryIds();
    const map = this.batteries();
    return ids.map(id => map[id]).filter((item): item is BmsBatterySnapshot => !!item);
  });

  protected readonly bankSummaries = computed<BmsBankSummary[]>(() => {
    const banks = this.banks();
    const map = this.batteries();
    return banks.map(bank => this.buildBankSummary(bank, map));
  });

  protected readonly colorRole = computed(() => this.runtime.options()?.color);
  protected readonly ignoreZones = computed(() => this.runtime.options()?.ignoreZones);

  protected readonly widgetColors = computed(() => {
    const theme = this.theme();
    if (!theme) return null;
    return getColors(this.colorRole(), theme);
  });

  protected readonly batteryDisplayModels = computed<Record<string, BmsBatteryDisplayModel>>(() => {
    const batteries = this.visibleBatteries();
    const theme = this.theme();
    const widgetColors = this.widgetColors();
    const ignoreZones = this.ignoreZones();

    const models: Record<string, BmsBatteryDisplayModel> = {};
    for (const battery of batteries) {
      const chargeBarColorCompact = resolveZoneAwareColor(
        battery.stateOfChargeState,
        widgetColors?.dimmer ?? 'var(--kip-contrast-dimmer-color)',
        theme,
        ignoreZones
      );
      const chargeBarColorRegular = resolveZoneAwareColor(
        battery.stateOfChargeState,
        widgetColors?.dim ?? 'var(--kip-contrast-dim-color)',
        theme,
        ignoreZones
      );
      const currentTextColorCompact = resolveZoneAwareColor(
        battery.currentState,
        'var(--kip-contrast-dim-color)',
        theme,
        ignoreZones
      );
      const currentTextColorRegular = resolveZoneAwareColor(
        battery.currentState,
        'var(--kip-contrast-color)',
        theme,
        ignoreZones
      );

      models[battery.id] = {
        id: battery.id,
        titleText: battery.name || `Battery ${battery.id}`,
        chargeWidth: (WidgetBmsComponent.BATTERY_CARD_WIDTH - 3) * (battery.stateOfCharge ?? 0),
        chargeBarColorCompact,
        chargeBarColorRegular,
        currentTextColorCompact,
        currentTextColorRegular,
        currentText: `${this.formatCurrent(battery.current)}`.trim(),
        detailLineCompact: `${this.formatVoltage(battery.voltage)}\u00A0\u00A0\u00A0\u00A0${this.formatTemperature(battery.temperature)}`,
        detailLineRegular: `${this.formatVoltage(battery.voltage)}\u00A0\u00A0\u00A0\u00A0${this.formatPower(battery.power)}\u00A0\u00A0\u00A0\u00A0${this.formatTemperature(battery.temperature)}`.trim(),
        socText: this.formatSoc(battery.stateOfCharge),
        socGlowEnabled: !ignoreZones && (
          battery.stateOfChargeState === States.Warn
          || battery.stateOfChargeState === States.Alarm
          || battery.stateOfChargeState === States.Alert
        ),
        actualCapacityText: battery.capacityActual ? `${battery.capacityActual} kWh` : '',
        remainingText: `${this.formatDuration(battery.timeRemaining)}`.trim(),
        iconKey: battery.current != null && battery.current > 0 ? 'power_renewal' : 'power_available'
      };
    }

    return models;
  });

  protected readonly bankDisplayModels = computed<Record<string, BmsBankDisplayModel>>(() => {
    const banks = this.bankSummaries();
    const widgetColors = this.widgetColors();

    const models: Record<string, BmsBankDisplayModel> = {};
    for (const bank of banks) {
      models[bank.id] = {
        id: bank.id,
        titleText: bank.name || 'Bank',
        currentText: this.formatCurrent(bank.totalCurrent),
        powerText: this.formatPower(bank.totalPower),
        socText: this.formatSoc(bank.avgSoc),
        remainingText: `${this.formatDuration(bank.timeRemaining)}`.trim(),
        remainingCapacityText: bank.remainingCapacity ? `${bank.remainingCapacity} kWh` : '',
        gaugeValuePath: this.buildSemiGaugeArcPath(WidgetBmsComponent.BANK_GAUGE_RADIUS, bank.avgSoc),
        gaugeValueColor: widgetColors?.color ?? 'var(--kip-contrast-color)',
        zoneState: null,
        zoneColor: null
      };
    }

    return models;
  });

  protected readonly hasBatteries = computed(() => this.visibleBatteries().length > 0);

  constructor() {
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
        untracked(() => this.applyConfig(cfg));
    });

    effect(() => {
      const banks = this.bankSummaries();
      const batteries = this.visibleBatteries();
      const widgetColors = this.widgetColors();
      const batteryDisplayModels = this.batteryDisplayModels();
      const bankDisplayModels = this.bankDisplayModels();
      if (!this.svg || !widgetColors) return;

      this.requestRender({
        banks,
        batteries,
        batteryDisplayModels,
        bankDisplayModels,
        widgetColors
      });
    });

    const batteryTree = this.data.subscribePathTreeWithInitial('self.electrical.batteries.*');

    if (batteryTree.initial.length) {
      for (const update of batteryTree.initial) {
        this.enqueuePathUpdate(update, true);
      }
      this.flushPendingPathUpdates();
      this.initialPathPaintDone = true;
    }

    batteryTree.live$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => {
        this.enqueuePathUpdate(update);
      });
  }

  ngAfterViewInit(): void {
    this.initializeSvg();
    this.loadPowerIcons();
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
      .attr('viewBox', `0 0 ${WidgetBmsComponent.VIEWBOX_WIDTH} ${WidgetBmsComponent.MIN_VIEWBOX_HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Battery Management System View');

    this.glowFilterId = `bms-soc-glow-${this.id()}`;

    const defs = this.svg.append('defs');
    const glowFilter = defs.append('filter')
      .attr('id', this.glowFilterId)
      .attr('x', '-30%').attr('y', '-30%')
      .attr('width', '160%').attr('height', '160%');
    glowFilter.append('feFlood')
      .attr('class', 'bms-soc-glow-flood')
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

    this.root = this.svg.append('g').attr('class', 'bms-root');
    this.bankLayer = this.root.append('g').attr('class', 'bms-banks');
    this.batteryLayer = this.root.append('g').attr('class', 'bms-batteries');
  }

  private loadPowerIcons(): void {
    this.loadNamedIcon('power_available', icon => {
      this.powerAvailableIconTemplate = icon;
    });
    this.loadNamedIcon('power_renewal', icon => {
      this.powerRenewalIconTemplate = icon;
    });
  }

  private loadNamedIcon(iconName: string, onLoaded: (icon: SVGElement) => void): void {
    this.iconRegistry.getNamedSvgIcon(iconName)
      .pipe(take(1))
      .subscribe({
        next: icon => {
          onLoaded(icon);
          this.requestRender();
        },
        error: () => {
        }
      });
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const bmsCfg = this.resolveBmsConfig(cfg);
    this.trackedBatteryIds.set(bmsCfg.trackedBatteryIds);
    this.banks.set(bmsCfg.banks);
  }

  private resolveBmsConfig(cfg: IWidgetSvcConfig): BmsWidgetConfig {
    const bms = cfg.bms;
    return {
      trackedBatteryIds: Array.isArray(bms?.trackedBatteryIds) ? bms.trackedBatteryIds : [],
      banks: (Array.isArray(bms?.banks) ? bms.banks : []).map(bank => ({
        ...bank,
        connectionMode: this.normalizeConnectionMode(bank.connectionMode)
      }))
    };
  }

  private normalizeConnectionMode(mode: unknown): BmsBankConnectionMode {
    return mode === 'series' ? 'series' : 'parallel';
  }

  private enqueuePathUpdate(update: IPathUpdateWithPath, fromInitial = false): void {
    const match = this.parseBatteryPath(update.path);
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
    }, WidgetBmsComponent.PATH_BATCH_WINDOW_MS);
  }

  private flushPendingPathUpdates(): void {
    if (!this.pendingPathUpdates.size) return;

    const updates = Array.from(this.pendingPathUpdates.values());
    this.pendingPathUpdates.clear();

    const uniqueBatteryIds = new Set(updates.map(update => update.id));
    uniqueBatteryIds.forEach(id => this.trackDiscoveredBattery(id));

    this.batteries.update(current => {
      let nextState = current;
      let hasChanges = false;

      for (const update of updates) {
        const existing = nextState[update.id] ?? { id: update.id } as BmsBatterySnapshot;
        const next = { ...existing } as BmsBatterySnapshot;
        const valueChanged = this.applyBatteryValue(next, update.key, update.value, update.state);

        let powerChanged = false;
        if (next.voltage != null && next.current != null) {
          const power = Number.isFinite(next.voltage) && Number.isFinite(next.current)
            ? next.voltage * next.current
            : null;
          if (!Object.is(next.power, power)) {
            next.power = power;
            powerChanged = true;
          }
        }

        if (!valueChanged && !powerChanged) continue;

        if (!hasChanges) {
          nextState = { ...nextState };
          hasChanges = true;
        }

        nextState[update.id] = next;
      }

      return hasChanges ? nextState : current;
    });
  }

  private parseBatteryPath(path: string): { id: string; key: string } | null {
    const match = path.match(/self\.electrical\.batteries\.([^.]+)\.(.+)$/);
    if (!match) return null;
    return { id: match[1], key: match[2] };
  }

  private trackDiscoveredBattery(id: string): void {
    const ids = this.discoveredBatteryIds();
    if (ids.includes(id)) return;
    const next = [...ids, id].sort();
    this.discoveredBatteryIds.set(next);
  }

  private applyBatteryValue(battery: BmsBatterySnapshot, key: string, value: unknown, state: TState | null): boolean {
    switch (key) {
      case 'name': {
        const nextValue = value as string;
        if (battery.name === nextValue) return false;
        battery.name = nextValue;
        return true;
      }
      case 'location': {
        const nextValue = value as string;
        if (battery.location === nextValue) return false;
        battery.location = nextValue;
        return true;
      }
      case 'chemistry': {
        const nextValue = value as string;
        if (battery.chemistry === nextValue) return false;
        battery.chemistry = nextValue;
        return true;
      }
      case 'voltage': {
        const nextValue = this.toNumber(value, 'V');
        if (Object.is(battery.voltage, nextValue)) return false;
        battery.voltage = nextValue;
        return true;
      }
      case 'current': {
        const nextValue = this.toNumber(value, 'A');
        const stateChanged = !Object.is(battery.currentState ?? null, state ?? null);
        if (Object.is(battery.current, nextValue) && !stateChanged) return false;
        battery.current = nextValue;
        battery.currentState = state;
        return true;
      }
      case 'temperature': {
        const nextValue = this.toNumber(value, this.units.getDefaults().Temperature);
        if (Object.is(battery.temperature, nextValue)) return false;
        battery.temperature = nextValue;
        return true;
      }
      case 'capacity.nominal': {
        const nextValue = this.toNumber(value, 'kWh');
        if (Object.is(battery.capacityNominal, nextValue)) return false;
        battery.capacityNominal = nextValue;
        return true;
      }
      case 'capacity.actual': {
        const nextValue = this.toNumber(value, 'kWh');
        if (Object.is(battery.capacityActual, nextValue)) return false;
        battery.capacityActual = nextValue;
        return true;
      }
      case 'capacity.remaining': {
        const nextValue = this.toNumber(value, 'kWh');
        if (Object.is(battery.capacityRemaining, nextValue)) return false;
        battery.capacityRemaining = nextValue;
        return true;
      }
      case 'capacity.stateOfCharge': {
        const nextValue = this.toNumber(value, 'ratio');
        const stateChanged = !Object.is(battery.stateOfChargeState ?? null, state ?? null);
        if (Object.is(battery.stateOfCharge, nextValue) && !stateChanged) return false;
        battery.stateOfCharge = nextValue;
        battery.stateOfChargeState = state;
        return true;
      }
      case 'capacity.timeRemaining': {
        const nextValue = this.toNumber(value, 's');
        if (Object.is(battery.timeRemaining, nextValue)) return false;
        battery.timeRemaining = nextValue;
        return true;
      }
      default:
        return false;
    }
  }

  private buildBankSummary(bank: BmsBankConfig, map: Record<string, BmsBatterySnapshot>): BmsBankSummary {
    const items = bank.batteryIds.map(id => map[id]).filter((item): item is BmsBatterySnapshot => !!item);
    const connectionMode = this.normalizeConnectionMode(bank.connectionMode);
    const totalCurrent = this.calculateBankCurrent(items, connectionMode);
    const totalPower = this.sumNumbers(items.map(item => item.power));
    const remainingCapacity = this.sumNumbers(items.map(item => item.capacityRemaining));
    const avgSoc = this.calculateBankSoc(items);
    const timeRemaining = this.calculateBankTimeRemaining(items, connectionMode);

    return {
      id: bank.id,
      name: bank.name,
      batteryIds: bank.batteryIds,
      totalCurrent,
      totalPower,
      remainingCapacity,
      avgSoc,
      timeRemaining
    };
  }

  private calculateBankSoc(items: BmsBatterySnapshot[]): number | null {
    const remainingTotal = this.sumNumbers(items.map(item => item.capacityRemaining));
    const actualTotal = this.sumNumbers(items.map(item => item.capacityActual));
    if (remainingTotal != null && actualTotal != null && actualTotal > 0) {
      return Math.max(0, Math.min(1, remainingTotal / actualTotal));
    }

    const nominalTotal = this.sumNumbers(items.map(item => item.capacityNominal));
    if (remainingTotal != null && nominalTotal != null && nominalTotal > 0) {
      return Math.max(0, Math.min(1, remainingTotal / nominalTotal));
    }

    return this.averageNumbers(items.map(item => item.stateOfCharge));
  }

  private calculateBankCurrent(items: BmsBatterySnapshot[], mode: BmsBankConnectionMode): number | null {
    const values = items.map(item => item.current);
    if (mode === 'series') {
      return this.averageNumbers(values);
    }
    return this.sumNumbers(values);
  }

  private calculateBankTimeRemaining(items: BmsBatterySnapshot[], mode: BmsBankConnectionMode): number | null {
    const values = items.map(item => item.timeRemaining);
    if (mode === 'series') {
      return this.minNumber(values);
    }
    return this.averageNumbers(values);
  }

  private requestRender(snapshot?: BmsRenderSnapshot): void {
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

  private buildRenderSnapshot(): BmsRenderSnapshot | null {
    const widgetColors = this.widgetColors();
    if (!widgetColors) return null;

    return {
      banks: this.bankSummaries(),
      batteries: this.visibleBatteries(),
      batteryDisplayModels: this.batteryDisplayModels(),
      bankDisplayModels: this.bankDisplayModels(),
      widgetColors
    };
  }

  private render(snapshot: BmsRenderSnapshot): void {
    if (!this.bankLayer || !this.batteryLayer) return;
    const { banks, batteries, bankDisplayModels, batteryDisplayModels, widgetColors } = snapshot;

    const renderLayout = this.buildRenderLayout(banks, batteries, bankDisplayModels, batteryDisplayModels);
    const viewBoxHeight = Math.max(WidgetBmsComponent.MIN_VIEWBOX_HEIGHT, renderLayout.contentHeight);
    this.svg?.attr('viewBox', `0 0 ${WidgetBmsComponent.VIEWBOX_WIDTH} ${viewBoxHeight}`);
    this.root?.attr('transform', null);

    const bankSelection = this.bankLayer
      .selectAll<SVGGElement, BmsRenderBank>('g.bank-card')
      .data(renderLayout.banks, item => item.id);

    const bankEnter = bankSelection.enter().append('g').attr('class', 'bank-card');
    bankEnter.append('rect').attr('class', 'bank-card').attr('rx', 4).attr('ry', 4);
    bankEnter.append('text').attr('class', 'bank-card-power');
    bankEnter.append('text').attr('class', 'bank-card-current');
    const gaugeEnter = bankEnter.append('g').attr('class', 'bank-gauge');
    gaugeEnter.append('path').attr('class', 'bank-gauge-bg');
    gaugeEnter.append('path').attr('class', 'bank-gauge-value');
    gaugeEnter.append('text').attr('class', 'bank-gauge-soc');
    bankEnter.append('text').attr('class', 'bank-actualCapacity');
    bankEnter.append('text').attr('class', 'bank-remaining');
    bankEnter.append('g').attr('class', 'bank-bms-batteries');
    bankEnter.append('text').attr('class', 'bank-title');

    const bankMerged = bankEnter.merge(bankSelection as d3.Selection<SVGGElement, BmsRenderBank, SVGGElement, unknown>);
    bankMerged.attr('transform', item => `translate(${item.x + 0.5},${item.y + 0.5})`);
    bankMerged.select('rect')
      .attr('width', item => item.width - 1)
      .attr('height', item => item.height - 1)
      .attr('stroke', 'var(--mat-sys-outline-variant)')
      .attr('stroke-width', 0.5);
    bankMerged.select('text.bank-title')
      .attr('x', 5)
      .attr('y', 16)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('font-size', 15.5)
      .attr('opacity', 0.8)
      .text(item => item.displayModel.titleText);
    bankMerged.select('text.bank-card-current')
      .attr('x', 10)
      .attr('y', 37)
      .attr('fill', 'var(--kip-contrast-color)')
      .attr('font-size', 16)
      .text(item => item.displayModel.currentText);
    bankMerged.select('text.bank-card-power')
      .attr('x', 10)
      .attr('y', 49)
      .attr('fill', 'var(--kip-contrast-color)')
      .attr('font-size', 10)
      .attr('opacity', 0.8)
      .text(item => item.displayModel.powerText);

    bankMerged.select('g.bank-gauge')
      .attr('transform', 'translate(143, 60)');
    bankMerged.select('path.bank-gauge-bg')
      .attr('d', this.bankGaugeBackgroundPath)
      .attr('fill', 'none')
      .attr('stroke', 'var(--kip-contrast-dimmer-color)')
      .attr('stroke-width', WidgetBmsComponent.BANK_GAUGE_BG_STROKE)
      .attr('stroke-linecap', 'round');
    bankMerged.select('path.bank-gauge-value')
      .attr('d', item => item.displayModel.gaugeValuePath)
      .attr('fill', 'none')
      .attr('stroke', item => item.displayModel.gaugeValueColor)
      .attr('stroke-width', WidgetBmsComponent.BANK_GAUGE_VALUE_STROKE)
      .attr('stroke-linecap', 'round');
    bankMerged.select('text.bank-gauge-soc')
      .attr('x', 0)
      .attr('y', -2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--kip-contrast-color)')
      .attr('font-size', 25)
      .attr('font-weight', 700)
      .text(item => item.displayModel.socText);
    bankMerged.select('text.bank-remaining')
      .attr('x', 143)
      .attr('y', 37)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 6)
      .text(item => item.displayModel.remainingText);
    bankMerged.select('text.bank-actualCapacity')
      .attr('x', 143)
      .attr('y', 68)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .text(item => item.displayModel.remainingCapacityText);
    bankMerged
      .select<SVGGElement>('g.bank-bms-batteries')
      .each((bankItem, index, nodes) => {
        const inBankContainer = d3.select(nodes[index]);
        const inBankSelection = inBankContainer
          .selectAll<SVGGElement, BmsRenderBattery>('g.battery-card')
          .data(bankItem.batteries, battery => battery.key);

        const inBankEnter = inBankSelection
          .enter()
          .append('g')
          .attr('class', 'battery-card battery-card--in-bank');
        this.appendBatteryCardSkeleton(inBankEnter);

        const inBankMerged = inBankEnter.merge(
          inBankSelection as d3.Selection<SVGGElement, BmsRenderBattery, SVGGElement, unknown>
        );
        this.renderBatteryCards(inBankMerged, widgetColors);

        inBankSelection.exit().remove();
      });

    bankSelection.exit().remove();

    const batterySelection = this.batteryLayer
      .selectAll<SVGGElement, BmsRenderBattery>('g.battery-card')
      .data(renderLayout.unassignedBatteries, item => item.key);

    const batteryEnter = batterySelection
      .enter()
      .append('g')
      .attr('class', 'battery-card battery-card--unassigned');

    this.appendBatteryCardSkeleton(batteryEnter);

    const batteryMerged = batteryEnter.merge(
      batterySelection as d3.Selection<SVGGElement, BmsRenderBattery, SVGGElement, unknown>
    );
    this.renderBatteryCards(batteryMerged, widgetColors);

    batterySelection.exit().remove();

    this.root?.attr('data-theme', 'ready');
  }

  private buildRenderLayout(
    banks: BmsBankSummary[],
    batteries: BmsBatterySnapshot[],
    bankDisplayModels: Record<string, BmsBankDisplayModel>,
    batteryDisplayModels: Record<string, BmsBatteryDisplayModel>
  ): BmsRenderLayout {
    const batteryById = new Map<string, BmsBatterySnapshot>(batteries.map(battery => [battery.id, battery]));
    const assignedBatteryIds = new Set<string>();
    const inBankSlotWidth = this.computeInBankBatterySlotWidth();
    const inBankScale = Math.max(0.35, Math.min(1, inBankSlotWidth / WidgetBmsComponent.BATTERY_CARD_WIDTH));
    const inBankRenderedHeight = WidgetBmsComponent.BATTERY_CARD_HEIGHT * inBankScale;
    let nextBankY = 0;

    const renderBanks = banks.map(bank => {
      const seenInBank = new Set<string>();
      const assigned = bank.batteryIds
        .map(id => batteryById.get(id))
        .filter((item): item is BmsBatterySnapshot => {
          if (!item) return false;
          if (seenInBank.has(item.id)) return false;
          seenInBank.add(item.id);
          return true;
        });

      assigned.forEach(item => assignedBatteryIds.add(item.id));

      const rows = Math.ceil(assigned.length / WidgetBmsComponent.IN_BANK_COLUMNS);
      const batterySectionHeight = rows > 0
        ? rows * inBankRenderedHeight + (rows - 1) * WidgetBmsComponent.CARD_GAP
        : 0;

      const bankHeight = Math.max(
        WidgetBmsComponent.BANK_MIN_HEIGHT,
        WidgetBmsComponent.BANK_HEADER_HEIGHT + batterySectionHeight + WidgetBmsComponent.CARD_GAP
      );

      const batteryCards: BmsRenderBattery[] = assigned.map((battery, index) => {
        const column = index % WidgetBmsComponent.IN_BANK_COLUMNS;
        const row = Math.floor(index / WidgetBmsComponent.IN_BANK_COLUMNS);
        const x = WidgetBmsComponent.IN_BANK_PADDING_X + column * (inBankSlotWidth + WidgetBmsComponent.IN_BANK_COLUMN_GAP);
        const y = WidgetBmsComponent.BANK_HEADER_HEIGHT + row * (inBankRenderedHeight + WidgetBmsComponent.CARD_GAP);
        return {
          id: battery.id,
          displayModel: batteryDisplayModels[battery.id],
          key: `${bank.id}::${battery.id}`,
          x,
          y,
          scale: inBankScale,
          compact: true
        };
      });

      const renderBank: BmsRenderBank = {
        id: bank.id,
        name: bank.name,
        batteryIds: bank.batteryIds,
        totalCurrent: bank.totalCurrent,
        totalPower: bank.totalPower,
        avgSoc: bank.avgSoc,
        remainingCapacity: bank.remainingCapacity,
        timeRemaining: bank.timeRemaining,
        displayModel: bankDisplayModels[bank.id],
        x: 0,
        y: nextBankY,
        width: WidgetBmsComponent.BANK_CARD_WIDTH,
        height: bankHeight,
        batteries: batteryCards
      };
      nextBankY += bankHeight + WidgetBmsComponent.CARD_GAP;
      return renderBank;
    });

    const unassignedStartY = renderBanks.length > 0 ? nextBankY : 0;
    const unassignedBatteries = batteries
      .filter(battery => !assignedBatteryIds.has(battery.id))
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((battery, index): BmsRenderBattery => ({
        id: battery.id,
        displayModel: batteryDisplayModels[battery.id],
        key: battery.id,
        x: 0,
        y: unassignedStartY + index * (WidgetBmsComponent.BATTERY_CARD_HEIGHT + WidgetBmsComponent.CARD_GAP),
        scale: 1,
        compact: false
      }));

    const lastBank = renderBanks[renderBanks.length - 1];
    const bankBottom = lastBank ? lastBank.y + lastBank.height : 0;
    const lastUnassigned = unassignedBatteries[unassignedBatteries.length - 1];
    const unassignedBottom = lastUnassigned ? lastUnassigned.y + WidgetBmsComponent.BATTERY_CARD_HEIGHT : 0;

    return {
      banks: renderBanks,
      unassignedBatteries,
      contentHeight: Math.max(bankBottom, unassignedBottom)
    };
  }

  private computeInBankBatterySlotWidth(): number {
    const totalInnerWidth = WidgetBmsComponent.BANK_CARD_WIDTH
      - WidgetBmsComponent.IN_BANK_PADDING_X * 2
      - WidgetBmsComponent.IN_BANK_COLUMN_GAP;
    return totalInnerWidth / WidgetBmsComponent.IN_BANK_COLUMNS;
  }

  private appendBatteryCardSkeleton(selection: d3.Selection<SVGGElement, BmsRenderBattery, SVGGElement, unknown>): void {
    selection.append('rect').attr('class', 'bms-battery').attr('rx', 4).attr('ry', 4);
    selection.append('rect').attr('class', 'bms-battery-tip').attr('rx', 1).attr('ry', 1);
    selection.append('rect').attr('class', 'bms-charge-fill').attr('rx', 3).attr('ry', 3);
    selection.append('g').attr('class', 'bms-state-icon');
    selection.append('text').attr('class', 'bms-ampere');
    selection.append('text').attr('class', 'bms-volt-power');
    selection.append('text').attr('class', 'bms-soc');
    selection.append('text').attr('class', 'bms-actualCapacity');
    selection.append('text').attr('class', 'bms-remaining');
    selection.append('text').attr('class', 'bms-title');
  }

  private renderBatteryCards(
    selection: d3.Selection<SVGGElement, BmsRenderBattery, SVGGElement, unknown>,
    widgetColors: ReturnType<typeof getColors>
  ): void {
    selection.attr('transform', item => `translate(${item.x},${item.y}) scale(${item.scale})`);
    selection.select('rect.bms-battery')
      .attr('width', item => item.compact ? WidgetBmsComponent.BATTERY_CARD_WIDTH - WidgetBmsComponent.CARD_GAP : WidgetBmsComponent.BATTERY_CARD_WIDTH)
      .attr('height', WidgetBmsComponent.BATTERY_CARD_HEIGHT)
      .attr('fill', item => item.compact ? 'var(--mat-sys-background)' : 'var(--kip-contrast-dimmer-color)')
      .attr('stroke', 'var(--kip-contrast-dimmer-color)')
      .attr('stroke-width', 0);
    selection.select('rect.bms-battery-tip')
      .attr('x', WidgetBmsComponent.BATTERY_CARD_WIDTH + 1)
      .attr('y', WidgetBmsComponent.BATTERY_CARD_HEIGHT / 2 - 10)
      .attr('width', 4)
      .attr('height', 20)
      .attr('fill', item => item.compact ? 'var(--mat-sys-background)' : 'var(--kip-contrast-dimmer-color)')
      .attr('stroke', widgetColors.color)
      .attr('stroke-width', 0);
    selection.select('rect.bms-charge-fill')
      .attr('x', 1.5)
      .attr('y', 1.5)
      .attr('width', item => item.displayModel.chargeWidth)
      .attr('height', WidgetBmsComponent.BATTERY_CARD_HEIGHT - 3)
      .attr('fill', item => item.compact ? item.displayModel.chargeBarColorCompact : item.displayModel.chargeBarColorRegular);
    selection.select('text.bms-title')
      .attr('x', 5)
      .attr('y', item => item.compact ? 11 : 14)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('font-size', item => item.compact ? 8 : 12)
      .attr('filter', item => item.displayModel.socGlowEnabled ? `url(#${this.glowFilterId})` : null)
      .text(item => item.displayModel.titleText);
    selection.select('text.bms-ampere')
      .attr('x', 10)
      .attr('y', 33)
      .attr('fill', item => item.compact ? item.displayModel.currentTextColorCompact : item.displayModel.currentTextColorRegular)
      .attr('font-size', 16)
      .attr('filter', item => item.displayModel.socGlowEnabled ? `url(#${this.glowFilterId})` : null)
      .text(item => item.displayModel.currentText);
    selection.select('text.bms-volt-power')
      .attr('x', 10)
      .attr('y', 45)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('font-size', 8)
      .attr('opacity', 0.8)
      .attr('filter', item => item.displayModel.socGlowEnabled ? `url(#${this.glowFilterId})` : null)
      .text(item => item.compact ? item.displayModel.detailLineCompact : item.displayModel.detailLineRegular);
    selection.select('text.bms-soc')
      .attr('x', WidgetBmsComponent.BATTERY_CARD_WIDTH - 33)
      .attr('y', 34)
      .attr('fill', item => item.compact ? 'var(--kip-contrast-dim-color)' : 'var(--kip-contrast-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 25)
      .attr('font-weight', 700)
      .attr('filter', item => item.displayModel.socGlowEnabled ? `url(#${this.glowFilterId})` : null)
      .text(item => item.displayModel.socText);
    selection.select('text.bms-actualCapacity')
      .attr('x', WidgetBmsComponent.BATTERY_CARD_WIDTH - 33)
      .attr('y', 45)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .attr('filter', item => item.displayModel.socGlowEnabled ? `url(#${this.glowFilterId})` : null)
      .text(item => item.compact ? '' : item.displayModel.actualCapacityText);
    selection.select('text.bms-remaining')
      .attr('x', WidgetBmsComponent.BATTERY_CARD_WIDTH - 33)
      .attr('y', 12)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 6)
      .attr('filter', item => item.displayModel.socGlowEnabled ? `url(#${this.glowFilterId})` : null)
      .text(item => item.compact ? '' : item.displayModel.remainingText);
    selection.select('g.bms-state-icon')
      .attr('transform', `translate(${WidgetBmsComponent.BATTERY_CARD_WIDTH / 2 - 18}, ${WidgetBmsComponent.BATTERY_CARD_HEIGHT / 2 - 18})`)
      .attr('display', item => item.compact && item.scale < 0.45 ? 'none' : null)
      .attr('color', item => item.compact ? widgetColors.dim : widgetColors.color)
      .attr('filter', item => item.displayModel.socGlowEnabled ? `url(#${this.glowFilterId})` : null)
      .each((item, index, nodes) => {
        const iconGroup = d3.select(nodes[index]);
        const iconKey = item.displayModel.iconKey;
        const iconTemplate = iconKey === 'power_renewal' ? this.powerRenewalIconTemplate : this.powerAvailableIconTemplate;
        if (!iconTemplate) {
          iconGroup.selectAll('*').remove();
          iconGroup.attr('data-icon-key', null);
          return;
        }
        const iconGroupNode = iconGroup.node() as SVGGElement | null;
        if (!iconGroupNode) return;
        const currentIconKey = iconGroup.attr('data-icon-key');
        if (currentIconKey === iconKey && iconGroupNode.firstElementChild) return;

        iconGroup.selectAll('*').remove();

        const iconNode = iconTemplate.cloneNode(true) as SVGSVGElement;
        iconNode.removeAttribute('id');
        iconNode.setAttribute('width', '36');
        iconNode.setAttribute('height', '36');
        if (!iconNode.getAttribute('viewBox')) {
          iconNode.setAttribute('viewBox', '0 0 24 24');
        }
        iconGroupNode.appendChild(iconNode);
        iconGroup.attr('data-icon-key', iconKey);
      });
  }

  private formatVoltage(value: number | null | undefined): string {
    if (value == null) return '-- V';
    return `${value.toFixed(1)}V`;
  }

  private formatCurrent(value: number | null | undefined): string {
    if (value == null) return '-- A';
    return `${value.toFixed(1)}A`;
  }

  private formatPower(value: number | null | undefined): string {
    if (value == null) return '';
    return `${value.toFixed(0)}W`;
  }

  private formatSoc(value: number | null | undefined): string {
    if (value == null) return '--%';
    return `${Math.round(value * 100)}%`;
  }

  private formatDuration(seconds: number | null | undefined): string {
    if (seconds == null) return '';
    return this.units.convertToUnit('D HH:MM:SS', seconds).toString();
  }

  private sumNumbers(values: (number | null | undefined)[]): number | null {
    const filtered = values.filter((value): value is number => typeof value === 'number');
    if (!filtered.length) return null;
    return filtered.reduce((acc, value) => acc + value, 0);
  }

  private averageNumbers(values: (number | null | undefined)[]): number | null {
    const filtered = values.filter((value): value is number => typeof value === 'number');
    if (!filtered.length) return null;
    return filtered.reduce((acc, value) => acc + value, 0) / filtered.length;
  }

  private minNumber(values: (number | null | undefined)[]): number | null {
    const filtered = values.filter((value): value is number => typeof value === 'number');
    if (!filtered.length) return null;
    return Math.min(...filtered);
  }

  private toNumber(value: unknown, unit: string): number | null {
    if (value == null) return null;
    if (typeof value !== 'number') return null;
    return this.units.convertToUnit(unit, value) ?? value;
  }

  private formatTemperature(value: unknown): string {
    if (value == null) return '';
    if (typeof value !== 'number') return '';
    return `${value.toFixed(1)} ${this.units.getDefaults().Temperature === 'celsius' ? '°C' : '°F'}`;
  }

  private buildSemiGaugeArcPath(radius: number, ratio: number | null | undefined): string {
    const safeRatio = Math.max(0, Math.min(1, ratio ?? 0));
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
}
