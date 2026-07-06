import { describe, it, expect } from 'vitest';
import {
  resolvePluginBaseUrl,
  snapImageWidth,
  DEFAULT_IMAGE_WIDTH_ALLOWLIST
} from './kip-plugin-url.util';

describe('resolvePluginBaseUrl', () => {
  it('prefers the configured URL', () => {
    expect(resolvePluginBaseUrl('http://x/signalk/v1/api/', 'https://boat.local:3443')).toBe(
      'https://boat.local:3443/plugins/sk-image/'
    );
    expect(resolvePluginBaseUrl(null, 'https://boat.local/')).toBe('https://boat.local/plugins/sk-image/');
  });

  it('derives the plugin base from the v1/v2 API URL by stripping the signalk suffix', () => {
    expect(resolvePluginBaseUrl('http://host:3000/signalk/v1/api/')).toBe('http://host:3000/plugins/sk-image/');
    expect(resolvePluginBaseUrl('http://host:3000/signalk/v2/api')).toBe('http://host:3000/plugins/sk-image/');
    expect(resolvePluginBaseUrl('http://host:3000/signalk')).toBe('http://host:3000/plugins/sk-image/');
  });

  it('honours a custom plugin id', () => {
    expect(resolvePluginBaseUrl('http://host:3000/signalk/v1/api/', null, 'kip')).toBe(
      'http://host:3000/plugins/kip/'
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
