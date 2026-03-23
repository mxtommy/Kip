import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsConfigComponent } from './config.component';
import { AuthenticationService, IAuthorizationToken } from '../../../services/authentication.service';
import { StorageService } from '../../../services/storage.service';
import { ToastService } from '../../../services/toast.service';
import { SettingsService } from '../../../services/settings.service';

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
        }
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
    await fixture.whenStable();

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
});
