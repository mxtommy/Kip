import { buildGatewayUrl, resolveGatewaySourceUrl } from './gateway-source.util';
import type { IVideoWidgetConfig } from '../../core/interfaces/widgets-interface';

const BASE = 'http://boat.local:3000/plugins/sk-video/';

describe('buildGatewayUrl', () => {
  it('builds the HLS playlist URL on the plugin proxy', () => {
    expect(buildGatewayUrl(BASE, 'foredeck', 'hls')).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/foredeck/stream.m3u8'
    );
  });

  it('builds the WHEP endpoint URL', () => {
    expect(buildGatewayUrl(BASE, 'foredeck', 'webrtc')).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/foredeck/whep'
    );
  });

  it('adds a trailing slash to a base that lacks one', () => {
    expect(buildGatewayUrl('http://h/plugins/sk-video', 'a-1', 'hls')).toBe(
      'http://h/plugins/sk-video/cameras/a-1/stream.m3u8'
    );
  });

  it('rejects a missing base or camera id', () => {
    expect(buildGatewayUrl(null, 'a', 'hls')).toBeNull();
    expect(buildGatewayUrl(BASE, null, 'hls')).toBeNull();
    expect(buildGatewayUrl(BASE, '', 'hls')).toBeNull();
  });

  it('rejects an unsafe camera id (path traversal / injection)', () => {
    expect(buildGatewayUrl(BASE, '../secret', 'hls')).toBeNull();
    expect(buildGatewayUrl(BASE, 'a/b', 'hls')).toBeNull();
    expect(buildGatewayUrl(BASE, 'a b', 'hls')).toBeNull();
  });

  it('rejects a non-http base URL', () => {
    expect(buildGatewayUrl('javascript:alert(1)', 'a', 'hls')).toBeNull();
    expect(buildGatewayUrl('not a url', 'a', 'hls')).toBeNull();
  });
});

describe('resolveGatewaySourceUrl', () => {
  const camera = (over: Partial<IVideoWidgetConfig> = {}): IVideoWidgetConfig => ({
    sourceKind: 'camera',
    cameraId: 'foredeck',
    ...over
  });

  it('returns the HLS URL by default for a camera source', () => {
    expect(resolveGatewaySourceUrl(camera(), BASE)).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/foredeck/stream.m3u8'
    );
  });

  it('returns the WHEP URL when the transport is webrtc', () => {
    expect(resolveGatewaySourceUrl(camera({ transport: 'webrtc' }), BASE)).toBe(
      'http://boat.local:3000/plugins/sk-video/cameras/foredeck/whep'
    );
  });

  it('returns null for non-camera source kinds', () => {
    expect(resolveGatewaySourceUrl({ sourceKind: 'url', url: 'http://x/a.mp4' }, BASE)).toBeNull();
    expect(resolveGatewaySourceUrl({ sourceKind: 'camera', cameraId: null }, BASE)).toBeNull();
  });

  it('returns null when the gateway base URL is unavailable', () => {
    expect(resolveGatewaySourceUrl(camera(), null)).toBeNull();
  });
});
