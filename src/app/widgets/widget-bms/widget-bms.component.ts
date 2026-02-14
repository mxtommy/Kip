import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, NgZone, OnDestroy, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';
import * as d3 from 'd3';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { WidgetRuntimeDirective } from '../../core/directives/widget-runtime.directive';
import { DataService, IPathUpdateWithPath } from '../../core/services/data.service';
import { UnitsService } from '../../core/services/units.service';
import type { ITheme } from '../../core/services/app-service';
import type { BmsBankConfig, BmsBankSummary, BmsBatterySnapshot, BmsWidgetConfig } from './bms.types';

interface BmsRenderBank extends BmsBankSummary {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface BmsRenderBattery extends BmsBatterySnapshot {
  x: number;
  y: number;
  width: number;
  height: number;
}

@Component({
  selector: 'widget-bms',
  templateUrl: './widget-bms.component.html',
  styleUrl: './widget-bms.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: []
})
export class WidgetBmsComponent implements AfterViewInit, OnDestroy {
  /**
   * Unique widget instance id assigned by the dashboard host.
   *
   * @example
   * const widgetId = this.id();
   */
  public id = input.required<string>();
  /**
   * Widget type identifier registered in WidgetService.
   *
   * @example
   * const widgetType = this.type();
   */
  public type = input.required<string>();
  /**
   * Current theme roles for the active color scheme.
   *
   * @example
   * const theme = this.theme();
   */
  public theme = input.required<ITheme | null>();

  /**
   * Default configuration for the BMS widget.
   *
   * @example
   * const defaults = WidgetBmsComponent.DEFAULT_CONFIG;
   */
  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig & { bms: BmsWidgetConfig } = {
    displayName: 'BMS',
    filterSelfPaths: true,
    enableTimeout: false,
    dataTimeout: 5,
    numDecimal: 1,
    color: 'contrast',
    paths: {},
    bms: {
      trackedBatteryIds: [],
      banks: []
    }
  };

  private static readonly VIEWBOX_WIDTH = 1200;
  private static readonly VIEWBOX_HEIGHT = 700;
  private static readonly BANK_CARD_HEIGHT = 180;
  private static readonly BANK_CARD_WIDTH = 340;
  private static readonly BATTERY_CARD_HEIGHT = 140;
  private static readonly BATTERY_CARD_WIDTH = 300;
  private static readonly CARD_GAP = 24;

  private readonly runtime = inject(WidgetRuntimeDirective);
  private readonly data = inject(DataService);
  private readonly units = inject(UnitsService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly ngZone = inject(NgZone);

  private readonly svgRef = viewChild.required<ElementRef<SVGSVGElement>>('bmsSvg');
  private svg?: d3.Selection<SVGSVGElement, unknown, null, undefined>;
  private root?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private bankLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;
  private batteryLayer?: d3.Selection<SVGGElement, unknown, null, undefined>;

  private renderFrameId: number | null = null;

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
      const banks = this.bankSummaries();
      const batteries = this.visibleBatteries();
      if (!theme || !this.svg) return;
      this.scheduleRender(banks, batteries, theme);
    });

    this.data.subscribePathTree('self.electrical.batteries.*')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(update => {
        this.handlePathUpdate(update);
      });
  }

  /**
   * Initializes the SVG canvas after view creation.
   *
   * @returns void
   *
   * @example
   * // Triggered automatically by Angular once the view is initialized.
   */
  ngAfterViewInit(): void {
    this.initializeSvg();
    const theme = this.theme();
    if (!theme) return;
    this.scheduleRender(this.bankSummaries(), this.visibleBatteries(), theme);
  }

  /**
   * Cancels pending render work on destroy.
   *
   * @returns void
   *
   * @example
   * // Triggered automatically by Angular when the widget is removed.
   */
  ngOnDestroy(): void {
    if (this.renderFrameId !== null) {
      cancelAnimationFrame(this.renderFrameId);
      this.renderFrameId = null;
    }
  }

  private initializeSvg(): void {
    this.svg = d3.select(this.svgRef().nativeElement);
    this.svg
      .attr('viewBox', `0 0 ${WidgetBmsComponent.VIEWBOX_WIDTH} ${WidgetBmsComponent.VIEWBOX_HEIGHT}`)
      .attr('role', 'img')
      .attr('aria-label', 'Battery management system view');

    this.root = this.svg.append('g').attr('class', 'bms-root');
    this.bankLayer = this.root.append('g').attr('class', 'bms-banks');
    this.batteryLayer = this.root.append('g').attr('class', 'bms-batteries');
  }

  private applyConfig(cfg: IWidgetSvcConfig): void {
    const bmsCfg = this.resolveBmsConfig(cfg);
    this.trackedBatteryIds.set(bmsCfg.trackedBatteryIds);
    this.banks.set(bmsCfg.banks);
  }

  private resolveBmsConfig(cfg: IWidgetSvcConfig): BmsWidgetConfig {
    const raw = (cfg as IWidgetSvcConfig & { bms?: BmsWidgetConfig }).bms;
    return {
      trackedBatteryIds: Array.isArray(raw?.trackedBatteryIds) ? raw.trackedBatteryIds : [],
      banks: Array.isArray(raw?.banks) ? raw.banks : []
    };
  }

  private handlePathUpdate(update: IPathUpdateWithPath): void {
    const match = this.parseBatteryPath(update.path);
    if (!match) return;

    const { id, key } = match;
    const value = update.update?.data?.value ?? null;
    this.trackDiscoveredBattery(id);

    this.batteries.update(current => {
      const existing = current[id] ?? { id } as BmsBatterySnapshot;
      const next = { ...existing } as BmsBatterySnapshot;
      this.applyBatteryValue(next, key, value);
      if (next.voltage != null && next.current != null) {
        next.power = Number.isFinite(next.voltage) && Number.isFinite(next.current)
          ? next.voltage * next.current
          : null;
      }
      return { ...current, [id]: next };
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

  private applyBatteryValue(battery: BmsBatterySnapshot, key: string, value: unknown): void {
    switch (key) {
      case 'name':
        battery.name = value as string;
        break;
      case 'location':
        battery.location = value as string;
        break;
      case 'voltage':
        battery.voltage = this.toNumber(value, 'V');
        break;
      case 'current':
        battery.current = this.toNumber(value, 'A');
        break;
      case 'temperature':
        battery.temperature = this.toNumber(value, 'K');
        break;
      case 'capacity.nominal':
        battery.capacityNominal = this.toNumber(value, 'J');
        break;
      case 'capacity.actual':
        battery.capacityActual = this.toNumber(value, 'J');
        break;
      case 'capacity.remaining':
        battery.capacityRemaining = this.toNumber(value, 'J');
        break;
      case 'capacity.stateOfCharge':
        battery.stateOfCharge = this.toNumber(value, 'ratio');
        break;
      case 'capacity.timeRemaining':
        battery.timeRemaining = this.toNumber(value, 's');
        break;
      default:
        break;
    }
  }

  private toNumber(value: unknown, unit: string): number | null {
    if (value == null) return null;
    if (typeof value !== 'number') return null;
    return this.units.convertToUnit(unit, value) ?? value;
  }

  private buildBankSummary(bank: BmsBankConfig, map: Record<string, BmsBatterySnapshot>): BmsBankSummary {
    const items = bank.batteryIds.map(id => map[id]).filter((item): item is BmsBatterySnapshot => !!item);
    const totalCurrent = this.sumNumbers(items.map(item => item.current));
    const totalPower = this.sumNumbers(items.map(item => item.power));
    const remainingCapacity = this.sumNumbers(items.map(item => item.capacityRemaining));
    const avgSoc = this.averageNumbers(items.map(item => item.stateOfCharge));
    const timeRemaining = this.minNumber(items.map(item => item.timeRemaining));

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

  private scheduleRender(banks: BmsBankSummary[], batteries: BmsBatterySnapshot[], theme: ITheme): void {
    if (this.renderFrameId !== null) return;
    this.renderFrameId = requestAnimationFrame(() => {
      this.renderFrameId = null;
      this.ngZone.runOutsideAngular(() => this.render(banks, batteries, theme));
    });
  }

  private render(banks: BmsBankSummary[], batteries: BmsBatterySnapshot[], theme: ITheme): void {
    if (!this.bankLayer || !this.batteryLayer) return;

    const bankItems = this.layoutBanks(banks);
    const batteryItems = this.layoutBatteries(batteries);

    const bankSelection = this.bankLayer
      .selectAll<SVGGElement, BmsRenderBank>('g.bank-card')
      .data(bankItems, item => item.id);

    const bankEnter = bankSelection
      .enter()
      .append('g')
      .attr('class', 'bank-card');

    bankEnter.append('rect').attr('class', 'bms-card bms-card--bank').attr('rx', 16).attr('ry', 16);
    bankEnter.append('text').attr('class', 'bms-card-title');
    bankEnter.append('text').attr('class', 'bms-card-metric');
    bankEnter.append('text').attr('class', 'bms-card-sub');
    bankEnter.append('text').attr('class', 'bms-card-meta');
    bankEnter.append('text').attr('class', 'bms-card-footer');

    const bankMerged = bankEnter.merge(bankSelection as d3.Selection<SVGGElement, BmsRenderBank, SVGGElement, unknown>);
    bankMerged.attr('transform', item => `translate(${item.x},${item.y})`);
    bankMerged.select('rect')
      .attr('width', item => item.width)
      .attr('height', item => item.height)
      .attr('fill', theme.cardColor)
      .attr('stroke', theme.contrast)
      .attr('stroke-width', 2);
    bankMerged.select('text.bms-card-title')
      .attr('x', 20)
      .attr('y', 32)
      .attr('fill', theme.contrast)
      .attr('font-size', 20)
      .attr('font-weight', 600)
      .text(item => item.name || 'Bank');
    bankMerged.select('text.bms-card-metric')
      .attr('x', 20)
      .attr('y', 82)
      .attr('fill', theme.contrast)
      .attr('font-size', 30)
      .attr('font-weight', 700)
      .text(item => this.formatPower(item.totalPower));
    bankMerged.select('text.bms-card-sub')
      .attr('x', 20)
      .attr('y', 112)
      .attr('fill', theme.contrast)
      .attr('font-size', 18)
      .attr('opacity', 0.9)
      .text(item => this.formatCurrent(item.totalCurrent));
    bankMerged.select('text.bms-card-meta')
      .attr('x', 20)
      .attr('y', 134)
      .attr('fill', theme.contrast)
      .attr('font-size', 15)
      .attr('opacity', 0.75)
      .text(item => this.formatCapacity(item.remainingCapacity));
    bankMerged.select('text.bms-card-footer')
      .attr('x', 20)
      .attr('y', 158)
      .attr('fill', theme.contrast)
      .attr('font-size', 16)
      .attr('opacity', 0.8)
      .text(item => `${this.formatSoc(item.avgSoc)}  ${this.formatDuration(item.timeRemaining)}`.trim());

    bankSelection.exit().remove();

    const batterySelection = this.batteryLayer
      .selectAll<SVGGElement, BmsRenderBattery>('g.battery-card')
      .data(batteryItems, item => item.id);

    const batteryEnter = batterySelection
      .enter()
      .append('g')
      .attr('class', 'battery-card');

    batteryEnter.append('rect').attr('class', 'bms-card bms-card--battery').attr('rx', 14).attr('ry', 14);
    batteryEnter.append('text').attr('class', 'bms-card-title');
    batteryEnter.append('text').attr('class', 'bms-card-metric');
    batteryEnter.append('text').attr('class', 'bms-card-sub');
    batteryEnter.append('text').attr('class', 'bms-card-meta');
    batteryEnter.append('text').attr('class', 'bms-card-footer');
    batteryEnter.append('line').attr('class', 'bms-flow-line');

    const batteryMerged = batteryEnter.merge(batterySelection as d3.Selection<SVGGElement, BmsRenderBattery, SVGGElement, unknown>);
    batteryMerged.attr('transform', item => `translate(${item.x},${item.y})`);
    batteryMerged.select('rect')
      .attr('width', item => item.width)
      .attr('height', item => item.height)
      .attr('fill', theme.cardColor)
      .attr('stroke', theme.contrast)
      .attr('stroke-width', 2);
    batteryMerged.select('text.bms-card-title')
      .attr('x', 18)
      .attr('y', 28)
      .attr('fill', theme.contrast)
      .attr('font-size', 18)
      .attr('font-weight', 600)
      .text(item => item.name || `Battery ${item.id}`);
    batteryMerged.select('text.bms-card-metric')
      .attr('x', 18)
      .attr('y', 70)
      .attr('fill', theme.contrast)
      .attr('font-size', 30)
      .attr('font-weight', 700)
      .text(item => this.formatSoc(item.stateOfCharge));
    batteryMerged.select('text.bms-card-sub')
      .attr('x', 18)
      .attr('y', 94)
      .attr('fill', theme.contrast)
      .attr('font-size', 18)
      .attr('opacity', 0.9)
      .text(item => `${this.formatVoltage(item.voltage)}  ${this.formatCurrent(item.current)}`.trim());
    batteryMerged.select('text.bms-card-meta')
      .attr('x', 18)
      .attr('y', 114)
      .attr('fill', theme.contrast)
      .attr('font-size', 15)
      .attr('opacity', 0.75)
      .text(item => this.formatCapacity(item.capacityRemaining));
    batteryMerged.select('text.bms-card-footer')
      .attr('x', 18)
      .attr('y', 132)
      .attr('fill', theme.contrast)
      .attr('font-size', 16)
      .attr('opacity', 0.8)
      .text(item => `${this.formatPower(item.power)} ${this.formatDuration(item.timeRemaining)}`.trim());

    batteryMerged.select('line.bms-flow-line')
      .attr('x1', item => item.width - 80)
      .attr('x2', item => item.width - 20)
      .attr('y1', item => item.height - 28)
      .attr('y2', item => item.height - 28)
      .attr('stroke', item => this.flowColor(item.current, theme))
      .attr('stroke-width', 3)
      .attr('stroke-dasharray', item => item.current == null ? 'none' : '6 6');

    batterySelection.exit().remove();

    this.root?.attr('data-theme', theme ? 'ready' : 'unknown');
  }

  private layoutBanks(banks: BmsBankSummary[]): BmsRenderBank[] {
    const startX = 40;
    const startY = 30;
    const columns = 2;
    return banks.map((bank, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (WidgetBmsComponent.BANK_CARD_WIDTH + WidgetBmsComponent.CARD_GAP);
      const y = startY + row * (WidgetBmsComponent.BANK_CARD_HEIGHT + WidgetBmsComponent.CARD_GAP);
      return {
        ...bank,
        x,
        y,
        width: WidgetBmsComponent.BANK_CARD_WIDTH,
        height: WidgetBmsComponent.BANK_CARD_HEIGHT
      };
    });
  }

  private layoutBatteries(batteries: BmsBatterySnapshot[]): BmsRenderBattery[] {
    const startX = 40;
    const startY = 280;
    const columns = 3;
    return batteries.map((battery, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (WidgetBmsComponent.BATTERY_CARD_WIDTH + WidgetBmsComponent.CARD_GAP);
      const y = startY + row * (WidgetBmsComponent.BATTERY_CARD_HEIGHT + WidgetBmsComponent.CARD_GAP);
      return {
        ...battery,
        x,
        y,
        width: WidgetBmsComponent.BATTERY_CARD_WIDTH,
        height: WidgetBmsComponent.BATTERY_CARD_HEIGHT
      };
    });
  }

  private formatVoltage(value: number | null | undefined): string {
    if (value == null) return '-- V';
    return `${value.toFixed(2)}V`;
  }

  private formatCurrent(value: number | null | undefined): string {
    if (value == null) return '-- A';
    return `${value.toFixed(1)}A`;
  }

  private formatPower(value: number | null | undefined): string {
    if (value == null) return '-- W';
    return `${value.toFixed(0)}W`;
  }

  private formatCapacity(value: number | null | undefined): string {
    if (value == null) return '-- J';
    const abs = Math.abs(value);
    if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}MJ`;
    if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}kJ`;
    return `${value.toFixed(0)}J`;
  }

  private formatSoc(value: number | null | undefined): string {
    if (value == null) return '--%';
    return `${Math.round(value * 100)}%`;
  }

  private formatDuration(seconds: number | null | undefined): string {
    if (seconds == null) return '';
    const total = Math.max(0, Math.round(seconds));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  private flowColor(current: number | null | undefined, theme: ITheme): string {
    if (current == null) return theme.contrast;
    return current >= 0 ? theme.zoneWarn : theme.zoneNominal;
  }
}
