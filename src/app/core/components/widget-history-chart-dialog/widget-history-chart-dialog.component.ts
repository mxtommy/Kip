import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, computed, effect, inject, model, signal, untracked, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';
import { Chart, ChartConfiguration, ChartDataset, Color, LegendItem, LineController, LineElement, LinearScale, PointElement, TimeScale, Tooltip, Legend } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { IWidget } from '../../interfaces/widgets-interface';
import { IKipSeriesDefinition } from '../../services/kip-series-api-client.service';
import { isKipTemplateSeriesDefinition, type IKipTemplateSeriesDefinition } from '../../contracts/kip-series-contract';
import {
  describeElectricalDualAxisSeries,
  ELECTRICAL_DUAL_AXIS_WIDGET_META,
  IDualAxisSeriesDescriptor,
  TDualAxisMetric,
  TDualAxisWidgetType
} from '../../contracts/electrical-history-chart.contract';
import { HistoryToChartMapperService } from '../../services/history-to-chart-mapper.service';
import { AppService } from '../../services/app-service';
import { UnitsService } from '../../services/units.service';
import { HistoryApiClientService } from '../../services/history-api-client.service';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { FormsModule} from '@angular/forms';

Chart.register(LineController, LineElement, LinearScale, PointElement, TimeScale, Tooltip, Legend);

interface ChartPoint {
  x: number;
  y: number;
}
type HistoryChartDataset = ChartDataset<'line', ChartPoint[]>;

/****
 * Dialog payload used by WidgetHistoryChartDialogComponent.
 */
export interface IWidgetHistoryChartDialogData {
  title: string;
  widget: IWidget;
  seriesDefinitions: IKipSeriesDefinition[];
}

@Component({
  selector: 'widget-history-chart-dialog',
  imports: [ MatDialogModule, MatButtonToggleModule, MatButtonModule, MatIconModule, FormsModule],
  templateUrl: './widget-history-chart-dialog.component.html',
  styleUrl: './widget-history-chart-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetHistoryChartDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly historyApiClient = inject(HistoryApiClientService);
  private readonly historyMapper = inject(HistoryToChartMapperService);
  private readonly app = inject(AppService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly units = inject(UnitsService);
  public readonly data = inject<IWidgetHistoryChartDialogData>(MAT_DIALOG_DATA);

  protected readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('historyCanvas');

  private theme = toSignal(this.app.cssThemeColorRoles$, { requireSync: true });

  protected loading = signal<boolean>(true);
  protected error = signal<string | null>(null);
  protected datasetCount = signal<number>(0);
  protected selectedPeriod = model<string>('PT1H');
  protected readonly hasNoData = computed<boolean>(() => !this.loading() && !this.error() && this.datasetCount() === 0);
  private chart: Chart<'line'> | null = null;
  private viewReady = false;
  private pendingDatasets: HistoryChartDataset[] = [];

  constructor() {
    effect(() => {
      const canvas = this.chartCanvas();
      const isLoading = this.loading();
      const count = this.datasetCount();

      if (!canvas || isLoading || count <= 0) {
        return;
      }

      untracked(() => {
        this.tryRenderChart();
      });
    });
  }

  /**
   * Loads and renders historical datasets for all provided series definitions.
   *
   * @returns {Promise<void>} Promise that resolves when loading/render pipeline completes.
   *
   * @example
   * await this.loadHistoryDatasets();
   */
  public async loadHistoryDatasets(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const querySeriesDefinitions = await this.resolveQueryableSeriesDefinitions();
      const datasets = await Promise.all(
        querySeriesDefinitions.map((series, index) => this.buildDatasetForSeries(series, index))
      );

      this.pendingDatasets = datasets.filter((dataset): dataset is HistoryChartDataset => !!dataset);
      this.datasetCount.set(this.pendingDatasets.length);
      this.tryRenderChart();
    } catch (error) {
      console.error('[WidgetHistoryChartDialogComponent] Failed to load widget history datasets:', error);
      this.error.set('Unable to load historical data for this widget.');
      this.pendingDatasets = [];
      this.datasetCount.set(0);
    } finally {
      this.loading.set(false);
      queueMicrotask(() => {
        this.tryRenderChart();
      });
    }
  }

  /**
   * Angular lifecycle hook that starts history loading and registers destroy cleanup.
   *
   * @returns {void}
   *
   * @example
   * component.ngOnInit();
   */
  public ngOnInit(): void {
    void this.loadHistoryDatasets();

    this.destroyRef.onDestroy(() => {
      this.chart?.destroy();
      this.chart = null;
    });
  }

  /**
   * Angular lifecycle hook invoked after template view initialization.
   * Marks the chart canvas as ready for Chart.js rendering.
   *
   * @returns {void}
   *
   * @example
   * component.ngAfterViewInit();
   */
  public ngAfterViewInit(): void {
    this.onCanvasReady();
  }

  /**
   * Angular lifecycle hook that destroys the chart instance.
   *
   * @returns {void}
   *
   * @example
   * component.ngOnDestroy();
   */
  public ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  /**
   * Marks the dialog view as ready and attempts rendering once canvas exists.
   *
   * @returns {void}
   *
   * @example
   * this.onCanvasReady();
   */
  public onCanvasReady(): void {
    this.viewReady = true;
    this.tryRenderChart();
  }

  private async buildDatasetForSeries(series: IKipSeriesDefinition, index: number): Promise<HistoryChartDataset | null> {
    const rawPath = series.path;
    if (!rawPath) {
      return null;
    }

    const duration = this.resolveDuration(series);
    const resolutionSeconds = this.resolveResolutionSeconds(duration);

    const requestCandidates = this.buildHistoryRequestCandidates(rawPath, series.context);
    const dualAxisSeries = this.describeDualAxisSeries(rawPath);
    let chartPoints: ChartPoint[] = [];
    let labelPath = this.normalizeHistoryPath(rawPath);
    const convertUnitTo = this.resolveConvertUnitTo(rawPath);

    for (const candidate of requestCandidates) {
      const response = await this.historyApiClient.getValues({
        paths: candidate.paths,
        context: candidate.context,
        duration,
        resolution: resolutionSeconds
      });

      if (!response?.data?.length) {
        continue;
      }

      const datapoints = this.historyMapper.mapValuesToChartDatapoints(response, {
        unit: 'number',
        domain: 'scalar'
      });

      // Apply unit conversion if needed
      chartPoints = datapoints.map(point => {
        let y = point.data.value as number;
        if (typeof y === 'number' && Number.isFinite(y)) {
          if (dualAxisSeries?.metric === 'soc') {
            y *= 100;
          } else if (dualAxisSeries?.metric === 'panelPower') {
            y /= 1000;
          } else if (!dualAxisSeries && convertUnitTo) {
            y = this.units.convertToUnit(convertUnitTo, y);
          }
        }
        return { x: point.timestamp, y };
      });

      if (chartPoints.length) {
        labelPath = candidate.labelPath;
        break;
      }
    }

    if (!chartPoints.length) {
      return null;
    }


    const color = this.resolveSeriesColor(index, dualAxisSeries);

    const sourceLabel = series.source ? ` (${series.source})` : '';

    return {
      label: `${labelPath}${sourceLabel}`,
      data: chartPoints,
      borderColor: color,
      backgroundColor: color,
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.25,
      yAxisID: dualAxisSeries?.axisId ?? 'y',
      borderDash: this.isDualAxisDashedSeries(dualAxisSeries) ? [6, 4] : undefined,
      fill: false
    };
  }

  private describeDualAxisSeries(path: string | null | undefined): IDualAxisSeriesDescriptor | null {
    const normalizedPath = this.normalizeHistoryPath(path ?? '');
    return describeElectricalDualAxisSeries(normalizedPath);
  }

  private resolveSeriesColor(index: number, dualAxisSeries: IDualAxisSeriesDescriptor | null): string {
    const palette = this.getSeriesPalette();
    if (!dualAxisSeries) {
      return palette[index % palette.length];
    }

    return this.getDualAxisMetricColor(dualAxisSeries.widgetType, dualAxisSeries.metric);
  }

  private getSeriesPalette(): string[] {
    const configColorKey = this.data.widget?.config?.color || 'blue';
    const preferredColor = this.resolveThemeColor(configColorKey);
    let palette = [
      this.theme().green,
      this.theme().orange,
      this.theme().pink,
      this.theme().purple,
      this.theme().yellow,
      this.theme().grey,
      this.theme().blue,
      this.theme().contrast
    ];

    const existingIndex = palette.findIndex(color => color?.toLowerCase() === preferredColor.toLowerCase());
    if (existingIndex !== -1) {
      palette = [palette[existingIndex], ...palette.slice(0, existingIndex), ...palette.slice(existingIndex + 1)];
    } else {
      palette = [preferredColor, ...palette];
    }

    return palette;
  }

  private resolveThemeColor(colorKey: string): string {
    const themeColor = this.theme()[colorKey as keyof ReturnType<typeof this.theme>];
    return typeof themeColor === 'string' && themeColor.length > 0 ? themeColor : colorKey;
  }

  private isDualAxisDashedSeries(descriptor: IDualAxisSeriesDescriptor | null): boolean {
    if (!descriptor) return false;

    // Stroke style is series-based: entity #1 solid, entity #2 dashed, etc.
    const entityIndex = this.getDualAxisEntityOrderIndex(descriptor.entityId, descriptor.widgetType);
    return entityIndex % 2 === 1;
  }

  private getDualAxisEntityOrderIndex(entityId: string, widgetType: TDualAxisWidgetType): number {
    const orderedEntityIds: string[] = [];

    this.data.seriesDefinitions.forEach(series => {
      const descriptor = this.describeDualAxisSeries(series.path);
      if (!descriptor || descriptor.widgetType !== widgetType || orderedEntityIds.includes(descriptor.entityId)) {
        return;
      }

      orderedEntityIds.push(descriptor.entityId);
    });

    const resolvedIndex = orderedEntityIds.indexOf(entityId);
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }

  private getDualAxisMetricColor(widgetType: TDualAxisWidgetType, metric: TDualAxisMetric): string {
    const palette = this.getSeriesPalette();
    const metricOrder = ELECTRICAL_DUAL_AXIS_WIDGET_META[widgetType]?.metricOrder ?? [];
    const metricIndex = metricOrder.indexOf(metric);
    const safeIndex = metricIndex >= 0 ? metricIndex : 0;
    return palette[safeIndex % palette.length];
  }

  private buildHistoryRequestCandidates(rawPath: string, context: string | null | undefined): { paths: string; context: string | undefined; labelPath: string }[] {
    const normalizedPath = this.normalizeHistoryPath(rawPath);
    const contextCandidate = this.resolveHistoryContext(rawPath, context);
    const pathVariants = [normalizedPath].filter(path => path.length > 0);
    const requests: { paths: string; context: string | undefined; labelPath: string }[] = [];

    pathVariants.forEach(path => {
      requests.push({ paths: `${path}:avg`, context: contextCandidate, labelPath: this.normalizeHistoryPath(path) });
    });

    return requests;
  }

  private async resolveQueryableSeriesDefinitions(): Promise<IKipSeriesDefinition[]> {
    const expandedSeries: IKipSeriesDefinition[] = [];

    for (const series of this.data.seriesDefinitions) {
      const concreteSeries = await this.expandTemplateSeries(series);
      expandedSeries.push(...concreteSeries);
    }

    return this.sortExpandedSeries(expandedSeries);
  }

  /**
   * Sorts dual-axis series by entity id first (preserves entity grouping),
   * then by the metric position defined in dualAxisMetricOrder (primary before secondary).
   * Non-dual-axis series are left at the end in their original relative order.
   */
  private sortExpandedSeries(series: IKipSeriesDefinition[]): IKipSeriesDefinition[] {
    const hasDualAxis = series.some(s => this.describeDualAxisSeries(s.path) !== null);
    if (!hasDualAxis) {
      return series;
    }

    return [...series].sort((a, b) => {
      const descA = this.describeDualAxisSeries(a.path);
      const descB = this.describeDualAxisSeries(b.path);

      if (!descA && !descB) return 0;
      if (!descA) return 1;
      if (!descB) return -1;

      if (descA.entityId !== descB.entityId) {
        return descA.entityId.localeCompare(descB.entityId);
      }

      const orderA = ELECTRICAL_DUAL_AXIS_WIDGET_META[descA.widgetType]?.metricOrder.indexOf(descA.metric) ?? 0;
      const orderB = ELECTRICAL_DUAL_AXIS_WIDGET_META[descB.widgetType]?.metricOrder.indexOf(descB.metric) ?? 0;
      return orderA - orderB;
    });
  }

  private async expandTemplateSeries(series: IKipSeriesDefinition): Promise<IKipSeriesDefinition[]> {
    const normalizedPath = this.normalizeHistoryPath(series.path ?? '');
    const isWildcardPath = normalizedPath.endsWith('.*');

    if (!isKipTemplateSeriesDefinition(series) && !isWildcardPath) {
      return [series];
    }

    const prefix = normalizedPath.replace(/\.\*$/, '');
    if (!prefix.length) {
      return [series];
    }

    const duration = this.resolveDuration(series);
    const availablePaths = await this.historyApiClient.getPaths({ duration });
    if (!availablePaths?.length) {
      return [series];
    }

    const matchedPaths = this.findConcreteTemplatePaths(series, prefix, availablePaths);
    if (matchedPaths.length === 0) {
      return [series];
    }

    return matchedPaths.map((path, index) => ({
      ...series,
      seriesId: `${series.seriesId}:resolved:${index}`,
      datasetUuid: `${series.datasetUuid}:resolved:${index}`,
      path,
      expansionMode: null,
      familyKey: null,
      allowedIds: null
    }));
  }

  private findConcreteTemplatePaths(series: IKipSeriesDefinition, prefix: string, availablePaths: string[]): string[] {
    const normalized = Array.from(new Set(availablePaths
      .map(path => this.normalizeHistoryPath(path))
      .filter(path => path.startsWith(`${prefix}.`))));

    if (normalized.length === 0) {
      return [];
    }

    if (!isKipTemplateSeriesDefinition(series)) {
      return normalized;
    }

    const filteredByMetric = normalized.filter(path => this.matchesTemplateMetric(path, prefix, series));
    return filteredByMetric.filter(path => this.matchesTemplateAllowedIds(path, prefix, series));
  }

  private matchesTemplateMetric(path: string, prefix: string, series: IKipTemplateSeriesDefinition): boolean {
    const suffix = path.slice(prefix.length + 1);

    if (series.expansionMode === 'solar-tree') {
      return suffix.endsWith('.current') || suffix.endsWith('.panelPower');
    }

    return suffix.endsWith('.current') || suffix.endsWith('.capacity.stateOfCharge') || suffix.endsWith('.stateOfCharge');
  }

  private matchesTemplateAllowedIds(path: string, prefix: string, series: IKipTemplateSeriesDefinition): boolean {
    const allowedGeneric = Array.isArray(series.allowedIds)
      ? series.allowedIds.map(id => String(id).trim()).filter(id => id.length > 0)
      : [];

    if (allowedGeneric.length === 0) {
      return true;
    }

    const entityId = this.extractEntityId(path, prefix, series);
    return !!entityId && allowedGeneric.includes(entityId);
  }

  private extractEntityId(path: string, prefix: string, series: IKipTemplateSeriesDefinition): string | null {
    const suffix = path.slice(prefix.length + 1);
    if (!suffix.length) {
      return null;
    }

    const metricSuffixes = this.getTemplateMetricSuffixes(series);
    const metricSuffix = metricSuffixes.find(candidate => suffix.endsWith(candidate));
    if (!metricSuffix) {
      return null;
    }

    const entityId = suffix.slice(0, -metricSuffix.length).replace(/\.$/, '').trim();
    if (!entityId.length) {
      return null;
    }

    return entityId;
  }

  private getTemplateMetricSuffixes(series: IKipTemplateSeriesDefinition): string[] {
    switch (series.expansionMode) {
      case 'solar-tree':
        return ['.panelPower', '.current'];
      case 'charger-tree':
      case 'inverter-tree':
      case 'alternator-tree':
        return ['.voltage', '.current'];
      case 'ac-tree':
        return [
          '.line1.voltage',
          '.line1.current',
          '.line1.frequency',
          '.line2.voltage',
          '.line2.current',
          '.line2.frequency',
          '.line3.voltage',
          '.line3.current',
          '.line3.frequency',
        ];
      case 'bms-battery-tree':
      default:
        return ['.capacity.stateOfCharge', '.stateOfCharge', '.current'];
    }
  }

  private normalizeHistoryPath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed.length) {
      return '';
    }

    return trimmed.replace(/^(vessels\.)?self\./, '');
  }

  private resolveHistoryContext(rawPath: string, context: string | null | undefined): string | undefined {
    const explicitContext = this.normalizeContext(context);
    if (explicitContext) {
      return explicitContext;
    }

    if (/^(vessels\.)?self\./.test(rawPath)) {
      return 'vessels.self';
    }

    return undefined;
  }

  private tryRenderChart(): void {
    if (!this.viewReady) {
      return;
    }

    if (!this.pendingDatasets.length) {
      this.chart?.destroy();
      this.chart = null;
      return;
    }

    const canvas = this.chartCanvas();
    if (!canvas) {
      return;
    }

    this.chart?.destroy();

    const unitLabel = this.getPrimaryAxisUnitLabel();

    const config: ChartConfiguration<'line'> = {
      type: 'line',
      data: {
        datasets: this.pendingDatasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        parsing: false,
        interaction: {
          mode: 'nearest',
          intersect: false,
          axis: 'x'
        },
        scales: {
          x: {
            type: 'time',
            time: {
              tooltipFormat: 'PPpp',
              displayFormats: {
                second: 'HH:mm:ss',
                minute: 'HH:mm',
                hour: 'HH:mm',
                day: 'MMM d',
                week: 'MMM d',
                month: 'MMM yyyy'
              },
              unit: 'minute',
              minUnit: 'second'


            },
            ticks: {
              color: this.theme().contrastDim,
            },
            grid: {
              color: this.theme().contrastDimmer
            }
          },
          ...this.buildYScales(unitLabel)
        },
        plugins: {
          legend: {
            labels: {
              color: this.theme().contrastDim,
              generateLabels: chart => this.buildLegendLabels(chart)
            }
          },
          tooltip: {
            boxWidth: 15,
            boxHeight: 15,
            bodyFont: {
              size: 14
            },
            multiKeyBackground: 'rgba(0, 0, 0, 0)',
            callbacks: {
              labelColor: tooltipItem => {
                const legendItem = this.getLegendItemForDataset(tooltipItem.chart, tooltipItem.datasetIndex);
                const borderDash = Array.isArray(legendItem?.lineDash) && legendItem.lineDash.length >= 2
                  ? [legendItem.lineDash[0], legendItem.lineDash[1]] as [number, number]
                  : undefined;

                return {
                  borderColor: (legendItem?.strokeStyle ?? this.theme().contrast) as string,
                  backgroundColor: 'rgba(0, 0, 0, 0)',
                  borderWidth: 2,
                  borderRadius: 0,
                  borderDash
                };
              }
            }
          }
        }
      }
    };

    this.chart = new Chart(canvas.nativeElement.getContext('2d')!, config);
  }

  private getPrimaryAxisUnitLabel(): string {
    const convertUnitTo = this.resolveConvertUnitTo();

    return this.getUnitsLabel(convertUnitTo);
  }

  private resolveConvertUnitTo(rawPath?: string): string | null {
    const widgetConfig = this.data.widget?.config;
    if (!widgetConfig) {
      return null;
    }

    if (widgetConfig.paths && typeof widgetConfig.paths === 'object') {
      if (rawPath) {
        for (const key of Object.keys(widgetConfig.paths)) {
          const pathCfg = widgetConfig.paths[key];
          if (pathCfg?.path === rawPath && pathCfg.convertUnitTo) {
            return pathCfg.convertUnitTo;
          }
        }
      }

      const firstPathKey = Object.keys(widgetConfig.paths)[0];
      if (firstPathKey && widgetConfig.paths[firstPathKey]?.convertUnitTo) {
        return widgetConfig.paths[firstPathKey].convertUnitTo;
      }
    }

    return widgetConfig.convertUnitTo ?? null;
  }

  private buildYScales(unitLabel: string): NonNullable<NonNullable<ChartConfiguration<'line'>['options']>['scales']> {
    const dualAxisWidgetType = this.resolveDualAxisWidgetType();

    if (dualAxisWidgetType === 'widget-bms') {
      const socAxisColor = this.getDualAxisMetricColor('widget-bms', 'soc');
      const currentAxisColor = this.getDualAxisMetricColor('widget-bms', 'current');
      return {
        ySoc: {
          type: 'linear',
          position: 'left',
          min: 0,
          max: 100,
          ticks: {
            color: this.theme().contrastDim,
            callback: value => `${value}%`
          },
          grid: {
            color: this.theme().contrastDimmer
          },
          title: {
            display: true,
            text: 'SoC (%)',
            color: socAxisColor
          }
        },
        yCurrent: {
          type: 'linear',
          position: 'right',
          ticks: {
            color: this.theme().contrastDim,
            callback: value => `${value} A`
          },
          grid: {
            drawOnChartArea: false,
            color: this.theme().contrastDimmer
          },
          title: {
            display: true,
            text: 'Current (A)',
            color: currentAxisColor
          }
        }
      };
    }

    if (dualAxisWidgetType === 'widget-solar-charger') {
      const powerAxisColor = this.getDualAxisMetricColor('widget-solar-charger', 'panelPower');
      const currentAxisColor = this.getDualAxisMetricColor('widget-solar-charger', 'current');
      return {
        yPower: {
          type: 'linear',
          position: 'left',
          ticks: {
            color: this.theme().contrastDim,
            callback: value => `${value} kW`
          },
          grid: {
            color: this.theme().contrastDimmer
          },
          title: {
            display: true,
            text: 'Power (kW)',
            color: powerAxisColor
          }
        },
        yCurrent: {
          type: 'linear',
          position: 'right',
          ticks: {
            color: this.theme().contrastDim,
            callback: value => `${value} A`
          },
          grid: {
            drawOnChartArea: false,
            color: this.theme().contrastDimmer
          },
          title: {
            display: true,
            text: 'Current (A)',
            color: currentAxisColor
          }
        }
      };
    }

    return {
      y: {
        ticks: {
          color: this.theme().contrastDim
        },
        grid: {
          color: this.theme().contrastDimmer
        },
        title: {
          display: !!unitLabel,
          text: unitLabel ? `${unitLabel}` : '',
          color: this.theme().contrastDim
        }
      }
    };
  }

  private buildLegendLabels(chart: Chart): LegendItem[] {
    return Chart.defaults.plugins.legend.labels.generateLabels(chart).map(label => {
      const dataset = label.datasetIndex != null
        ? chart.data.datasets[label.datasetIndex] as HistoryChartDataset
        : null;
      const borderDash = Array.isArray(dataset?.borderDash) ? dataset.borderDash : [];
      return {
        ...label,
        fillStyle: 'transparent' as Color,
        lineDash: borderDash
      };
    });
  }

  private getLegendItemForDataset(chart: Chart, datasetIndex: number): LegendItem | null {
    return this.buildLegendLabels(chart).find(label => label.datasetIndex === datasetIndex) ?? null;
  }

  private resolveDualAxisWidgetType(): TDualAxisWidgetType | null {
    const widgetType = this.data.widget?.type;

    if (widgetType === 'widget-bms'
      && this.pendingDatasets.some(dataset => dataset.yAxisID === 'ySoc' || dataset.yAxisID === 'yCurrent')) {
      return 'widget-bms';
    }

    if (widgetType === 'widget-solar-charger'
      && this.pendingDatasets.some(dataset => dataset.yAxisID === 'yPower' || dataset.yAxisID === 'yCurrent')) {
      return 'widget-solar-charger';
    }

    return null;
  }

  protected setPeriod(period: string) {
    this.selectedPeriod.set(period);
    this.loadHistoryDatasets();
  }

  private resolveDuration(series: IKipSeriesDefinition): string {
    if (series.timeScale && series.period && Number.isFinite(series.period)) {
      return this.durationFromScaleAndPeriod(series.timeScale, series.period);
    }

    return this.selectedPeriod();
  }

  private durationFromScaleAndPeriod(scaleRaw: string, periodRaw: number): string {
    const period = Math.max(1, Math.round(periodRaw));
    const scale = scaleRaw.trim().toLowerCase();

    const parsed = scale.match(/^last\s+(\d+)\s+([a-z]+)/i);
    if (parsed) {
      const parsedPeriod = Number(parsed[1]);
      const parsedScale = parsed[2];
      if (Number.isFinite(parsedPeriod) && parsedPeriod > 0) {
        return this.durationFromToken(parsedScale, parsedPeriod);
      }
    }

    return this.durationFromToken(scale, period);
  }

  private durationFromToken(tokenRaw: string, value: number): string {
    const token = tokenRaw.toLowerCase();
    if (token.startsWith('second')) return `PT${value}S`;
    if (token.startsWith('minute')) return `PT${value}M`;
    if (token.startsWith('hour')) return `PT${value}H`;
    if (token.startsWith('day')) return `P${value}D`;
    if (token.startsWith('week')) return `P${value * 7}D`;
    if (token.startsWith('month')) return `P${value}M`;
    return 'PT24H';
  }

  private resolveResolutionSeconds(duration: string): number {
    const durationSeconds = this.parseDurationToSeconds(duration);
    if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return 1;
    }

    return Math.max(1, Math.round(durationSeconds / 120));
  }

  private parseDurationToSeconds(duration: string): number {
    const durationRegex = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/i;
    const match = durationRegex.exec(duration.trim());
    if (!match) {
      return NaN;
    }

    const days = Number(match[1] ?? 0);
    const hours = Number(match[2] ?? 0);
    const minutes = Number(match[3] ?? 0);
    const seconds = Number(match[4] ?? 0);

    return days * 86400 + hours * 3600 + minutes * 60 + seconds;
  }

  private normalizeContext(context: string | null | undefined): string | undefined {
    const trimmed = typeof context === 'string' ? context.trim() : '';
    return trimmed.length ? trimmed : undefined;
  }

  /**
   * Returns a display label for the y-axis unit, based on widget config.
   * @param unit The convertUnitTo string
   * @returns string label for axis
   */
  private getUnitsLabel(unit: string | null | undefined): string {
    if (!unit) return '';
    switch (unit) {
      case 'percent':
      case 'percentraw':
        return '%';
      case 'latitudeMin':
        return 'latitude in minutes';
      case 'latitudeSec':
        return 'latitude in secondes';
      case 'longitudeMin':
        return 'longitude in minutes';
      case 'longitudeSec':
        return 'longitude in secondes';
      default:
        return unit;
    }
  }
}
