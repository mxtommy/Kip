import { TestBed } from '@angular/core/testing';

import { ConfigurationUpgradeService } from './configuration-upgrade.service';
import { StorageService } from './storage.service';
import { AppSettingsService } from './app-settings.service';

describe('ConfigurationUpgradeService', () => {
  let service: ConfigurationUpgradeService;

  const mockStorage = {
    initConfig: null,
    listConfigs: jasmine.createSpy('listConfigs').and.resolveTo([]),
    getConfig: jasmine.createSpy('getConfig').and.resolveTo(null),
    setConfig: jasmine.createSpy('setConfig').and.resolveTo()
  };

  const mockAppSettings = {
    useSharedConfig: true,
    reloadApp: jasmine.createSpy('reloadApp'),
    getAppConfig: jasmine.createSpy('getAppConfig').and.returnValue({}),
    getDashboardConfig: jasmine.createSpy('getDashboardConfig').and.returnValue([]),
    getThemeConfig: jasmine.createSpy('getThemeConfig').and.returnValue({}),
    loadConfigFromLocalStorage: jasmine.createSpy('loadConfigFromLocalStorage').and.returnValue({}),
    resetSettings: jasmine.createSpy('resetSettings')
  };

  beforeEach(() => {
    mockStorage.listConfigs.calls.reset();
    mockStorage.getConfig.calls.reset();
    mockStorage.setConfig.calls.reset();
    mockAppSettings.reloadApp.calls.reset();

    TestBed.configureTestingModule({
      providers: [
        ConfigurationUpgradeService,
        { provide: StorageService, useValue: mockStorage },
        { provide: AppSettingsService, useValue: mockAppSettings }
      ]
    });
    service = TestBed.inject(ConfigurationUpgradeService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should support calling runUpgrade without a version argument', async () => {
    await service.runUpgrade();

    expect(mockStorage.listConfigs).toHaveBeenCalledWith(9);
    expect(service.error()).toBeNull();
  });
});
