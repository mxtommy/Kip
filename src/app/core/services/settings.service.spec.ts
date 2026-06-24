import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';
import { ensureLocalStorage } from '../../../test-helpers/local-storage.test-helper';

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

function createService(): SettingsService {
  // localStorage is installed+cleared in beforeEach; the test seeds before calling this.
  // Provide both services so the transitive chain resolves to the global stubs
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
