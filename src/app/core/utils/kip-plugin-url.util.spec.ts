import { describe, it, expect } from 'vitest';
import {
  resolvePluginBaseUrl,
  snapImageWidth,
  stripToServerRoot,
  DEFAULT_IMAGE_WIDTH_ALLOWLIST
} from './kip-plugin-url.util';

describe('stripToServerRoot', () => {
  it('strips a /signalk[/vN[/api]] suffix from the path, leaving the origin', () => {
    expect(stripToServerRoot('http://host:3000/signalk/v1/api/')).toBe('http://host:3000');
    expect(stripToServerRoot('http://host:3000/signalk/v2/api')).toBe('http://host:3000');
    expect(stripToServerRoot('http://host:3000/signalk')).toBe('http://host:3000');
    expect(stripToServerRoot('http://host:3000')).toBe('http://host:3000');
    expect(stripToServerRoot('http://host:3000/')).toBe('http://host:3000');
  });

  it('does NOT eat a host that is literally named "signalk"', () => {
    expect(stripToServerRoot('http://signalk')).toBe('http://signalk');
    expect(stripToServerRoot('http://signalk/')).toBe('http://signalk');
    expect(stripToServerRoot('http://signalk/signalk/v1/api')).toBe('http://signalk');
  });

  it('preserves a reverse-proxy subpath', () => {
    expect(stripToServerRoot('https://boat.local/proxy/signalk/v1/api')).toBe('https://boat.local/proxy');
  });
});

describe('resolvePluginBaseUrl', () => {
  // The base must target the plugin's crew-reachable /signalk/v1/api mount, NOT the /plugins/<id>
  // alias — signalk-server admin-gates every /plugins/* route on a secured server, which would 401/403
  // ordinary crew (and the native <img> element, which carries no auth header) even for reads.
  it('prefers the configured URL and targets the v1 API mount', () => {
    expect(resolvePluginBaseUrl('http://x/signalk/v1/api/', 'https://boat.local:3443')).toBe(
      'https://boat.local:3443/signalk/v1/api/sk-image/'
    );
    expect(resolvePluginBaseUrl(null, 'https://boat.local/')).toBe(
      'https://boat.local/signalk/v1/api/sk-image/'
    );
  });

  it('does not double up when the configured URL already carries a /signalk suffix', () => {
    expect(resolvePluginBaseUrl(null, 'https://boat.local/signalk/')).toBe(
      'https://boat.local/signalk/v1/api/sk-image/'
    );
    expect(resolvePluginBaseUrl(null, 'https://boat.local/signalk/v1/api')).toBe(
      'https://boat.local/signalk/v1/api/sk-image/'
    );
  });

  it('derives the base from the v1/v2 API URL by stripping the signalk suffix', () => {
    expect(resolvePluginBaseUrl('http://host:3000/signalk/v1/api/')).toBe(
      'http://host:3000/signalk/v1/api/sk-image/'
    );
    expect(resolvePluginBaseUrl('http://host:3000/signalk/v2/api')).toBe(
      'http://host:3000/signalk/v1/api/sk-image/'
    );
    expect(resolvePluginBaseUrl('http://host:3000/signalk')).toBe(
      'http://host:3000/signalk/v1/api/sk-image/'
    );
  });

  it('honours a custom plugin id on the v1 API mount', () => {
    expect(resolvePluginBaseUrl('http://host:3000/signalk/v1/api/', null, 'some-plugin')).toBe(
      'http://host:3000/signalk/v1/api/some-plugin/'
    );
  });

  it('returns null when nothing is known', () => {
    expect(resolvePluginBaseUrl(null)).toBeNull();
    expect(resolvePluginBaseUrl(undefined, '')).toBeNull();
  });
});

describe('snapImageWidth', () => {
  const max = DEFAULT_IMAGE_WIDTH_ALLOWLIST[DEFAULT_IMAGE_WIDTH_ALLOWLIST.length - 1];

  it('snaps up to the nearest allow-listed width, accounting for DPR', () => {
    expect(snapImageWidth(100)).toBe(160);
    expect(snapImageWidth(320)).toBe(320);
    expect(snapImageWidth(330)).toBe(640);
    expect(snapImageWidth(320, 2)).toBe(640); // 320 css * 2 dpr = 640
  });

  it('uses the canonical max for unknown/zero/oversized widths', () => {
    expect(snapImageWidth(undefined)).toBe(max);
    expect(snapImageWidth(0)).toBe(max);
    expect(snapImageWidth(99999)).toBe(max);
  });

  it('snaps against a caller-supplied allow-list (the server-discovered one)', () => {
    expect(snapImageWidth(150, 1, [100, 200, 400])).toBe(200);
    expect(snapImageWidth(500, 1, [100, 200, 400])).toBe(400); // max of the custom list
    expect(snapImageWidth(50, 1, [100, 200, 400])).toBe(100);
  });
});
