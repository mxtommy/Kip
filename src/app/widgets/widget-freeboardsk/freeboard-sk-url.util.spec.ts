import { describe, expect, it } from 'vitest';
import { buildFreeboardSkUrl } from './freeboard-sk-url.util';

describe('buildFreeboardSkUrl', () => {
  it('cookie mode: uses the served origin and no token, ignoring a cross-origin server URL and any token', () => {
    expect(
      buildFreeboardSkUrl({
        cookieMode: true,
        appOrigin: 'https://boat.hal:4430',
        serverUrl: 'https://elsewhere.example:9999',
        token: 'should-not-appear'
      })
    ).toBe('https://boat.hal:4430/@signalk/freeboard-sk/');
  });

  it('token mode with a token: uses the server URL and appends ?token=', () => {
    expect(
      buildFreeboardSkUrl({
        cookieMode: false,
        appOrigin: 'https://app.example',
        serverUrl: 'https://boat.example:3000',
        token: 'abc123'
      })
    ).toBe('https://boat.example:3000/@signalk/freeboard-sk/?token=abc123');
  });

  it('token mode without a token: uses the server URL and no token param', () => {
    expect(
      buildFreeboardSkUrl({
        cookieMode: false,
        appOrigin: 'https://app.example',
        serverUrl: 'https://boat.example:3000',
        token: null
      })
    ).toBe('https://boat.example:3000/@signalk/freeboard-sk/');
  });
});
