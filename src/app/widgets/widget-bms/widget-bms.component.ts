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
import type { BmsBankConfig, BmsBankSummary, BmsBatterySnapshot, BmsWidgetConfig } from './bms.types';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';

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
  imports: [MatIconModule]
})
export class WidgetBmsComponent implements AfterViewInit, OnDestroy {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme | null>();

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

  private static readonly VIEWBOX_WIDTH = 200;
  private static readonly VIEWBOX_HEIGHT = 200;
  private static readonly BANK_CARD_HEIGHT = 200;
  private static readonly BANK_CARD_WIDTH = 200;
  private static readonly BATTERY_CARD_HEIGHT = 50;
  private static readonly BATTERY_CARD_WIDTH = 190;
  private static readonly CARD_GAP = 5;
  private static readonly BANK_GAUGE_RADIUS = 30;
  private static readonly BANK_GAUGE_BG_STROKE = 10;
  private static readonly BANK_GAUGE_VALUE_STROKE = 10;

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

  ngAfterViewInit(): void {
    this.initializeSvg();
    this.loadPowerIcons();
    const theme = this.theme();
    if (!theme) return;
    this.scheduleRender(this.bankSummaries(), this.visibleBatteries(), theme);
  }

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
            this.scheduleRender(this.bankSummaries(), this.visibleBatteries(), theme);
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

    bankEnter.append('rect').attr('class', 'bms-card bms-card--bank').attr('rx', 4).attr('ry', 4);
    bankEnter.append('text').attr('class', 'bms-card-title');
    bankEnter.append('text').attr('class', 'bms-card-power');
    bankEnter.append('text').attr('class', 'bms-card-current');
    bankEnter.append('text').attr('class', 'bms-card-capacity');
    bankEnter.append('text').attr('class', 'bms-card-remaining');
    const gaugeEnter = bankEnter.append('g').attr('class', 'bms-bank-gauge');
    gaugeEnter.append('path').attr('class', 'bms-gauge-bg');
    gaugeEnter.append('path').attr('class', 'bms-gauge-value');
    gaugeEnter.append('circle').attr('class', 'bms-gauge-center');
    gaugeEnter.append('text').attr('class', 'bms-gauge-label');

    const bankMerged = bankEnter.merge(bankSelection as d3.Selection<SVGGElement, BmsRenderBank, SVGGElement, unknown>);
    bankMerged.attr('transform', item => `translate(${item.x},${item.y})`);
    bankMerged.select('rect')
      .attr('width', item => item.width)
      .attr('height', item => item.height)
      .attr('fill', getColors(this.runtime.options().color, this.theme()).dimmer)
      .attr('stroke', theme.contrast)
      .attr('stroke-width', 0);
    bankMerged.select('text.bms-card-title')
      .attr('x', 5)
      .attr('y', 10)
      .attr('fill', theme.contrast)
      .attr('font-size', 8)
      .attr('opacity', 0.8)
      .text(item => item.name || 'Bank');
    bankMerged.select('text.bms-card-current')
      .attr('x', 33)
      .attr('y', 32)
      .attr('fill', theme.contrast)
      .attr('text-anchor', 'middle')
      .attr('font-size', 16)
      .text(item => this.formatCurrent(item.totalCurrent));
    bankMerged.select('text.bms-card-power')
      .attr('x', 33)
      .attr('y', 45)
      .attr('fill', theme.contrast)
      .attr('text-anchor', 'middle')
      .attr('font-size', 10)
      .attr('opacity', 0.8)
      .text(item => this.formatPower(item.totalPower));



    bankMerged.select('g.bms-bank-gauge')
      .attr('transform', item => `translate(${item.width - 45}, 37)`);
    bankMerged.select('path.bms-gauge-bg')
      .attr('d', () => this.buildSemiGaugeArcPath(WidgetBmsComponent.BANK_GAUGE_RADIUS, 1))
      .attr('fill', 'none')
      .attr('stroke', getColors('contrast', this.theme()).dimmer)
      .attr('stroke-width', WidgetBmsComponent.BANK_GAUGE_BG_STROKE)
      .attr('stroke-linecap', 'round');
    bankMerged.select('path.bms-gauge-value')
      .attr('d', item => this.buildSemiGaugeArcPath(WidgetBmsComponent.BANK_GAUGE_RADIUS, item.avgSoc))
      .attr('fill', 'none')
      .attr('stroke', getColors(this.runtime.options().color, this.theme()).color)
      .attr('stroke-width', WidgetBmsComponent.BANK_GAUGE_VALUE_STROKE)
      .attr('stroke-linecap', 'round');
    bankMerged.select('circle.bms-gauge-center')
      .attr('cx', 0)
      .attr('cy', 0)
      .attr('r', 30)
      .attr('fill', 'none') //getColors(this.runtime.options().color, this.theme()).dimmer)
      .attr('stroke', theme.contrast)
      .attr('stroke-width', 0);
    bankMerged.select('text.bms-gauge-label')
      .attr('x', 0)
      .attr('y', 6)
      .attr('text-anchor', 'middle')
      .attr('fill', theme.contrast)
      .attr('font-size', 25)
      .attr('font-weight', 700)
      .text(item => this.formatSoc(item.avgSoc));
    bankMerged.select('text.bms-card-remaining')
      .attr('x', item => item.width - 45)
      .attr('y', 50)
      .attr('fill', getColors('contrast', this.theme()).dim)
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .text(item => `${this.formatDuration(item.timeRemaining)}`.trim());

    bankSelection.exit().remove();

    const batterySelection = this.batteryLayer
      .selectAll<SVGGElement, BmsRenderBattery>('g.battery-card')
      .data(batteryItems, item => item.id);

    const batteryEnter = batterySelection
      .enter()
      .append('g')
      .attr('class', 'battery-card');

    batteryEnter.append('rect').attr('class', 'bms-card-battery').attr('rx', 4).attr('ry', 4);
    batteryEnter.append('rect').attr('class', 'bms-card-tip').attr('rx', 1).attr('ry', 1);
    batteryEnter.append('rect').attr('class', 'bms-card-charge').attr('rx', 3).attr('ry', 3);
    batteryEnter.append('text').attr('class', 'bms-card-title');
    batteryEnter.append('text').attr('class', 'bms-card-ampere');
    batteryEnter.append('text').attr('class', 'bms-volt-power');
    batteryEnter.append('text').attr('class', 'bms-card-soc');
    batteryEnter.append('text').attr('class', 'bms-card-remaining');
    batteryEnter.append('g').attr('class', 'bms-card-icon');

    const batteryMerged = batteryEnter.merge(batterySelection as d3.Selection<SVGGElement, BmsRenderBattery, SVGGElement, unknown>);
    batteryMerged.attr('transform', item => `translate(${item.x},${item.y})`);
    batteryMerged.select('rect.bms-card-battery')
      .attr('width', item => item.width - 5)
      .attr('height', item => item.height)
      .attr('fill', getColors('contrast', this.theme()).dimmer)
      .attr('stroke', getColors(this.runtime.options().color, this.theme()).color)
      .attr('stroke-width', 0);
    batteryMerged.select('rect.bms-card-tip')
      .attr('x', item => item.width - 4)
      .attr('y', item => item.height / 2 - 10)
      .attr('width', 4)
      .attr('height', 20)
      .attr('fill', getColors('contrast', this.theme()).dimmer)
      .attr('stroke', getColors(this.runtime.options().color, this.theme()).color)
      .attr('stroke-width', 0);
    batteryMerged.select('rect.bms-card-charge')
      .attr('x', 1.5)
      .attr('y', 1.5)
      .attr('width', item => (item.width - 3) * (item.stateOfCharge ?? 0))
      .attr('height', item => item.height - 3)
      .attr('fill', getColors(this.runtime.options().color, this.theme()).dim);
    batteryMerged.select('text.bms-card-title')
      .attr('x', 5)
      .attr('y', 11)
      .attr('fill', theme.contrast)
      .attr('font-size', 8)
      .attr('opacity', 0.8)
      .text(item => item.name || `Battery ${item.id}`);
    batteryMerged.select('text.bms-card-ampere')
      .attr('x', 33)
      .attr('y', 32)
      .attr('fill', theme.contrast)
      .attr('text-anchor', 'middle')
      .attr('font-size', 16)
      .text(item => `${this.formatCurrent(item.current)}`.trim());
    batteryMerged.select('text.bms-volt-power')
      .attr('x', 5)
      .attr('y', 45)
      .attr('fill', theme.contrast)
      .attr('font-size', 8)
      .attr('opacity', 0.8)
      .text(item => `${this.formatVoltage(item.voltage)}\u00A0\u00A0\u00A0\u00A0${this.formatPower(item.power)}`.trim());
    batteryMerged.select('text.bms-card-soc')
      .attr('x', item => item.width - 38)
      .attr('y', 34)
      .attr('fill', theme.contrast)
      .attr('text-anchor', 'middle')
      .attr('font-size', 25)
      .attr('font-weight', 700)
      .text(item => this.formatSoc(item.stateOfCharge));
    batteryMerged.select('text.bms-card-remaining')
      .attr('x', item => item.width - 38)
      .attr('y', 42)
      .attr('fill', getColors('contrast', this.theme()).dim)
      .attr('text-anchor', 'middle')
      .attr('font-size', 8)
      .text(item => `${this.formatDuration(item.timeRemaining)}`.trim());
    batteryMerged.select('g.bms-card-icon')
      .attr('transform', item => `translate(${item.width / 2 - 18}, ${item.height / 2 - 18})`)
      .attr('color', getColors(this.runtime.options().color, this.theme()).color)
      .each((item, index, nodes) => {
        const iconGroup = d3.select(nodes[index]);
        iconGroup.selectAll('*').remove();
        const iconTemplate = this.iconForCurrent(item.current);
        if (!iconTemplate) return;

        const iconNode = iconTemplate.cloneNode(true) as SVGSVGElement;
        iconNode.removeAttribute('id');
        iconNode.setAttribute('width', '36');
        iconNode.setAttribute('height', '36');
        if (!iconNode.getAttribute('viewBox')) {
          iconNode.setAttribute('viewBox', '0 0 24 24');
        }
        const iconGroupNode = iconGroup.node() as SVGGElement | null;
        iconGroupNode?.appendChild(iconNode);
      });

     /*     batteryMerged.select('text.bms-card-meta')
      .attr('x', 5)
      .attr('y', 30)
      .attr('fill', theme.contrast)
      .attr('font-size', 10)
      .attr('opacity', 0.75)
      .text(item => this.formatCapacity(item.capacityRemaining)); */

    batterySelection.exit().remove();

    this.root?.attr('data-theme', theme ? 'ready' : 'unknown');
  }

  private layoutBanks(banks: BmsBankSummary[]): BmsRenderBank[] {
    const startX = 0;
    const startY = 0;
    const columns = 1;
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
    const startX = WidgetBmsComponent.CARD_GAP;
    const startY = 55;
    const columns = 1;
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

  private buildSemiGaugeArcPath(radius: number, ratio: number | null | undefined): string {
    const safeRatio = Math.max(0, ratio);
    const startAngle = -Math.PI * 0.6;
    const fullRange = Math.PI * 1.2;
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
    if (value == null) return null;
    if (typeof value !== 'number') return null;
    return this.units.convertToUnit(unit, value) ?? value;
  }
}
