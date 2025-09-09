import { Injectable, inject } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable, of } from "rxjs";
import { catchError, switchMap } from "rxjs/operators";
import { DataService } from "./data.service";
import { IDatasetServiceDatapoint, IDatasetServiceDatasetConfig } from "./data-set.service";

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
  providedIn: "root"
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
    historyApiUrl: string = `${window.location.protocol}//${window.location.host}/signalk/v1/history`
  ): Observable<IDatasetServiceDatapoint[]> {
    // Use provided URL or default to current host
    const baseUrl = historyApiUrl;
    const endTime = new Date();
    
    // Calculate time range based on dataset configuration
    const timeRange = this.calculateTimeRange(config, endTime);
    
    // Normalize path to remove context prefixes
    const cleanPath = this.normalizePathKey(config.path);
    
    const params = new URLSearchParams({
      context: "vessels.self",
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
        const unit = this.data.getPathUnitType(config.path) || "unitless";
        const domain = this.resolveAngleDomain(config.path, unit);

        // Plugin-controlled scheduling: only return data points that fit the requested schedule
        const scheduledData = this.applyScheduling(response.data, config, maxDataPoints);
        
        scheduledData.forEach(row => {
          if (row.length >= 2) {
            const timestamp = new Date(row[0] as string).getTime();
            const value = row[1] as number;
            
            if (typeof value === "number" && !isNaN(value)) {
              const datapoint: IDatasetServiceDatapoint = {
                timestamp,
                data: {
                  value: unit === "rad" 
                    ? (domain === "signed" 
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
   * Convert time scale format to ISO 8601 duration format
   */
  private getISO8601Duration(config: IDatasetServiceDatasetConfig): string {
    switch (config.timeScaleFormat) {
      case "Last 30 Minutes":
        return "PT30M";
      case "Last 5 Minutes":
        return "PT5M";
      case "Last Minute":
        return "PT1M";
      case "hour":
        return `PT${config.period}H`;
      case "minute":
        return `PT${config.period}M`;
      default: // "second"
        return `PT${config.period}S`;
    }
  }

  /**
   * Convert ISO 8601 duration to milliseconds for internal calculations
   */
  private durationToMs(duration: string): number {
    const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseFloat(match[3] || "0");
    
    return (hours * 60 * 60 + minutes * 60 + seconds) * 1000;
  }

  /**
   * Calculate appropriate time range based on dataset configuration
   */
  private calculateTimeRange(config: IDatasetServiceDatasetConfig, endTime: Date): { start: Date, end: Date } {
    const duration = this.getISO8601Duration(config);
    const timeRangeMs = this.durationToMs(duration);
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

    // Calculate the appropriate interval based on the dataset configuration using ISO 8601 durations
    const getSchedulingInterval = (config: IDatasetServiceDatasetConfig): string => {
      switch (config.timeScaleFormat) {
        case "Last 30 Minutes":
          return "PT15S"; // 15 seconds
        case "Last 5 Minutes":
          return "PT5S"; // 5 seconds
        case "Last Minute":
          return "PT1S"; // 1 second
        case "hour":
          return "PT30S"; // 30 seconds
        case "minute":
          return "PT1S"; // 1 second
        default: // "second"
          return "PT0.2S"; // 200ms
      }
    };
    
    const intervalDuration = getSchedulingInterval(config);
    const intervalMs = this.durationToMs(intervalDuration);

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
    return path.replace(/^vessels\.self\./, "").replace(/^self\./, "");
  }

  private resolveAngleDomain(path: string, unit: string): "scalar" | "direction" | "signed" {
    if (unit !== "rad") return "scalar";
    
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
    return signedAnglePaths.has(normalized) ? "signed" : "direction";
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