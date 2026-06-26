import { describe, it, expect } from 'vitest';
import { resolveSignalKPluginBaseUrl } from './signalk-plugin-url.util';

describe('resolveSignalKPluginBaseUrl', () => {
  const HTTP_V1 = 'http://host:3000/signalk/v1/api/';

  it('prefers the configured Signal K URL over the discovered endpoint', () => {
    expect(resolveSignalKPluginBaseUrl('sk-video', HTTP_V1, 'http://my.boat:3000'))
      .toBe('http://my.boat:3000/plugins/sk-video/');
  });

  it('strips a trailing slash from the configured URL', () => {
    expect(resolveSignalKPluginBaseUrl('sk-video', null, 'http://my.boat:3000/'))
      .toBe('http://my.boat:3000/plugins/sk-video/');
  });

  it('ignores a blank configured URL and falls back to the endpoint', () => {
    expect(resolveSignalKPluginBaseUrl('sk-video', HTTP_V1, '   '))
      .toBe('http://host:3000/plugins/sk-video/');
  });

  it('derives the root from a v1 api endpoint (with trailing slash)', () => {
    expect(resolveSignalKPluginBaseUrl('sk-video', 'http://host:3000/signalk/v1/api/'))
      .toBe('http://host:3000/plugins/sk-video/');
  });

  it('derives the root from a v2 api endpoint (no trailing slash)', () => {
    expect(resolveSignalKPluginBaseUrl('sk-video', 'http://host:3000/signalk/v2/api'))
      .toBe('http://host:3000/plugins/sk-video/');
  });

  it('derives the root from a bare /signalk endpoint', () => {
    expect(resolveSignalKPluginBaseUrl('sk-video', 'https://boat.local/signalk'))
      .toBe('https://boat.local/plugins/sk-video/');
  });

  it('returns null when neither URL is available', () => {
    expect(resolveSignalKPluginBaseUrl('sk-video', null)).toBeNull();
    expect(resolveSignalKPluginBaseUrl('sk-video', undefined, null)).toBeNull();
  });

  it('uses the supplied plugin id in the path', () => {
    expect(resolveSignalKPluginBaseUrl('kip', HTTP_V1))
      .toBe('http://host:3000/plugins/kip/');
  });

  it('rejects an invalid plugin id (no path injection or empty/uppercase/space)', () => {
    expect(resolveSignalKPluginBaseUrl('', HTTP_V1)).toBeNull();
    expect(resolveSignalKPluginBaseUrl('../evil', HTTP_V1)).toBeNull();
    expect(resolveSignalKPluginBaseUrl('sk video', HTTP_V1)).toBeNull();
    expect(resolveSignalKPluginBaseUrl('SK-Video', HTTP_V1)).toBeNull();
  });
});
