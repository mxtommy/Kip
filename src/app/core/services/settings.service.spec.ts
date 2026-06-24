import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
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
