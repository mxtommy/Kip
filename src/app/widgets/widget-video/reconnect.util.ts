export interface IBackoffOptions {
  /** Delay before the first retry. */
  baseMs: number;
  /** Maximum delay (the exponential growth is capped here). */
  maxMs: number;
  /** Exponential growth factor between attempts. */
  factor: number;
  /** Jitter as a fraction of the delay (±), spreading retries to avoid thundering herds. */
  jitterRatio: number;
  /** Give up after this many attempts. */
  maxAttempts: number;
}

export const DEFAULT_BACKOFF: IBackoffOptions = {
  baseMs: 1000,
  maxMs: 30000,
  factor: 2,
  jitterRatio: 0.3,
  maxAttempts: 6
};

/** Whether another reconnect should be attempted for the given 1-based attempt number. */
export function shouldReconnect(attempt: number, opts: IBackoffOptions): boolean {
  void attempt;
  void opts;
  // RED stub.
  return false;
}

/** Exponential backoff delay (no jitter) for a 1-based attempt, capped at maxMs. */
export function backoffDelayMs(attempt: number, opts: IBackoffOptions): number {
  void attempt;
  void opts;
  // RED stub.
  return 0;
}

/** Applies ±jitterRatio jitter to a delay using an injected random (0..1) for testability. */
export function applyJitter(delayMs: number, jitterRatio: number, random: () => number): number {
  void delayMs;
  void jitterRatio;
  void random;
  // RED stub.
  return 0;
}
