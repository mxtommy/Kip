import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SsoRedirectService } from './sso-redirect.service';
import { AuthenticationService, ILoginStatus } from './authentication.service';
import { ensureLocalStorage, ensureSessionStorage } from '../../../test-helpers/local-storage.test-helper';

class AuthStub {
  loginStatusValue: ILoginStatus | null = null;
}

const OIDC_STATUS: ILoginStatus = {
  status: 'notLoggedIn',
  authenticationRequired: true,
  oidcEnabled: true,
  oidcAutoLogin: true,
  oidcLoginUrl: '/signalk/v1/auth/oidc/login'
};

function setup(authStub: AuthStub = new AuthStub()) {
  ensureLocalStorage();
  ensureSessionStorage();
  TestBed.configureTestingModule({
    providers: [SsoRedirectService, { provide: AuthenticationService, useValue: authStub }]
  });
  const service = TestBed.inject(SsoRedirectService);
  const navSpy = vi
    .spyOn(service as unknown as { navigate: (u: string) => void }, 'navigate')
    .mockImplementation(() => undefined);
  return { service, navSpy, authStub };
}

describe('SsoRedirectService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('redirects to the OIDC login and records one budget attempt', () => {
    const { service, navSpy } = setup();

    expect(service.attemptAutoRedirect(OIDC_STATUS)).toBe('redirected');

    expect(navSpy).toHaveBeenCalledTimes(1);
    expect(navSpy.mock.calls[0][0]).toContain('/signalk/v1/auth/oidc/login');
    expect(service.attempts()).toBe(1);
  });

  it('stops redirecting once the budget is exhausted (kiosk auto-login loop guard)', () => {
    const { service, navSpy } = setup();

    expect(service.attemptAutoRedirect(OIDC_STATUS)).toBe('redirected');
    expect(service.attemptAutoRedirect(OIDC_STATUS)).toBe('redirected');
    expect(service.attemptAutoRedirect(OIDC_STATUS)).toBe('redirected');
    navSpy.mockClear();

    expect(service.attemptAutoRedirect(OIDC_STATUS)).toBe('budget-exhausted');
    expect(navSpy).not.toHaveBeenCalled();
  });

  it('resetBudget clears the attempt count', () => {
    const { service } = setup();
    service.attemptAutoRedirect(OIDC_STATUS);
    expect(service.attempts()).toBe(1);

    service.resetBudget();

    expect(service.attempts()).toBe(0);
    expect(service.isBudgetExhausted()).toBe(false);
  });

  it('manualSignIn resets the budget and disables auto-login', () => {
    const authStub = new AuthStub();
    authStub.loginStatusValue = OIDC_STATUS;
    const { service, navSpy } = setup(authStub);
    service.attemptAutoRedirect(OIDC_STATUS);
    service.attemptAutoRedirect(OIDC_STATUS);
    navSpy.mockClear();

    service.manualSignIn();

    expect(service.attempts()).toBe(0);
    expect(navSpy).toHaveBeenCalledTimes(1);
    expect(navSpy.mock.calls[0][0]).toContain('/signalk/v1/auth/oidc/login');
    expect(navSpy.mock.calls[0][0]).toContain('noAutoLogin=true');
  });

  it('falls back to the admin login when OIDC is not enabled', () => {
    const { service, navSpy } = setup();

    service.attemptAutoRedirect({ status: 'notLoggedIn', authenticationRequired: true, oidcEnabled: false });

    expect(navSpy.mock.calls[0][0]).toContain('/admin/#/login');
  });

  it('fails closed (does not auto-redirect) when sessionStorage is unavailable', () => {
    const { service, navSpy } = setup();
    const original = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get() { throw new Error('storage blocked'); }
    });

    try {
      expect(service.attemptAutoRedirect(OIDC_STATUS)).toBe('budget-exhausted');
      expect(navSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, value: original });
    }
  });

  it('fails closed when sessionStorage silently discards writes (probe read-back mismatch)', () => {
    const { service, navSpy } = setup();
    const original = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: { setItem() { /* accepted but discarded */ }, getItem() { return null; }, removeItem() { /* noop */ } }
    });

    try {
      expect(service.attemptAutoRedirect(OIDC_STATUS)).toBe('budget-exhausted');
      expect(navSpy).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, value: original });
    }
  });
});
