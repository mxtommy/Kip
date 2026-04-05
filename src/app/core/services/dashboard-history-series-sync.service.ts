import { DestroyRef, effect, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgGridStackWidget } from 'gridstack/dist/angular';
import { Dashboard, DashboardService } from './dashboard.service';
import { IWidget, IWidgetPath, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { IKipSeriesDefinition, KipSeriesApiClientService } from './kip-series-api-client.service';
import { IElectricalTrackedDeviceRef, IKipConcreteSeriesDefinition, IKipTemplateSeriesDefinition } from '../contracts/kip-series-contract';
import { SignalKConnectionService } from './signalk-connection.service';
import { PluginConfigClientService } from './plugin-config-client.service';
import { WidgetService } from './widget.service';
import {
  ElectricalFamilyKey,
  getElectricalWidgetFamilyDescriptor,
} from '../contracts/electrical-widget-family.contract';

interface IGridWidgetNode extends NgGridStackWidget {
  input?: {
    widgetProperties?: IWidget;
  };
  subGridOpts?: {
    children?: IGridWidgetNode[];
  };
}

interface IBmsBankLike {
  memberIds?: unknown;
  batteryIds?: unknown;
}

interface IFamilyConfigLike {
  trackedDevices?: unknown;
  groups?: unknown;
  banks?: unknown;
}

type TFamilyConfigProperty = 'bms' | 'solarCharger' | 'charger' | 'inverter' | 'alternator' | 'ac';

const FAMILY_CONFIG_PROPERTY: Record<ElectricalFamilyKey, TFamilyConfigProperty> = {
  batteries: 'bms',
  solar: 'solarCharger',
  chargers: 'charger',
  inverters: 'inverter',
  alternators: 'alternator',
  ac: 'ac',
};

@Injectable({
  providedIn: 'root'
})
export class DashboardHistorySeriesSyncService {
  private readonly dashboard = inject(DashboardService);
  private readonly kipSeries = inject(KipSeriesApiClientService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly connection = inject(SignalKConnectionService);
  private readonly pluginConfig = inject(PluginConfigClientService);
  private readonly widgetService = inject(WidgetService);

  private readonly serverEndpoint = toSignal(this.connection.serverServiceEndpoint$, {
    initialValue: null
  });

  private readonly RECONCILE_DEBOUNCE_MS = 750;
  private readonly AUTO_RETENTION_MS = 24 * 60 * 60 * 1000;
  private reconcileTimer: number | null = null;
  private lastSubmittedSignature: string | null = null;
  private pendingSignature: string | null = null;
  private pendingSeries: IKipSeriesDefinition[] = [];

  constructor() {
    effect(() => {
      const endpoint = this.serverEndpoint();
      const dashboards = this.dashboard.dashboards();

      if (!endpoint?.httpServiceUrl) {
        return;
      }

      try {
        const desiredSeries = this.extractSeriesFromDashboards(dashboards);
        this.scheduleReconcile(desiredSeries);
      } catch (error) {
        console.error('[DashboardHistorySeriesSyncService] Error extracting series from dashboards:', error);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.reconcileTimer !== null) {
        clearTimeout(this.reconcileTimer);
        this.reconcileTimer = null;
      }
    });
  }

  private scheduleReconcile(seriesDefinitions: IKipSeriesDefinition[]): void {
    const signature = this.getCanonicalSeriesSignature(seriesDefinitions);
    if (signature === this.lastSubmittedSignature) {
      return;
    }

    this.pendingSeries = seriesDefinitions;
    this.pendingSignature = signature;

    if (this.reconcileTimer !== null) {
      clearTimeout(this.reconcileTimer);
    }

    this.reconcileTimer = window.setTimeout(() => {
      void this.flushReconcile();
    }, this.RECONCILE_DEBOUNCE_MS);
  }

  private async flushReconcile(): Promise<void> {
    if (!this.pendingSignature) {
      return;
    }

    const nextSignature = this.pendingSignature;
    const nextSeries = this.pendingSeries;
    this.pendingSignature = null;
    this.reconcileTimer = null;

    const modeConfig = await this.pluginConfig.getKipRuntimeModeConfigCached('kip');
    if (!modeConfig.historySeriesServiceEnabled) {
      console.warn('[DashboardHistorySeriesSyncService] Reconcile skipped because history series service mode is disabled');
      this.lastSubmittedSignature = nextSignature;
      return;
    }

    try {
      await this.kipSeries.reconcileSeries(nextSeries);
      this.lastSubmittedSignature = nextSignature;
    } catch (error) {
      console.error('[DashboardHistorySeriesSyncService] Reconcile failed:', error);
      // Don't update lastSubmittedSignature so next cycle will retry
    }
  }

  private extractSeriesFromDashboards(dashboards: Dashboard[]): IKipSeriesDefinition[] {
    const definitions: IKipSeriesDefinition[] = [];

    dashboards.forEach(dashboard => {
      const topLevelNodes = this.coerceNodeList(dashboard.configuration);
      this.collectSeriesFromNodes(topLevelNodes, definitions);
    });

    return definitions
      .sort((left, right) => left.seriesId.localeCompare(right.seriesId));
  }

  /**
   * Resolves the historical series definitions for a single widget based on current
   * sync rules (dedicated widget mappings + automatic numeric path mapping).
   *
   * @param {IWidget | null | undefined} widget Widget definition to evaluate.
   * @returns {IKipSeriesDefinition[]} Historical series definitions for the widget.
   *
   * @example
   * const series = service.resolveSeriesForWidget(widget);
   */
  public resolveSeriesForWidget(widget: IWidget | null | undefined): IKipSeriesDefinition[] {
    const widgetType = widget?.type;
    const widgetUuid = widget?.uuid;
    const cfg = this.resolveWidgetConfig(widgetType, widget?.config);

    if (!widgetType || !widgetUuid || cfg?.supportAutomaticHistoricalSeries === false) {
      return [];
    }

    if (widgetType === 'widget-data-chart') {
      const series = this.mapDataChartWidget(widgetUuid, widgetType, cfg);
      return series ? [series] : [];
    }

    if (widgetType === 'widget-windtrends-chart') {
      return this.mapWindTrendsWidget(widgetUuid, widgetType, cfg);
    }

    const electricalDescriptor = getElectricalWidgetFamilyDescriptor(widgetType);
    if (electricalDescriptor?.templateExpansionMode) {
      const mappedSeries = this.mapElectricalTemplateWidget(widgetUuid, cfg, electricalDescriptor);
      if (mappedSeries) {
        return [mappedSeries];
      }
    }

    return this.mapAutomaticHistorySeries(widgetUuid, widgetType, cfg);
  }

  private resolveWidgetConfig(widgetType: string | undefined, cfg: IWidgetSvcConfig | undefined): IWidgetSvcConfig | undefined {
    if (!widgetType) {
      return cfg;
    }

    const defaultCfg = this.getDefaultConfigForType(widgetType);
    if (!defaultCfg) {
      return cfg;
    }

    if (!cfg) {
      return defaultCfg;
    }

    return {
      ...defaultCfg,
      ...cfg,
      paths: cfg.paths ?? defaultCfg.paths
    };
  }

  private getDefaultConfigForType(widgetType: string): IWidgetSvcConfig | undefined {
    try {
      const comp = this.widgetService.getComponentType(widgetType) as { DEFAULT_CONFIG?: IWidgetSvcConfig } | undefined;
      return comp?.DEFAULT_CONFIG;
    } catch {
      return undefined;
    }
  }

  private collectSeriesFromNodes(nodes: IGridWidgetNode[], sink: IKipSeriesDefinition[]): void {
    nodes.forEach(node => {
      const widget = node?.input?.widgetProperties;
      sink.push(...this.resolveSeriesForWidget(widget));

      const children = this.coerceNodeList(node?.subGridOpts?.children);
      if (children.length > 0) {
        this.collectSeriesFromNodes(children, sink);
      }
    });
  }

  private mapDataChartWidget(widgetUuid: string, widgetType: string, cfg: IWidgetSvcConfig | undefined): IKipConcreteSeriesDefinition | null {
    const path = this.normalizeString(cfg?.datachartPath);
    if (!path) {
      return null;
    }

    return {
      seriesId: `${widgetUuid}:datachart`,
      datasetUuid: widgetUuid,
      ownerWidgetUuid: widgetUuid,
      ownerWidgetSelector: widgetType,
      path,
      context: null,
      source: this.normalizeString(cfg?.datachartSource),
      timeScale: this.normalizeString(cfg?.timeScale),
      period: this.normalizeNumber(cfg?.period),
      retentionDurationMs: null,
      sampleTime: null,
      enabled: true,
    };
  }

  private mapWindTrendsWidget(widgetUuid: string, widgetType: string, cfg: IWidgetSvcConfig | undefined): IKipConcreteSeriesDefinition[] {
    const shared = {
      ownerWidgetUuid: widgetUuid,
      ownerWidgetSelector: widgetType,
      context: null,
      source: 'default',
      timeScale: this.normalizeString(cfg?.timeScale),
      period: 30,
      retentionDurationMs: null,
      sampleTime: null,
      enabled: true,
    };

    return [
      {
        ...shared,
        seriesId: `${widgetUuid}:wind-direction`,
        datasetUuid: `${widgetUuid}-twd`,
        path: 'self.environment.wind.directionTrue',
      },
      {
        ...shared,
        seriesId: `${widgetUuid}:wind-speed`,
        datasetUuid: `${widgetUuid}-tws`,
        path: 'self.environment.wind.speedTrue',
      }
    ];
  }

  private mapElectricalTemplateWidget(
    widgetUuid: string,
    cfg: IWidgetSvcConfig | undefined,
    descriptor: NonNullable<ReturnType<typeof getElectricalWidgetFamilyDescriptor>>
  ): IKipTemplateSeriesDefinition | null {
    const expansionMode = descriptor.templateExpansionMode;
    if (!expansionMode) {
      return null;
    }

    const allowedIds = this.resolveElectricalAllowedIds(cfg, descriptor.familyKey);
    const trackedDevices = this.resolveTrackedDevicePairs(cfg, descriptor.familyKey);
    const suffix = descriptor.familyKey;
    return {
      seriesId: `${widgetUuid}:${suffix}-template`,
      datasetUuid: `${widgetUuid}:${suffix}-template`,
      ownerWidgetUuid: widgetUuid,
      ownerWidgetSelector: descriptor.selector,
      path: `${descriptor.selfRootPath}.*`,
      expansionMode,
      familyKey: descriptor.familyKey,
      allowedIds: allowedIds.length > 0 ? [...allowedIds] : null,
      trackedDevices: trackedDevices.length > 0 ? [...trackedDevices] : null,
      context: null,
      source: 'default',
      timeScale: this.normalizeString(cfg?.timeScale),
      period: this.normalizeNumber(cfg?.period),
      retentionDurationMs: this.AUTO_RETENTION_MS,
      sampleTime: null,
      enabled: true,
    };
  }

  private resolveElectricalAllowedIds(cfg: IWidgetSvcConfig | undefined, familyKey: ElectricalFamilyKey): string[] {
    const familyCfg = this.resolveFamilyConfig(cfg, familyKey);
    if (!familyCfg) {
      return [];
    }

    const tracked = this.resolveTrackedDevicePairs(cfg, familyKey);

    if (tracked.length === 0) {
      return [];
    }

    const trackedSet = new Set<string>();
    const ids = new Set<string>();
    const trackedIds = tracked.map(device => device.id);
    this.collectStringIdsIntoSet(trackedSet, trackedIds);
    this.collectStringIdsIntoSet(ids, trackedIds);

    const groups = Array.isArray(familyCfg.groups) ? familyCfg.groups as IBmsBankLike[] : [];
    groups.forEach(group => {
      this.collectStringIdsIntoSet(ids, group.memberIds, trackedSet);
      this.collectStringIdsIntoSet(ids, group.batteryIds, trackedSet);
    });

    const banks = Array.isArray(familyCfg.banks) ? familyCfg.banks as IBmsBankLike[] : [];
    banks.forEach(bank => {
      this.collectStringIdsIntoSet(ids, bank.memberIds, trackedSet);
      this.collectStringIdsIntoSet(ids, bank.batteryIds, trackedSet);
    });

    return [...ids].sort((left, right) => left.localeCompare(right));
  }

  private resolveFamilyConfig(cfg: IWidgetSvcConfig | undefined, familyKey: ElectricalFamilyKey): IFamilyConfigLike | null {
    if (!cfg) {
      return null;
    }

    const record = cfg as Record<string, unknown>;
    const familyProperty = record[FAMILY_CONFIG_PROPERTY[familyKey]];

    if (familyProperty && typeof familyProperty === 'object') {
      return familyProperty as IFamilyConfigLike;
    }

    return null;
  }

  private resolveTrackedDevicePairs(cfg: IWidgetSvcConfig | undefined, familyKey: ElectricalFamilyKey): IElectricalTrackedDeviceRef[] {
    const familyCfg = this.resolveFamilyConfig(cfg, familyKey);
    if (!familyCfg || !Array.isArray(familyCfg.trackedDevices)) {
      return [];
    }

    const trackedByKey = new Map<string, IElectricalTrackedDeviceRef>();
    familyCfg.trackedDevices.forEach(item => {
      if (!item || typeof item !== 'object') {
        return;
      }

      const candidate = item as { id?: unknown; source?: unknown };
      const id = this.normalizeString(candidate.id);
      if (!id) {
        return;
      }

      const source = this.normalizeString(candidate.source) ?? 'default';
      trackedByKey.set(`${id}||${source}`, { id, source });
    });

    return [...trackedByKey.values()].sort((left, right) => {
      const idCompare = left.id.localeCompare(right.id);
      return idCompare !== 0 ? idCompare : left.source.localeCompare(right.source);
    });
  }

  private collectStringIdsIntoSet(target: Set<string>, input: unknown, allowedIds?: ReadonlySet<string>): void {
    if (!Array.isArray(input)) {
      return;
    }

    input.forEach(value => {
      if (typeof value !== 'string') {
        return;
      }

      const normalized = this.normalizeTrackedIdentifierToId(value);
      if (normalized.length > 0) {
        if (allowedIds && !allowedIds.has(normalized)) {
          return;
        }
        target.add(normalized);
      }
    });
  }

  private normalizeTrackedIdentifierToId(value: string): string {
    const normalized = value.trim();
    if (normalized.length === 0) {
      return '';
    }

    const separatorIndex = normalized.indexOf('||');
    if (separatorIndex < 0) {
      return normalized;
    }

    return normalized.slice(0, separatorIndex).trim();
  }

  private mapAutomaticHistorySeries(widgetUuid: string, widgetType: string, cfg: IWidgetSvcConfig | undefined): IKipConcreteSeriesDefinition[] {
    const paths = this.extractWidgetPaths(cfg?.paths);
    const seriesBySignature = new Map<string, IKipConcreteSeriesDefinition>();

    paths.forEach(pathCfg => {
      if (pathCfg.pathType !== 'number') {
        return;
      }

      const path = this.normalizeString(pathCfg.path);
      if (!path) {
        return;
      }

      const source = this.normalizeString(pathCfg.source);
      const signature = `${path}|${source ?? 'default'}`;
      if (seriesBySignature.has(signature)) {
        return;
      }

      const pathKey = this.slugify(path);
      const sourceKey = this.slugify(source ?? 'default');
      const sampleTime = this.normalizeNumber(pathCfg.sampleTime);

      seriesBySignature.set(signature, {
        seriesId: `${widgetUuid}:auto:${pathKey}:${sourceKey}`,
        datasetUuid: `${widgetUuid}:${pathKey}:${sourceKey}`,
        ownerWidgetUuid: widgetUuid,
        ownerWidgetSelector: widgetType,
        path,
        context: null,
        source,
        timeScale: this.normalizeString(cfg?.timeScale),
        period: this.normalizeNumber(cfg?.period),
        retentionDurationMs: this.AUTO_RETENTION_MS,
        sampleTime,
        enabled: true,
      });
    });

    return [...seriesBySignature.values()];
  }

  private extractWidgetPaths(paths: IWidgetSvcConfig['paths'] | undefined): IWidgetPath[] {
    if (!paths) {
      return [];
    }

    if (Array.isArray(paths)) {
      return paths;
    }

    return Object.values(paths);
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private normalizeString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeNumber(value: unknown): number | null {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return null;
    }
    return value;
  }

  private coerceNodeList(nodes: unknown): IGridWidgetNode[] {
    if (!Array.isArray(nodes)) {
      return [];
    }

    return nodes as IGridWidgetNode[];
  }

  /**
   * Creates a canonical signature for series definitions using field-by-field comparison.
   * Normalizes arrays (sorting) and null/undefined values to ensure stable comparison
   * independent of insertion order or property mutations.
   *
   * Mirrors the plugin's robust comparator logic for consistency.
   */
  private getCanonicalSeriesSignature(series: IKipSeriesDefinition[]): string {
    const normalized = series.map(s => ({
      seriesId: s.seriesId,
      datasetUuid: s.datasetUuid,
      ownerWidgetUuid: s.ownerWidgetUuid,
      ownerWidgetSelector: s.ownerWidgetSelector,
      path: s.path,
      expansionMode: s.expansionMode ?? null,
      familyKey: s.familyKey ?? null,
      allowedIds: Array.isArray(s.allowedIds) ? [...s.allowedIds].sort() : null,
      trackedDevices: Array.isArray(s.trackedDevices)
        ? [...s.trackedDevices]
          .map(device => ({ id: device.id, source: device.source }))
          .sort((left, right) => {
            const idCompare = left.id.localeCompare(right.id);
            return idCompare !== 0 ? idCompare : left.source.localeCompare(right.source);
          })
        : null,
      context: s.context ?? null,
      source: s.source ?? null,
      timeScale: s.timeScale ?? null,
      period: s.period ?? null,
      retentionDurationMs: s.retentionDurationMs ?? null,
      sampleTime: s.sampleTime ?? null,
      enabled: s.enabled,
    }));
    return JSON.stringify(normalized);
  }
}
