import type { IVideoWidgetConfig } from '../../core/interfaces/widgets-interface';

/** Transports the sk-video plugin proxy exposes for a saved camera. */
export type TGatewayTransport = 'hls' | 'webrtc';

/** Proxy path on the sk-video plugin for each transport, relative to the plugin base URL. */
const GATEWAY_PATHS: Record<TGatewayTransport, (id: string) => string> = {
  hls: (id) => `cameras/${id}/stream.m3u8`,
  webrtc: (id) => `cameras/${id}/whep`
};

/** Camera ids become part of a URL path, so they must be a plain safe slug. */
const CAMERA_ID = /^[A-Za-z0-9-]+$/;

/**
 * Builds the same-origin gateway URL for a saved camera and transport, or `null` when the inputs are
 * missing or unsafe. The browser only ever talks to the plugin proxy (never the camera or go2rtc
 * directly), so `baseUrl` must be the resolved sk-video plugin base (`http(s)`, ending in `/`).
 */
export function buildGatewayUrl(
  baseUrl: string | null | undefined,
  cameraId: string | null | undefined,
  transport: TGatewayTransport
): string | null {
  if (!baseUrl || !cameraId || !CAMERA_ID.test(cameraId)) {
    return null;
  }
  let base: URL;
  try {
    base = new URL(baseUrl);
  } catch {
    return null;
  }
  if (base.protocol !== 'http:' && base.protocol !== 'https:') {
    return null;
  }
  // Resolve relative to the plugin directory; guarantee a trailing slash so the id isn't swallowed.
  const dir = base.href.endsWith('/') ? base.href : `${base.href}/`;
  return new URL(GATEWAY_PATHS[transport](cameraId), dir).href;
}

/**
 * Resolves the playable gateway URL for a `camera` source, or `null` for any other source kind or
 * when the camera/base URL is missing. A `webrtc` transport returns the WHEP endpoint; everything
 * else streams HLS (a fully same-origin-proxiable GET, playable on every engine).
 */
export function resolveGatewaySourceUrl(
  video: IVideoWidgetConfig | null | undefined,
  baseUrl: string | null | undefined
): string | null {
  if (!video || (video.sourceKind ?? 'url') !== 'camera') {
    return null;
  }
  const transport: TGatewayTransport = video.transport === 'webrtc' ? 'webrtc' : 'hls';
  return buildGatewayUrl(baseUrl, video.cameraId, transport);
}
