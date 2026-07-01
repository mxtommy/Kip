import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CanvasService } from './canvas.service';

describe('CanvasService', () => {
  let service: CanvasService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CanvasService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('memoizes calculateOptimalFontSize and skips the measureText search on repeat calls', () => {
    let measureCalls = 0;
    const ctx = {
      font: '',
      measureText(text: string): TextMetrics {
        measureCalls++;
        const px = parseInt((this as { font: string }).font, 10) || 10;
        return { width: text.length * px * 0.5 } as TextMetrics;
      }
    } as unknown as CanvasRenderingContext2D;

    const first = service.calculateOptimalFontSize(ctx, '12.3', 100, 40, 'normal');
    const callsAfterFirst = measureCalls;
    expect(callsAfterFirst).toBeGreaterThan(0); // binary search ran the first time

    const second = service.calculateOptimalFontSize(ctx, '12.3', 100, 40, 'normal');
    expect(second).toBe(first);                 // identical result
    expect(measureCalls).toBe(callsAfterFirst); // cache hit: no extra measureText calls

    // A different geometry/text is a cache miss and runs the search again.
    service.calculateOptimalFontSize(ctx, '12.3', 120, 40, 'normal');
    expect(measureCalls).toBeGreaterThan(callsAfterFirst);
  });
});

/**
 * The shared ResizeObserver used to reallocate every canvas's backing store and
 * redraw it synchronously in one callback — a single long task on a fullscreen/
 * grid-relayout storm that blocks input (incl. the exit-fullscreen gesture).
 * These pin the two mitigations: skip the realloc when the size is unchanged,
 * and time-slice the batch across animation frames.
 */
describe('CanvasService resize handling (freeze-audit)', () => {
  let service: CanvasService;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CanvasService);
    service.scaleFactor = 1;
  });

  function fakeCanvas() {
    const c: { style: Record<string, string>; getContext: () => null; _w: number; _h: number; writes: number; width: number; height: number } =
      { style: {}, getContext: () => null, _w: 0, _h: 0, writes: 0 } as never;
    Object.defineProperty(c, 'width', { get() { return c._w; }, set(v: number) { c._w = v; c.writes++; } });
    Object.defineProperty(c, 'height', { get() { return c._h; }, set(v: number) { c._h = v; } });
    return c;
  }

  it('setHighDPISize skips the backing-store realloc when the device-pixel size is unchanged', () => {
    const c = fakeCanvas();
    const rect = { width: 100, height: 80 } as DOMRectReadOnly;
    service.setHighDPISize(c as unknown as HTMLCanvasElement, rect);
    expect(c.writes).toBe(1);
    service.setHighDPISize(c as unknown as HTMLCanvasElement, rect);
    expect(c.writes).toBe(1); // unchanged size -> no second realloc
    service.setHighDPISize(c as unknown as HTMLCanvasElement, { width: 120, height: 80 } as DOMRectReadOnly);
    expect(c.writes).toBe(2); // genuine change still reallocates
  });

  it('flushResizes time-slices: it defers the remainder to the next frame when the budget is exceeded', () => {
    const a = fakeCanvas(), b = fakeCanvas();
    const internals = service as unknown as {
      pendingResize: Map<HTMLCanvasElement, DOMRectReadOnly>;
      flushResizes: () => void;
    };
    const rect = { width: 100, height: 80 } as DOMRectReadOnly;
    internals.pendingResize.set(a as unknown as HTMLCanvasElement, rect);
    internals.pendingResize.set(b as unknown as HTMLCanvasElement, rect);

    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1 as unknown as number);
    let t = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => (t += 100)); // each call jumps 100ms past the 8ms budget

    internals.flushResizes();

    expect(internals.pendingResize.size).toBe(1); // one processed, remainder deferred
    expect(rafSpy).toHaveBeenCalled();            // rescheduled to a later frame
    rafSpy.mockRestore();
    vi.restoreAllMocks();
  });
});
