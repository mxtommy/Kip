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

    it('startFresh retires BOTH global and user legacy configs via an awaited write before resetting', async () => {
        mockStorage.initConfig = null; // remote (Signal K) path
        mockStorage.listConfigs.mockResolvedValueOnce([
            { scope: 'global', name: 'gconf' },
            { scope: 'user', name: 'uconf' }
        ]);
        mockStorage.getConfig.mockImplementation(async () => ({ app: { configVersion: 10 } }));

        service.startFresh();

        // The reset (which reloads the page) must run only after retiring completes.
        await vi.waitFor(() => expect(mockAppSettings.resetSettings).toHaveBeenCalled());

        // Global must be retired via an awaited setConfig (not a deferred fire-and-forget),
        // to legacy file version 9 with configVersion 0 — same as the user scope.
        expect(mockStorage.setConfig).toHaveBeenCalledWith(
            'global', 'gconf', expect.objectContaining({ app: expect.objectContaining({ configVersion: 0 }) }), 9);
        expect(mockStorage.setConfig).toHaveBeenCalledWith(
            'user', 'uconf', expect.objectContaining({ app: expect.objectContaining({ configVersion: 0 }) }), 9);
    });
});
