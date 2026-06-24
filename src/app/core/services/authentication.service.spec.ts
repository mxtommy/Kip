import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
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

  describe('auth mode detection (Unit 2)', () => {
    function seedConn(overrides: Record<string, unknown>): void {
      localStorage.setItem(
        'connectionConfig',
        JSON.stringify({
          configVersion: 12,
          kipUUID: 'u',
          signalKUrl: 'http://localhost',
          proxyEnabled: false,
          signalKSubscribeAll: false,
          useDeviceToken: false,
          loginName: '',
          useSharedConfig: true,
          sharedConfigName: 'default',
          ...overrides
        })
      );
    }

    it("returns 'cookie' when proxy mode is enabled (effective origin is the app)", () => {
      seedConn({ proxyEnabled: true, signalKUrl: 'https://elsewhere.example:9999' });
      expect(createService().authMode).toBe('cookie');
    });

    it("returns 'cookie' when the server URL is empty (defaults to the app origin)", () => {
      seedConn({ signalKUrl: '' });
      expect(createService().authMode).toBe('cookie');
    });

    it("returns 'cookie' when the server URL matches the app origin", () => {
      seedConn({ signalKUrl: window.location.origin });
      expect(createService().authMode).toBe('cookie');
    });

    it("returns 'token' for a cross-origin server URL", () => {
      seedConn({ signalKUrl: 'https://boat.example:3443' });
      expect(createService().authMode).toBe('token');
    });
  });

  describe('startup token suppression by mode (Unit 2)', () => {
    function seedConn(overrides: Record<string, unknown>): void {
      localStorage.setItem(
        'connectionConfig',
        JSON.stringify({
          configVersion: 12,
          kipUUID: 'u',
          signalKUrl: 'http://localhost',
          proxyEnabled: false,
          signalKSubscribeAll: false,
          useDeviceToken: false,
          loginName: '',
          useSharedConfig: true,
          sharedConfigName: 'default',
          ...overrides
        })
      );
    }

    it('ignores a stored user token in cookie mode (cookie/SSO is authoritative)', async () => {
      seedConn({ proxyEnabled: true });
      seedToken({ expiry: nowSec() + 3600, isDeviceAccessToken: false });
      const service = createService();
      expect(await firstValueFrom(service.authToken$)).toBeNull();
      expect(await firstValueFrom(service.isLoggedIn$)).toBe(false);
    });

    it('keeps a stored device token in cookie mode (unattended fallback, not stranded)', async () => {
      seedConn({ proxyEnabled: true });
      seedToken({ expiry: nowSec() + 3600, isDeviceAccessToken: true });
      const service = createService();
      expect(await firstValueFrom(service.authToken$)).not.toBeNull();
    });

    it('keeps a stored user token in token mode (cross-origin)', async () => {
      seedConn({ signalKUrl: 'https://boat.example:3443' });
      seedToken({ expiry: nowSec() + 3600, isDeviceAccessToken: false });
      const service = createService();
      expect(await firstValueFrom(service.authToken$)).not.toBeNull();
      expect(await firstValueFrom(service.isLoggedIn$)).toBe(true);
    });
  });

  describe('loginStatus session state (Unit 3)', () => {
    function seedConn(overrides: Record<string, unknown>): void {
      localStorage.setItem(
        'connectionConfig',
        JSON.stringify({
          configVersion: 12,
          kipUUID: 'u',
          signalKUrl: '',
          proxyEnabled: true,
          signalKSubscribeAll: false,
          useDeviceToken: false,
          loginName: '',
          useSharedConfig: true,
          sharedConfigName: 'default',
          ...overrides
        })
      );
    }

    function expectLoginStatusRequest(httpTesting: HttpTestingController) {
      return httpTesting.expectOne(
        req => req.url.endsWith('/skServer/loginStatus') && !req.url.includes('/signalk/v1')
      );
    }

    it('logged-in writable session: isLoggedIn/isUserSession/canWriteUserData true, no token', async () => {
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const pending = service.refreshLoginStatus();
      const req = expectLoginStatusRequest(httpTesting);
      expect(req.request.method).toBe('GET');
      expect(req.request.withCredentials).toBe(true);
      req.flush({ status: 'loggedIn', readOnlyAccess: false, userLevel: 'admin' });
      await pending;

      expect(await firstValueFrom(service.isLoggedIn$)).toBe(true);
      expect(await firstValueFrom(service.isUserSession$)).toBe(true);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(true);
      expect(await firstValueFrom(service.authToken$)).toBeNull();
      httpTesting.verify();
    });

    it('logged-in read-only user (userLevel readonly): isUserSession true, canWriteUserData false', async () => {
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const pending = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush({ status: 'loggedIn', userLevel: 'readonly' });
      await pending;

      expect(await firstValueFrom(service.isLoggedIn$)).toBe(true);
      expect(await firstValueFrom(service.isUserSession$)).toBe(true);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(false);
      httpTesting.verify();
    });

    it('admin user stays write-capable even when the server allows anonymous read (readOnlyAccess true)', async () => {
      // readOnlyAccess is the server allow_readonly flag, NOT the user's permission. A signed-in
      // admin (userLevel admin) must remain write-capable regardless of it.
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const pending = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush({ status: 'loggedIn', userLevel: 'admin', readOnlyAccess: true });
      await pending;

      expect(await firstValueFrom(service.canWriteUserData$)).toBe(true);
      httpTesting.verify();
    });

    it('logged-in readwrite user: canWriteUserData true', async () => {
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const pending = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush({ status: 'loggedIn', userLevel: 'readwrite' });
      await pending;

      expect(await firstValueFrom(service.canWriteUserData$)).toBe(true);
      httpTesting.verify();
    });

    it('logged-in with no userLevel: isUserSession true but canWriteUserData false (fail closed)', async () => {
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const pending = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush({ status: 'loggedIn' });
      await pending;

      expect(await firstValueFrom(service.isUserSession$)).toBe(true);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(false);
      httpTesting.verify();
    });

    it('fails closed when loginStatus does not respond within the timeout', async () => {
      vi.useFakeTimers();
      try {
        seedConn({ proxyEnabled: true });
        const service = createService();
        const httpTesting = TestBed.inject(HttpTestingController);

        const pending = service.refreshLoginStatus();
        expectLoginStatusRequest(httpTesting); // request opened, never flushed
        await vi.advanceTimersByTimeAsync(5001);
        const result = await pending;

        expect(result).toBeNull();
        expect(await firstValueFrom(service.isLoggedIn$)).toBe(false);
        httpTesting.verify();
      } finally {
        vi.useRealTimers();
      }
    });

    it('not-logged-in: all session flags false; OIDC descriptors captured', async () => {
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const pending = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush({
        status: 'notLoggedIn',
        authenticationRequired: true,
        oidcEnabled: true,
        oidcAutoLogin: true,
        oidcLoginUrl: '/signalk/v1/auth/oidc/login',
        oidcProviderName: 'HaLOS SSO'
      });
      await pending;

      expect(await firstValueFrom(service.isLoggedIn$)).toBe(false);
      expect(await firstValueFrom(service.isUserSession$)).toBe(false);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(false);
      const status = await firstValueFrom(service.loginStatus$);
      expect(status?.authenticationRequired).toBe(true);
      expect(status?.oidcEnabled).toBe(true);
      expect(status?.oidcAutoLogin).toBe(true);
      expect(status?.oidcLoginUrl).toBe('/signalk/v1/auth/oidc/login');
      httpTesting.verify();
    });

    it('unreachable server: fails closed (not logged in), returns null, no throw', async () => {
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const pending = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush('down', { status: 503, statusText: 'Service Unavailable' });
      const result = await pending;

      expect(result).toBeNull();
      expect(await firstValueFrom(service.isLoggedIn$)).toBe(false);
      expect(await firstValueFrom(service.isUserSession$)).toBe(false);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(false);
      httpTesting.verify();
    });

    it('unexpected response shape: not logged in, no throw', async () => {
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const pending = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush({ unexpected: 'shape' });
      await pending;

      expect(await firstValueFrom(service.isLoggedIn$)).toBe(false);
      expect(await firstValueFrom(service.isUserSession$)).toBe(false);
      httpTesting.verify();
    });

    it('non-object 200 body (e.g. an HTML login page): not logged in, no throw', async () => {
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const pending = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush('<!doctype html><html>login</html>');
      const result = await pending;

      expect(result).toBeNull();
      expect(await firstValueFrom(service.isLoggedIn$)).toBe(false);
      expect(await firstValueFrom(service.isUserSession$)).toBe(false);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(false);
      httpTesting.verify();
    });

    it('mid-session transition: logged-in -> not-logged-in -> failure flips all signals false and clears descriptors', async () => {
      seedConn({ proxyEnabled: true });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      // 1. Logged in, OIDC descriptors present.
      const first = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush({
        status: 'loggedIn',
        userLevel: 'admin',
        oidcEnabled: true,
        oidcLoginUrl: '/signalk/v1/auth/oidc/login'
      });
      await first;
      expect(await firstValueFrom(service.isLoggedIn$)).toBe(true);
      expect(await firstValueFrom(service.isUserSession$)).toBe(true);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(true);
      expect((await firstValueFrom(service.loginStatus$))?.oidcLoginUrl).toBe('/signalk/v1/auth/oidc/login');

      // 2. Session ends server-side: re-check returns notLoggedIn; stale OIDC descriptor cleared.
      const second = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush({ status: 'notLoggedIn' });
      await second;
      expect(await firstValueFrom(service.isLoggedIn$)).toBe(false);
      expect(await firstValueFrom(service.isUserSession$)).toBe(false);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(false);
      expect((await firstValueFrom(service.loginStatus$))?.oidcLoginUrl).toBeUndefined();

      // 3. A later failure re-emits null status (fail-closed) on the already-used instance.
      const third = service.refreshLoginStatus();
      expectLoginStatusRequest(httpTesting).flush('down', { status: 503, statusText: 'Service Unavailable' });
      await third;
      expect(await firstValueFrom(service.isLoggedIn$)).toBe(false);
      expect(await firstValueFrom(service.loginStatus$)).toBeNull();
      httpTesting.verify();
    });

    it('token mode does not query loginStatus', async () => {
      seedConn({ proxyEnabled: false, signalKUrl: 'https://boat.example:3443' });
      const service = createService();
      const httpTesting = TestBed.inject(HttpTestingController);

      const result = await service.refreshLoginStatus();

      expect(result).toBeNull();
      httpTesting.verify(); // asserts no loginStatus request was issued
    });

    it('token-mode user token yields a user session via the derived signals', async () => {
      seedConn({ proxyEnabled: false, signalKUrl: 'https://boat.example:3443' });
      seedToken({ expiry: nowSec() + 3600, isDeviceAccessToken: false });
      const service = createService();

      expect(await firstValueFrom(service.isUserSession$)).toBe(true);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(true);
    });

    it('token-mode device token is not a user session', async () => {
      seedConn({ proxyEnabled: false, signalKUrl: 'https://boat.example:3443' });
      seedToken({ expiry: nowSec() + 3600, isDeviceAccessToken: true });
      const service = createService();

      expect(await firstValueFrom(service.isUserSession$)).toBe(false);
      expect(await firstValueFrom(service.canWriteUserData$)).toBe(false);
    });
  });
});
