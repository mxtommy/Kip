import { DestroyRef, inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SignalKConnectionService } from './signalk-connection.service';
import { PluginConfigClientService } from './plugin-config-client.service';
import type { AggregateMethod, TimeRangeQueryParams } from '@signalk/server-api/history';

/**
 * Series definition expected by the KIP plugin `/plugins/kip/series/reconcile` endpoint.
 */
export interface IKipSeriesDefinition {
  seriesId: string;
  datasetUuid: string;
  ownerWidgetUuid: string;
  ownerWidgetSelector?: string | null;
  path: string;
  context?: string | null;
  source?: string | null;
  timeScale?: string | null;
  period?: number | null;
  retentionDurationMs?: number | null;
  sampleTime?: number | null;
  enabled?: boolean;
}

/**
 * Reconcile summary returned by the KIP plugin `/plugins/kip/series/reconcile` endpoint.
 */
export interface IKipSeriesReconcileResult {
  created: number;
  updated: number;
  deleted: number;
  total: number;
}

/**
 * Represents a single series metadata from the History API response.
 */
interface IHistoryValueMetadata {
  path: string;
  method?: AggregateMethod | 'avg'; // keep 'avg' for compatibility with existing backends/tests
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
 * Query parameters supported by the /history/values endpoint in this app.
 *
 * Extends server-api query params while preserving current app compatibility:
 * - allows string `resolution` passthrough (e.g. `PT1S`)
 * - requires `paths` for the HTTP endpoint variant used by KIP
 */
export type IHistoryValuesQueryParams = Partial<TimeRangeQueryParams> & {
  paths: string;
  context?: string;
  resolution?: number | string;
};

@Injectable({
  providedIn: 'root'
})
export class KipSeriesApiClientService {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(SignalKConnectionService);
  private readonly pluginConfig = inject(PluginConfigClientService);
  private readonly destroyRef = inject(DestroyRef);

  private kipPluginServiceUrl: string | null = null;

  constructor() {
    this.connection.serverServiceEndpoint$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(endpoint => {
        const httpServiceUrl = endpoint?.httpServiceUrl || null;
        this.kipPluginServiceUrl = this.resolveKipPluginServiceUrl(httpServiceUrl);
      });
  }

  private resolveKipPluginServiceUrl(httpServiceUrl: string | null): string | null {
    const configuredUrl = this.connection.signalKURL?.url?.trim();
    if (configuredUrl) {
      const base = configuredUrl.endsWith('/') ? configuredUrl.slice(0, -1) : configuredUrl;
      return `${base}/plugins/kip/`;
    }

    if (!httpServiceUrl) {
      return null;
    }

    const normalized = httpServiceUrl.endsWith('/') ? httpServiceUrl.slice(0, -1) : httpServiceUrl;
    const root = normalized
      .replace(/\/signalk\/v2\/api$/, '')
      .replace(/\/signalk\/v1\/api$/, '')
      .replace(/\/signalk\/v2$/, '')
      .replace(/\/signalk\/v1$/, '')
      .replace(/\/signalk$/, '');

    return `${root}/plugins/kip/`;
  }

  /**
   * Reconciles the full KIP history series set with the backend plugin.
   *
   * @param {IKipSeriesDefinition[]} seriesDefinitions Desired full set of series definitions.
   * @returns {Promise<IKipSeriesReconcileResult | null>} Reconcile summary when successful, otherwise null.
   *
   * @example
  * const result = await kipSeriesApiClientService.reconcileSeries([
   *   {
   *     seriesId: 'widget-123:datachart',
   *     datasetUuid: 'widget-123',
   *     ownerWidgetUuid: 'widget-123',
   *     ownerWidgetSelector: 'widget-data-chart',
   *     path: 'navigation.speedThroughWater',
   *     source: 'default',
   *     timeScale: 'minute',
   *     period: 10,
   *     enabled: true
   *   }
   * ]);
   *
   * @memberof KipSeriesApiClientService
   */
  public async reconcileSeries(seriesDefinitions: IKipSeriesDefinition[]): Promise<IKipSeriesReconcileResult | null> {
    try {
      const modeConfig = await this.pluginConfig.getKipRuntimeModeConfigCached('kip');
      if (!modeConfig.historySeriesServiceEnabled) {
        console.warn('[KipSeriesApiClientService] Reconcile skipped because history-series service is disabled in KIP plugin settings');
        return null;
      }

      if (!this.kipPluginServiceUrl) {
        console.warn('[KipSeriesApiClientService] No KIP plugin endpoint available for series reconcile');
        return null;
      }

      const reconcileUrl = `${this.kipPluginServiceUrl}series/reconcile`;
      console.log(`[KipSeriesApiClientService] POST ${reconcileUrl} (${seriesDefinitions.length} series)`);

      const response = await firstValueFrom(
        this.http.post<IKipSeriesReconcileResult>(reconcileUrl, seriesDefinitions)
      );

      console.log(
        `[KipSeriesApiClientService] Series reconcile successful (created=${response.created}, updated=${response.updated}, deleted=${response.deleted}, total=${response.total})`
      );
      return response;
    } catch (error) {
      console.error('[KipSeriesApiClientService] Series reconcile request failed:', error);
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
   * @param {IHistoryValuesQueryParams} params - Query parameters for the history request.
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
   * @memberof HistoryApiClientService
   */
  public async getValues(params: IHistoryValuesQueryParams): Promise<IHistoryValuesResponse | null> {
    try {
      if (!this.kipPluginServiceUrl) {
        console.warn('[HistoryApiClientService] No HTTP service URL available');
        return null;
      }

      const historyUrl = `${this.kipPluginServiceUrl}history/values`;
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
      console.log(`[HistoryApiClientService] GET ${fullUrl}`);

      const response = await firstValueFrom(
        this.http.get<IHistoryValuesResponse>(historyUrl, { params: httpParams })
      );

      console.log(`[HistoryApiClientService] History fetch successful, received ${response.data?.length ?? 0} data points`);
      return response;
    } catch (error) {
      console.error('[HistoryApiClientService] History API request failed:', error);
      return null;
    }
  }
}
