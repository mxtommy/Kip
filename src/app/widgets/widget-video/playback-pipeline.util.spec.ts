import { describe, it, expect } from 'vitest';
import { detectTransportFromUrl, selectPlaybackPipeline, type IPlaybackCapabilities } from './playback-pipeline.util';

const CHROME: IPlaybackCapabilities = { hasMediaSource: true, hlsJsSupported: true, nativeHls: false };
const SAFARI: IPlaybackCapabilities = { hasMediaSource: true, hlsJsSupported: false, nativeHls: true };
const IPHONE: IPlaybackCapabilities = { hasMediaSource: false, hlsJsSupported: false, nativeHls: true };
const NEITHER: IPlaybackCapabilities = { hasMediaSource: false, hlsJsSupported: false, nativeHls: false };

describe('detectTransportFromUrl', () => {
  it('detects HLS from an .m3u8 URL (with or without query)', () => {
    expect(detectTransportFromUrl('https://cam/live/stream.m3u8')).toBe('hls');
    expect(detectTransportFromUrl('https://cam/live/stream.m3u8?token=abc')).toBe('hls');
  });
  it('treats everything else as a progressive file', () => {
    expect(detectTransportFromUrl('https://cam/clip.mp4')).toBe('file');
    expect(detectTransportFromUrl('https://cam/feed')).toBe('file');
  });
});

describe('selectPlaybackPipeline', () => {
  it('auto-detects HLS and prefers native HLS on Safari/iOS', () => {
    expect(selectPlaybackPipeline('auto', 'https://cam/s.m3u8', SAFARI)).toBe('hls-native');
    expect(selectPlaybackPipeline('auto', 'https://cam/s.m3u8', IPHONE)).toBe('hls-native');
  });

  it('auto-detects HLS and falls back to hls.js where there is no native HLS', () => {
    expect(selectPlaybackPipeline('auto', 'https://cam/s.m3u8', CHROME)).toBe('hls-hlsjs');
  });

  it('reports HLS as unsupported when neither native nor hls.js is available', () => {
    expect(selectPlaybackPipeline('auto', 'https://cam/s.m3u8', NEITHER)).toBe('unsupported');
  });

  it('auto-detects a progressive file', () => {
    expect(selectPlaybackPipeline('auto', 'https://cam/clip.mp4', CHROME)).toBe('file');
  });

  it('honours an explicit MJPEG or WebRTC transport regardless of URL', () => {
    expect(selectPlaybackPipeline('mjpeg', 'https://cam/stream', CHROME)).toBe('mjpeg');
    expect(selectPlaybackPipeline('webrtc', 'https://cam/whep', CHROME)).toBe('webrtc');
  });

  it('honours an explicit HLS transport and still branches on capabilities', () => {
    expect(selectPlaybackPipeline('hls', 'https://cam/no-extension', SAFARI)).toBe('hls-native');
    expect(selectPlaybackPipeline('hls', 'https://cam/no-extension', CHROME)).toBe('hls-hlsjs');
  });
});
