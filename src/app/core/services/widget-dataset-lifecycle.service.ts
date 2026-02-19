import { Injectable, inject } from '@angular/core';
import { DatasetService, IDatasetServiceDatasetConfig, TimeScaleFormat } from './data-set.service';
import { IWidgetSvcConfig } from '../interfaces/widgets-interface';

@Injectable({
  providedIn: 'root'
})
export class WidgetDatasetLifecycleService {
  private readonly dataset = inject(DatasetService);

  /**
   * Ensures Data Chart dataset configuration exists and stays in sync with widget settings.
   *
   * @param {string} widgetUuid Widget UUID used as dataset UUID.
   * @param {IWidgetSvcConfig} cfg Data Chart widget configuration.
   * @param {string | undefined} signature Stable signature used as dataset label.
   * @returns {void}
   *
   * @example
   * lifecycle.syncDataChartDataset('widget-1', cfg, 'path|unit|source|minute|10');
   */
  public syncDataChartDataset(widgetUuid: string, cfg: IWidgetSvcConfig, signature: string | undefined): void {
    const path = typeof cfg?.datachartPath === 'string' ? cfg.datachartPath.trim() : '';
    if (!path) {
      return;
    }

    const source = typeof cfg?.datachartSource === 'string' && cfg.datachartSource.trim().length > 0
      ? cfg.datachartSource.trim()
      : 'default';
    const timeScale = cfg?.timeScale as TimeScaleFormat;
    const period = Number(cfg?.period ?? 0);
    const label = signature ?? '';

    this.upsertDataset({
      uuid: widgetUuid,
      path,
      source,
      timeScale,
      period,
      label,
      serialize: true,
      editable: false
    });
  }

  /**
   * Ensures Numeric mini-chart backing dataset exists and matches path/source.
   *
   * @param {string} widgetUuid Widget UUID used as dataset UUID.
   * @param {string} path Signal K path.
   * @param {string} source Signal K source.
   * @returns {void}
   *
   * @example
   * lifecycle.syncNumericMiniChartDataset('widget-2', 'navigation.speedOverGround', 'default');
   */
  public syncNumericMiniChartDataset(widgetUuid: string, path: string, source: string): void {
    const normalizedPath = typeof path === 'string' ? path.trim() : '';
    if (!normalizedPath) {
      return;
    }

    const normalizedSource = typeof source === 'string' && source.trim().length > 0
      ? source.trim()
      : 'default';

    this.upsertDataset({
      uuid: widgetUuid,
      path: normalizedPath,
      source: normalizedSource,
      timeScale: 'minute',
      period: 0.2,
      label: `simple-chart-${widgetUuid}`,
      serialize: false,
      editable: false
    });
  }

  /**
   * Ensures Windtrends direction and speed datasets exist and match current timescale.
   *
   * @param {string} widgetUuid Widget UUID used to derive dataset UUIDs.
   * @param {TimeScaleFormat} timeScale Window timescale for both wind datasets.
   * @returns {void}
   *
   * @example
   * lifecycle.syncWindTrendsDatasets('widget-wind-1', 'Last 30 Minutes');
   */
  public syncWindTrendsDatasets(widgetUuid: string, timeScale: TimeScaleFormat): void {
    if (!timeScale || String(timeScale).trim().length === 0) {
      return;
    }

    this.upsertDataset({
      uuid: `${widgetUuid}-twd`,
      path: 'self.environment.wind.directionTrue',
      source: 'default',
      timeScale,
      period: 30,
      label: `windtrends-${widgetUuid}`,
      serialize: true,
      editable: false
    });

    this.upsertDataset({
      uuid: `${widgetUuid}-tws`,
      path: 'self.environment.wind.speedTrue',
      source: 'default',
      timeScale,
      period: 30,
      label: `speedtrends-${widgetUuid}`,
      serialize: true,
      editable: false
    });
  }

  /**
   * Removes a dataset when it exists.
   *
   * @param {string} datasetUuid Dataset UUID.
   * @param {boolean} [serialize=false] Persist removal to settings when true.
   * @returns {void}
   *
   * @example
   * lifecycle.removeDatasetIfExists('widget-2', false);
   */
  public removeDatasetIfExists(datasetUuid: string, serialize = false): void {
    this.dataset.removeIfExists(datasetUuid, serialize);
  }

  /**
   * Removes all datasets owned by a widget UUID.
   *
   * Ownership rules:
   * - direct dataset UUID match (`ownerWidgetUuid`)
   * - composite child dataset UUID prefix (`ownerWidgetUuid-*`)
   *
   * @param {string} ownerWidgetUuid Widget UUID owning one or more datasets.
   * @param {boolean} [serialize=true] Persist removals to settings when true.
   * @returns {void}
   *
   * @example
   * lifecycle.removeOwnedDatasets('widget-abc', true);
   */
  public removeOwnedDatasets(ownerWidgetUuid: string, serialize = true): void {
    const normalizedOwner = typeof ownerWidgetUuid === 'string' ? ownerWidgetUuid.trim() : '';
    if (!normalizedOwner) {
      return;
    }

    const allDatasets = this.dataset.list();
    const toRemove = allDatasets.filter(datasetConfig =>
      datasetConfig.uuid === normalizedOwner
      || datasetConfig.uuid?.startsWith(`${normalizedOwner}-`)
    );

    toRemove.forEach(datasetConfig => {
      this.dataset.removeIfExists(datasetConfig.uuid, serialize);
    });
  }

  private upsertDataset(input: {
    uuid: string;
    path: string;
    source: string;
    timeScale: TimeScaleFormat;
    period: number;
    label: string;
    serialize: boolean;
    editable: boolean;
  }): void {
    const existing = this.dataset.getDatasetConfig(input.uuid);
    if (!existing) {
      this.dataset.create(
        input.path,
        input.source,
        input.timeScale,
        input.period,
        input.label,
        input.serialize,
        input.editable,
        input.uuid
      );
      return;
    }

    const needsUpdate =
      existing.path !== input.path
      || existing.pathSource !== input.source
      || existing.timeScaleFormat !== input.timeScale
      || existing.period !== input.period
      || existing.label !== input.label;

    if (!needsUpdate) {
      return;
    }

    const nextConfig: IDatasetServiceDatasetConfig = {
      ...existing,
      path: input.path,
      pathSource: input.source,
      timeScaleFormat: input.timeScale,
      period: input.period,
      label: input.label,
      editable: input.editable
    };

    this.dataset.edit(nextConfig, input.serialize);
  }
}