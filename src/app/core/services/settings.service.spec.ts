import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MatSnackBar } from '@angular/material/snack-bar';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

describe('SettingsService', () => {
  it('should be created', () => {
    TestBed.configureTestingModule({ providers: [SettingsService] });
    const service = TestBed.inject(SettingsService);
    expect(service).toBeTruthy();
  });

  describe('loadDemoConfig (shared/server config)', () => {
    let storageMock: {
      activeConfigFileVersion: number;
      storageServiceReady$: BehaviorSubject<boolean>;
      isRemoteContextBootstrapped: () => boolean;
      initConfig: unknown;
      setConfig: ReturnType<typeof vi.fn>;
    };
    let snackMock: { open: ReturnType<typeof vi.fn> };
    let service: SettingsService;

    beforeEach(() => {
      storageMock = {
        activeConfigFileVersion: 0,
        storageServiceReady$: new BehaviorSubject<boolean>(true),
        isRemoteContextBootstrapped: () => false,
        initConfig: null,
        setConfig: vi.fn().mockResolvedValue(null)
      };
      snackMock = { open: vi.fn() };

      TestBed.configureTestingModule({
        providers: [
          SettingsService,
          { provide: StorageService, useValue: storageMock },
          { provide: MatSnackBar, useValue: snackMock }
        ]
      });

      service = TestBed.inject(SettingsService);
      service.useSharedConfig = true;
      vi.spyOn(service, 'reloadApp').mockImplementation(() => undefined);
    });

    it('reloads only after the demo config save resolves', async () => {
      let resolveSave: (value: unknown) => void;
      storageMock.setConfig.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));

      service.loadDemoConfig();
      await Promise.resolve();

      expect(storageMock.setConfig).toHaveBeenCalledWith('user', 'default', expect.anything());
      // Reload must wait for the write, not race it.
      expect(service.reloadApp).not.toHaveBeenCalled();

      resolveSave(null);
      await Promise.resolve();
      await Promise.resolve();

      expect(service.reloadApp).toHaveBeenCalledTimes(1);
    });

    it('does not reload and surfaces an error when the demo config save fails', async () => {
      storageMock.setConfig.mockRejectedValueOnce(new Error('network down'));

      service.loadDemoConfig();
      await Promise.resolve();
      await Promise.resolve();

      // The save must actually be attempted (not skipped) before we assert no reload.
      expect(storageMock.setConfig).toHaveBeenCalledWith('user', 'default', expect.anything());
      expect(service.reloadApp).not.toHaveBeenCalled();
      expect(snackMock.open).toHaveBeenCalled();
    });

    it('does nothing when storage is not ready', async () => {
      storageMock.storageServiceReady$.next(false);

      service.loadDemoConfig();
      await Promise.resolve();

      expect(storageMock.setConfig).not.toHaveBeenCalled();
      expect(service.reloadApp).not.toHaveBeenCalled();
    });
  });
});
