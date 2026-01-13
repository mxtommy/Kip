import { TestBed, inject } from '@angular/core/testing';

import { DatasetService, TimeScaleFormat } from './data-set.service';
import { AppSettingsService } from './app-settings.service';
import { DataService } from './data.service';

describe('DatasetService', () => {
  beforeEach(() => {
    const appSettingsMock: Partial<AppSettingsService> = {
      getDataSets: () => [],
      // Skip cleanup logic and avoid any persistence writes.
      configUpgrade: () => true,
      getAppConfig: () => ({ configVersion: 999 } as any),
      getDashboardConfig: () => [],
      saveDataSets: () => undefined
    };

    const dataServiceMock: Partial<DataService> = {
      getPathUnitType: () => 'number'
    };

    TestBed.configureTestingModule({
      providers: [
        DatasetService,
        { provide: AppSettingsService, useValue: appSettingsMock },
        { provide: DataService, useValue: dataServiceMock }
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

    const lastMinute = (service as any).createDataSourceConfiguration(mk('Last Minute', 1));
    expect(lastMinute.maxDataPoints).toBe(120);
    expect(lastMinute.sampleTime).toBe(500);
    expect(lastMinute.smoothingPeriod).toBe(30);

    const lastFive = (service as any).createDataSourceConfiguration(mk('Last 5 Minutes', 1));
    expect(lastFive.maxDataPoints).toBe(120);
    expect(lastFive.sampleTime).toBe(2500);
    expect(lastFive.smoothingPeriod).toBe(30);

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

    const cfg = (service as any).createDataSourceConfiguration(ds);
    expect(cfg.sampleTime).toBe(100);
    expect(cfg.maxDataPoints).toBe(10);
    expect(cfg.smoothingPeriod).toBe(2);
  }));
});
