import { describe, it, expect } from 'vitest';
import { evaluateFirstFrame } from './first-frame.util';

describe('evaluateFirstFrame', () => {
  it('is ok once a frame has painted (even after the timeout)', () => {
    expect(evaluateFirstFrame({ paintedFrame: true, hasData: true, timedOut: true })).toBe('ok');
    expect(evaluateFirstFrame({ paintedFrame: true, hasData: false, timedOut: false })).toBe('ok');
  });

  it('flags no-decode when the watchdog elapses with data but no painted frame', () => {
    expect(evaluateFirstFrame({ paintedFrame: false, hasData: true, timedOut: true })).toBe('no-decode');
  });

  it('stays pending before the timeout', () => {
    expect(evaluateFirstFrame({ paintedFrame: false, hasData: true, timedOut: false })).toBe('pending');
  });

  it('stays pending after the timeout when there is no data yet (still loading, not a codec issue)', () => {
    expect(evaluateFirstFrame({ paintedFrame: false, hasData: false, timedOut: true })).toBe('pending');
  });
});
