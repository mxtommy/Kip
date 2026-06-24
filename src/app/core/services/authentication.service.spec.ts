import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { firstValueFrom } from 'rxjs';
import { AuthenticationService, IAuthorizationToken } from './authentication.service';
import { ensureLocalStorage } from '../../../test-helpers/local-storage.test-helper';

const nowSec = (): number => Math.floor(Date.now() / 1000);

// The constructor/renewal paths read token.expiry from the stored IAuthorizationToken
// object, so a decodable JWT is not required for these tests.
function seedToken(token: Partial<IAuthorizationToken>): void {
  localStorage.setItem(
    'authorization_token',
    JSON.stringify({ token: 'jwt', expiry: null, isDeviceAccessToken: false, ...token })
  );
}

function seedConnectionConfig(loginPassword: string): void {
  localStorage.setItem(
    'connectionConfig',
    JSON.stringify({
      configVersion: 12,
      kipUUID: 'u',
      signalKUrl: 'http://localhost',
      proxyEnabled: false,
      signalKSubscribeAll: false,
      useDeviceToken: false,
      loginName: 'pi',
      loginPassword,
      useSharedConfig: true,
      sharedConfigName: 'default'
    })
  );
}

function createService(): AuthenticationService {
  // Real AuthenticationService; HttpClient + SignalKConnectionService come from the
  // global test stubs (src/test.ts).
  TestBed.configureTestingModule({ providers: [AuthenticationService] });
  return TestBed.inject(AuthenticationService);
}

describe('AuthenticationService', () => {
  beforeEach(() => ensureLocalStorage());

  it('should be created', () => {
    expect(createService()).toBeTruthy();
  });

  describe('startup token handling (Option A: the JWT is the persisted credential)', () => {
    it('keeps an unexpired user-session token and reports logged in', async () => {
      seedToken({ expiry: nowSec() + 3600, isDeviceAccessToken: false });
      const service = createService();
      expect(await firstValueFrom(service.authToken$)).not.toBeNull();
      expect(await firstValueFrom(service.isLoggedIn$)).toBe(true);
      expect(localStorage.getItem('authorization_token')).not.toBeNull();
    });

    it('deletes an expired user-session token on startup', async () => {
      seedToken({ expiry: nowSec() - 10, isDeviceAccessToken: false });
      const service = createService();
      expect(await firstValueFrom(service.authToken$)).toBeNull();
      expect(await firstValueFrom(service.isLoggedIn$)).toBe(false);
      expect(localStorage.getItem('authorization_token')).toBeNull();
    });
  });

  describe('token renewal without a stored password', () => {
    it('deletes the token to surface re-login instead of re-POSTing stored credentials', async () => {
      // Construct with a far-future token so the constructor does not auto-trigger renewal.
      seedToken({ expiry: nowSec() + 3600, isDeviceAccessToken: false });
      const service = createService();
      const loginSpy = vi.spyOn(service, 'login').mockResolvedValue(undefined);

      // Move the stored token into the renewal window (still valid, < buffer remaining).
      seedToken({ expiry: nowSec() + 30, isDeviceAccessToken: false });
      seedConnectionConfig('plaintext-secret-must-not-be-used');

      (service as unknown as { handleTokenRenewal: () => void }).handleTokenRenewal();

      expect(loginSpy).not.toHaveBeenCalled();
      expect(await firstValueFrom(service.authToken$)).toBeNull();
      expect(localStorage.getItem('authorization_token')).toBeNull();
    });
  });
});
