import { Component, OnInit, OnDestroy, ElementRef, AfterViewInit, viewChild, inject, NgZone } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { HttpClient } from '@angular/common/http';
import { Subscription, interval } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';

import { Chart, ChartConfiguration, ChartData, ChartType, TimeUnit, TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, Title, SubTitle } from 'chart.js';
import 'chartjs-adapter-date-fns';

Chart.register(TimeScale, LinearScale, LineController, PointElement, LineElement, Filler, Title, SubTitle);

interface HistoryDataResult {
  context: string;
  range: {
    from: string;
    to: string;
  };
  values: Array<{
    path: string;
    method: string;
  }>;
  data: Array<[string, ...any[]]>;
  refresh?: {
    enabled: boolean;
    intervalSeconds: number;
    nextRefresh: string;
  };
}

interface IChartColors {
  valueLine: string;
  valueFill: string;
  chartLabel: string;
  chartValue: string;
}

@Component({
  selector: 'widget-history-chart',
  imports: [WidgetHostComponent],
  templateUrl: './widget-history-chart.component.html',
  styleUrl: './widget-history-chart.component.scss'
})
export class WidgetHistoryChartComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly ngZone = inject(NgZone);
  readonly historyChart = viewChild('historyChart', { read: ElementRef });

  public lineChartData: ChartData<'line', Array<{x: number, y: number}>> = {
    datasets: []
  };
  
  public lineChartOptions: ChartConfiguration['options'] = {
    parsing: false,
    datasets: {
      line: {
        pointRadius: 0,
        pointHoverRadius: 0,
        tension: 0.4,
      }
    },
    animations: {
      tension: {
        easing: "easeInOutCubic"
      }
    }
  };
  
  public lineChartType: ChartType = 'line';
  private chart: Chart;
  private refreshSubscription: Subscription;
  protected lastDataFetch: Date;

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'History Chart',
      historyApiUrl: `${window.location.origin}/signalk/v1/history`,
      historyPaths: [],
      aggregationMethods: ['average'],
      timeMode: 'duration',
      startTime: 'now',
      endTime: '',
      duration: 1,
      durationUnit: 'h',
      refreshEnabled: true,
      refreshInterval: 30,
      resolution: null,
      useUTC: false,
      showTimeScale: true,
      showYScale: true,
      startScaleAtZero: false,
      yScaleSuggestedMin: null,
      yScaleSuggestedMax: null,
      enableMinMaxScaleLimit: false,
      yScaleMin: null,
      yScaleMax: null,
      inverseYAxis: false,
      verticalChart: false,
      numDecimal: 2,
      color: 'contrast',
    };
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.startWidget();
  }

  protected startWidget(): void {
    this.createChart();
    this.loadHistoryData();
    this.setupRefresh();
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.stopRefresh();
    this.startWidget();
  }

  private createChart(): void {
    this.setChartOptions();
    this.createDatasets();

    if (!this.chart) {
      this.chart = new Chart(this.historyChart().nativeElement.getContext('2d'), {
        type: this.lineChartType,
        data: this.lineChartData,
        options: this.lineChartOptions
      });
    } else {
      this.chart.update();
    }
  }

  private setChartOptions(): void {
    this.lineChartOptions.maintainAspectRatio = false;
    this.lineChartOptions.animation = false;

    this.lineChartOptions.indexAxis = this.widgetProperties.config.verticalChart ? 'y' : 'x';

    if (this.widgetProperties.config.verticalChart) {
      this.lineChartOptions.scales = {
        y: {
          type: "time",
          display: this.widgetProperties.config.showTimeScale,
          position: "right",
          time: {
            unit: this.getTimeUnit(),
            displayFormats: {
              hour: 'HH:mm',
              minute: 'HH:mm', 
              second: 'HH:mm:ss',
              day: 'MMM d'
            },
            tooltipFormat: 'MMM d, HH:mm'
          },
          ticks: {
            color: this.getThemeColors().chartValue,
            callback: (value: any, index: number, ticks: any[]) => {
              const date = new Date(value);
              const timeStr = date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit', 
                hour12: false 
              });
              
              let showDate = index === 0; // Always show date on first tick
              
              // Check if we've crossed a day boundary since the previous tick
              if (index > 0 && ticks[index - 1]) {
                const prevDate = new Date(ticks[index - 1].value);
                const currentDay = date.getDate();
                const prevDay = prevDate.getDate();
                const currentMonth = date.getMonth();
                const prevMonth = prevDate.getMonth();
                const currentYear = date.getFullYear();
                const prevYear = prevDate.getFullYear();
                
                // Show date if day, month, or year changed between ticks
                showDate = showDate || (currentDay !== prevDay) || 
                          (currentMonth !== prevMonth) || (currentYear !== prevYear);
              }
              
              if (showDate) {
                const dateStr = date.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                });
                return [dateStr, timeStr];
              }
              
              return timeStr;
            }
          },
          grid: {
            display: true,
            color: this.theme().contrastDimmer
          }
        },
        x: {
          type: "linear",
          display: this.widgetProperties.config.showYScale,
          position: "top",
          suggestedMin: this.widgetProperties.config.enableMinMaxScaleLimit ? null : this.widgetProperties.config.yScaleSuggestedMin,
          suggestedMax: this.widgetProperties.config.enableMinMaxScaleLimit ? null : this.widgetProperties.config.yScaleSuggestedMax,
          min: this.widgetProperties.config.enableMinMaxScaleLimit ? this.widgetProperties.config.yScaleMin : null,
          max: this.widgetProperties.config.enableMinMaxScaleLimit ? this.widgetProperties.config.yScaleMax : null,
          beginAtZero: this.widgetProperties.config.startScaleAtZero,
          reverse: this.widgetProperties.config.inverseYAxis,
          ticks: {
            maxTicksLimit: 8,
            precision: this.widgetProperties.config.numDecimal,
            color: this.getThemeColors().chartValue,
          },
          grid: {
            display: true,
            color: this.theme().contrastDimmer,
          }
        }
      };
    } else {
      this.lineChartOptions.scales = {
        x: {
          type: "time",
          display: this.widgetProperties.config.showTimeScale,
          time: {
            unit: this.getTimeUnit(),
            displayFormats: this.getTimeDisplayFormats(),
            tooltipFormat: 'MMM d, HH:mm'
          },
          ticks: {
            color: this.getThemeColors().chartValue,
          },
          grid: {
            display: true,
            color: this.theme().contrastDimmer
          }
        },
        y: {
          display: this.widgetProperties.config.showYScale,
          position: "right",
          suggestedMin: this.widgetProperties.config.enableMinMaxScaleLimit ? null : this.widgetProperties.config.yScaleSuggestedMin,
          suggestedMax: this.widgetProperties.config.enableMinMaxScaleLimit ? null : this.widgetProperties.config.yScaleSuggestedMax,
          min: this.widgetProperties.config.enableMinMaxScaleLimit ? this.widgetProperties.config.yScaleMin : null,
          max: this.widgetProperties.config.enableMinMaxScaleLimit ? this.widgetProperties.config.yScaleMax : null,
          beginAtZero: this.widgetProperties.config.startScaleAtZero,
          reverse: this.widgetProperties.config.inverseYAxis,
          ticks: {
            maxTicksLimit: 8,
            precision: this.widgetProperties.config.numDecimal,
            color: this.getThemeColors().chartValue,
          },
          grid: {
            display: true,
            color: this.theme().contrastDimmer,
          }
        }
      };
    }

    this.lineChartOptions.plugins = {
      title: {
        display: true,
        align: "center",
        text: this.widgetProperties.config.displayName,
        font: {
          size: 16,
        },
        color: this.getThemeColors().chartLabel
      },
      legend: {
        display: this.shouldShowLegend(),
        position: 'top',
      }
    };
  }

  private getTimeUnit(): TimeUnit {
    const duration = this.widgetProperties.config.duration;
    const unit = this.widgetProperties.config.durationUnit;
    
    // Always use hour for multi-day data - it works better than 'day'
    if (unit === 'd' || (unit === 'h' && duration >= 24)) {
      return 'hour';
    } else if (unit === 'h' || (unit === 'm' && duration >= 60)) {
      return 'minute';
    } else {
      return 'second';
    }
  }

  private getTimeDisplayFormats(): Record<string, string> {
    const duration = this.widgetProperties.config.duration;
    const unit = this.widgetProperties.config.durationUnit;
    
    // For multi-day spans, show dates on major boundaries
    if (unit === 'd' || (unit === 'h' && duration >= 24)) {
      return {
        hour: 'MMM d, HH:mm',
        minute: 'HH:mm',
        second: 'HH:mm:ss',
        day: 'MMM d'
      };
    } else {
      return {
        hour: 'HH:mm',
        minute: 'HH:mm',
        second: 'HH:mm:ss'
      };
    }
  }

  private shouldShowLegend(): boolean {
    return this.widgetProperties.config.historyPaths.length > 1 || 
           this.widgetProperties.config.aggregationMethods.length > 1;
  }


  private createDatasets(): void {
    this.lineChartData.datasets = [];
    
    const paths = this.widgetProperties.config.historyPaths || [];
    const methods = this.widgetProperties.config.aggregationMethods || ['average'];
    const colors = this.generateDatasetColors(paths.length * methods.length);
    
    let colorIndex = 0;
    paths.forEach(path => {
      methods.forEach(method => {
        const datasetLabel = paths.length > 1 || methods.length > 1 
          ? `${path} (${method})` 
          : this.widgetProperties.config.displayName;
        
        this.lineChartData.datasets.push({
          label: datasetLabel,
          data: [],
          parsing: false,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 4,
          borderWidth: 2,
          borderColor: colors[colorIndex].line,
          backgroundColor: colors[colorIndex].fill,
          fill: false,
        });
        colorIndex++;
      });
    });
  }

  private generateDatasetColors(count: number): Array<{line: string, fill: string}> {
    const themeColors = this.getThemeColors();
    const baseColors = [
      themeColors.valueLine,
      this.theme().blue,
      this.theme().green,
      this.theme().orange,
      this.theme().purple,
      this.theme().pink,
      this.theme().yellow,
      this.theme().grey
    ];
    
    const colors = [];
    for (let i = 0; i < count; i++) {
      const baseColor = baseColors[i % baseColors.length];
      colors.push({
        line: baseColor,
        fill: baseColor + '20' // Add transparency
      });
    }
    return colors;
  }

  private getThemeColors(): IChartColors {
    const widgetColor = this.widgetProperties.config.color;
    console.log('HISTORY CHART COLOR DEBUG:', widgetColor);
    
    switch (widgetColor) {
      case "blue":
        return {
          valueLine: this.theme().blue,
          valueFill: this.theme().blue + '30',
          chartLabel: this.theme().contrastDim,
          chartValue: this.theme().blue
        };
      case "green":
        return {
          valueLine: this.theme().green,
          valueFill: this.theme().green + '30',
          chartLabel: this.theme().contrastDim,
          chartValue: this.theme().green
        };
      case "orange":
        return {
          valueLine: this.theme().orange,
          valueFill: this.theme().orange + '30',
          chartLabel: this.theme().contrastDim,
          chartValue: this.theme().orange
        };
      case "yellow":
        return {
          valueLine: this.theme().yellow,
          valueFill: this.theme().yellow + '30',
          chartLabel: this.theme().contrastDim,
          chartValue: this.theme().yellow
        };
      case "pink":
        return {
          valueLine: this.theme().pink,
          valueFill: this.theme().pink + '30',
          chartLabel: this.theme().contrastDim,
          chartValue: this.theme().pink
        };
      case "purple":
        return {
          valueLine: this.theme().purple,
          valueFill: this.theme().purple + '30',
          chartLabel: this.theme().contrastDim,
          chartValue: this.theme().purple
        };
      case "grey":
        return {
          valueLine: this.theme().grey,
          valueFill: this.theme().grey + '30',
          chartLabel: this.theme().contrastDim,
          chartValue: this.theme().grey
        };
      case "contrast":
        return {
          valueLine: this.theme().contrast,
          valueFill: this.theme().contrast + '30',
          chartLabel: this.theme().contrastDim,
          chartValue: this.theme().contrast
        };
      default:
        return {
          valueLine: this.theme().contrast,
          valueFill: this.theme().contrast + '30',
          chartLabel: this.theme().contrastDim,
          chartValue: this.theme().contrast
        };
    }
  }

  private loadHistoryData(): void {
    const params = this.buildHistoryParams();
    const url = `${this.widgetProperties.config.historyApiUrl}/values`;
    
    console.log('=== HISTORY CHART DEBUG ===');
    console.log('API URL:', url);
    console.log('API Params:', params);
    console.log('Widget Config:', this.widgetProperties.config);
    
    this.http.get<HistoryDataResult>(url, { params }).pipe(
      catchError(error => {
        console.error('Failed to load history data from:', url);
        console.error('With params:', params);
        console.error('Error details:', error);
        return of(null);
      })
    ).subscribe(result => {
      console.log('API Response received:', result);
      if (result) {
        console.log('Data rows count:', result.data?.length);
        console.log('Value columns:', result.values);
        this.updateChartData(result);
        this.lastDataFetch = new Date();
      } else {
        console.log('No data received from API');
      }
    });
  }

  private buildHistoryParams(): Record<string, string> {
    const config = this.widgetProperties.config;
    const params: Record<string, string> = {};
    
    console.log('Building params from config:', {
      historyPaths: config.historyPaths,
      aggregationMethods: config.aggregationMethods,
      timeMode: config.timeMode,
      startTime: config.startTime,
      endTime: config.endTime,
      duration: config.duration,
      durationUnit: config.durationUnit
    });
    
    // Build paths parameter with aggregation methods
    const pathsWithMethods = [];
    if (config.historyPaths && config.aggregationMethods) {
      config.historyPaths.forEach(path => {
        config.aggregationMethods.forEach(method => {
          pathsWithMethods.push(`${path}:${method}`);
        });
      });
    }
    params['paths'] = pathsWithMethods.join(',');
    console.log('Built paths parameter:', params['paths']);
    
    // Time parameters
    if (config.timeMode === 'duration') {
      params['start'] = config.startTime || 'now';
      params['duration'] = `${config.duration || 1}${config.durationUnit || 'h'}`;
      console.log('Using duration mode:', params['start'], params['duration']);
    } else {
      params['from'] = config.startTime;
      params['to'] = config.endTime;
      console.log('Using range mode:', params['from'], 'to', params['to']);
    }
    
    // Additional parameters
    if (config.useUTC) {
      params['useUTC'] = 'true';
    }
    
    if (config.refreshEnabled) {
      params['refresh'] = 'true';
    }
    
    if (config.resolution) {
      params['resolution'] = config.resolution.toString();
    }
    
    console.log('Final API params:', params);
    return params;
  }

  private updateChartData(result: HistoryDataResult): void {
    if (!result.data || result.data.length === 0) {
      return;
    }
    
    // Clear existing data
    this.lineChartData.datasets.forEach(dataset => {
      dataset.data = [];
    });
    
    // Process data rows
    result.data.forEach(row => {
      const timestamp = new Date(row[0]).getTime();
      
      // Skip the timestamp column, process data columns
      for (let i = 1; i < row.length; i++) {
        const datasetIndex = i - 1;
        if (datasetIndex < this.lineChartData.datasets.length) {
          const value = row[i];
          if (value !== null && value !== undefined) {
            const point = this.widgetProperties.config.verticalChart 
              ? { x: value, y: timestamp }
              : { x: timestamp, y: value };
            this.lineChartData.datasets[datasetIndex].data.push(point);
          }
        }
      }
    });
    
    this.ngZone.runOutsideAngular(() => {
      this.chart?.update('none');
    });
  }

  private setupRefresh(): void {
    this.stopRefresh();
    
    if (this.widgetProperties.config.refreshEnabled && this.widgetProperties.config.refreshInterval > 0) {
      this.refreshSubscription = interval(this.widgetProperties.config.refreshInterval * 1000).pipe(
        switchMap(() => {
          // Only refresh if we're in 'now' mode or duration mode with 'now' start
          if (this.widgetProperties.config.startTime === 'now' || 
              (this.widgetProperties.config.timeMode === 'duration' && this.widgetProperties.config.startTime === 'now')) {
            return this.http.get<HistoryDataResult>(`${this.widgetProperties.config.historyApiUrl}/values`, {
              params: this.buildHistoryParams()
            }).pipe(
              catchError(error => {
                console.error('Failed to refresh history data:', error);
                return of(null);
              })
            );
          }
          return of(null);
        })
      ).subscribe(result => {
        if (result) {
          this.updateChartData(result);
        }
      });
    }
  }

  private stopRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = null;
    }
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
    this.stopRefresh();
    this.chart?.destroy();
  }
}