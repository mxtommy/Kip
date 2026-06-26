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

const PRESETS: Record<TVideoPreset, IPresetTuning> = {
  docking: {
    hls: { lowLatencyMode: true, liveSyncDurationCount: 2, maxLiveSyncPlaybackRate: 2, backBufferLength: 0, maxBufferLength: 10 },
    jitterBufferTargetMs: 100,
    preferLowLatency: true,
    label: 'Docking',
    hint: 'Lowest delay — best for close-quarters manoeuvring.'
  },
  balanced: {
    hls: { lowLatencyMode: true, liveSyncDurationCount: 3, maxLiveSyncPlaybackRate: 1.2, backBufferLength: 30, maxBufferLength: 30 },
    jitterBufferTargetMs: 350,
    preferLowLatency: false,
    label: 'Balanced',
    hint: 'A low delay with steady playback.'
  },
  best: {
    hls: { lowLatencyMode: false, liveSyncDurationCount: 6, maxLiveSyncPlaybackRate: 1, backBufferLength: 90, maxBufferLength: 60 },
    jitterBufferTargetMs: 2000,
    preferLowLatency: false,
    label: 'Best quality',
    hint: 'Smoothest picture — more delay.'
  }
};

/** Maps a preset to concrete tuning. Unknown values fall back to 'balanced'. */
export function mapPreset(preset: TVideoPreset): IPresetTuning {
  return PRESETS[preset] ?? PRESETS.balanced;
}
