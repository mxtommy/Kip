import { AfterViewInit, ChangeDetectionStrategy, Component, DestroyRef, ElementRef, OnDestroy, OnInit, computed, effect, inject, model, signal, untracked, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';
import { Chart, ChartConfiguration, ChartDataset, LineController, LineElement, LinearScale, PointElement, TimeScale, Tooltip, Legend } from 'chart.js';
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
  private pendingDatasets: ChartDataset<'line', { x: number; y: number }[]>[] = [];

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

      this.pendingDatasets = datasets.filter((dataset): dataset is ChartDataset<'line', { x: number; y: number }[]> => !!dataset);
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

  private async buildDatasetForSeries(series: IKipSeriesDefinition, index: number): Promise<ChartDataset<'line', { x: number; y: number }[]> | null> {
    const rawPath = series.path;
    if (!rawPath) {
      return null;
    }

    const duration = this.resolveDuration(series);
    const resolutionSeconds = this.resolveResolutionSeconds(duration);

    const requestCandidates = this.buildHistoryRequestCandidates(rawPath, series.context);
    let chartPoints: { x: number; y: number }[] = [];
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
        if (convertUnitTo && typeof y === 'number' && Number.isFinite(y)) {
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

    const colors = [
      this.theme().blue,
      this.theme().green,
      this.theme().pink,
      this.theme().orange,
      this.theme().purple,
      this.theme().yellow,
      this.theme().contrast
    ];

    const color = colors[index % colors.length];
    const sourceLabel = series.source ? ` (${series.source})` : '';

    return {
      label: `${labelPath}${sourceLabel}`,
      data: chartPoints,
      borderColor: color,
      backgroundColor: color,
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.25,
      fill: false
    };
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

    // Determine y-axis unit label from widget config (prefer per-path, fallback to top-level)
    let unitLabel = '';
    const widgetConfig = this.data.widget?.config;
    let convertUnitTo: string | null = null;
    if (widgetConfig) {
      // Try to get from first path config if available
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

    unitLabel = this.getUnitsLabel(convertUnitTo);

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
        },
        plugins: {
          legend: {
            labels: {
              color: this.theme().contrastDim
            }
          }
        }
      }
    };

    this.chart = new Chart(canvas.nativeElement.getContext('2d')!, config);
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
