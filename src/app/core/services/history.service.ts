import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { DataService } from './data.service';
import { IDatasetServiceDatapoint, IDatasetServiceDatasetConfig } from './data-set.service';

// Interface for REST history feed response
interface IHistoryFeedResponse {
  context: string;
  range: {
    from: string;
    to: string;
  };
  values: {
    path: string;
    method: string;
  }[];
  data: [string, ...unknown[]][];
}

@Injectable({
  providedIn: 'root'
})
export class HistoryService {
  private http = inject(HttpClient);
  private data = inject(DataService);

  /**
   * Fetch historical data from REST feed with plugin-controlled scheduling
   * Returns observable with historical datapoints that can be subscribed to
   */
  public fetchHistoryData(
    config: IDatasetServiceDatasetConfig,
    maxDataPoints: number,
    historyApiUrl?: string
  ): Observable<IDatasetServiceDatapoint[]> {
    // Use provided URL or default to localhost:3000
    const baseUrl = historyApiUrl || `http://localhost:3000/signalk/v1/history`;
    const endTime = new Date();
    
    // Calculate time range based on dataset configuration
    const timeRange = this.calculateTimeRange(config, endTime);
    
    // Normalize path to remove context prefixes
    const cleanPath = this.normalizePathKey(config.path);
    
    const params = new URLSearchParams({
      context: 'vessels.self',
      from: timeRange.start.toISOString(),
      to: timeRange.end.toISOString(),
      paths: `${cleanPath}:max`
    });

    const url = `${baseUrl}/values?${params.toString()}`;

    return this.http.get<IHistoryFeedResponse>(url).pipe(
      catchError(error => {
        console.error(`[History Service] Failed to fetch history data for ${config.uuid}:`, error);
        return of(null);
      }),
      switchMap(response => {
        if (!response || !response.data || response.data.length === 0) {
          console.warn(`[History Service] No history data received for ${config.uuid}`);
          return of([]);
        }

        // Process historical data points
        const datapoints: IDatasetServiceDatapoint[] = [];
        const unit = this.data.getPathUnitType(config.path) || 'unitless';
        const domain = this.resolveAngleDomain(config.path, unit);

        // Plugin-controlled scheduling: only return data points that fit the requested schedule
        const scheduledData = this.applyScheduling(response.data, config, maxDataPoints);
        
        scheduledData.forEach(row => {
          if (row.length >= 2) {
            const timestamp = new Date(row[0] as string).getTime();
            const value = row[1] as number;
            
            if (typeof value === 'number' && !isNaN(value)) {
              const datapoint: IDatasetServiceDatapoint = {
                timestamp,
                data: {
                  value: unit === 'rad' 
                    ? (domain === 'signed' 
                        ? this.normalizeToSigned(value)
                        : this.normalizeToDirection(value))
                    : value,
                  sma: null, // Will be calculated by dataset service
                  ema: null,
                  doubleEma: null,
                  lastAngleAverage: null,
                  lastAverage: null,
                  lastMinimum: null,
                  lastMaximum: null
                }
              };
              datapoints.push(datapoint);
            }
          }
        });

        return of(datapoints);
      })
    );
  }

  /**
   * Calculate appropriate time range based on dataset configuration
   */
  private calculateTimeRange(config: IDatasetServiceDatasetConfig, endTime: Date): { start: Date, end: Date } {
    let timeRangeMs: number;

    switch (config.timeScaleFormat) {
      case "Last 30 Minutes":
        timeRangeMs = 30 * 60 * 1000;
        break;
      case "Last 5 Minutes":
        timeRangeMs = 5 * 60 * 1000;
        break;
      case "Last Minute":
        timeRangeMs = 1 * 60 * 1000;
        break;
      case "hour":
        timeRangeMs = config.period * 60 * 60 * 1000;
        break;
      case "minute":
        timeRangeMs = config.period * 60 * 1000;
        break;
      default: // "second"
        timeRangeMs = config.period * 1000;
        break;
    }

    const startTime = new Date(endTime.getTime() - timeRangeMs);
    return { start: startTime, end: endTime };
  }

  /**
   * Apply plugin-controlled scheduling to historical data
   * This prevents sending the same data multiple times and schedules updates appropriately
   */
  private applyScheduling(
    data: [string, ...unknown[]][],
    config: IDatasetServiceDatasetConfig,
    maxDataPoints: number
  ): [string, ...unknown[]][] {
    if (data.length === 0) return [];

    // Calculate the appropriate interval based on the dataset configuration
    let intervalMs: number;
    
    switch (config.timeScaleFormat) {
      case "Last 30 Minutes":
        intervalMs = 15000; // 15 seconds
        break;
      case "Last 5 Minutes":
        intervalMs = 5000; // 5 seconds
        break;
      case "Last Minute":
        intervalMs = 1000; // 1 second
        break;
      case "hour":
        intervalMs = 30000; // 30 seconds
        break;
      case "minute":
        intervalMs = 1000; // 1 second
        break;
      default: // "second"
        intervalMs = 200; // 200ms
        break;
    }

    // Filter data to match the desired interval and prevent duplicates
    const filteredData: [string, ...unknown[]][] = [];
    let lastTimestamp = 0;

    for (const row of data) {
      const timestamp = new Date(row[0] as string).getTime();
      
      // Only include data points that are at least intervalMs apart
      if (timestamp - lastTimestamp >= intervalMs) {
        filteredData.push(row);
        lastTimestamp = timestamp;
      }
    }

    // Limit to maxDataPoints to prevent overwhelming the system
    if (filteredData.length > maxDataPoints) {
      // Take evenly distributed points across the range
      const step = Math.floor(filteredData.length / maxDataPoints);
      const sampledData: [string, ...unknown[]][] = [];
      for (let i = 0; i < filteredData.length; i += step) {
        sampledData.push(filteredData[i]);
      }
      return sampledData.slice(0, maxDataPoints);
    }

    return filteredData;
  }

  // Utility methods for path and angle normalization
  private normalizePathKey(path: string): string {
    return path.replace(/^vessels\.self\./, '').replace(/^self\./, '');
  }

  private resolveAngleDomain(path: string, unit: string): 'scalar' | 'direction' | 'signed' {
    if (unit !== 'rad') return 'scalar';
    
    const signedAnglePaths = new Set<string>([
      "navigation.attitude.roll",
      "navigation.attitude.pitch", 
      "navigation.attitude.yaw",
      "environment.wind.angleApparent",
      "environment.wind.angleTrueGround",
      "environment.wind.angleTrueWater",
      "steering.rudderAngle"
    ]);

    const normalized = this.normalizePathKey(path);
    return signedAnglePaths.has(normalized) ? 'signed' : 'direction';
  }

  private mod(a: number, n: number): number { 
    return ((a % n) + n) % n; 
  }
  
  private normalizeToDirection(rad: number): number {
    const twoPi = 2 * Math.PI;
    return this.mod(rad, twoPi); // [0, 2π)
  }
  
  private normalizeToSigned(rad: number): number {
    const twoPi = 2 * Math.PI;
    return this.mod(rad + Math.PI, twoPi) - Math.PI; // (-π, π]
  }
}