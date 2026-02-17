import { TestBed, inject } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DatasetService, TimeScaleFormat } from './data-set.service';
import { SettingsService } from './settings.service';
import { IAppConfig } from '../interfaces/app-settings.interfaces';
import { DataService } from './data.service';
import { SignalkHistoryService } from './signalk-history.service';
import { of } from 'rxjs';


describe('DatasetService', () => {
  let historyServiceMock: jasmine.SpyObj<SignalkHistoryService>;

  beforeEach(() => {
    historyServiceMock = jasmine.createSpyObj<SignalkHistoryService>('SignalkHistoryService', ['getValues']);
    historyServiceMock.getValues.and.resolveTo(null);

    const appSettingsMock: Partial<SettingsService> = {
      getDataSets: () => [],
      // Skip cleanup logic and avoid any persistence writes.
      configUpgrade: signal(true),
      getAppConfig: () => ({ configVersion: 999 } as IAppConfig),
      getDashboardConfig: () => [],
      saveDataSets: () => undefined
    };

    const dataServiceMock: Partial<DataService> = {
      getPathUnitType: () => 'number',
      subscribePath: () => of({ data: { value: 1, timestamp: null }, state: 'normal' })
    };

    TestBed.configureTestingModule({
      providers: [
        DatasetService,
        { provide: SettingsService, useValue: appSettingsMock },
        { provide: DataService, useValue: dataServiceMock },
        { provide: SignalkHistoryService, useValue: historyServiceMock }
      ]
    });
  });

  it('should be created', inject([DatasetService], (service: DatasetService) => {
    expect(service).toBeTruthy();
  }));

  it('derives ~120 points per window for larger windows', inject([DatasetService], (service: DatasetService) => {
    const mk = (timeScaleFormat: TimeScaleFormat, period: number) => ({
      uuid: 'ds-1',
      path: 'navigation.speedThroughWater',
      pathSource: 'test',
      baseUnit: 'number',
      timeScaleFormat,
      period,
      label: 'test'
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastMinute = (service as any).createDataSourceConfiguration(mk('Last Minute', 1));
    expect(lastMinute.maxDataPoints).toBe(120);
    expect(lastMinute.sampleTime).toBe(500);
    expect(lastMinute.smoothingPeriod).toBe(30);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lastFive = (service as any).createDataSourceConfiguration(mk('Last 5 Minutes', 1));
    expect(lastFive.maxDataPoints).toBe(120);
    expect(lastFive.sampleTime).toBe(2500);
    expect(lastFive.smoothingPeriod).toBe(30);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sixtyHours = (service as any).createDataSourceConfiguration(mk('hour', 60));
    expect(sixtyHours.maxDataPoints).toBe(120);
    expect(sixtyHours.sampleTime).toBe(1_800_000);
    expect(sixtyHours.smoothingPeriod).toBe(30);
  }));

  it('enforces a minimum sampling interval for very small windows', inject([DatasetService], (service: DatasetService) => {
    const ds = {
      uuid: 'ds-2',
      path: 'navigation.headingTrue',
      pathSource: 'test',
      baseUnit: 'number',
      timeScaleFormat: 'second' as const,
      period: 1,
      label: 'test'
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cfg = (service as any).createDataSourceConfiguration(ds);
    expect(cfg.sampleTime).toBe(100);
    expect(cfg.maxDataPoints).toBe(10);
    expect(cfg.smoothingPeriod).toBe(2);
  }));

  it('skips history seeding when sampleTime is below one second', inject([DatasetService], async (service: DatasetService) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).shouldSeedHistory(999)).toBeFalse();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((service as any).shouldSeedHistory(1000)).toBeTrue();

    const config = {
      uuid: 'ds-sec-1',
      path: 'navigation.headingTrue',
      pathSource: 'test',
      baseUnit: 'number',
      timeScaleFormat: 'second' as const,
      period: 1,
      label: 'test-sec'
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)._svcDatasetConfigs = [config];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).start(config.uuid);

    expect(historyServiceMock.getValues).not.toHaveBeenCalled();
    service.ngOnDestroy();
  }));

  it('passes history resolution in seconds when seeding history', inject([DatasetService], async (service: DatasetService) => {
    historyServiceMock.getValues.calls.reset();
    historyServiceMock.getValues.and.resolveTo({
      context: 'vessels.self',
      range: {
        from: '2026-02-16T00:00:00.000Z',
        to: '2026-02-16T00:05:00.000Z'
      },
      values: [],
      data: []
    });

    const config = {
      uuid: 'ds-last-5',
      path: 'navigation.speedThroughWater',
      pathSource: 'test',
      baseUnit: 'number',
      timeScaleFormat: 'Last 5 Minutes' as const,
      period: 1,
      label: 'test-last-5'
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)._svcDatasetConfigs = [config];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).start(config.uuid);

    expect(historyServiceMock.getValues).toHaveBeenCalled();
    const request = historyServiceMock.getValues.calls.mostRecent().args[0] as { resolution: number };
    // Last 5 Minutes resolves to sampleTime=2500ms, therefore history resolution=3s
    expect(request.resolution).toBe(3);
    service.ngOnDestroy();
  }));

  it('hydrates dataSource history from seeded history datapoints', inject([DatasetService], async (service: DatasetService) => {
    historyServiceMock.getValues.calls.reset();
    historyServiceMock.getValues.and.resolveTo({
      context: 'vessels.self',
      range: {
        from: '2026-02-16T00:00:00.000Z',
        to: '2026-02-16T00:05:00.000Z'
      },
      values: [
        { path: 'navigation.speedThroughWater', method: 'avg' }
      ],
      data: [
        ['2026-02-16T00:00:00.000Z', 2],
        ['2026-02-16T00:01:00.000Z', 4],
        ['2026-02-16T00:02:00.000Z', 6]
      ]
    });

    const config = {
      uuid: 'ds-hydrate-history',
      path: 'navigation.speedThroughWater',
      pathSource: 'test',
      baseUnit: 'number',
      timeScaleFormat: 'Last 5 Minutes' as const,
      period: 1,
      label: 'test-hydrate-history'
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)._svcDatasetConfigs = [config];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (service as any).start(config.uuid);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataSource = (service as any)._svcDataSource.find((entry: { uuid: string }) => entry.uuid === config.uuid);
    expect(dataSource).toBeTruthy();
    expect(dataSource.historicalData[0]).toBe(2);
    expect(dataSource.historicalData[1]).toBe(4);
    expect(dataSource.historicalData[2]).toBe(6);

    service.ngOnDestroy();
  }));

  it('continues startup in live mode when history seeding throws', inject([DatasetService], async (service: DatasetService) => {
    historyServiceMock.getValues.calls.reset();
    historyServiceMock.getValues.and.rejectWith(new Error('History backend failure'));

    const config = {
      uuid: 'ds-live-fallback',
      path: 'navigation.speedOverGround',
      pathSource: 'test',
      baseUnit: 'number',
      timeScaleFormat: 'Last 5 Minutes' as const,
      period: 1,
      label: 'test-live-fallback'
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (service as any)._svcDatasetConfigs = [config];

    await expectAsync(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (service as any).start(config.uuid)
    ).toBeResolved();

    // Data source should still be active for live updates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dataSource = (service as any)._svcDataSource.find((entry: { uuid: string }) => entry.uuid === config.uuid);
    expect(dataSource).toBeTruthy();
    expect(dataSource.pathObserverSubscription.closed).toBeFalse();

    service.ngOnDestroy();
  }));

  it('sets dataset stats only on final history datapoint using datapoint values', inject([DatasetService], (service: DatasetService) => {
    const response = {
      context: 'vessels.self',
      range: {
        from: '2026-02-16T00:00:00.000Z',
        to: '2026-02-16T00:03:00.000Z'
      },
      values: [
        { path: 'navigation.speedThroughWater', method: 'avg' },
        { path: 'navigation.speedThroughWater', method: 'min' },
        { path: 'navigation.speedThroughWater', method: 'max' }
      ],
      data: [
        ['2026-02-16T00:00:00.000Z', 2, 50, 80],
        ['2026-02-16T00:01:00.000Z', 4, 55, 85],
        ['2026-02-16T00:02:00.000Z', 6, 60, 90]
      ]
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datapoints = (service as any).convertHistoryToDatapoints(response, 'number', 'scalar');

    expect(datapoints.length).toBe(3);
    expect(datapoints[0].data.lastAverage).toBeNull();
    expect(datapoints[0].data.lastMinimum).toBeNull();
    expect(datapoints[0].data.lastMaximum).toBeNull();
    expect(datapoints[1].data.lastAverage).toBeNull();
    expect(datapoints[1].data.lastMinimum).toBeNull();
    expect(datapoints[1].data.lastMaximum).toBeNull();

    // Must be computed from datapoint.value series [2,4,6], not min/max columns.
    expect(datapoints[2].data.lastAverage).toBe(4);
    expect(datapoints[2].data.lastMinimum).toBe(2);
    expect(datapoints[2].data.lastMaximum).toBe(6);
  }));

  it('uses circular stats for final history datapoint in rad direction domain', inject([DatasetService], (service: DatasetService) => {
    const response = {
      context: 'vessels.self',
      range: {
        from: '2026-02-16T00:00:00.000Z',
        to: '2026-02-16T00:03:00.000Z'
      },
      values: [
        { path: 'environment.wind.angleTrueWater', method: 'avg' }
      ],
      data: [
        ['2026-02-16T00:00:00.000Z', 6.19591884457987],  // 355°
        ['2026-02-16T00:01:00.000Z', 0.08726646259971647], // 5°
        ['2026-02-16T00:02:00.000Z', 0.05235987755982989]  // 3°
      ]
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const datapoints = (service as any).convertHistoryToDatapoints(response, 'rad', 'direction');

    expect(datapoints.length).toBe(3);
    expect(datapoints[0].data.lastAverage).toBeNull();
    expect(datapoints[1].data.lastAverage).toBeNull();

    const final = datapoints[2].data;
    expect(final.lastAverage).toBeCloseTo(0.0174959160, 6); // circular mean (~1.0024°)
    expect(final.lastMinimum).toBeCloseTo(6.1959188446, 6); // 355°
    expect(final.lastMaximum).toBeCloseTo(0.0872664626, 6); // 5°
  }));
});
