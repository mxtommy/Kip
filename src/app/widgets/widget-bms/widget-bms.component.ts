import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { take } from 'rxjs/operators';
import { getColors } from '../../core/utils/themeColors.utils';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { UnitsService } from '../../core/services/units.service';
import type { ITheme } from '../../core/services/app-service';
import type { BmsBankConfig, BmsBankConnectionMode, BmsBankSummary, BmsBatterySnapshot, BmsWidgetConfig } from './bms.types';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';

interface BmsRenderBank extends BmsBankSummary {
  x: number;
  y: number;
  width: number;
  height: number;
  batteries: BmsRenderBattery[];
}

interface BmsRenderBattery extends BmsBatterySnapshot {
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

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig & { bms: BmsWidgetConfig } = {
    color: 'contrast',
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
  private static readonly BANK_HEADER_HEIGHT = 60;
  private static readonly BANK_MIN_HEIGHT = 75;
  private static readonly IN_BANK_COLUMNS = 2;
  private static readonly IN_BANK_COLUMN_GAP = 5;
  private static readonly IN_BANK_PADDING_X = 5;
  private static readonly BANK_GAUGE_RADIUS = 38;
  private static readonly BANK_GAUGE_BG_STROKE = 8;
  private static readonly BANK_GAUGE_VALUE_STROKE = 8;
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

  private renderFrameId: number | null = null;
  private pathBatchTimerId: number | null = null;
  private initialPathPaintDone = false;
  private readonly pendingPathUpdates = new Map<string, { id: string; key: string; value: unknown }>();
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

  protected readonly hasBatteries = computed(() => this.visibleBatteries().length > 0);

  constructor() {
    effect(() => {
      const cfg = this.runtime.options();
      if (!cfg) return;
        untracked(() => this.applyConfig(cfg));
    });

    effect(() => {
      const theme = this.theme();
      const options = this.runtime.options();
      const banks = this.bankSummaries();
      const batteries = this.visibleBatteries();
      if (!theme || !this.svg) return;
      const colorRole = options?.color ?? WidgetBmsComponent.DEFAULT_CONFIG.color;
      this.scheduleRender(banks, batteries, theme, colorRole);
    });

    this.data.subscribePathTree('self.electrical.batteries.*')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => {
        this.enqueuePathUpdate(update);
      });
  }

  ngAfterViewInit(): void {
    this.initializeSvg();
    this.loadPowerIcons();
    const theme = this.theme();
    if (!theme) return;
    const options = this.runtime.options();
    const colorRole = options?.color ?? WidgetBmsComponent.DEFAULT_CONFIG.color;
    this.scheduleRender(this.bankSummaries(), this.visibleBatteries(), theme, colorRole);
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
  }

  private initializeSvg(): void {
    this.svg = d3.select(this.svgRef().nativeElement);
    this.svg
      .attr('viewBox', `0 0 ${WidgetBmsComponent.VIEWBOX_WIDTH} ${WidgetBmsComponent.MIN_VIEWBOX_HEIGHT}`)
      .attr('preserveAspectRatio', 'xMidYMid meet')
      .attr('role', 'img')
      .attr('aria-label', 'Battery Management System View');

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
          const theme = this.theme();
          if (theme && this.svg) {
            const options = this.runtime.options();
            const colorRole = options?.color ?? WidgetBmsComponent.DEFAULT_CONFIG.color;
            this.scheduleRender(this.bankSummaries(), this.visibleBatteries(), theme, colorRole);
          }
        },
        error: () => {
        }
      });
  }

  private iconForCurrent(current: number | null | undefined): SVGElement | null {
    if (current != null && current > 0) {
      return this.powerRenewalIconTemplate;
    }
    return this.powerAvailableIconTemplate;
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const bmsCfg = this.resolveBmsConfig(cfg);
    this.trackedBatteryIds.set(bmsCfg.trackedBatteryIds);
    this.banks.set(bmsCfg.banks);
  }

  private resolveBmsConfig(cfg: IWidgetSvcConfig): BmsWidgetConfig {
    const bms = (cfg as IWidgetSvcConfig & { bms?: BmsWidgetConfig }).bms;
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

  private enqueuePathUpdate(update: IPathUpdateWithPath): void {
    const match = this.parseBatteryPath(update.path);
    if (!match) return;

    const { id, key } = match;
    const value = update.update?.data?.value ?? null;
    const updateKey = `${id}::${key}`;
    this.pendingPathUpdates.set(updateKey, { id, key, value });

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
        const valueChanged = this.applyBatteryValue(next, update.key, update.value);

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

  private applyBatteryValue(battery: BmsBatterySnapshot, key: string, value: unknown): boolean {
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
        if (Object.is(battery.current, nextValue)) return false;
        battery.current = nextValue;
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
        if (Object.is(battery.stateOfCharge, nextValue)) return false;
        battery.stateOfCharge = nextValue;
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

  private scheduleRender(banks: BmsBankSummary[], batteries: BmsBatterySnapshot[], theme: ITheme, colorRole: string): void {
    if (this.renderFrameId !== null) return;
    this.renderFrameId = requestAnimationFrame(() => {
      this.renderFrameId = null;
      this.ngZone.runOutsideAngular(() => this.render(banks, batteries, theme, colorRole));
    });
  }

  private render(banks: BmsBankSummary[], batteries: BmsBatterySnapshot[], theme: ITheme, colorRole: string): void {
    if (!this.bankLayer || !this.batteryLayer) return;
    const widgetColors = getColors(colorRole, theme);

    const renderLayout = this.buildRenderLayout(banks, batteries);
    const viewBoxHeight = Math.max(WidgetBmsComponent.MIN_VIEWBOX_HEIGHT, renderLayout.contentHeight);
    this.svg?.attr('viewBox', `0 0 ${WidgetBmsComponent.VIEWBOX_WIDTH} ${viewBoxHeight}`);
    this.root?.attr('transform', null);

    const bankSelection = this.bankLayer
      .selectAll<SVGGElement, BmsRenderBank>('g.bank-card')
      .data(renderLayout.banks, item => item.id);

    const bankEnter = bankSelection.enter().append('g').attr('class', 'bank-card');
    bankEnter.append('rect').attr('class', 'bms-card bms-card--bank').attr('rx', 4).attr('ry', 4);
    bankEnter.append('text').attr('class', 'bms-card-title');
    bankEnter.append('text').attr('class', 'bms-card-power');
    bankEnter.append('text').attr('class', 'bms-card-current');
    bankEnter.append('text').attr('class', 'bms-card-capacity');
    bankEnter.append('text').attr('class', 'bms-card-actualCapacity');
    bankEnter.append('text').attr('class', 'bms-card-remaining');
    const gaugeEnter = bankEnter.append('g').attr('class', 'bms-bank-gauge');
    gaugeEnter.append('path').attr('class', 'bms-gauge-bg');
    gaugeEnter.append('path').attr('class', 'bms-gauge-value');
    gaugeEnter.append('text').attr('class', 'bms-gauge-label');
    bankEnter.append('g').attr('class', 'bms-bank-batteries');

    const bankMerged = bankEnter.merge(bankSelection as d3.Selection<SVGGElement, BmsRenderBank, SVGGElement, unknown>);
    bankMerged.attr('transform', item => `translate(${item.x},${item.y})`);
    bankMerged.select('rect')
      .attr('width', item => item.width)
      .attr('height', item => item.height)
      .attr('stroke', 'var(--mat-sys-outline-variant)')
      .attr('stroke-width', 0.5);
    bankMerged.select('text.bms-card-title')
      .attr('x', 5)
      .attr('y', 16)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('font-size', 15.5)
      .attr('opacity', 0.8)
      .text(item => item.name || 'Bank');
    bankMerged.select('text.bms-card-current')
      .attr('x', 10)
      .attr('y', 37)
      .attr('fill', 'var(--kip-contrast-color)')
      .attr('font-size', 16)
      .text(item => this.formatCurrent(item.totalCurrent));
    bankMerged.select('text.bms-card-power')
      .attr('x', 10)
      .attr('y', 49)
      .attr('fill', 'var(--kip-contrast-color)')
      .attr('font-size', 10)
      .attr('opacity', 0.8)
      .text(item => this.formatPower(item.totalPower));

    bankMerged.select('g.bms-bank-gauge')
      .attr('transform', 'translate(150, 46)');
    bankMerged.select('path.bms-gauge-bg')
      .attr('d', () => this.buildSemiGaugeArcPath(WidgetBmsComponent.BANK_GAUGE_RADIUS, 1))
      .attr('fill', 'none')
      .attr('stroke', 'var(--kip-contrast-dimmer-color)')
      .attr('stroke-width', WidgetBmsComponent.BANK_GAUGE_BG_STROKE)
      .attr('stroke-linecap', 'round');
    bankMerged.select('path.bms-gauge-value')
      .attr('d', item => this.buildSemiGaugeArcPath(WidgetBmsComponent.BANK_GAUGE_RADIUS, item.avgSoc))
      .attr('fill', 'none')
      .attr('stroke', widgetColors.color)
      .attr('stroke-width', WidgetBmsComponent.BANK_GAUGE_VALUE_STROKE)
      .attr('stroke-linecap', 'round');
    bankMerged.select('text.bms-gauge-label')
      .attr('x', 0)
      .attr('y', -2)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--kip-contrast-color)')
      .attr('font-size', 25)
      .attr('font-weight', 700)
      .text(item => this.formatSoc(item.avgSoc));
    bankMerged.select('text.bms-card-remaining')
      .attr('x', 150)
      .attr('y', 22)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 6)
      .text(item => `${this.formatDuration(item.timeRemaining)}`.trim());
    bankMerged.select('text.bms-card-actualCapacity')
      .attr('x', 150)
      .attr('y', 53)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .text(item => item.remainingCapacity ? `${item.remainingCapacity} kWh` : '');
    bankMerged
      .select<SVGGElement>('g.bms-bank-batteries')
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

    this.root?.attr('data-theme', theme ? 'ready' : 'unknown');
  }

  private buildRenderLayout(banks: BmsBankSummary[], batteries: BmsBatterySnapshot[]): BmsRenderLayout {
    const batteryById = new Map<string, BmsBatterySnapshot>(batteries.map(battery => [battery.id, battery]));
    const assignedBatteryIds = new Set<string>();
    const inBankScale = this.computeInBankBatteryScale();
    const inBankRenderedHeight = WidgetBmsComponent.BATTERY_CARD_HEIGHT * inBankScale;
    const inBankSlotWidth = this.computeInBankBatterySlotWidth();
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
          ...battery,
          key: `${bank.id}::${battery.id}`,
          x,
          y,
          scale: inBankScale,
          compact: true
        };
      });

      const renderBank: BmsRenderBank = {
        ...bank,
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
        ...battery,
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

  private computeInBankBatteryScale(): number {
    const slotWidth = this.computeInBankBatterySlotWidth();
    return Math.max(0.35, Math.min(1, slotWidth / WidgetBmsComponent.BATTERY_CARD_WIDTH));
  }

  private appendBatteryCardSkeleton(selection: d3.Selection<SVGGElement, BmsRenderBattery, SVGGElement, unknown>): void {
    selection.append('rect').attr('class', 'bms-card-battery').attr('rx', 4).attr('ry', 4);
    selection.append('rect').attr('class', 'bms-card-tip').attr('rx', 1).attr('ry', 1);
    selection.append('rect').attr('class', 'bms-card-charge').attr('rx', 3).attr('ry', 3);
    selection.append('text').attr('class', 'bms-card-title');
    selection.append('text').attr('class', 'bms-card-ampere');
    selection.append('text').attr('class', 'bms-volt-power');
    selection.append('text').attr('class', 'bms-card-soc');
    selection.append('text').attr('class', 'bms-card-actualCapacity');
    selection.append('text').attr('class', 'bms-card-remaining');
    selection.append('g').attr('class', 'bms-card-icon');
  }

  private renderBatteryCards(
    selection: d3.Selection<SVGGElement, BmsRenderBattery, SVGGElement, unknown>,
    widgetColors: ReturnType<typeof getColors>
  ): void {
    selection.attr('transform', item => `translate(${item.x},${item.y}) scale(${item.scale})`);
    selection.select('rect.bms-card-battery')
      .attr('width', WidgetBmsComponent.BATTERY_CARD_WIDTH)
      .attr('height', WidgetBmsComponent.BATTERY_CARD_HEIGHT)
      .attr('fill', 'var(--mat-sys-background)')
      .attr('stroke', 'var(--kip-contrast-dimmer-color)')
      .attr('stroke-width', 0);
    selection.select('rect.bms-card-tip')
      .attr('x', WidgetBmsComponent.BATTERY_CARD_WIDTH + 1)
      .attr('y', WidgetBmsComponent.BATTERY_CARD_HEIGHT / 2 - 10)
      .attr('width', 4)
      .attr('height', 20)
      .attr('fill', 'var(--mat-sys-background)')
      .attr('stroke', widgetColors.color)
      .attr('stroke-width', 0);
    selection.select('rect.bms-card-charge')
      .attr('x', 1.5)
      .attr('y', 1.5)
      .attr('width', item => (WidgetBmsComponent.BATTERY_CARD_WIDTH - 3) * (item.stateOfCharge ?? 0))
      .attr('height', WidgetBmsComponent.BATTERY_CARD_HEIGHT - 3)
      .attr('fill', item => item.compact ? widgetColors.dimmer : widgetColors.dim);
    selection.select('text.bms-card-title')
      .attr('x', 5)
      .attr('y', item => item.compact ? 11 : 14)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('font-size', item => item.compact ? 8 : 12)
      .text(item => item.name || `Battery ${item.id}`);
    selection.select('text.bms-card-ampere')
      .attr('x', 10)
      .attr('y', 33)
      .attr('fill', item => item.compact ? 'var(--kip-contrast-dim-color)' : 'var(--kip-contrast-color)')
      .attr('font-size', 16)
      .text(item => `${this.formatCurrent(item.current)}`.trim());
    selection.select('text.bms-volt-power')
      .attr('x', 10)
      .attr('y', 45)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('font-size', 8)
      .attr('opacity', 0.8)
      .text(item => item.compact ? `${this.formatVoltage(item.voltage)}\u00A0\u00A0\u00A0\u00A0${this.formatTemperature(item.temperature)}` : `${this.formatVoltage(item.voltage)}\u00A0\u00A0\u00A0\u00A0${this.formatPower(item.power)}\u00A0\u00A0\u00A0\u00A0${this.formatTemperature(item.temperature)}`.trim());
    selection.select('text.bms-card-soc')
      .attr('x', WidgetBmsComponent.BATTERY_CARD_WIDTH - 33)
      .attr('y', 34)
      .attr('fill', item => item.compact ? 'var(--kip-contrast-dim-color)' : 'var(--kip-contrast-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 25)
      .attr('font-weight', 700)
      .text(item => this.formatSoc(item.stateOfCharge));
    selection.select('text.bms-card-actualCapacity')
      .attr('x', WidgetBmsComponent.BATTERY_CARD_WIDTH - 33)
      .attr('y', 45)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .text(item => item.compact ? '' : item.capacityActual ? `${item.capacityActual} kWh` : '');
    selection.select('text.bms-card-remaining')
      .attr('x', WidgetBmsComponent.BATTERY_CARD_WIDTH - 33)
      .attr('y', 12)
      .attr('fill', 'var(--kip-contrast-dim-color)')
      .attr('text-anchor', 'middle')
      .attr('font-size', 6)
      .text(item => item.compact ? '' : `${this.formatDuration(item.timeRemaining)}`.trim());
    selection.select('g.bms-card-icon')
      .attr('transform', `translate(${WidgetBmsComponent.BATTERY_CARD_WIDTH / 2 - 18}, ${WidgetBmsComponent.BATTERY_CARD_HEIGHT / 2 - 18})`)
      .attr('display', item => item.compact && item.scale < 0.45 ? 'none' : null)
      .attr('color', item => item.compact ? widgetColors.dim : widgetColors.color)
      .each((item, index, nodes) => {
        const iconGroup = d3.select(nodes[index]);
        const iconTemplate = this.iconForCurrent(item.current);
        if (!iconTemplate) {
          iconGroup.selectAll('*').remove();
          iconGroup.attr('data-icon-key', null);
          return;
        }

        const iconKey = item.current != null && item.current > 0 ? 'power_renewal' : 'power_available';
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
