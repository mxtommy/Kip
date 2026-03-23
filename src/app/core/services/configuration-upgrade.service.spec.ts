import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigurationUpgradeService } from './configuration-upgrade.service';
import { StorageService } from './storage.service';
import { SettingsService } from './settings.service';

describe('ConfigurationUpgradeService', () => {
    let service: ConfigurationUpgradeService;

    const mockStorage = {
        initConfig: null,
        listConfigs: vi.fn().mockResolvedValue([]),
        getConfig: vi.fn().mockResolvedValue(null),
        setConfig: vi.fn().mockResolvedValue(undefined)
    };

    const mockAppSettings = {
        useSharedConfig: true,
        reloadApp: vi.fn(),
        getAppConfig: vi.fn().mockReturnValue({}),
        getDashboardConfig: vi.fn().mockReturnValue([]),
        getThemeConfig: vi.fn().mockReturnValue({}),
        loadConfigFromLocalStorage: vi.fn().mockReturnValue({}),
        resetSettings: vi.fn()
    };

    beforeEach(() => {
        mockStorage.listConfigs.mockClear();
        mockStorage.getConfig.mockClear();
        mockStorage.setConfig.mockClear();
        mockAppSettings.reloadApp.mockClear();

        TestBed.configureTestingModule({
            providers: [
                ConfigurationUpgradeService,
                { provide: StorageService, useValue: mockStorage },
                { provide: SettingsService, useValue: mockAppSettings }
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
