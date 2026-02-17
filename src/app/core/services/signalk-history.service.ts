import { Injectable, inject, DestroyRef } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SignalKConnectionService } from './signalk-connection.service';

/**
 * Represents a single data point from the History API response.
 * The array format: [timestamp_string, value1, value2, ...]
 * where each value corresponds to the paths in the request.
 */
export interface IHistoryDataPoint {
  timestamp: string;
  values: (number | string | null | number[])[];
}

/**
 * Represents a single series metadata from the History API response.
 */
export interface IHistoryValueMetadata {
  path: string;
  method?: string; // e.g., 'sma', 'avg', 'min', 'max'
}

/**
 * Complete response from the History API /values endpoint.
 */
export interface IHistoryValuesResponse {
  context: string;
  range: {
    from: string;
    to: string;
  };
  values: IHistoryValueMetadata[];
  data: (string | number | null | number[])[][];
}

/**
 * Query parameters for the History API.
 */
export interface IHistoryQueryParams {
  from?: string;      // ISO 8601 date-time (inclusive)
  to?: string;        // ISO 8601 date-time (inclusive, defaults to now)
  duration?: string;  // ISO 8601 duration or milliseconds
  paths: string;      // Required: comma-separated Signal K paths with optional aggregation
  context?: string;   // Optional Signal K context, default 'vessels.self'
  resolution?: string | number; // Optional: window length in seconds or time expression
}

@Injectable({
  providedIn: 'root'
})
export class SignalkHistoryService {
  private http = inject(HttpClient);
  private connection = inject(SignalKConnectionService);
  private destroyRef = inject(DestroyRef);

  private historyServiceUrl: string | null = null;

  constructor() {
    // Monitor endpoint changes; derive v2 history URL from the published v1 endpoint.
    this.connection.serverServiceEndpoint$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(endpoint => {
        const httpServiceUrl = endpoint?.httpServiceUrl || null;
        this.historyServiceUrl = httpServiceUrl ? httpServiceUrl.replace('/v1/', '/v2/') : null;
        if (!this.historyServiceUrl) {
          console.warn(`[SignalkHistoryService] History API endpoint not available; history service is disabled`);
        }
      });
  }

  /**
   * Gets paths that have historical data available for the specified time range.
   *
   * @param {Partial<IHistoryQueryParams>} params - Optional time range parameters.
   *   - from: Start of the time range (ISO 8601), optional
   *   - to: End of the time range (ISO 8601), optional
   *   - duration: Duration of the time range (ISO 8601 or milliseconds), optional
   *
   * @returns {Promise<string[] | null>} Array of Signal K paths with historical data, or null if the request fails.
   *
   * @example
   *   const paths = await historyService.getPaths({
   *     from: new Date(Date.now() - 3600000).toISOString(),
   *     to: new Date().toISOString()
   *   });
   *   if (paths) {
   *     console.log('Available paths:', paths);
   *   }
   *
   * @memberof SignalkHistoryService
   */
  public async getPaths(params?: Partial<IHistoryQueryParams>): Promise<string[] | null> {
    try {
      if (!this.historyServiceUrl) {
        console.warn('[SignalkHistoryService] No HTTP service URL available');
        return null;
      }

      const historyUrl = `${this.historyServiceUrl}history/paths`;
      let httpParams = new HttpParams();

      // Build query parameters (time range only, no paths needed)
      if (params?.from) {
        httpParams = httpParams.set('from', params.from);
      }
      if (params?.to) {
        httpParams = httpParams.set('to', params.to);
      }
      if (params?.duration) {
        httpParams = httpParams.set('duration', params.duration.toString());
      }

      const fullUrl = `${historyUrl}?${httpParams.toString()}`;
      console.log(`[SignalkHistoryService] GET ${fullUrl}`);

      const response = await firstValueFrom(
        this.http.get<string[]>(historyUrl, { params: httpParams })
      );

      console.log(`[SignalkHistoryService] Retrieved ${response?.length ?? 0} available paths`);
      return response;
    } catch (error) {
      console.error('[SignalkHistoryService] History API /paths request failed:', error);
      return null;
    }
  }

  /**
   * Fetches historical data from the Signal K History API.
   *
   * The History API must be available on the Signal K server. History data
   * is populated by installed plugins such as signalk-to-influxdb2 or
   * signalk-parquet. If no history is available or the API is not installed,
   * the request will fail.
   *
   * @param {IHistoryQueryParams} params - Query parameters for the history request.
   *   - paths (required): comma-separated Signal K paths with optional aggregation suffixes
   *     (e.g., 'navigation.speedOverGround:sma:5,navigation.speedThroughWater:avg')
   *   - from, to, duration: define the time range
   *   - resolution: optional downsampling window
   *   - context: optional Signal K context (defaults to 'vessels.self')
   *
   * @returns {Promise<IHistoryValuesResponse | null>} The history response, or null if the request fails.
   *
   * @example
   *   const response = await historyService.getValues({
   *     paths: 'navigation.speedThroughWater:avg,navigation.speedThroughWater:min',
   *     from: new Date(Date.now() - 3600000).toISOString(),
   *     to: new Date().toISOString(),
   *     resolution: 1
   *   });
   *   if (response) {
   *     for (const [timestamp, ...values] of response.data) {
   *       console.log(timestamp, values);
   *     }
   *   }
   *
   * @memberof SignalkHistoryService
   */
  public async getValues(params: IHistoryQueryParams): Promise<IHistoryValuesResponse | null> {
    try {
      if (!this.historyServiceUrl) {
        console.warn('[SignalkHistoryService] No HTTP service URL available');
        return null;
      }

      const historyUrl = `${this.historyServiceUrl}history/values`;
      let httpParams = new HttpParams();

      // Build query parameters
      httpParams = httpParams.set('paths', params.paths);
      if (params.context) {
        httpParams = httpParams.set('context', params.context);
      }
      if (params.from) {
        httpParams = httpParams.set('from', params.from);
      }
      if (params.to) {
        httpParams = httpParams.set('to', params.to);
      }
      if (params.duration) {
        httpParams = httpParams.set('duration', params.duration.toString());
      }
      if (params.resolution !== undefined && params.resolution !== null) {
        httpParams = httpParams.set('resolution', params.resolution.toString());
      }

      const fullUrl = `${historyUrl}?${httpParams.toString()}`;
      console.log(`[SignalkHistoryService] GET ${fullUrl}`);

      const response = await firstValueFrom(
        this.http.get<IHistoryValuesResponse>(historyUrl, { params: httpParams })
      );

      console.log(`[SignalkHistoryService] History fetch successful, received ${response.data?.length ?? 0} data points`);
      return response;
    } catch (error) {
      console.error('[SignalkHistoryService] History API request failed:', error);
      return null;
    }
  }
}
