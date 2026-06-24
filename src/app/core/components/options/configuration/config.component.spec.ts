import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsConfigComponent } from './config.component';
import { AuthenticationService, IAuthorizationToken } from '../../../services/authentication.service';
import { StorageService } from '../../../services/storage.service';
import { ToastService } from '../../../services/toast.service';
import { SettingsService } from '../../../services/settings.service';
import { ImageAssetService } from '../../../services/image-asset.service';
import { DialogService } from '../../../services/dialog.service';

const createToken = (overrides: Partial<IAuthorizationToken> = {}): IAuthorizationToken => ({
  token: 'token',
  expiry: Date.now() / 1000 + 3600,
  isDeviceAccessToken: true,
  ...overrides
});

describe('SettingsConfigComponent', () => {
  let component: SettingsConfigComponent;
  let fixture: ComponentFixture<SettingsConfigComponent>;
  let authTokenSubject: BehaviorSubject<IAuthorizationToken | null>;
  let storageMock: {
    isAppDataSupported: boolean;
    listConfigs: ReturnType<typeof vi.fn>;
    removeItem: ReturnType<typeof vi.fn>;
    getConfig: ReturnType<typeof vi.fn>;
    setConfig: ReturnType<typeof vi.fn>;
  };
  let toastMock: {
    show: ReturnType<typeof vi.fn>;
  };
  let imagesMock: {
    ready: boolean;
    cacheStats: ReturnType<typeof vi.fn>;
    purgeCache: ReturnType<typeof vi.fn>;
  };
  let dialogMock: {
    openConfirmationDialog: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    authTokenSubject = new BehaviorSubject<IAuthorizationToken | null>(null);
    storageMock = {
      isAppDataSupported: true,
      listConfigs: vi.fn().mockResolvedValue([
        { scope: 'global', name: 'multi-test2' },
        { scope: 'user', name: 'default' },
        { scope: 'user', name: 'race-config' }
      ]),
      removeItem: vi.fn(),
      getConfig: vi.fn().mockResolvedValue({ app: {}, dashboards: [], theme: {} }),
      setConfig: vi.fn().mockReturnValue(true)
    };
    toastMock = {
      show: vi.fn()
    };
    imagesMock = {
      ready: true,
      cacheStats: vi.fn(() => of({ bytes: 1048576, files: 3 })),
      purgeCache: vi.fn(() => of({ ok: true }))
    };
    dialogMock = {
      openConfirmationDialog: vi.fn(() => of(true))
    };

    await TestBed.configureTestingModule({
      imports: [SettingsConfigComponent],
      providers: [
        {
          provide: AuthenticationService,
          useValue: {
            authToken$: authTokenSubject.asObservable()
          }
        },
        { provide: StorageService, useValue: storageMock },
        { provide: ToastService, useValue: toastMock },
        {
          provide: SettingsService,
          useValue: {
            useSharedConfig: false,
            getAppConfig: vi.fn(),
            getDashboardConfig: vi.fn(),
            getThemeConfig: vi.fn(),
            loadConfigFromLocalStorage: vi.fn(),
            replaceConfig: vi.fn(),
            reloadApp: vi.fn(),
            resetSettings: vi.fn(),
            resetConnection: vi.fn(),
            loadDemoConfig: vi.fn()
          }
        },
        { provide: ImageAssetService, useValue: imagesMock },
        { provide: DialogService, useValue: dialogMock }
      ]
    })
      .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SettingsConfigComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should be created', () => {
    expect(component).toBeTruthy();
  });

  it('derives auth state and config options from signals', async () => {
    authTokenSubject.next(createToken({ isDeviceAccessToken: true }));
    fixture.detectChanges();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(component.hasToken).toBe(true);
    expect(component.isTokenTypeDevice).toBe(true);
    expect(component.saveConfigScope).toBe('global');
    expect(storageMock.listConfigs).toHaveBeenCalled();

    expect(component.serverConfigOptions()).toEqual([
      { scope: 'global', name: 'multi-test2', key: 'global::multi-test2' },
      { scope: 'user', name: 'race-config', key: 'user::race-config' }
    ]);
  });

  it('deletes configuration using parsed key', () => {
    component.deleteConfigByKey('global::multi-test2');

    expect(storageMock.removeItem).toHaveBeenCalledWith('global', 'multi-test2', undefined);
  });

  it('shows error when delete key is invalid', () => {
    component.deleteConfigByKey('');

    expect(toastMock.show).toHaveBeenCalledWith('Please select a valid configuration to delete.', 0, false, 'error');
    expect(storageMock.removeItem).not.toHaveBeenCalled();
  });

  it('loads and formats the image cache size on init', () => {
    expect(imagesMock.cacheStats).toHaveBeenCalled();
    const api = component as unknown as { imageCacheDisplay: () => string };
    expect(api.imageCacheDisplay()).toBe('1.0 MB · 3 files');
  });

  it('shows Unavailable when the image service is not ready', () => {
    imagesMock.ready = false;
    component.refreshImageCache();
    const api = component as unknown as { imageCacheDisplay: () => string };
    expect(api.imageCacheDisplay()).toBe('Unavailable');
  });

  it('purges the image cache after confirmation and refreshes', () => {
    imagesMock.cacheStats.mockClear();
    component.purgeImageCache();

    expect(dialogMock.openConfirmationDialog).toHaveBeenCalled();
    expect(imagesMock.purgeCache).toHaveBeenCalled();
    expect(imagesMock.cacheStats).toHaveBeenCalled();
    expect(toastMock.show).toHaveBeenCalledWith('Image cache purged', 1000, true, 'success');
  });

  it('does not purge when the confirmation is declined', () => {
    dialogMock.openConfirmationDialog.mockReturnValueOnce(of(false));
    component.purgeImageCache();

    expect(imagesMock.purgeCache).not.toHaveBeenCalled();
  });
});
