import { DestroyRef, inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SignalKConnectionService } from './signalk-connection.service';
import { SignalkPluginConfigService } from './signalk-plugin-config.service';

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

@Injectable({
  providedIn: 'root'
})
export class KipSeriesService {
  private readonly http = inject(HttpClient);
  private readonly connection = inject(SignalKConnectionService);
  private readonly pluginConfig = inject(SignalkPluginConfigService);
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
   * const result = await kipSeriesService.reconcileSeries([
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
   * @memberof KipSeriesService
   */
  public async reconcileSeries(seriesDefinitions: IKipSeriesDefinition[]): Promise<IKipSeriesReconcileResult | null> {
    try {
      const modeConfig = await this.pluginConfig.getKipRuntimeModeConfigCached('kip');
      if (!modeConfig.historySeriesServiceEnabled) {
        console.warn('[KipSeriesService] Reconcile skipped because history-series service is disabled in KIP plugin settings');
        return null;
      }

      if (!this.kipPluginServiceUrl) {
        console.warn('[KipSeriesService] No KIP plugin endpoint available for series reconcile');
        return null;
      }

      const reconcileUrl = `${this.kipPluginServiceUrl}series/reconcile`;
      console.log(`[KipSeriesService] POST ${reconcileUrl} (${seriesDefinitions.length} series)`);

      const response = await firstValueFrom(
        this.http.post<IKipSeriesReconcileResult>(reconcileUrl, seriesDefinitions)
      );

      console.log(
        `[KipSeriesService] Series reconcile successful (created=${response.created}, updated=${response.updated}, deleted=${response.deleted}, total=${response.total})`
      );
      return response;
    } catch (error) {
      console.error('[KipSeriesService] Series reconcile request failed:', error);
      return null;
    }
  }
}
