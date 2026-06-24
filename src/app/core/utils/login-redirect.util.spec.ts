import { describe, expect, it } from 'vitest';
import { isSafeReturnTo, buildLoginRedirectUrl } from './login-redirect.util';

describe('isSafeReturnTo', () => {
  it('accepts a site-relative path', () => {
    expect(isSafeReturnTo('/dashboard')).toBe(true);
    expect(isSafeReturnTo('/dashboard/2?foo=bar')).toBe(true);
  });

  it('rejects empty / non-string', () => {
    expect(isSafeReturnTo('')).toBe(false);
    expect(isSafeReturnTo(null)).toBe(false);
    expect(isSafeReturnTo(undefined)).toBe(false);
  });

  it('rejects protocol-relative and absolute URLs', () => {
    expect(isSafeReturnTo('//evil.example')).toBe(false);
    expect(isSafeReturnTo('https://evil.example/x')).toBe(false);
    expect(isSafeReturnTo('http://evil.example')).toBe(false);
  });

  it('rejects a backslash (browsers normalize it to /)', () => {
    expect(isSafeReturnTo('/\\evil.example')).toBe(false);
    expect(isSafeReturnTo('/\\/evil.example')).toBe(false);
  });

  it('rejects control characters', () => {
    expect(isSafeReturnTo('/path\x00')).toBe(false);
    expect(isSafeReturnTo('/path\nmore')).toBe(false);
    expect(isSafeReturnTo('/path\x7f')).toBe(false);
  });

  it('rejects a non-relative target (no leading slash)', () => {
    expect(isSafeReturnTo('dashboard')).toBe(false);
    expect(isSafeReturnTo('javascript:alert(1)')).toBe(false);
  });

  it('rejects the login self-route (avoids a redirect loop)', () => {
    expect(isSafeReturnTo('/login')).toBe(false);
  });
});

describe('buildLoginRedirectUrl', () => {
  it('appends a validated returnTo to a query-style (OIDC) login URL', () => {
    const url = buildLoginRedirectUrl({ loginUrl: '/signalk/v1/auth/oidc/login', returnTo: '/dashboard' });
    expect(url).toBe('/signalk/v1/auth/oidc/login?returnTo=%2Fdashboard');
  });

  it('drops an unsafe returnTo but still returns the login URL', () => {
    const url = buildLoginRedirectUrl({ loginUrl: '/signalk/v1/auth/oidc/login', returnTo: '//evil.example' });
    expect(url).toBe('/signalk/v1/auth/oidc/login');
  });

  it('adds noAutoLogin for a recovery (manual) sign-in', () => {
    const url = buildLoginRedirectUrl({ loginUrl: '/signalk/v1/auth/oidc/login', returnTo: '/x', noAutoLogin: true });
    expect(url).toBe('/signalk/v1/auth/oidc/login?returnTo=%2Fx&noAutoLogin=true');
  });

  it('places params in the hash fragment for an admin hash-route login URL', () => {
    const url = buildLoginRedirectUrl({ loginUrl: '/admin/#/login', noAutoLogin: true });
    expect(url).toBe('/admin/#/login?noAutoLogin=true');
  });

  it('returns the login URL unchanged when there are no params', () => {
    expect(buildLoginRedirectUrl({ loginUrl: '/signalk/v1/auth/oidc/login' })).toBe('/signalk/v1/auth/oidc/login');
  });
});
