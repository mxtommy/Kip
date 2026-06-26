/** Inputs for judging whether a stream is decoding, gathered from the <video> element + a watchdog. */
export interface IFirstFrameState {
  /** A real frame has been presented (requestVideoFrameCallback fired, or decoded frames > 0). */
  paintedFrame: boolean;
  /** The element has usable media data (readyState >= HAVE_CURRENT_DATA = 2). */
  hasData: boolean;
  /** The first-frame watchdog timeout has elapsed. */
  timedOut: boolean;
}

export type TFirstFrameVerdict = 'ok' | 'no-decode' | 'pending';

/**
 * Judges the first-frame watchdog. A painted frame means playback is fine. If the watchdog elapses
 * while the element has data but has still painted nothing, the codec is most likely undecodable on
 * this device (e.g. HEVC without a hardware decoder) — surface a clear message rather than a black
 * frame. Otherwise we're still loading.
 */
export function evaluateFirstFrame(state: IFirstFrameState): TFirstFrameVerdict {
  void state;
  // RED stub.
  return 'pending';
}
