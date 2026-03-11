import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, computed, effect, inject, model, signal, untracked, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';
import { Chart, ChartConfiguration, ChartDataset, Color, LegendItem, LineController, LineElement, LinearScale, PointElement, TimeScale, Tooltip, Legend } from 'chart.js';
import 'chartjs-adapter-date-fns';
import { IWidget } from '../../interfaces/widgets-interface';
import { IKipSeriesDefinition } from '../../services/kip-series-api-client.service';
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
type BmsMetric = 'soc' | 'current';

interface IBmsSeriesDescriptor {
  batteryId: string;
  metric: BmsMetric;
}

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
      const datasets = await Promise.all(
        this.data.seriesDefinitions.map((series, index) => this.buildDatasetForSeries(series, index))
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
    const bmsSeries = this.describeBmsSeries(rawPath);
    let chartPoints: ChartPoint[] = [];
    let labelPath = this.normalizeHistoryPath(rawPath);

    // Get widget config for this path (if available)
    const widgetConfig = this.data.widget?.config;
    // Try to find config for this path (by path key or by matching path string)
    // Fallback to widgetConfig.convertUnitTo if not per-path
    let convertUnitTo: string | null = null;
    if (widgetConfig) {
      // If widgetConfig.paths exists and is an object, try to find matching path config
      if (widgetConfig.paths && typeof widgetConfig.paths === 'object') {
        for (const key of Object.keys(widgetConfig.paths)) {
          const pathCfg = widgetConfig.paths[key];
          if (pathCfg?.path === rawPath && pathCfg.convertUnitTo) {
            convertUnitTo = pathCfg.convertUnitTo;
            break;
          }
        }
      }
      // Fallback to top-level convertUnitTo
      if (!convertUnitTo && widgetConfig.convertUnitTo) {
        convertUnitTo = widgetConfig.convertUnitTo;
      }
    }

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
        if (bmsSeries?.metric === 'soc' && typeof y === 'number' && Number.isFinite(y)) {
          y *= 100;
        } else if (convertUnitTo && typeof y === 'number' && Number.isFinite(y)) {
          y = this.units.convertToUnit(convertUnitTo, y);
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


    const color = this.resolveSeriesColor(index, bmsSeries);

    const sourceLabel = series.source ? ` (${series.source})` : '';

    return {
      label: `${labelPath}${sourceLabel}`,
      data: chartPoints,
      borderColor: color,
      backgroundColor: color,
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.25,
      yAxisID: bmsSeries ? this.getBmsAxisId(bmsSeries.metric) : 'y',
      borderDash: bmsSeries?.metric === 'soc' ? [6, 4] : undefined,
      fill: false
    };
  }

  private describeBmsSeries(path: string | null | undefined): IBmsSeriesDescriptor | null {
    const normalizedPath = this.normalizeHistoryPath(path ?? '');
    const socMatch = /^electrical\.batteries\.([^.]+)\.(?:capacity\.)?stateOfCharge$/i.exec(normalizedPath);
    if (socMatch) {
      return { batteryId: socMatch[1], metric: 'soc' };
    }

    const currentMatch = /^electrical\.batteries\.([^.]+)\.current$/i.exec(normalizedPath);
    if (currentMatch) {
      return { batteryId: currentMatch[1], metric: 'current' };
    }

    return null;
  }

  private resolveSeriesColor(index: number, bmsSeries: IBmsSeriesDescriptor | null): string {
    const palette = this.getSeriesPalette();
    if (!bmsSeries) {
      return palette[index % palette.length];
    }

    const batteryIndex = this.getBmsBatteryOrderIndex(bmsSeries.batteryId);
    return palette[batteryIndex % palette.length];
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

  private getBmsBatteryOrderIndex(batteryId: string): number {
    const orderedBatteryIds: string[] = [];

    this.data.seriesDefinitions.forEach(series => {
      const descriptor = this.describeBmsSeries(series.path);
      if (!descriptor || orderedBatteryIds.includes(descriptor.batteryId)) {
        return;
      }

      orderedBatteryIds.push(descriptor.batteryId);
    });

    const resolvedIndex = orderedBatteryIds.indexOf(batteryId);
    return resolvedIndex >= 0 ? resolvedIndex : 0;
  }

  private getBmsAxisId(metric: BmsMetric): 'ySoc' | 'yCurrent' {
    return metric === 'soc' ? 'ySoc' : 'yCurrent';
  }

  private buildHistoryRequestCandidates(rawPath: string, context: string | null | undefined): { paths: string; context: string | undefined; labelPath: string }[] {
    const normalizedPath = this.normalizeHistoryPath(rawPath);
    const contextCandidate = this.resolveHistoryContext(rawPath, context);
    const pathVariants = [...new Set([normalizedPath].filter(path => path.length > 0))];
    const requests: { paths: string; context: string | undefined; labelPath: string }[] = [];

    pathVariants.forEach(path => {
      requests.push({ paths: `${path}:avg`, context: contextCandidate, labelPath: this.normalizeHistoryPath(path) });
    });

    return requests;
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
            callbacks: {
              labelColor: tooltipItem => {
                const legendColors = this.getLegendColorsForDataset(tooltipItem.chart, tooltipItem.datasetIndex);
                const dataset = tooltipItem.dataset as HistoryChartDataset;
                const borderDash = Array.isArray(dataset.borderDash) && dataset.borderDash.length >= 2
                  ? [dataset.borderDash[0], dataset.borderDash[1]] as [number, number]
                  : undefined;

                return {
                  borderColor: this.darkenColor(legendColors.stroke, 0.25),
                  backgroundColor: legendColors.fill,
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
    const widgetConfig = this.data.widget?.config;
    let convertUnitTo: string | null = null;
    if (widgetConfig) {
      if (widgetConfig.paths && typeof widgetConfig.paths === 'object') {
        const firstPathKey = Object.keys(widgetConfig.paths)[0];
        if (firstPathKey && widgetConfig.paths[firstPathKey]?.convertUnitTo) {
          convertUnitTo = widgetConfig.paths[firstPathKey].convertUnitTo;
        }
      }
      if (!convertUnitTo && widgetConfig.convertUnitTo) {
        convertUnitTo = widgetConfig.convertUnitTo;
      }
    }

    return this.getUnitsLabel(convertUnitTo);
  }

  private buildYScales(unitLabel: string): NonNullable<NonNullable<ChartConfiguration<'line'>['options']>['scales']> {
    if (this.isBmsChart()) {
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
            color: this.theme().contrastDim
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
            color: this.theme().contrastDim
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
    return Chart.defaults.plugins.legend.labels.generateLabels(chart).map(label => ({
      ...label,
      fillStyle: this.darkenColor(label.fillStyle, 0.25),
      strokeStyle: label.strokeStyle
    }));
  }

  private darkenColor(color: Color, amount: number): Color {
    if (typeof color !== 'string') {
      return color;
    }

    const trimmed = color.trim();
    const hexMatch = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(trimmed);
    if (hexMatch) {
      const normalized = hexMatch[1].length === 3
        ? hexMatch[1].split('').map(char => `${char}${char}`).join('')
        : hexMatch[1];
      const red = Number.parseInt(normalized.slice(0, 2), 16);
      const green = Number.parseInt(normalized.slice(2, 4), 16);
      const blue = Number.parseInt(normalized.slice(4, 6), 16);
      const darken = (value: number) => Math.max(0, Math.round(value * (1 - amount)));
      return `rgb(${darken(red)}, ${darken(green)}, ${darken(blue)})`;
    }

    const rgbMatch = /^rgba?\(([^)]+)\)$/i.exec(trimmed);
    if (rgbMatch) {
      const [redRaw = '0', greenRaw = '0', blueRaw = '0'] = rgbMatch[1].split(',').map(part => part.trim());
      const red = Number.parseFloat(redRaw);
      const green = Number.parseFloat(greenRaw);
      const blue = Number.parseFloat(blueRaw);
      const darken = (value: number) => Math.max(0, Math.round(value * (1 - amount)));
      return `rgb(${darken(red)}, ${darken(green)}, ${darken(blue)})`;
    }

    return color;
  }

  private getLegendColorsForDataset(chart: Chart, datasetIndex: number): { fill: Color; stroke: Color } {
    const labels = this.buildLegendLabels(chart);
    const label = labels.find(entry => entry.datasetIndex === datasetIndex);
    if (!label) {
      return {
        fill: this.darkenColor(this.theme().contrast, 0.25),
        stroke: this.theme().contrast
      };
    }

    return {
      fill: label.fillStyle,
      stroke: label.strokeStyle
    };
  }

  private isBmsChart(): boolean {
    return this.data.widget?.type === 'widget-bms'
      && this.pendingDatasets.some(dataset => dataset.yAxisID === 'ySoc' || dataset.yAxisID === 'yCurrent');
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
