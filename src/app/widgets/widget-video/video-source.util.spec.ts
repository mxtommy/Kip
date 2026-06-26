import { describe, it, expect } from 'vitest';
import { resolveVideoSourceUrl } from './video-source.util';

const ORIGIN = 'https://boat.local';

describe('resolveVideoSourceUrl', () => {
  it('passes through an absolute http(s) URL', () => {
    expect(resolveVideoSourceUrl({ sourceKind: 'url', url: 'http://cam/video.mp4' }, ORIGIN))
      .toBe('http://cam/video.mp4');
    expect(resolveVideoSourceUrl({ sourceKind: 'url', url: 'https://cam/video.mp4' }, ORIGIN))
      .toBe('https://cam/video.mp4');
  });

  it('resolves a relative URL against the page origin', () => {
    expect(resolveVideoSourceUrl({ sourceKind: 'url', url: '/media/clip.mp4' }, ORIGIN))
      .toBe('https://boat.local/media/clip.mp4');
  });

  it('treats a missing sourceKind as a URL source when a url is present', () => {
    expect(resolveVideoSourceUrl({ url: 'https://cam/v.mp4' }, ORIGIN))
      .toBe('https://cam/v.mp4');
  });

  it('rejects dangerous or non-http(s) protocols', () => {
    expect(resolveVideoSourceUrl({ sourceKind: 'url', url: 'javascript:alert(1)' }, ORIGIN)).toBeNull();
    expect(resolveVideoSourceUrl({ sourceKind: 'url', url: 'data:video/mp4;base64,AAAA' }, ORIGIN)).toBeNull();
    expect(resolveVideoSourceUrl({ sourceKind: 'url', url: 'file:///etc/passwd' }, ORIGIN)).toBeNull();
  });

  it('returns null for empty, whitespace or missing urls', () => {
    expect(resolveVideoSourceUrl({ sourceKind: 'url', url: '' }, ORIGIN)).toBeNull();
    expect(resolveVideoSourceUrl({ sourceKind: 'url', url: '   ' }, ORIGIN)).toBeNull();
    expect(resolveVideoSourceUrl({ sourceKind: 'url', url: null }, ORIGIN)).toBeNull();
    expect(resolveVideoSourceUrl({ sourceKind: 'url' }, ORIGIN)).toBeNull();
  });

  it('returns null for source kinds that are not yet wired up', () => {
    expect(resolveVideoSourceUrl({ sourceKind: 'file', fileAssetId: 'abc' }, ORIGIN)).toBeNull();
    expect(resolveVideoSourceUrl({ sourceKind: 'manual', url: 'rtsp://cam/stream' }, ORIGIN)).toBeNull();
    expect(resolveVideoSourceUrl({ sourceKind: 'scan' }, ORIGIN)).toBeNull();
  });

  it('returns null for null/undefined config', () => {
    expect(resolveVideoSourceUrl(null, ORIGIN)).toBeNull();
    expect(resolveVideoSourceUrl(undefined, ORIGIN)).toBeNull();
  });
});
