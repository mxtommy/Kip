import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { uiEventService } from './uiEvent.service';

/**
 * Detects whether the app is running inside an iframe (e.g. Signal K app-dock, Freeboard).
 * When embedded, the host manages fullscreen, so KIP must defer to it (#1062).
 * Accessing `top` across origins throws a SecurityError, which itself means we are embedded.
 */
function isEmbeddedInIframe(win: { self: unknown; top: unknown } = window): boolean {
  try {
    return win.self !== win.top;
  } catch {
    // Reading window.top across origins throws a SecurityError -> we are embedded.
    return true;
  }
}

describe('GestureService', () => {
  let service: uiEventService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(uiEventService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

describe('isEmbeddedInIframe (#1062)', () => {
  it('returns false at the top level (self === top)', () => {
    const win = {} as { self: unknown; top: unknown };
    win.self = win;
    win.top = win;
    expect(isEmbeddedInIframe(win)).toBe(false);
  });

  it('returns true inside an iframe (self !== top)', () => {
    const top = { name: 'host' };
    const win = { self: null as unknown, top };
    win.self = win;
    expect(isEmbeddedInIframe(win)).toBe(true);
  });

  it('returns true when reading top throws (cross-origin host)', () => {
    const win = {
      get self() { return win; },
      get top(): unknown { throw new Error('SecurityError: cross-origin'); }
    };
    expect(isEmbeddedInIframe(win)).toBe(true);
  });
});
