import type { Mock } from "vitest";
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Dashboard, DashboardService } from './dashboard.service';
import { DashboardHistorySeriesSyncService } from './dashboard-history-series-sync.service';
import { IKipSeriesDefinition, KipSeriesApiClientService } from './kip-series-api-client.service';
import { IEndpointStatus, SignalKConnectionService } from './signalk-connection.service';
import { PluginConfigClientService } from './plugin-config-client.service';
import { IWidget } from '../interfaces/widgets-interface';
import { WidgetService } from './widget.service';

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
        getKipRuntimeModeConfigCached: Mock;
    };
    let widgetServiceMock: {
        getComponentType: Mock;
    };
    let reconcileSpy: Mock;

    beforeEach(() => {
        historySeriesServiceEnabled = true;
        pluginConfigMock = {
            getKipRuntimeModeConfigCached: vi.fn().mockImplementation(async () => ({
                historySeriesServiceEnabled,
                registerAsHistoryApiProvider: true
            }))
        };

        reconcileSpy = vi.fn().mockResolvedValue({
            created: 0,
            updated: 0,
            deleted: 0,
            total: 0,
        });

        widgetServiceMock = {
            getComponentType: vi.fn().mockReturnValue(undefined)
        };

        TestBed.configureTestingModule({
            providers: [
                DashboardHistorySeriesSyncService,
                { provide: DashboardService, useClass: DashboardServiceStub },
                { provide: SignalKConnectionService, useClass: SignalKConnectionServiceStub },
                { provide: PluginConfigClientService, useValue: pluginConfigMock },
                { provide: WidgetService, useValue: widgetServiceMock },
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

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should not reconcile when HTTP endpoint is unavailable', async () => {
        vi.useFakeTimers();
        TestBed.inject(DashboardHistorySeriesSyncService);
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

        await vi.advanceTimersByTimeAsync(800);

        expect(reconcileSpy).not.toHaveBeenCalled();
    });

    it('should extract numeric path series and reconcile once after debounce', async () => {
        vi.useFakeTimers();
        TestBed.inject(DashboardHistorySeriesSyncService);
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

        await vi.advanceTimersByTimeAsync(800);

        expect(reconcileSpy).toHaveBeenCalledTimes(1);

        const submitted = vi.mocked(reconcileSpy).mock.lastCall[0];
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
    });

    it('should preserve dedicated data chart and wind trends sync mappings', async () => {
        vi.useFakeTimers();
        TestBed.inject(DashboardHistorySeriesSyncService);
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

        await vi.advanceTimersByTimeAsync(800);

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        const submitted = vi.mocked(reconcileSpy).mock.lastCall[0];
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
    });

    it('should skip reconcile when history series service mode is disabled', async () => {
        vi.useFakeTimers();
        TestBed.inject(DashboardHistorySeriesSyncService);
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

        await vi.advanceTimersByTimeAsync(800);

        expect(reconcileSpy).not.toHaveBeenCalled();
    });

    it('should reconcile when dashboards signal emits updated widget configuration', async () => {
        vi.useFakeTimers();
        TestBed.inject(DashboardHistorySeriesSyncService);
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
        await vi.advanceTimersByTimeAsync(800);

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        reconcileSpy.mockClear();

        dashboardStub.dashboards.update(dashboards => dashboards.map((dashboard, index) => {
            if (index !== 0) {
                return dashboard;
            }

            const nextConfiguration = [...(dashboard.configuration ?? [])];
            const firstWidget = nextConfiguration[0] as unknown as {
                input?: {
                    widgetProperties?: {
                        config?: Record<string, unknown>;
                    };
                };
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
        await vi.advanceTimersByTimeAsync(800);

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        const submitted = vi.mocked(reconcileSpy).mock.lastCall[0];
        expect(submitted[0].path).toBe('navigation.speedOverGround');
    });

    it('should skip widgets explicitly opted out and include array/object numeric paths', async () => {
        vi.useFakeTimers();
        TestBed.inject(DashboardHistorySeriesSyncService);
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
        await vi.advanceTimersByTimeAsync(800);

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        const submitted = vi.mocked(reconcileSpy).mock.lastCall[0];
        expect(seriesIds(submitted)).toEqual([
            'array-1:auto:navigation-headingtrue:default',
            'auto-1:auto:navigation-speedthroughwater:default'
        ]);
        expect(submitted.every(item => item.retentionDurationMs === 86400000)).toBe(true);
    });

    it('should deduplicate duplicate numeric paths with same source per widget', async () => {
        vi.useFakeTimers();
        TestBed.inject(DashboardHistorySeriesSyncService);
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

        await vi.advanceTimersByTimeAsync(800);

        expect(reconcileSpy).toHaveBeenCalledTimes(1);
        expect(vi.mocked(reconcileSpy).mock.lastCall[0].length).toBe(1);
    });

    it('resolves dedicated data chart and wind trends mappings via public widget resolver', () => {
        const service = TestBed.inject(DashboardHistorySeriesSyncService);
        const dataChartWidget: IWidget = {
            uuid: 'widget-data-1',
            type: 'widget-data-chart',
            config: {
                datachartPath: 'navigation.speedThroughWater',
                datachartSource: 'default',
                timeScale: 'minute',
                period: 10,
            }
        };

        const windTrendsWidget: IWidget = {
            uuid: 'widget-wind-1',
            type: 'widget-windtrends-chart',
            config: {
                timeScale: 'Last 30 Minutes'
            }
        };

        const dataChartSeries = service.resolveSeriesForWidget(dataChartWidget);
        const windSeries = service.resolveSeriesForWidget(windTrendsWidget);

        expect(dataChartSeries.map(item => item.seriesId)).toEqual(['widget-data-1:datachart']);
        expect(windSeries.map(item => item.seriesId).sort()).toEqual([
            'widget-wind-1:wind-direction',
            'widget-wind-1:wind-speed'
        ]);
    });

    it('resolves widget-bms template mappings for plugin-side battery expansion', () => {
        const service = TestBed.inject(DashboardHistorySeriesSyncService);
        const widget: IWidget = {
            uuid: 'widget-bms-1',
            type: 'widget-bms',
            config: {
                timeScale: 'minute',
                period: 15,
            }
        };

        const series = service.resolveSeriesForWidget(widget);
        expect(seriesIds(series)).toEqual([
          'widget-bms-1:batteries-template'
        ]);
        expect(series.every(item => item.expansionMode === 'bms-battery-tree')).toBe(true);
    });

    it('includes configured BMS battery scope in template series payload', () => {
        const service = TestBed.inject(DashboardHistorySeriesSyncService);
        const widget: IWidget = {
            uuid: 'widget-bms-2',
            type: 'widget-bms',
            config: {
                bms: {
                trackedDevices: [
                  { id: 'house', source: 'default', key: 'house||default' },
                  { id: 'starter', source: 'default', key: 'starter||default' }
                ],
                    banks: [
                        { id: 'bank-1', name: 'House', connectionMode: 'parallel', batteryIds: ['house', 'aux'] }
                    ]
                }
            } as IWidget['config']
        };

        const series = service.resolveSeriesForWidget(widget);
        expect(series.length).toBe(1);
      expect(series[0].allowedIds).toEqual(['house', 'starter']);
    });

  it('excludes stale bank members not present in trackedDevices', () => {
    const service = TestBed.inject(DashboardHistorySeriesSyncService);
    const widget: IWidget = {
      uuid: 'widget-bms-stale-1',
      type: 'widget-bms',
      config: {
        bms: {
          trackedDevices: [{ id: 'house', source: 'default', key: 'house||default' }],
          groups: [
            { id: 'bank-1', name: 'House', connectionMode: 'parallel', memberIds: ['house', 'starter'] }
          ]
        }
      } as IWidget['config']
    };

    const series = service.resolveSeriesForWidget(widget);
    expect(series.length).toBe(1);
    expect(series[0].allowedIds).toEqual(['house']);
    });

  it('uses all discovered batteries when trackedDevices is empty, even if banks exist', () => {
        const service = TestBed.inject(DashboardHistorySeriesSyncService);
        const widget: IWidget = {
            uuid: 'widget-bms-3',
            type: 'widget-bms',
            config: {
                bms: {
                trackedDevices: [],
                    banks: [
                        { id: 'bank-1', name: 'House', connectionMode: 'parallel', batteryIds: ['house'] }
                    ]
                }
            } as IWidget['config']
        };

        const series = service.resolveSeriesForWidget(widget);
        expect(series.length).toBe(1);
    expect(series[0].allowedIds).toBeNull();
    });

    it('resolves widget-solar-charger template mappings for plugin-side charger expansion', () => {
        const service = TestBed.inject(DashboardHistorySeriesSyncService);
        const widget: IWidget = {
            uuid: 'widget-solar-1',
            type: 'widget-solar-charger',
            config: {
                timeScale: 'minute',
                period: 15,
            }
        };

        const series = service.resolveSeriesForWidget(widget);
        expect(seriesIds(series)).toEqual([
            'widget-solar-1:solar-template'
        ]);
        expect(series.every(item => item.expansionMode === 'solar-tree')).toBe(true);
    });

    it('includes configured Solar charger scope in template series payload', () => {
        const service = TestBed.inject(DashboardHistorySeriesSyncService);
        const widget: IWidget = {
            uuid: 'widget-solar-2',
            type: 'widget-solar-charger',
            config: {
                solarCharger: {
                trackedDevices: [
                  { id: 'port-array', source: 'default', key: 'port-array||default' },
                  { id: 'starboard-array', source: 'default', key: 'starboard-array||default' }
                ],
                optionsById: {}
                }
            } as IWidget['config']
        };

        const series = service.resolveSeriesForWidget(widget);
        expect(series.length).toBe(1);
      expect(series[0].allowedIds).toEqual(['port-array', 'starboard-array']);
      expect(series[0].trackedDevices).toEqual([
        { id: 'port-array', source: 'default' },
        { id: 'starboard-array', source: 'default' }
      ]);
    });

  it('emits source-qualified trackedDevices for same device id across multiple sources', () => {
    const service = TestBed.inject(DashboardHistorySeriesSyncService);
    const widget: IWidget = {
      uuid: 'widget-charger-source-1',
      type: 'widget-charger',
      config: {
        charger: {
          trackedDevices: [
            { id: 'mppt1', source: 'Renogy Rover', key: 'mppt1||Renogy Rover' },
            { id: 'mppt1', source: 'default', key: 'mppt1||default' }
          ],
          groups: [],
          optionsById: {}
        }
      }
    };

    const series = service.resolveSeriesForWidget(widget);
    expect(series.length).toBe(1);
    expect(series[0].allowedIds).toEqual(['mppt1']);
    expect(series[0].trackedDevices).toEqual([
      { id: 'mppt1', source: 'default' },
      { id: 'mppt1', source: 'Renogy Rover' }
    ]);
  });

  it('normalizes source-qualified group memberIds when building allowedIds', () => {
    const service = TestBed.inject(DashboardHistorySeriesSyncService);
    const widget: IWidget = {
      uuid: 'widget-charger-group-source-1',
      type: 'widget-charger',
      config: {
        charger: {
          trackedDevices: [
            { id: 'mppt1', source: 'Renogy Rover', key: 'mppt1||Renogy Rover' },
            { id: 'mppt2', source: 'default', key: 'mppt2||default' }
          ],
          groups: [
            {
              id: 'grp-1',
              name: 'House Chargers',
              memberIds: ['mppt1||Renogy Rover', 'stale||default']
            }
          ],
          optionsById: {}
        }
      } as IWidget['config']
    };

    const series = service.resolveSeriesForWidget(widget);
    expect(series.length).toBe(1);
    expect(series[0].allowedIds).toEqual(['mppt1', 'mppt2']);
    });

  it('resolves template mappings for all new electrical families', () => {
    const service = TestBed.inject(DashboardHistorySeriesSyncService);
    const widgets: IWidget[] = [
      {
        uuid: 'widget-charger-1',
        type: 'widget-charger',
        config: {
          charger: {
            trackedDevices: [
              { id: 'dc-a', source: 'default', key: 'dc-a||default' },
              { id: 'dc-b', source: 'default', key: 'dc-b||default' }
            ],
            groups: [],
            optionsById: {}
          }
        }
      },
      {
        uuid: 'widget-inverter-1',
        type: 'widget-inverter',
        config: {
          inverter: {
            trackedDevices: [{ id: 'inv-a', source: 'default', key: 'inv-a||default' }],
            groups: [],
            optionsById: {}
          }
        }
      },
      {
        uuid: 'widget-alternator-1',
        type: 'widget-alternator',
        config: {
          alternator: {
            trackedDevices: [{ id: 'alt-a', source: 'default', key: 'alt-a||default' }],
            groups: [],
            optionsById: {}
          }
        }
      },
      {
        uuid: 'widget-ac-1',
        type: 'widget-ac',
        config: {
          ac: {
            trackedDevices: [{ id: 'ac-main', source: 'default', key: 'ac-main||default' }],
            groups: [],
            optionsById: {}
          }
        }
      }
    ];

    const resolved = widgets.flatMap(widget => service.resolveSeriesForWidget(widget));

    expect(seriesIds(resolved)).toEqual([
      'widget-ac-1:ac-template',
      'widget-alternator-1:alternators-template',
      'widget-charger-1:chargers-template',
      'widget-inverter-1:inverters-template'
    ]);

    expect(resolved.find(item => item.seriesId === 'widget-charger-1:chargers-template')).toMatchObject({
      expansionMode: 'charger-tree',
      familyKey: 'chargers',
      allowedIds: ['dc-a', 'dc-b'],
      trackedDevices: [
        { id: 'dc-a', source: 'default' },
        { id: 'dc-b', source: 'default' }
      ]
    });

    expect(resolved.find(item => item.seriesId === 'widget-inverter-1:inverters-template')).toMatchObject({
      expansionMode: 'inverter-tree',
      familyKey: 'inverters',
      allowedIds: ['inv-a'],
      trackedDevices: [{ id: 'inv-a', source: 'default' }]
    });

    expect(resolved.find(item => item.seriesId === 'widget-alternator-1:alternators-template')).toMatchObject({
      expansionMode: 'alternator-tree',
      familyKey: 'alternators',
      allowedIds: ['alt-a'],
      trackedDevices: [{ id: 'alt-a', source: 'default' }]
    });

    expect(resolved.find(item => item.seriesId === 'widget-ac-1:ac-template')).toMatchObject({
      expansionMode: 'ac-tree',
      familyKey: 'ac',
      allowedIds: ['ac-main'],
      trackedDevices: [{ id: 'ac-main', source: 'default' }]
    });
  });

  it('uses all discovered solar units when trackedDevices is empty', () => {
        const service = TestBed.inject(DashboardHistorySeriesSyncService);
        const widget: IWidget = {
            uuid: 'widget-solar-3',
            type: 'widget-solar-charger',
            config: {
                solarCharger: {
                trackedDevices: [],
                optionsById: {}
                }
            } as IWidget['config']
        };

        const series = service.resolveSeriesForWidget(widget);
        expect(series.length).toBe(1);
    expect(series[0].allowedIds).toBeNull();
      expect(series[0].trackedDevices).toBeNull();
    });

    it('returns no widget series when supportAutomaticHistoricalSeries is explicitly false', () => {
        const service = TestBed.inject(DashboardHistorySeriesSyncService);
        const widget: IWidget = {
            uuid: 'widget-numeric-1',
            type: 'widget-numeric',
            config: {
                supportAutomaticHistoricalSeries: false,
                paths: {
                    numericPath: {
                        description: 'Numeric Data',
                        path: 'navigation.speedThroughWater',
                        source: null,
                        pathType: 'number',
                        isPathConfigurable: true,
                        sampleTime: 1000
                    }
                }
            }
        };

        expect(service.resolveSeriesForWidget(widget)).toEqual([]);
    });

    it('resolves numeric paths from widget DEFAULT_CONFIG when saved config is partial', () => {
        widgetServiceMock.getComponentType.mockImplementation((selector: string) => {
            if (selector !== 'widget-horizon') {
                return undefined;
            }

            return {
                DEFAULT_CONFIG: {
                    supportAutomaticHistoricalSeries: true,
                    timeScale: 'minute',
                    period: 30,
                    paths: {
                        gaugePitchPath: {
                            description: 'Pitch',
                            path: 'self.navigation.attitude.pitch',
                            source: 'default',
                            pathType: 'number',
                            isPathConfigurable: true,
                            sampleTime: 1000
                        },
                        gaugeRollPath: {
                            description: 'Roll',
                            path: 'self.navigation.attitude.roll',
                            source: 'default',
                            pathType: 'number',
                            isPathConfigurable: true,
                            sampleTime: 1000
                        }
                    }
                }
            };
        });

        const service = TestBed.inject(DashboardHistorySeriesSyncService);
        const widget: IWidget = {
            uuid: 'widget-horizon-1',
            type: 'widget-horizon',
            config: {
                displayName: 'Horizon'
            }
        };

        const series = service.resolveSeriesForWidget(widget);
        expect(seriesIds(series)).toEqual([
            'widget-horizon-1:auto:self-navigation-attitude-pitch:default',
            'widget-horizon-1:auto:self-navigation-attitude-roll:default'
        ]);
    });
});
