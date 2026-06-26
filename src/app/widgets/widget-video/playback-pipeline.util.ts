/** The concrete playback mechanism chosen for a source. */
export type TPlaybackPipeline = 'file' | 'hls-native' | 'hls-hlsjs' | 'mjpeg' | 'webrtc' | 'unsupported';

/** The transport configured for a source ('auto' detects from the URL). */
export type TVideoTransport = 'auto' | 'file' | 'hls' | 'mjpeg' | 'webrtc';

/** Browser playback capabilities, resolved once at runtime and passed into the pure selector. */
export interface IPlaybackCapabilities {
  /** `window.MediaSource` exists (false on iPhone Safari, which only has ManagedMediaSource). */
  hasMediaSource: boolean;
  /** `Hls.isSupported()` — hls.js (MSE-based) can run. */
  hlsJsSupported: boolean;
  /** Native HLS via `<video>` (`canPlayType('application/vnd.apple.mpegurl')`). */
  nativeHls: boolean;
}

/** Detects the transport from a URL when the configured transport is 'auto'. */
export function detectTransportFromUrl(url: string): 'hls' | 'file' {
  const path = url.split('?')[0].toLowerCase();
  return /\.m3u8$/.test(path) ? 'hls' : 'file';
}

/**
 * Chooses the concrete playback pipeline for a source, branching on browser capabilities.
 * HLS prefers the browser's native player (Safari/iOS) and falls back to hls.js elsewhere.
 */
export function selectPlaybackPipeline(
  transport: TVideoTransport,
  url: string,
  caps: IPlaybackCapabilities
): TPlaybackPipeline {
  const effective = transport === 'auto' ? detectTransportFromUrl(url) : transport;
  switch (effective) {
    case 'file':
      return 'file';
    case 'mjpeg':
      return 'mjpeg';
    case 'webrtc':
      return 'webrtc';
    case 'hls':
      if (caps.nativeHls) {
        return 'hls-native';
      }
      return caps.hlsJsSupported ? 'hls-hlsjs' : 'unsupported';
    default:
      return 'unsupported';
  }
}
