import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';
import { ensureLocalStorage } from '../../../test-helpers/local-storage.test-helper';

interface SeedOpts {
  sharedConfigName?: string;
  useSharedConfig?: boolean;
}

function seedConfig(opts: SeedOpts = {}): void {
  localStorage.setItem('authorization_token', JSON.stringify(null));
  localStorage.setItem('connectionConfig', JSON.stringify({
    configVersion: 12,
    kipUUID: 'test-uuid',
    // Cross-origin so authMode resolves to token: storage then routes purely on useSharedConfig,
    // keeping "local mode" (useSharedConfig:false) genuinely local under the auth-era routing.
    signalKUrl: 'https://boat.example:3443',
    proxyEnabled: false,
    signalKSubscribeAll: false,
    useDeviceToken: false,
    loginName: '',
    loginPassword: '',
    useSharedConfig: opts.useSharedConfig ?? false,
    sharedConfigName: opts.sharedConfigName ?? 'profileA'
  }));
  localStorage.setItem('appConfig', JSON.stringify({
    configVersion: 12,
    autoNightMode: false,
    redNightMode: false,
    nightModeBrightness: 1,
    isRemoteControl: false,
    instanceName: '',
    dataSets: [],
    unitDefaults: {},
    notificationConfig: {
      disableNotifications: true,
      menuGrouping: false,
      security: { disableSecurity: true },
      devices: { disableDevices: true, showNormalState: false, showNominalState: false },
      sound: { disableSound: true, muteNormal: true, muteNominal: true, muteWarn: true, muteAlert: true, muteAlarm: true, muteEmergency: true }
    }
  }));
  localStorage.setItem('dashboardsConfig', JSON.stringify([{ id: 'dash-1' }]));
  localStorage.setItem('themeConfig', JSON.stringify({ themeName: 'light' }));
}

function seedConnectionConfig(extra: Record<string, unknown> = {}): void {
  localStorage.setItem('authorization_token', JSON.stringify(null));
  localStorage.setItem(
    'connectionConfig',
    JSON.stringify({
      configVersion: 12,
      kipUUID: 'test-uuid',
      signalKUrl: 'http://localhost',
      proxyEnabled: false,
      signalKSubscribeAll: false,
      useDeviceToken: false,
      loginName: 'pi',
      useSharedConfig: true,
      sharedConfigName: 'default',
      ...extra
    })
  );
}

function createService(opts?: SeedOpts): SettingsService {
  // opts provided (profile suite): clear + seed inside. Omitted (credential/routing suites): the
  // describe's beforeEach already cleared and the test seeds via seedConnectionConfig first.
  if (opts) {
    ensureLocalStorage();
    seedConfig(opts);
  }
  // Provide both services in the module so transitive deps resolve to the global stubs
  // (AuthenticationService / SignalKConnectionService) rather than the real root services.
  TestBed.configureTestingModule({ providers: [SettingsService, StorageService] });
  return TestBed.inject(SettingsService);
}

describe('SettingsService — connection credential persistence', () => {
  beforeEach(() => ensureLocalStorage());

  it('getConnectionConfig() does not expose a loginPassword key', () => {
    seedConnectionConfig();
    const cfg = createService().getConnectionConfig();
    expect(Object.prototype.hasOwnProperty.call(cfg, 'loginPassword')).toBe(false);
  });

  it('strips a persisted loginPassword from a legacy connectionConfig on load, without a version bump', () => {
    seedConnectionConfig({ loginPassword: 'plaintext-secret' });
    createService();
    const persisted = JSON.parse(localStorage.getItem('connectionConfig') as string);
    expect(Object.prototype.hasOwnProperty.call(persisted, 'loginPassword')).toBe(false);
    expect(persisted.configVersion).toBe(12);
  });

  it('preserves loginName while dropping the password', () => {
    seedConnectionConfig({ loginName: 'captain', loginPassword: 'secret' });
    const cfg = createService().getConnectionConfig();
    expect(cfg.loginName).toBe('captain');
    expect(Object.prototype.hasOwnProperty.call(cfg, 'loginPassword')).toBe(false);
  });
});

describe('SettingsService — storage routing by mode (Unit 5)', () => {
  beforeEach(() => ensureLocalStorage());

  // authMode is derived by the real AuthenticationService from the seeded connectionConfig:
  // proxyEnabled => cookie; a cross-origin signalKUrl => token.
  const COOKIE = { proxyEnabled: true };
  const CROSS_ORIGIN = { signalKUrl: 'https://boat.example:3443' };

  function setup(connExtra: Record<string, unknown>) {
    seedConnectionConfig(connExtra);
    // Seed the local config keys so the localStorage startup() branch (cross-origin/local routing)
    // loads cleanly instead of throwing an (unhandled, suite-masking) JSON parse error.
    localStorage.setItem('appConfig', JSON.stringify({ configVersion: 12, dataSets: [], unitDefaults: {}, notificationConfig: {} }));
    localStorage.setItem('dashboardsConfig', JSON.stringify([]));
    localStorage.setItem('themeConfig', JSON.stringify({ themeName: '' }));
    TestBed.configureTestingModule({ providers: [SettingsService, StorageService] });
    const storage = TestBed.inject(StorageService);
    const patchSpy = vi.spyOn(storage, 'patchConfig').mockImplementation(() => undefined);
    const service = TestBed.inject(SettingsService);
    return { service, patchSpy };
  }

  it('cookie mode routes a setting write to server applicationData, not localStorage', () => {
    const { service, patchSpy } = setup({ ...COOKIE, useSharedConfig: false });
    localStorage.removeItem('themeConfig');

    service.setThemeName('cookie-theme');

    expect(patchSpy).toHaveBeenCalledWith('IThemeConfig', { themeName: 'cookie-theme' });
    expect(localStorage.getItem('themeConfig')).toBeNull();
  });

  it('cross-origin shared config still routes to server applicationData (unchanged)', () => {
    const { service, patchSpy } = setup({ ...CROSS_ORIGIN, useSharedConfig: true });
    localStorage.removeItem('themeConfig');

    service.setThemeName('shared-theme');

    expect(patchSpy).toHaveBeenCalledWith('IThemeConfig', { themeName: 'shared-theme' });
    expect(localStorage.getItem('themeConfig')).toBeNull();
  });

  it('cross-origin local config still routes to localStorage (unchanged)', () => {
    const { service, patchSpy } = setup({ ...CROSS_ORIGIN, useSharedConfig: false });

    service.setThemeName('local-theme');

    expect(patchSpy).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('themeConfig') as string)).toEqual({ themeName: 'local-theme' });
  });
});

describe('SettingsService', () => {
  it('should be created', () => {
    expect(createService({})).toBeTruthy();
  });

  describe('active profile (local mode)', () => {
    let service: SettingsService;

    beforeEach(() => {
      service = createService({ useSharedConfig: false, sharedConfigName: 'profileA' });
    });

    it('getActiveProfileName returns the booted slot name', () => {
      expect(service.getActiveProfileName()).toBe('profileA');
    });

    it('setActiveProfile updates the name and persists it to connectionConfig', () => {
      service.setActiveProfile('cockpit');
      expect(service.getActiveProfileName()).toBe('cockpit');
      const cc = JSON.parse(localStorage.getItem('connectionConfig') as string);
      expect(cc.sharedConfigName).toBe('cockpit');
    });

    it('setActiveProfile keeps StorageService.sharedConfigName coherent', () => {
      const storage = TestBed.inject(StorageService);
      service.setActiveProfile('cockpit');
      expect(storage.sharedConfigName).toBe('cockpit');
    });
  });

  describe('config snapshot', () => {
    it('returns an assembled IConfig when settings are loaded', () => {
      const service = createService({ useSharedConfig: false });
      const snap = service.getActiveConfigSnapshot();
      expect(snap).not.toBeNull();
      expect(snap?.app).not.toBeNull();
      expect(snap?.theme?.themeName).toBe('light');
      expect(snap?.dashboards).toEqual([{ id: 'dash-1' }]);
    });

    it('returns null on a degraded shared boot (config not loaded)', () => {
      // useSharedConfig=true but storage was never bootstrapped → startup() early-returns,
      // leaving activeConfig.app null. Clone must not seed from a hollow snapshot.
      const service = createService({ useSharedConfig: true, sharedConfigName: 'profileA' });
      expect(service.getActiveConfigSnapshot()).toBeNull();
    });
  });
});
