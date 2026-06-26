import { describe, it, expect } from 'vitest';
import { mapPreset } from './playback-presets.util';

describe('mapPreset', () => {
  it('docking minimises latency: low-latency HLS, small buffers, fast catch-up, low jitter target', () => {
    const t = mapPreset('docking');
    expect(t.hls.lowLatencyMode).toBe(true);
    expect(t.hls.maxLiveSyncPlaybackRate).toBeGreaterThan(1.4);
    expect(t.hls.backBufferLength).toBeLessThanOrEqual(5);
    expect(t.jitterBufferTargetMs).toBeLessThanOrEqual(150);
    expect(t.preferLowLatency).toBe(true);
  });

  it('balanced is the middle ground with a 3-segment live sync window', () => {
    const t = mapPreset('balanced');
    expect(t.hls.lowLatencyMode).toBe(true);
    expect(t.hls.liveSyncDurationCount).toBe(3);
    expect(t.jitterBufferTargetMs).toBeGreaterThan(150);
    expect(t.jitterBufferTargetMs).toBeLessThanOrEqual(500);
    expect(t.preferLowLatency).toBe(false);
  });

  it('best quality favours smoothness: no low-latency mode, larger buffers, large jitter target', () => {
    const t = mapPreset('best');
    expect(t.hls.lowLatencyMode).toBe(false);
    expect(t.hls.maxLiveSyncPlaybackRate).toBe(1);
    expect(t.hls.backBufferLength).toBeGreaterThanOrEqual(60);
    expect(t.jitterBufferTargetMs).toBeGreaterThanOrEqual(1000);
  });

  it('exposes a human label and hint for each preset', () => {
    for (const p of ['docking', 'balanced', 'best'] as const) {
      expect(mapPreset(p).label.length).toBeGreaterThan(0);
      expect(mapPreset(p).hint.length).toBeGreaterThan(0);
    }
  });
});
