import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
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
