import { fakeAsync, TestBed, tick } from '@angular/core/testing';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Dashboard, DashboardService } from './dashboard.service';
import { HistorySeriesReconcileService } from './history-series-reconcile.service';
import { IKipSeriesDefinition, KipSeriesService } from './kip-series.service';
import { IEndpointStatus, SignalKConnectionService } from './signalk-connection.service';
import { SignalkPluginConfigService } from './signalk-plugin-config.service';

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

describe('HistorySeriesReconcileService', () => {
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
        HistorySeriesReconcileService,
        { provide: DashboardService, useClass: DashboardServiceStub },
        { provide: SignalKConnectionService, useClass: SignalKConnectionServiceStub },
        { provide: SignalkPluginConfigService, useValue: pluginConfigMock },
        {
          provide: KipSeriesService,
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
          {
            id: 'widget-1',
            selector: 'widget-host2',
            input: {
              widgetProperties: {
                uuid: 'widget-1',
                type: 'widget-data-chart',
                config: {
                  datachartPath: 'navigation.speedThroughWater',
                  timeScale: 'minute',
                  period: 10,
                }
              }
            }
          }
        ]
      }
    ]);

    TestBed.inject(HistorySeriesReconcileService);
    tick(800);

    expect(reconcileSpy).not.toHaveBeenCalled();
  }));

  it('should extract chart series and reconcile once after debounce', fakeAsync(() => {
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
            id: 'widget-data-1',
            selector: 'widget-host2',
            input: {
              widgetProperties: {
                uuid: 'widget-data-1',
                type: 'widget-data-chart',
                config: {
                  datachartPath: 'navigation.speedThroughWater',
                  datachartSource: 'default',
                  timeScale: 'minute',
                  period: 10,
                }
              }
            }
          },
          {
            id: 'widget-wind-1',
            selector: 'widget-host2',
            input: {
              widgetProperties: {
                uuid: 'widget-wind-1',
                type: 'widget-windtrends-chart',
                config: {
                  timeScale: 'Last 30 Minutes'
                }
              }
            }
          }
        ]
      }
    ]);

    TestBed.inject(HistorySeriesReconcileService);
    tick(800);

    expect(reconcileSpy).toHaveBeenCalledTimes(1);

    const submitted = reconcileSpy.calls.mostRecent().args[0];
    expect(submitted).toEqual([
      {
        seriesId: 'widget-data-1:datachart',
        datasetUuid: 'widget-data-1',
        ownerWidgetUuid: 'widget-data-1',
        ownerWidgetSelector: 'widget-data-chart',
        path: 'navigation.speedThroughWater',
        context: null,
        source: 'default',
        timeScale: 'minute',
        period: 10,
        retentionDurationMs: null,
        sampleTime: null,
        enabled: true,
      },
      {
        seriesId: 'widget-wind-1:wind-direction',
        datasetUuid: 'widget-wind-1-twd',
        ownerWidgetUuid: 'widget-wind-1',
        ownerWidgetSelector: 'widget-windtrends-chart',
        path: 'self.environment.wind.directionTrue',
        context: null,
        source: 'default',
        timeScale: 'Last 30 Minutes',
        period: 30,
        retentionDurationMs: null,
        sampleTime: null,
        enabled: true,
      },
      {
        seriesId: 'widget-wind-1:wind-speed',
        datasetUuid: 'widget-wind-1-tws',
        ownerWidgetUuid: 'widget-wind-1',
        ownerWidgetSelector: 'widget-windtrends-chart',
        path: 'self.environment.wind.speedTrue',
        context: null,
        source: 'default',
        timeScale: 'Last 30 Minutes',
        period: 30,
        retentionDurationMs: null,
        sampleTime: null,
        enabled: true,
      }
    ]);
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
          createDataChartNode('widget-data-1', 'navigation.speedThroughWater')
        ]
      }
    ]);

    TestBed.inject(HistorySeriesReconcileService);
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
          {
            id: 'widget-data-1',
            selector: 'widget-host2',
            input: {
              widgetProperties: {
                uuid: 'widget-data-1',
                type: 'widget-data-chart',
                config: {
                  datachartPath: 'navigation.speedThroughWater',
                  datachartSource: 'default',
                  timeScale: 'minute',
                  period: 10,
                }
              }
            }
          }
        ]
      }
    ]);
    TestBed.inject(HistorySeriesReconcileService);
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
              period: 20
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
    expect(submitted[0].period).toBe(20);
  }));

  it('converges series set across add/edit/delete/copy/paste/duplicate in mixed dashboards', fakeAsync(() => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    TestBed.inject(HistorySeriesReconcileService);

    const baselineDashboards: Dashboard[] = [
      {
        id: 'dash-1',
        name: 'Dash 1',
        icon: 'dashboard-dashboard',
        configuration: [
          createDataChartNode('dc-1', 'navigation.speedThroughWater', 10),
          createWindTrendsNode('wt-1'),
          createNonHistoryNode('nh-1')
        ]
      },
      {
        id: 'dash-2',
        name: 'Dash 2',
        icon: 'dashboard-dashboard',
        configuration: [
          createDataChartNode('dc-2', 'navigation.speedOverGround', 5)
        ]
      }
    ];

    // Initial reconcile
    dashboardStub.dashboards.set(baselineDashboards);
    tick(800);
    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    expect(seriesIds(reconcileSpy.calls.mostRecent().args[0])).toEqual([
      'dc-1:datachart',
      'dc-2:datachart',
      'wt-1:wind-direction',
      'wt-1:wind-speed'
    ]);
    reconcileSpy.calls.reset();

    // Add (new windtrends widget)
    dashboardStub.dashboards.set([
      baselineDashboards[0],
      {
        ...baselineDashboards[1],
        configuration: [
          ...(baselineDashboards[1].configuration ?? []),
          createWindTrendsNode('wt-2')
        ]
      }
    ]);
    tick(800);
    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    expect(seriesIds(reconcileSpy.calls.mostRecent().args[0])).toEqual([
      'dc-1:datachart',
      'dc-2:datachart',
      'wt-1:wind-direction',
      'wt-1:wind-speed',
      'wt-2:wind-direction',
      'wt-2:wind-speed'
    ]);
    reconcileSpy.calls.reset();

    // Edit (data chart period/path)
    dashboardStub.dashboards.set([
      {
        ...baselineDashboards[0],
        configuration: [
          createDataChartNode('dc-1', 'navigation.courseOverGroundTrue', 20),
          createWindTrendsNode('wt-1'),
          createNonHistoryNode('nh-1')
        ]
      },
      {
        ...baselineDashboards[1],
        configuration: [
          createDataChartNode('dc-2', 'navigation.speedOverGround', 5),
          createWindTrendsNode('wt-2')
        ]
      }
    ]);
    tick(800);
    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    const editedSeries = reconcileSpy.calls.mostRecent().args[0];
    const dc1 = editedSeries.find(item => item.seriesId === 'dc-1:datachart');
    expect(dc1?.path).toBe('navigation.courseOverGroundTrue');
    expect(dc1?.period).toBe(20);
    reconcileSpy.calls.reset();

    // Copy/Paste (new data chart UUID)
    dashboardStub.dashboards.set([
      {
        ...baselineDashboards[0],
        configuration: [
          createDataChartNode('dc-1', 'navigation.courseOverGroundTrue', 20),
          createWindTrendsNode('wt-1'),
          createNonHistoryNode('nh-1')
        ]
      },
      {
        ...baselineDashboards[1],
        configuration: [
          createDataChartNode('dc-2', 'navigation.speedOverGround', 5),
          createWindTrendsNode('wt-2'),
          createDataChartNode('dc-1-copy', 'navigation.courseOverGroundTrue', 20)
        ]
      }
    ]);
    tick(800);
    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    expect(seriesIds(reconcileSpy.calls.mostRecent().args[0])).toContain('dc-1-copy:datachart');
    reconcileSpy.calls.reset();

    // Duplicate (new windtrends UUID)
    dashboardStub.dashboards.set([
      {
        ...baselineDashboards[0],
        configuration: [
          createDataChartNode('dc-1', 'navigation.courseOverGroundTrue', 20),
          createWindTrendsNode('wt-1'),
          createWindTrendsNode('wt-1-dup'),
          createNonHistoryNode('nh-1')
        ]
      },
      {
        ...baselineDashboards[1],
        configuration: [
          createDataChartNode('dc-2', 'navigation.speedOverGround', 5),
          createWindTrendsNode('wt-2'),
          createDataChartNode('dc-1-copy', 'navigation.courseOverGroundTrue', 20)
        ]
      }
    ]);
    tick(800);
    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    expect(seriesIds(reconcileSpy.calls.mostRecent().args[0])).toContain('wt-1-dup:wind-direction');
    expect(seriesIds(reconcileSpy.calls.mostRecent().args[0])).toContain('wt-1-dup:wind-speed');
    reconcileSpy.calls.reset();

    // Delete (remove one data chart)
    dashboardStub.dashboards.set([
      {
        ...baselineDashboards[0],
        configuration: [
          createDataChartNode('dc-1', 'navigation.courseOverGroundTrue', 20),
          createWindTrendsNode('wt-1'),
          createWindTrendsNode('wt-1-dup'),
          createNonHistoryNode('nh-1')
        ]
      },
      {
        ...baselineDashboards[1],
        configuration: [
          createWindTrendsNode('wt-2'),
          createDataChartNode('dc-1-copy', 'navigation.courseOverGroundTrue', 20)
        ]
      }
    ]);
    tick(800);
    expect(reconcileSpy).toHaveBeenCalledTimes(1);
    expect(seriesIds(reconcileSpy.calls.mostRecent().args[0])).not.toContain('dc-2:datachart');
  }));
});
