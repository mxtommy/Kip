/** Quality-vs-latency preset. */
export type TVideoPreset = 'docking' | 'balanced' | 'best';

/** hls.js tuning derived from a preset. */
export interface IHlsTuning {
  lowLatencyMode: boolean;
  liveSyncDurationCount: number;
  maxLiveSyncPlaybackRate: number;
  backBufferLength: number;
  maxBufferLength: number;
}

/** Resolved tuning for a preset, applied across transports. */
export interface IPresetTuning {
  hls: IHlsTuning;
  /** Target WebRTC jitter buffer in milliseconds (0–4000; no-op on Safari). */
  jitterBufferTargetMs: number;
  /** Prefer the lowest-latency transport (WHEP) when more than one is available. */
  preferLowLatency: boolean;
  /** Short UI label and plain-language hint. */
  label: string;
  hint: string;
}

/** Maps a preset to concrete tuning. Unknown values fall back to 'balanced'. */
export function mapPreset(preset: TVideoPreset): IPresetTuning {
  void preset;
  // RED stub.
  return {
    hls: { lowLatencyMode: false, liveSyncDurationCount: 0, maxLiveSyncPlaybackRate: 0, backBufferLength: 0, maxBufferLength: 0 },
    jitterBufferTargetMs: 0,
    preferLowLatency: false,
    label: '',
    hint: ''
  };
}
