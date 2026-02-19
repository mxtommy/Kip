import { DestroyRef, effect, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NgGridStackWidget } from 'gridstack/dist/angular';
import { Dashboard, DashboardService } from './dashboard.service';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { IKipSeriesDefinition, KipSeriesService } from './kip-series.service';
import { SignalKConnectionService } from './signalk-connection.service';

interface IGridWidgetNode extends NgGridStackWidget {
  input?: {
    widgetProperties?: IWidget;
  };
  subGridOpts?: {
    children?: IGridWidgetNode[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class HistorySeriesReconcileService {
  private readonly dashboard = inject(DashboardService);
  private readonly kipSeries = inject(KipSeriesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly connection = inject(SignalKConnectionService);

  private readonly serverEndpoint = toSignal(this.connection.serverServiceEndpoint$, {
    initialValue: null
  });

  private readonly RECONCILE_DEBOUNCE_MS = 750;
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

      const desiredSeries = this.extractSeriesFromDashboards(dashboards);
      this.scheduleReconcile(desiredSeries);
    });

    this.destroyRef.onDestroy(() => {
      if (this.reconcileTimer !== null) {
        clearTimeout(this.reconcileTimer);
        this.reconcileTimer = null;
      }
    });
  }

  private scheduleReconcile(seriesDefinitions: IKipSeriesDefinition[]): void {
    const signature = JSON.stringify(seriesDefinitions);
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

    await this.kipSeries.reconcileSeries(nextSeries);
    this.lastSubmittedSignature = nextSignature;
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

  private collectSeriesFromNodes(nodes: IGridWidgetNode[], sink: IKipSeriesDefinition[]): void {
    nodes.forEach(node => {
      const widget = node?.input?.widgetProperties;
      const widgetType = widget?.type;
      const widgetUuid = widget?.uuid;

      if (widgetType && widgetUuid) {
        if (widgetType === 'widget-data-chart') {
          const series = this.mapDataChartWidget(widgetUuid, widgetType, widget?.config);
          if (series) {
            sink.push(series);
          }
        }

        if (widgetType === 'widget-windtrends-chart') {
          sink.push(...this.mapWindTrendsWidget(widgetUuid, widgetType, widget?.config));
        }
      }

      const children = this.coerceNodeList(node?.subGridOpts?.children);
      if (children.length > 0) {
        this.collectSeriesFromNodes(children, sink);
      }
    });
  }

  private mapDataChartWidget(widgetUuid: string, widgetType: string, cfg: IWidgetSvcConfig | undefined): IKipSeriesDefinition | null {
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

  private mapWindTrendsWidget(widgetUuid: string, widgetType: string, cfg: IWidgetSvcConfig | undefined): IKipSeriesDefinition[] {
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
}
