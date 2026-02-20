import { AfterViewInit, Component, DestroyRef, ElementRef, OnDestroy, OnInit, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Chart,
  ChartConfiguration,
  ChartDataset,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  TimeScale,
  Tooltip,
  Legend,
} from 'chart.js';
import 'chartjs-adapter-date-fns';
import { IWidget } from '../../interfaces/widgets-interface';
import { IKipSeriesDefinition } from '../../services/kip-series-api-client.service';
import { HistoryApiClientService } from '../../services/history-api-client.service';
import { HistoryToChartMapperService } from '../../services/history-to-chart-mapper.service';
import { AppService } from '../../services/app-service';

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
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  templateUrl: './widget-history-chart-dialog.component.html',
  styleUrl: './widget-history-chart-dialog.component.scss'
})
export class WidgetHistoryChartDialogComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly historyApiClient = inject(HistoryApiClientService);
  private readonly historyMapper = inject(HistoryToChartMapperService);
  private readonly app = inject(AppService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Dialog data payload containing title, widget identity and resolved historical series.
   *
   * @example
   * const title = this.data.title;
   */
  public readonly data = inject<IWidgetHistoryChartDialogData>(MAT_DIALOG_DATA);

  private readonly theme = toSignal(this.app.cssThemeColorRoles$, { requireSync: true });

  /**
   * Canvas reference used by Chart.js.
   */
  protected readonly chartCanvas = viewChild<ElementRef<HTMLCanvasElement>>('historyCanvas');

  /**
   * Indicates whether history requests are currently in progress.
   */
  protected readonly loading = signal<boolean>(true);

  /**
   * Error message shown when history loading fails.
   */
  protected readonly error = signal<string | null>(null);

  /**
   * Number of rendered datasets.
   */
  protected readonly datasetCount = signal<number>(0);

  /**
   * Empty-state flag after loading has completed.
   */
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
    const rawPath = this.normalizeInputPath(series.path);
    if (!rawPath) {
      return null;
    }

    const duration = this.resolveDuration(series);
    const resolutionSeconds = this.resolveResolutionSeconds(duration);

    const requestCandidates = this.buildHistoryRequestCandidates(rawPath, series.context);
    let chartPoints: { x: number; y: number }[] = [];
    let labelPath = this.normalizeHistoryPath(rawPath);

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

      chartPoints = datapoints
        .filter(point => point.data.value !== null && Number.isFinite(point.data.value))
        .map(point => ({ x: point.timestamp, y: point.data.value as number }));

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
    const pathVariants = [...new Set([rawPath, normalizedPath].filter(path => path.length > 0))];
    const requests: { paths: string; context: string | undefined; labelPath: string }[] = [];

    pathVariants.forEach(path => {
      requests.push({ paths: `${path}:avg`, context: contextCandidate, labelPath: this.normalizeHistoryPath(path) });
    });

    pathVariants.forEach(path => {
      requests.push({ paths: path, context: contextCandidate, labelPath: this.normalizeHistoryPath(path) });
    });

    return requests;
  }

  private normalizeInputPath(path: string | null | undefined): string {
    const trimmed = typeof path === 'string' ? path.trim() : '';
    if (!trimmed.length) {
      return '';
    }

    return trimmed;
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
              tooltipFormat: 'PPpp'
            },
            ticks: {
              color: this.theme().contrastDim
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

  private resolveDuration(series: IKipSeriesDefinition): string {
    if (series.timeScale && series.period && Number.isFinite(series.period)) {
      return this.durationFromScaleAndPeriod(series.timeScale, series.period);
    }

    return 'PT24H';
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
}
