import { describe, it, expect } from 'vitest';
import { applyJitter, backoffDelayMs, shouldReconnect, DEFAULT_BACKOFF, type IBackoffOptions } from './reconnect.util';

const OPTS: IBackoffOptions = { baseMs: 1000, maxMs: 30000, factor: 2, jitterRatio: 0.3, maxAttempts: 6 };

describe('backoffDelayMs', () => {
  it('grows exponentially from the base delay', () => {
    expect(backoffDelayMs(1, OPTS)).toBe(1000);
    expect(backoffDelayMs(2, OPTS)).toBe(2000);
    expect(backoffDelayMs(3, OPTS)).toBe(4000);
    expect(backoffDelayMs(4, OPTS)).toBe(8000);
  });
  it('is capped at maxMs', () => {
    expect(backoffDelayMs(10, OPTS)).toBe(30000);
  });
});

describe('shouldReconnect', () => {
  it('retries up to maxAttempts then gives up', () => {
    expect(shouldReconnect(1, OPTS)).toBe(true);
    expect(shouldReconnect(6, OPTS)).toBe(true);
    expect(shouldReconnect(7, OPTS)).toBe(false);
  });
});

describe('applyJitter', () => {
  it('adds no jitter at the midpoint, and ±ratio at the extremes', () => {
    expect(applyJitter(1000, 0.3, () => 0.5)).toBe(1000);
    expect(applyJitter(1000, 0.3, () => 1)).toBe(1300);
    expect(applyJitter(1000, 0.3, () => 0)).toBe(700);
  });
  it('never returns a negative delay', () => {
    expect(applyJitter(100, 2, () => 0)).toBeGreaterThanOrEqual(0);
  });
});

describe('DEFAULT_BACKOFF', () => {
  it('is a sane policy', () => {
    expect(DEFAULT_BACKOFF.maxAttempts).toBeGreaterThan(0);
    expect(DEFAULT_BACKOFF.maxMs).toBeGreaterThanOrEqual(DEFAULT_BACKOFF.baseMs);
  });
});
