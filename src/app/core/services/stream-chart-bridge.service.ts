import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, interval, BehaviorSubject } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';

export interface StreamChartConfig {
  streamId: string;
  name: string;
  path: string;
  timeRange: string;
  resolution: number;
  aggregateMethod: 'average' | 'min' | 'max' | 'sum' | 'count';
  chartConfig?: {
    displayName: string;
    color: string;
    showTimeScale: boolean;
    showYScale: boolean;
  };
}

export interface ChartDataset {
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

export interface StreamInfo {
  id: string;
  name: string;
  path: string;
  status: 'running' | 'stopped' | 'paused' | 'created';
  timeRange?: string;
  resolution?: number;
  aggregateMethod?: string;
  dataPointsStreamed?: number;
  lastValue?: any;
  lastTimestamp?: string;
}

@Injectable({
  providedIn: 'root'
})
export class StreamChartBridgeService {
  private baseUrl = `${window.location.origin}`;
  private parquetApiUrl = `${this.baseUrl}/plugins/signalk-parquet`;
  
  private activeStreams = new Map<string, StreamChartConfig>();
  private chartDatasets = new Map<string, ChartDataset>();
  private streamUpdates = new Subject<{ streamId: string; dataset: ChartDataset }>();
  private availableStreams = new BehaviorSubject<StreamInfo[]>([]);

  constructor(private http: HttpClient) {
    this.initializeService();
  }

  private initializeService() {
    // Load available streams on startup
    this.loadAvailableStreams();
    
    // Set up periodic refresh of available streams
    interval(10000).subscribe(() => {
      this.loadAvailableStreams();
    });
  }

  /**
   * Get all available streams from signalk-parquet
   */
  public getAvailableStreams(): Observable<StreamInfo[]> {
    return this.availableStreams.asObservable();
  }

  private loadAvailableStreams() {
    this.http.get<any>(`${this.parquetApiUrl}/api/streams`)
      .pipe(
        catchError(error => {
          console.warn('Failed to load streams from signalk-parquet:', error);
          return of({ streams: [] });
        })
      )
      .subscribe(response => {
        const streams: StreamInfo[] = response.streams || [];
        this.availableStreams.next(streams);
      });
  }

  /**
   * Create a new stream configured for chart visualization
   */
  public createStreamForChart(config: Omit<StreamChartConfig, 'streamId'>): Observable<{ success: boolean; streamId?: string; error?: string }> {
    const streamRequest = {
      name: config.name,
      path: config.path,
      timeRange: config.timeRange,
      resolution: config.resolution,
      aggregateMethod: config.aggregateMethod,
      rate: 5000, // Update every 5 seconds for charts
      windowSize: 100 // Keep last 100 data points for charts
    };

    return this.http.post<any>(`${this.parquetApiUrl}/api/streams`, streamRequest)
      .pipe(
        tap(response => {
          if (response.success && response.stream) {
            // Store chart-specific configuration
            const chartConfig: StreamChartConfig = {
              ...config,
              streamId: response.stream.id
            };
            
            this.activeStreams.set(response.stream.id, chartConfig);
            this.initializeChartDataset(response.stream.id, chartConfig);
          }
        }),
        catchError(error => {
          console.error('Failed to create stream:', error);
          return of({ success: false, error: error.message || 'Failed to create stream' });
        })
      );
  }

  /**
   * Ingest an existing stream and prepare it for chart visualization
   */
  public ingestExistingStream(streamId: string): Observable<{ success: boolean; error?: string }> {
    return this.http.get<any>(`${this.parquetApiUrl}/api/streams`)
      .pipe(
        switchMap(response => {
          const streams = response.streams || [];
          const existingStream = streams.find((s: any) => s.id === streamId);
          
          if (!existingStream) {
            return of({ success: false, error: 'Stream not found' });
          }

          // Convert existing stream to chart configuration
          const chartConfig: StreamChartConfig = {
            streamId: existingStream.id,
            name: existingStream.name,
            path: existingStream.path,
            timeRange: existingStream.timeRange || '1h',
            resolution: existingStream.resolution || 30000,
            aggregateMethod: (existingStream.aggregateMethod as any) || 'average',
            chartConfig: {
              displayName: existingStream.name,
              color: 'contrast',
              showTimeScale: true,
              showYScale: true
            }
          };

          this.activeStreams.set(streamId, chartConfig);
          this.initializeChartDataset(streamId, chartConfig);

          // Start monitoring this stream for chart updates
          this.startChartDataUpdates(streamId);

          return of({ success: true });
        }),
        catchError(error => {
          console.error('Failed to ingest existing stream:', error);
          return of({ success: false, error: error.message || 'Failed to ingest stream' });
        })
      );
  }

  /**
   * Start streaming data for charts
   */
  public startStreamForChart(streamId: string): Observable<{ success: boolean; error?: string }> {
    return this.http.put<any>(`${this.parquetApiUrl}/api/streams/${streamId}/start`, {})
      .pipe(
        tap(response => {
          if (response.success) {
            this.startChartDataUpdates(streamId);
          }
        }),
        catchError(error => {
          console.error('Failed to start stream:', error);
          return of({ success: false, error: error.message || 'Failed to start stream' });
        })
      );
  }

  /**
   * Stop streaming data for charts
   */
  public stopStreamForChart(streamId: string): Observable<{ success: boolean; error?: string }> {
    return this.http.put<any>(`${this.parquetApiUrl}/api/streams/${streamId}/stop`, {})
      .pipe(
        catchError(error => {
          console.error('Failed to stop stream:', error);
          return of({ success: false, error: error.message || 'Failed to stop stream' });
        })
      );
  }

  /**
   * Get chart-compatible dataset for a stream
   */
  public getChartDataset(streamId: string): ChartDataset | null {
    return this.chartDatasets.get(streamId) || null;
  }

  /**
   * Get real-time updates for a specific stream's chart data
   */
  public getStreamUpdates(streamId: string): Observable<ChartDataset> {
    return this.streamUpdates.asObservable().pipe(
      switchMap(update => {
        if (update.streamId === streamId) {
          return of(update.dataset);
        }
        return of();
      })
    );
  }

  /**
   * Convert stream data to Kip History Chart compatible format
   */
  public convertToHistoryChartFormat(streamId: string): Observable<any> {
    const dataset = this.getChartDataset(streamId);
    if (!dataset) {
      return of(null);
    }

    // Convert to the format expected by Kip's WidgetHistoryChartComponent
    const historyChartFormat = {
      context: dataset.context,
      range: dataset.range,
      values: dataset.values,
      data: dataset.data,
      refresh: dataset.refresh
    };

    return of(historyChartFormat);
  }

  private initializeChartDataset(streamId: string, config: StreamChartConfig) {
    const now = new Date();
    const timeRangeMs = this.parseTimeRange(config.timeRange);
    
    const dataset: ChartDataset = {
      context: 'vessels.self', // Default context
      range: {
        from: new Date(now.getTime() - timeRangeMs).toISOString(),
        to: now.toISOString()
      },
      values: [{
        path: config.path,
        method: config.aggregateMethod
      }],
      data: [],
      refresh: {
        enabled: true,
        intervalSeconds: 30,
        nextRefresh: new Date(now.getTime() + 30000).toISOString()
      }
    };

    this.chartDatasets.set(streamId, dataset);
  }

  private startChartDataUpdates(streamId: string) {
    // Set up periodic updates from stream to chart dataset
    const updateInterval = interval(5000); // Update every 5 seconds
    
    updateInterval.pipe(
      switchMap(() => this.updateChartFromStream(streamId)),
      catchError(error => {
        console.error(`Error updating chart data for stream ${streamId}:`, error);
        return of(null);
      })
    ).subscribe();
  }

  private updateChartFromStream(streamId: string): Observable<any> {
    return this.http.get<any>(`${this.parquetApiUrl}/api/streams/${streamId}/data?limit=50`)
      .pipe(
        tap(response => {
          if (response && response.data && response.data.length > 0) {
            const dataset = this.chartDatasets.get(streamId);
            if (!dataset) return;

            // Convert stream data to chart format
            const chartData: Array<[string, any]> = response.data.map((point: any) => [
              point.timestamp,
              point.value
            ]);

            // Update dataset
            dataset.data = chartData;
            dataset.range.to = new Date().toISOString();
            
            // Update next refresh time
            if (dataset.refresh) {
              dataset.refresh.nextRefresh = new Date(Date.now() + 30000).toISOString();
            }

            this.chartDatasets.set(streamId, dataset);

            // Emit update
            this.streamUpdates.next({ streamId, dataset });
          }
        }),
        catchError(error => {
          console.warn(`No data available for stream ${streamId}:`, error);
          return of(null);
        })
      );
  }

  private parseTimeRange(timeRange: string): number {
    const match = timeRange.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 60 * 60 * 1000; // 1 hour default
    }
    
    const value = parseInt(match[1]);
    const unit = match[2];
    
    switch (unit) {
      case 's': return value * 1000;
      case 'm': return value * 60 * 1000;
      case 'h': return value * 60 * 60 * 1000;
      case 'd': return value * 24 * 60 * 60 * 1000;
      default: return 60 * 60 * 1000;
    }
  }

  /**
   * Cleanup method
   */
  public shutdown() {
    this.activeStreams.clear();
    this.chartDatasets.clear();
    this.streamUpdates.complete();
    this.availableStreams.complete();
  }
}