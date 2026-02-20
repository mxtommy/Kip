import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Dashboard, DashboardService } from './dashboard.service';
import { DashboardHistorySeriesSyncService } from './dashboard-history-series-sync.service';
import { IKipSeriesDefinition, KipSeriesApiClientService } from './kip-series-api-client.service';
import { IEndpointStatus, SignalKConnectionService } from './signalk-connection.service';
import { PluginConfigClientService } from './plugin-config-client.service';

class DashboardServiceStub {
  public dashboards = signal<Dashboard[]>([]);
}

class SignalKConnectionServiceStub {
  public serverServiceEndpoint$ = new BehaviorSubject<IEndpointStatus>({
    operation: 0,
    message: 'Not connected',
    serverDescription: null,
    httpServiceUrl: null,
    WsServiceUrl: null
  });
}

type TWidgetNode = NonNullable<Dashboard['configuration']>[number];

function createAutomaticNode(uuid: string, selector: string, options?: {
  supportAutomaticHistoricalSeries?: boolean;
  numericPath?: string | null;
  textPath?: string | null;
  source?: string | null;
  sampleTime?: number;
  period?: number;
  timeScale?: string;
}): TWidgetNode {
  const numericPath = options?.numericPath ?? 'navigation.speedThroughWater';
  const textPath = options?.textPath ?? 'navigation.state';

  return {
    id: uuid,
    selector: 'widget-host2',
    input: {
      widgetProperties: {
        uuid,
        type: selector,
        config: {
          supportAutomaticHistoricalSeries: options?.supportAutomaticHistoricalSeries,
          timeScale: options?.timeScale ?? 'minute',
          period: options?.period ?? 10,
          paths: {
            numericPath: {
              description: 'Numeric Data',
              path: numericPath,
              source: options?.source ?? null,
              pathType: 'number',
              isPathConfigurable: true,
              sampleTime: options?.sampleTime ?? 1000
            },
            textPath: {
              description: 'Text Data',
              path: textPath,
              source: null,
              pathType: 'string',
              isPathConfigurable: true,
              sampleTime: 1000
            }
          }
        }
      }
    }
  } as TWidgetNode;
}

function createArrayPathsNode(uuid: string, selector: string, supportAutomaticHistoricalSeries?: boolean): TWidgetNode {
  return {
    id: uuid,
    selector: 'widget-host2',
    input: {
      widgetProperties: {
        uuid,
        type: selector,
        config: {
          supportAutomaticHistoricalSeries,
          timeScale: 'hour',
          period: 1,
          paths: [
            {
              description: 'Numeric Data',
              path: 'navigation.headingTrue',
              source: null,
              pathType: 'number',
              isPathConfigurable: true,
              sampleTime: 500
            },
            {
              description: 'Disabled Numeric Data',
              path: null,
              source: null,
              pathType: 'number',
              isPathConfigurable: true,
              sampleTime: 1000
            }
          ]
        }
      }
    }
  } as TWidgetNode;
}

function createDataChartNode(uuid: string, path: string, period = 10): TWidgetNode {
  return {
    id: uuid,
    selector: 'widget-host2',
    input: {
      widgetProperties: {
        uuid,
        type: 'widget-data-chart',
        config: {
          datachartPath: path,
          datachartSource: 'default',
          timeScale: 'minute',
          period
        }
      }
    }
  } as TWidgetNode;
}

function createWindTrendsNode(uuid: string): TWidgetNode {
  return {
    id: uuid,
    selector: 'widget-host2',
    input: {
      widgetProperties: {
        uuid,
        type: 'widget-windtrends-chart',
        config: {
          timeScale: 'Last 30 Minutes'
        }
      }
    }
  } as TWidgetNode;
}

function createNonHistoryNode(uuid: string): TWidgetNode {
  return {
    id: uuid,
    selector: 'widget-host2',
    input: {
      widgetProperties: {
        uuid,
        type: 'widget-gauge-ng-rpm',
        config: {}
      }
    }
  } as TWidgetNode;
}

function seriesIds(series: IKipSeriesDefinition[]): string[] {
  return series.map(item => item.seriesId).sort();
}

describe('DashboardHistorySeriesSyncService', () => {
  let dashboardStub: DashboardServiceStub;
  let connectionStub: SignalKConnectionServiceStub;
  let historySeriesServiceEnabled = true;
  let pluginConfigMock: {
    getKipRuntimeModeConfigCached: jasmine.Spy;
  };
  let reconcileSpy: jasmine.Spy<(series: IKipSeriesDefinition[]) => Promise<{ created: number; updated: number; deleted: number; total: number }>>;

  beforeEach(() => {
    historySeriesServiceEnabled = true;
    pluginConfigMock = {
      getKipRuntimeModeConfigCached: jasmine.createSpy('getKipRuntimeModeConfigCached').and.callFake(async () => ({
        historySeriesServiceEnabled,
        registerAsHistoryApiProvider: true
      }))
    };

    reconcileSpy = jasmine.createSpy('reconcileSeries').and.resolveTo({
      created: 0,
      updated: 0,
      deleted: 0,
      total: 0,
    });

    TestBed.configureTestingModule({
      providers: [
        DashboardHistorySeriesSyncService,
        { provide: DashboardService, useClass: DashboardServiceStub },
        { provide: SignalKConnectionService, useClass: SignalKConnectionServiceStub },
        { provide: PluginConfigClientService, useValue: pluginConfigMock },
        {
          provide: KipSeriesApiClientService,
          useValue: {
            reconcileSeries: reconcileSpy
          }
        }
      ]
    });

    dashboardStub = TestBed.inject(DashboardService) as unknown as DashboardServiceStub;
    connectionStub = TestBed.inject(SignalKConnectionService) as unknown as SignalKConnectionServiceStub;
  });

  it('should not reconcile when HTTP endpoint is unavailable', fakeAsync(() => {
    dashboardStub.dashboards.set([
      {
        id: 'dash-1',
        name: 'Dashboard 1',
        icon: 'dashboard-dashboard',
        configuration: [
          createAutomaticNode('widget-1', 'widget-numeric')
        ]
      }
    ]);

    TestBed.inject(DashboardHistorySeriesSyncService);
    tick(800);

    expect(reconcileSpy).not.toHaveBeenCalled();
  }));

  it('should extract numeric path series and reconcile once after debounce', fakeAsync(() => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    dashboardStub.dashboards.set([
      {
        id: 'dash-1',
        name: 'Dashboard 1',
        icon: 'dashboard-dashboard',
        configuration: [
          createAutomaticNode('widget-numeric-1', 'widget-numeric', {
            numericPath: 'navigation.speedThroughWater',
            source: 'default',
            timeScale: 'minute',
            period: 10,
            sampleTime: 1200
          })
        ]
      }
    ]);

    TestBed.inject(DashboardHistorySeriesSyncService);
    tick(800);

    expect(reconcileSpy).toHaveBeenCalledTimes(1);

    const submitted = reconcileSpy.calls.mostRecent().args[0];
    expect(submitted.length).toBe(1);
    expect(submitted[0]).toEqual({
      seriesId: 'widget-numeric-1:auto:navigation-speedthroughwater:default',
      datasetUuid: 'widget-numeric-1:navigation-speedthroughwater:default',
      ownerWidgetUuid: 'widget-numeric-1',
      ownerWidgetSelector: 'widget-numeric',
      path: 'navigation.speedThroughWater',
      context: null,
      source: 'default',
      timeScale: 'minute',
      period: 10,
      retentionDurationMs: 86400000,
      sampleTime: 1200,
      enabled: true,
    });
  }));

  it('should preserve dedicated data chart and wind trends sync mappings', fakeAsync(() => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    dashboardStub.dashboards.set([
      {
        id: 'dash-1',
        name: 'Dashboard 1',
        icon: 'dashboard-dashboard',
        configuration: [
          createDataChartNode('widget-data-1', 'navigation.speedThroughWater', 10),
          createWindTrendsNode('widget-wind-1'),
          createAutomaticNode('widget-numeric-1', 'widget-numeric', {
            numericPath: 'navigation.headingTrue',
            source: null,
            period: 5,
            sampleTime: 500
          })
        ]
      }
    ]);

    TestBed.inject(DashboardHistorySeriesSyncService);
    tick(800);

    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    const submitted = reconcileSpy.calls.mostRecent().args[0];
    expect(seriesIds(submitted)).toEqual([
      'widget-data-1:datachart',
      'widget-numeric-1:auto:navigation-headingtrue:default',
      'widget-wind-1:wind-direction',
      'widget-wind-1:wind-speed'
    ]);

    const dataChart = submitted.find(series => series.seriesId === 'widget-data-1:datachart');
    expect(dataChart?.path).toBe('navigation.speedThroughWater');

    const windDirection = submitted.find(series => series.seriesId === 'widget-wind-1:wind-direction');
    expect(windDirection?.path).toBe('self.environment.wind.directionTrue');

    const windSpeed = submitted.find(series => series.seriesId === 'widget-wind-1:wind-speed');
    expect(windSpeed?.path).toBe('self.environment.wind.speedTrue');
  }));

  it('should skip reconcile when history series service mode is disabled', fakeAsync(() => {
    historySeriesServiceEnabled = false;

    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    dashboardStub.dashboards.set([
      {
        id: 'dash-1',
        name: 'Dashboard 1',
        icon: 'dashboard-dashboard',
        configuration: [
          createAutomaticNode('widget-data-1', 'widget-numeric')
        ]
      }
    ]);

    TestBed.inject(DashboardHistorySeriesSyncService);
    tick(800);

    expect(reconcileSpy).not.toHaveBeenCalled();
  }));

  it('should reconcile when dashboards signal emits updated widget configuration', fakeAsync(() => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    dashboardStub.dashboards.set([
      {
        id: 'dash-1',
        name: 'Dashboard 1',
        icon: 'dashboard-dashboard',
        configuration: [
          createAutomaticNode('widget-data-1', 'widget-numeric', {
            source: 'default',
            period: 10
          })
        ]
      }
    ]);
    TestBed.inject(DashboardHistorySeriesSyncService);
    tick(800);

    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    reconcileSpy.calls.reset();

    dashboardStub.dashboards.update(dashboards => dashboards.map((dashboard, index) => {
      if (index !== 0) {
        return dashboard;
      }

      const nextConfiguration = [...(dashboard.configuration ?? [])];
      const firstWidget = nextConfiguration[0] as unknown as {
        input?: {
          widgetProperties?: {
            config?: Record<string, unknown>
          }
        }
      };

      const nextWidget = {
        ...(nextConfiguration[0] as object),
        input: {
          ...(firstWidget.input ?? {}),
          widgetProperties: {
            ...(firstWidget.input?.widgetProperties ?? {}),
            config: {
              ...(firstWidget.input?.widgetProperties?.config ?? {}),
              paths: {
                ...((firstWidget.input?.widgetProperties?.config?.paths as Record<string, unknown>) ?? {}),
                numericPath: {
                  description: 'Numeric Data',
                  path: 'navigation.speedOverGround',
                  source: 'default',
                  pathType: 'number',
                  isPathConfigurable: true,
                  sampleTime: 1000
                }
              }
            }
          }
        }
      };

      nextConfiguration[0] = nextWidget as never;
      return {
        ...dashboard,
        configuration: nextConfiguration
      };
    }));
    tick(800);

    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    const submitted = reconcileSpy.calls.mostRecent().args[0];
    expect(submitted[0].path).toBe('navigation.speedOverGround');
  }));

  it('should skip widgets explicitly opted out and include array/object numeric paths', fakeAsync(() => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    TestBed.inject(DashboardHistorySeriesSyncService);

    dashboardStub.dashboards.set([
      {
        id: 'dash-1',
        name: 'Dash 1',
        icon: 'dashboard-dashboard',
        configuration: [
          createAutomaticNode('auto-1', 'widget-numeric', {
            supportAutomaticHistoricalSeries: true,
            numericPath: 'navigation.speedThroughWater',
            source: null
          }),
          createArrayPathsNode('array-1', 'widget-gauge-ng-radial', true),
          createAutomaticNode('auto-optout', 'widget-text', {
            supportAutomaticHistoricalSeries: false,
            numericPath: 'navigation.speedOverGround'
          }),
          createNonHistoryNode('nh-1')
        ]
      }
    ]);
    tick(800);

    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    const submitted = reconcileSpy.calls.mostRecent().args[0];
    expect(seriesIds(submitted)).toEqual([
      'array-1:auto:navigation-headingtrue:default',
      'auto-1:auto:navigation-speedthroughwater:default'
    ]);
    expect(submitted.every(item => item.retentionDurationMs === 86400000)).toBeTrue();
  }));

  it('should deduplicate duplicate numeric paths with same source per widget', fakeAsync(() => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    dashboardStub.dashboards.set([
      {
        id: 'dash-1',
        name: 'Dashboard 1',
        icon: 'dashboard-dashboard',
        configuration: [
          {
            id: 'widget-dup',
            selector: 'widget-host2',
            input: {
              widgetProperties: {
                uuid: 'widget-dup',
                type: 'widget-numeric',
                config: {
                  supportAutomaticHistoricalSeries: true,
                  paths: {
                    numericPathA: {
                      description: 'A',
                      path: 'navigation.speedOverGround',
                      source: 'default',
                      pathType: 'number',
                      isPathConfigurable: true,
                      sampleTime: 500
                    },
                    numericPathB: {
                      description: 'B',
                      path: 'navigation.speedOverGround',
                      source: 'default',
                      pathType: 'number',
                      isPathConfigurable: true,
                      sampleTime: 1000
                    }
                  }
                }
              }
            }
          }
        ]
      }
    ]);

    TestBed.inject(DashboardHistorySeriesSyncService);
    tick(800);

    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    expect(reconcileSpy.calls.mostRecent().args[0].length).toBe(1);
  }));
});
