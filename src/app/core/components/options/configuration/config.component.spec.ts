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
  let settingsMock: {
    useSharedConfig: boolean;
    getAppConfig: ReturnType<typeof vi.fn>;
    getDashboardConfig: ReturnType<typeof vi.fn>;
    getThemeConfig: ReturnType<typeof vi.fn>;
    loadConfigFromLocalStorage: ReturnType<typeof vi.fn>;
    replaceConfig: ReturnType<typeof vi.fn>;
    reloadApp: ReturnType<typeof vi.fn>;
    resetSettings: ReturnType<typeof vi.fn>;
    resetConnection: ReturnType<typeof vi.fn>;
    loadDemoConfig: ReturnType<typeof vi.fn>;
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
      removeItem: vi.fn().mockResolvedValue(undefined),
      getConfig: vi.fn().mockResolvedValue({ app: {}, dashboards: [], theme: {} }),
      setConfig: vi.fn().mockResolvedValue(null)
    };
    toastMock = {
      show: vi.fn()
    };
    settingsMock = {
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
        { provide: SettingsService, useValue: settingsMock }
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

  it('restoring a configuration reloads only after the save resolves', async () => {
    let resolveSave!: (value: unknown) => void;
    storageMock.setConfig.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));
    component.copyConfigForm.setValue({ sourceTarget: 'global::multi-test2' });

    const done = component.copyConfig();
    // Let getConfig resolve and saveConfig kick off the (still pending) setConfig.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(storageMock.setConfig).toHaveBeenCalledWith('user', 'default', expect.anything());
    // Reload must wait for the server write to complete, not race it.
    expect(settingsMock.reloadApp).not.toHaveBeenCalled();

    resolveSave(null);
    await done;

    expect(settingsMock.reloadApp).toHaveBeenCalledTimes(1);
  });

  it('does not reload when restoring a configuration fails to save', async () => {
    storageMock.setConfig.mockRejectedValueOnce(new Error('network down'));
    component.copyConfigForm.setValue({ sourceTarget: 'global::multi-test2' });

    await component.copyConfig();

    expect(settingsMock.reloadApp).not.toHaveBeenCalled();
    expect(toastMock.show).toHaveBeenCalledWith('Configuration not saved to server', 0, false, 'error');
  });

  it('uploading a configuration reloads only after the save resolves', async () => {
    authTokenSubject.next(createToken({ isDeviceAccessToken: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    let resolveSave!: (value: unknown) => void;
    storageMock.setConfig.mockReturnValueOnce(new Promise((resolve) => { resolveSave = resolve; }));

    const file = new File(
      [JSON.stringify({ app: {}, dashboards: [], theme: {} })],
      'KipConfig.json',
      { type: 'application/json' }
    );
    const event = { target: { files: [file] } } as unknown as Event;

    component.uploadJsonConfig(event);

    // Wait for FileReader.onload to parse and call setConfig.
    await vi.waitFor(() => expect(storageMock.setConfig).toHaveBeenCalledWith('user', 'default', expect.anything()));
    // Reload must not fire while the upload write is still in flight.
    expect(settingsMock.reloadApp).not.toHaveBeenCalled();

    resolveSave(null);
    await vi.waitFor(() => expect(settingsMock.reloadApp).toHaveBeenCalledTimes(1));
  });

  it('does not reload when an uploaded configuration fails to save', async () => {
    authTokenSubject.next(createToken({ isDeviceAccessToken: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    storageMock.setConfig.mockRejectedValueOnce(new Error('network down'));

    const file = new File(
      [JSON.stringify({ app: {}, dashboards: [], theme: {} })],
      'KipConfig.json',
      { type: 'application/json' }
    );
    const event = { target: { files: [file] } } as unknown as Event;

    component.uploadJsonConfig(event);

    await vi.waitFor(() => expect(toastMock.show).toHaveBeenCalledWith('Configuration not saved to server', 0, false, 'error'));
    expect(settingsMock.reloadApp).not.toHaveBeenCalled();
  });

  it('refreshes the configuration list only after a delete completes', async () => {
    storageMock.listConfigs.mockClear();
    let resolveDelete!: () => void;
    storageMock.removeItem.mockReturnValueOnce(new Promise<void>((resolve) => { resolveDelete = resolve; }));

    const done = component.deleteConfig('global', 'multi-test2');
    await Promise.resolve();

    // The list must not refresh until the server has actually removed the entry.
    expect(storageMock.listConfigs).not.toHaveBeenCalled();

    resolveDelete();
    await done;

    expect(storageMock.listConfigs).toHaveBeenCalled();
    expect(toastMock.show).toHaveBeenCalledWith('Configuration [multi-test2] deleted from [global] storage scope', 1000, false, 'success');
  });

  it('reports an error and skips the refresh when a delete fails', async () => {
    storageMock.listConfigs.mockClear();
    storageMock.removeItem.mockRejectedValueOnce(new Error('network down'));

    await component.deleteConfig('global', 'multi-test2');

    expect(toastMock.show).toHaveBeenCalledWith('Configuration [multi-test2] could not be deleted from [global] storage scope', 0, false, 'error');
    expect(storageMock.listConfigs).not.toHaveBeenCalled();
  });

  it('rejects an uploaded file that is not valid JSON', async () => {
    authTokenSubject.next(createToken({ isDeviceAccessToken: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    const file = new File(['{ not valid json'], 'KipConfig.json', { type: 'application/json' });
    const event = { target: { files: [file] } } as unknown as Event;

    component.uploadJsonConfig(event);

    await vi.waitFor(() => expect(toastMock.show).toHaveBeenCalledWith('File does not contain valid JSON.', 0, false, 'error'));
    expect(storageMock.setConfig).not.toHaveBeenCalled();
    expect(settingsMock.reloadApp).not.toHaveBeenCalled();
  });

  it('rejects an uploaded file that is not a JSON file', () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    const event = { target: { files: [file] } } as unknown as Event;

    component.uploadJsonConfig(event);

    expect(toastMock.show).toHaveBeenCalledWith('Please select a valid JSON file', 0, false, 'error');
    expect(storageMock.setConfig).not.toHaveBeenCalled();
    expect(settingsMock.reloadApp).not.toHaveBeenCalled();
  });

  it('uploads to local storage and reloads when there is no auth token', async () => {
    // No token emitted -> hasToken is false -> localStorage path.
    const config = { app: { a: 1 }, dashboards: [{ d: 1 }], theme: { t: 1 } };
    const file = new File([JSON.stringify(config)], 'KipConfig.json', { type: 'application/json' });
    const event = { target: { files: [file] } } as unknown as Event;

    component.uploadJsonConfig(event);

    await vi.waitFor(() => expect(settingsMock.reloadApp).toHaveBeenCalledTimes(1));
    expect(storageMock.setConfig).not.toHaveBeenCalled();
    expect(settingsMock.replaceConfig).toHaveBeenCalledWith('appConfig', config.app, false);
    expect(settingsMock.replaceConfig).toHaveBeenCalledWith('dashboardsConfig', config.dashboards, false);
    expect(settingsMock.replaceConfig).toHaveBeenCalledWith('themeConfig', config.theme, false);
  });

  it('surfaces an error and does not reload when the local storage upload write fails', async () => {
    // No token -> localStorage path. A localStorage.setItem throw (quota exceeded /
    // private mode) must be contained, not escape the async onload handler.
    settingsMock.replaceConfig.mockImplementation(() => { throw new DOMException('Quota', 'QuotaExceededError'); });
    const file = new File([JSON.stringify({ app: {}, dashboards: [], theme: {} })], 'KipConfig.json', { type: 'application/json' });
    const event = { target: { files: [file] } } as unknown as Event;

    component.uploadJsonConfig(event);

    await vi.waitFor(() => expect(toastMock.show).toHaveBeenCalledWith('Configuration not saved', 0, false, 'error'));
    expect(settingsMock.reloadApp).not.toHaveBeenCalled();
  });

  it('refreshes the configuration list after a successful save with refresh enabled', async () => {
    storageMock.listConfigs.mockClear();

    const saved = await component.saveConfig({ app: {}, dashboards: [], theme: {} } as never, 'global', 'my-backup');

    expect(saved).toBe(true);
    expect(storageMock.setConfig).toHaveBeenCalledWith('global', 'my-backup', expect.anything());
    expect(storageMock.listConfigs).toHaveBeenCalled();
  });

  it('refuses to save to the reserved user/default scope without forceSave', async () => {
    const saved = await component.saveConfig({ app: {}, dashboards: [], theme: {} } as never, 'user', 'default');

    expect(saved).toBe(false);
    expect(storageMock.setConfig).not.toHaveBeenCalled();
    expect(toastMock.show).toHaveBeenCalledWith("Saving configuration with scope 'user' and name 'default' is not allowed.", 0, false, 'error');
  });

  it('shows an error and does not restore when no configuration is selected', async () => {
    component.copyConfigForm.setValue({ sourceTarget: '' });

    await component.copyConfig();

    expect(toastMock.show).toHaveBeenCalledWith('Please select a valid configuration to restore.', 0, false, 'error');
    expect(storageMock.getConfig).not.toHaveBeenCalled();
    expect(settingsMock.reloadApp).not.toHaveBeenCalled();
  });

  it('shows an error and does not reload when the source config cannot be retrieved', async () => {
    storageMock.getConfig.mockRejectedValueOnce({ statusText: 'Not Found' });
    component.copyConfigForm.setValue({ sourceTarget: 'global::multi-test2' });

    await component.copyConfig();

    expect(toastMock.show).toHaveBeenCalledWith('Cannot retrieve server configuration: Not Found', 0, false, 'error');
    expect(storageMock.setConfig).not.toHaveBeenCalled();
    expect(settingsMock.reloadApp).not.toHaveBeenCalled();
  });

  it('surfaces the storage-requirements message on a 401 when listing configs', async () => {
    storageMock.listConfigs.mockRejectedValueOnce({ status: 401, statusText: 'Unauthorized' });

    component.getServerConfigList();

    await vi.waitFor(() => expect(toastMock.show).toHaveBeenCalledWith(
      expect.stringContaining('Storage Service: Unauthorized'), 0, false, 'error'));
  });

  it('reads the active config from memory when shared config is enabled', () => {
    settingsMock.useSharedConfig = true;
    settingsMock.getAppConfig.mockReturnValue({ a: 1 });
    settingsMock.getDashboardConfig.mockReturnValue([{ d: 1 }]);
    settingsMock.getThemeConfig.mockReturnValue({ t: 1 });

    expect(component.getActiveConfig()).toEqual({ app: { a: 1 }, dashboards: [{ d: 1 }], theme: { t: 1 } });
    expect(settingsMock.loadConfigFromLocalStorage).not.toHaveBeenCalled();
  });

  it('reads the active config from local storage when shared config is disabled', () => {
    settingsMock.useSharedConfig = false;
    settingsMock.loadConfigFromLocalStorage.mockImplementation((key: string) => ({ from: key }));

    expect(component.getActiveConfig()).toEqual({
      app: { from: 'appConfig' },
      dashboards: { from: 'dashboardsConfig' },
      theme: { from: 'themeConfig' }
    });
  });
});
