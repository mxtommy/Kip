/**
 * GestureDirective — design notes
 *
 * Lightweight, standalone gesture recognizer using the Pointer Events API.
 * This section documents the implementation and design goals for maintainers.
 *
 * - Runs pointer tracking outside Angular's zone for low-overhead move handling.
 * - Emits high-level gestures via typed DOM CustomEvents so templates and consumers
 *   can read strongly-typed payloads from `event.detail`.
 * - Focuses on single-pointer tracking for dashboard widgets (no multi-touch mix).
 * - Robust long-press cancellation and cleanup to avoid leaked handlers or pointer capture.
 *
 * Supported gestures (emitted events): swipeleft, swiperight, swipeup, swipedown, press, doubletap.
 */
import { Directive, DestroyRef, ElementRef, NgZone, inject, input, output } from '@angular/core';


// Cancel handler metadata used for long-press cancellation listeners.
type CancelTarget = 'el' | 'doc' | 'window';
interface CancelHandlerEntry {
  type: string;
  handler: EventListenerOrEventListenerObject;
  opts?: AddEventListenerOptions;
  targets?: CancelTarget[];
}

/**
 * Gesture recognizer (emitted events): swipeleft, swiperight, swipeup, swipedown,
 * press, doubletap.
 *
 * Notes for users:
 *  - The directive sets `touch-action: none` on the host element to reduce native
 *    browser gesture interference. If your layout relies on native scrolling, attach
 *    the directive to an overlay element instead.
 *  - All configuration properties are Angular signals (`input(...)`) and can be bound from templates.
 *
 * Optional Inputs to adjust recognition. Uses optimal setting per pointer type if not specified:
 *  - `swipeMinDistance` (number) - minimum primary-axis movement in pixels to consider a swipe. Default: 30.
 *  - `swipeMaxDuration` (number) - maximum duration in ms for a swipe. Default: 600.
 *  - `longPressMs` (number) - milliseconds required to trigger a long press. Default: 500.
 *  - `doubleTapInterval` (number) - maximum ms between taps to consider a double tap. Default: 300.
 *  - `tapSlop` (number) - movement tolerance in pixels for taps/double taps. Default: 20.
 *  - `pressMoveSlop` (number) - movement allowance in pixels while still considering a long press valid. Default: 10.
 *
 *
 * Usage:
 * @example
 *  <div
 *    kipGestures
 *    [longPressMs]="500"
 *    (press)="onPress($event)">
 *  </div>
 */
@Directive({ selector: '[kipGestures]' })
export class GestureDirective {
  // Service-level Chrome/macOS detection
  private readonly isChromeOnMac: boolean;
  // Firefox detection (used to suppress ghost click after long-press)
  private readonly isFirefox: boolean;
  // Debug flag: set to true to enable gesture debug logging
  private static readonly DEBUG = false;
  // Static counter for instance IDs (debugging)
  private static _instanceCounter = 0;
  private readonly _instanceId: number;

  // Config inputs (can be overridden via property binding)
  // Default values for touch; will be dynamically adjusted per pointer type
  /** Minimum primary-axis distance (px) required to consider a gesture a swipe. */
  swipeMinDistance = input(30);
  /** Maximum duration (ms) for a swipe gesture to be valid. */
  swipeMaxDuration = input(600);
  /** Long-press duration (ms) threshold. */
  longPressMs = input(500);
  /** Maximum ms between taps to consider a double-tap. */
  doubleTapInterval = input(300);
  /** Movement tolerance (px) for taps/double taps. */
  tapSlop = input(20);
  /** Movement allowance (px) while still considering a long press valid. */
  pressMoveSlop = input(10);

  // Dynamically adjusted gesture thresholds (set on pointerdown)
  private _swipeMinDistance = 30;
  private _swipeMaxDuration = 600;
  private _longPressMs = 500;
  private _doubleTapInterval = 300;
  private _tapSlop = 20;
  private _pressMoveSlop = 10;

  // Outputs (signal-based)
  /** Emitted when a leftward horizontal swipe is detected. Event.detail contains { dx, dy, duration }. */
  swipeleft = output<CustomEvent<{ dx: number; dy: number; duration: number }>>();
  /** Emitted when a rightward horizontal swipe is detected. Event.detail contains { dx, dy, duration }. */
  swiperight = output<CustomEvent<{ dx: number; dy: number; duration: number }>>();
  /** Emitted when an upward vertical swipe is detected. Event.detail contains { dx, dy, duration }. */
  swipeup = output<CustomEvent<{ dx: number; dy: number; duration: number }>>();
  /** Emitted when a downward vertical swipe is detected. Event.detail contains { dx, dy, duration }. */
  swipedown = output<CustomEvent<{ dx: number; dy: number; duration: number }>>();
  /** Emitted for a long press. Event.detail contains { x, y, center }. */
  press = output<CustomEvent<{ x: number; y: number; center?: { x: number; y: number } }>>();
  /** Emitted on a double-tap. Event.detail contains { x, y, dt }. */
  doubletap = output<CustomEvent<{ x: number; y: number; dt: number }>>();

  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private tracking = false;
  private longPressTimer: number | null = null;
  private pressFired = false;

  private cancelLongpressHandlers: CancelHandlerEntry[] = [];

  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private currentPointerType: string | null = null;
  private lastTapUpTime = 0; // time of last pointerup treated as tap
  private lastTapUpX = 0;
  private lastTapUpY = 0;
  private potentialDoubleTap = false; // set on pointerdown if within interval+slop of last tap up
  // Prevent native context menu which can abort pointer sequences in Chrome
  private onContextMenu = (ev: Event) => { ev.preventDefault(); };
  // Axis lock for more forgiving swipe recognition
  private lockedAxis: 'x' | 'y' | null = null;
  private readonly axisLockThreshold = 6; // px of movement before locking axis


  constructor() {
    // is running in Chrome on macOS?
    this.isChromeOnMac = (() => {
      const ua = navigator.userAgent;
      const platform = navigator.platform;
      // Chrome on Mac: userAgent includes 'Chrome' and 'Macintosh', platform includes 'Mac'
      return /Chrome\//.test(ua) && /Mac/.test(platform) && !/Edg\//.test(ua) && !/OPR\//.test(ua);
    })();
    // detect Firefox to handle post-long-press synthetic click
    this.isFirefox = /Firefox\//.test(navigator.userAgent);

    this._instanceId = ++GestureDirective._instanceCounter;
    this.debug('GestureDirective instance created', { instanceId: this._instanceId });
    this.zone.runOutsideAngular(() => {
      const el = this.host.nativeElement;
      // Disable native touch panning so vertical swipes register as pointer events (iOS Safari)
      if (!el.style.touchAction) {
        el.style.touchAction = 'none';
        // Fallback legacy property for older Safari versions
        if ('webkitTouchCallout' in el.style) {
          // vendor prefixed property safeguard
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (el.style as any).webkitTouchCallout = 'none';
        }
      }
      // pointerdown passive:false so we can preventDefault on iOS if needed to stop native behavior
      el.addEventListener('pointerdown', this.onPointerDown, { passive: false });
      el.addEventListener('pointermove', this.onPointerMove, { passive: true });
      // raw updates provide higher-fidelity movement in Chrome
      el.addEventListener('pointerrawupdate', this.onPointerRawUpdate as EventListener, { passive: true } as AddEventListenerOptions);
      el.addEventListener('pointerup', this.onPointerUp, { passive: true });
      el.addEventListener('pointercancel', this.onPointerCancel, { passive: true });
      el.addEventListener('lostpointercapture', this.onPointerCancel, { passive: true });
      // Native mouse dblclick fallback (improves reliability after drag interactions)
      el.addEventListener('dblclick', this.onNativeDblClick, { passive: true });
      // Block context menu to avoid Chrome aborting pointer sequences
      el.addEventListener('contextmenu', this.onContextMenu, { passive: false });

      this.destroyRef.onDestroy(() => {
        el.removeEventListener('pointerdown', this.onPointerDown);
        el.removeEventListener('pointermove', this.onPointerMove);
        el.removeEventListener('pointerrawupdate', this.onPointerRawUpdate as EventListener);
        el.removeEventListener('pointerup', this.onPointerUp);
        el.removeEventListener('pointercancel', this.onPointerCancel);
        el.removeEventListener('lostpointercapture', this.onPointerCancel);
        el.removeEventListener('dblclick', this.onNativeDblClick);
        el.removeEventListener('contextmenu', this.onContextMenu);
        if (this.longPressTimer) {
          window.clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }

        // Ensure any ad-hoc cancel listeners attached to document/element are removed
        this.removeLongpressCancelListeners();

        // Release pointer capture if it was set
        try {
          if (this.pointerId !== null && typeof el.releasePointerCapture === 'function') {
            el.releasePointerCapture(this.pointerId);
          }
        } catch {
          /* ignore release errors */
        }
        this.pointerId = null;
        this.tracking = false;
      });
    });
  }

  private onNativeDblClick = (ev: MouseEvent) => {
    // Emit a synthetic doubletap (mouse scenario) unless a touch doubletap already emitted recently
    const evt = new CustomEvent('doubletap', { detail: { x: ev.clientX, y: ev.clientY, dt: 0 } });
    this.zone.run(() => this.doubletap.emit(evt));
    this.lastTapTime = 0; // reset sequence to avoid immediate re-trigger from pointer logic
  };

  private onPointerDown = (ev: PointerEvent) => {
    this.debug('pointerdown', {
      x: ev.clientX,
      y: ev.clientY,
      pointerId: ev.pointerId,
      pointerType: ev.pointerType,
      sourceElement: ev.target instanceof Element ? ev.target.outerHTML : String(ev.target)
    });
    if (this.pointerId !== null) return; // single pointer only
    this.pointerId = ev.pointerId;
    this.tracking = true;
    this.pressFired = false;
    this.currentPointerType = ev.pointerType || null;
    this.lockedAxis = null;

    // Dynamically adjust gesture thresholds based on pointer type
    switch (ev.pointerType) {
      case 'touch':
        // Chrome on macOS can coalesce moves and fire pointercancel more often;
        // slightly relax thresholds to improve detection without causing false positives
        this._swipeMinDistance = this.isChromeOnMac ? Math.min(25, this.swipeMinDistance()) : this.swipeMinDistance();
        this._swipeMaxDuration = this.isChromeOnMac ? Math.max(850, this.swipeMaxDuration()) : this.swipeMaxDuration();
        this._longPressMs = this.longPressMs();           // 500ms
        this._doubleTapInterval = this.doubleTapInterval(); // 300ms
        this._tapSlop = this.tapSlop();                   // 20px
        this._pressMoveSlop = this.pressMoveSlop();       // 10px
        break;
      case 'pen':
        this._swipeMinDistance = 20;
        this._swipeMaxDuration = 500;
        this._longPressMs = 400;
        this._doubleTapInterval = 250;
        this._tapSlop = 10;
        this._pressMoveSlop = 8;
        break;
      case 'mouse':
      default:
        this._swipeMinDistance = 15;
        this._swipeMaxDuration = 400;
        this._longPressMs = 350;
        this._doubleTapInterval = 250;
        this._tapSlop = 8;
        this._pressMoveSlop = 6;
        break;
    }

    // Double tap logic
    const now = performance.now();
    const dtFromLastUp = now - this.lastTapUpTime;
    const distFromLastUp = Math.hypot(ev.clientX - this.lastTapUpX, ev.clientY - this.lastTapUpY);
    this.potentialDoubleTap = dtFromLastUp <= this._doubleTapInterval && distFromLastUp <= this._tapSlop;
    this.startX = ev.clientX;
    this.startY = ev.clientY;
    this.startTime = performance.now();
    try { (ev.target as HTMLElement).setPointerCapture(ev.pointerId); } catch { /* ignore */ }
    if (this.longPressTimer) {
      this.debug('longpress timer cleared on pointerdown');
      window.clearTimeout(this.longPressTimer);
    }
    if (!this.potentialDoubleTap) {
      // Add robust cancellation listeners
      this.addLongpressCancelListeners();
      this.debug('longpress timer scheduled');
      this.longPressTimer = window.setTimeout(() => {
        this.debug('longpress timer fired', { tracking: this.tracking });
        if (!this.tracking) {
          this.debug('longpress cancelled: not tracking');
          return;
        }
        const dx = ev.clientX - this.startX;
        const dy = ev.clientY - this.startY;
        if (Math.abs(dx) <= this._pressMoveSlop && Math.abs(dy) <= this._pressMoveSlop) {
          this.debug('longpress recognized', { x: this.startX, y: this.startY });
          // Firefox: suppress the synthetic click on pointerup that targets the newly opened dialog
          if (this.isFirefox) this.suppressNextClick(500);
          this.pressFired = true;
          const evt = new CustomEvent('press', { detail: { x: this.startX, y: this.startY, center: { x: this.startX, y: this.startY } } });
          this.zone.run(() => this.press.emit(evt));
        }
        this.removeLongpressCancelListeners();
      }, this._longPressMs);
    }
  };

  /**
   * Firefox can synthesize a click on pointerup and retarget it to the element under the pointer.
   * When a modal/dialog opens in response to long-press, suppress the next click/up so it doesn't
   * activate controls in the dialog. One-shot suppression with capture listeners.
   */
  private suppressNextClick(timeoutMs = 500) {
    this.debug('suppressNextClick (Firefox)', { timeoutMs });
    const opts: AddEventListenerOptions = { capture: true, passive: false };
    // include common mouse/touch/pointer click-related events
    const types = ['click', 'pointerup', 'mouseup', 'mousedown', 'auxclick', 'touchend', 'touchstart', 'contextmenu'];
    const cancel = (e: Event) => {
      this.debug('suppress ghost event', e.type);
      e.preventDefault();
      e.stopPropagation();
      const maybe = e as unknown as { stopImmediatePropagation?: () => void };
      if (typeof maybe.stopImmediatePropagation === 'function') maybe.stopImmediatePropagation();
      // do not teardown here; keep suppression active for the whole window to catch both pointerup and click
    };
    const teardown = () => {
      types.forEach(t => document.removeEventListener(t, cancel, opts));
      window.clearTimeout(timer);
    };
    types.forEach(t => document.addEventListener(t, cancel, opts));
    const timer = window.setTimeout(teardown, timeoutMs);
  }

  private onPointerMove = (ev: PointerEvent) => {
    //this.debug('pointermove', { x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId });
    if (!this.tracking || ev.pointerId !== this.pointerId) return;
    if (this.pressFired) return; // Suppress drag after longpress
    // Cancel longpress on the very first pointermove event, regardless of movement
    if (this.longPressTimer) {
      this.debug('longpress cancelled by pointermove');
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
      this.removeLongpressCancelListeners();
    }
    // Establish axis lock when movement exceeds a small threshold to better classify swipes
    if (!this.lockedAxis) {
      const dx = ev.clientX - this.startX;
      const dy = ev.clientY - this.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx >= this.axisLockThreshold || absDy >= this.axisLockThreshold) {
        this.lockedAxis = absDx >= absDy ? 'x' : 'y';
        this.debug('axis locked', { axis: this.lockedAxis, dx, dy });
      }
    }
  };

  // Chrome sends pointerrawupdate for high-frequency movement; mirror pointermove logic for cancellation/axis lock
  private onPointerRawUpdate = (ev: PointerEvent) => {
    if (!this.tracking || ev.pointerId !== this.pointerId) return;
    if (this.pressFired) return;
    if (this.longPressTimer) {
      this.debug('longpress cancelled by pointerrawupdate');
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
      this.removeLongpressCancelListeners();
    }
    if (!this.lockedAxis) {
      const dx = ev.clientX - this.startX;
      const dy = ev.clientY - this.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx >= this.axisLockThreshold || absDy >= this.axisLockThreshold) {
        this.lockedAxis = absDx >= absDy ? 'x' : 'y';
        this.debug('axis locked (raw)', { axis: this.lockedAxis, dx, dy });
      }
    }
  };

  private onPointerUp = (ev: PointerEvent) => {
    this.debug('pointerup', { x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId });
    if (!this.tracking || ev.pointerId !== this.pointerId) return;
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    const dx = ev.clientX - this.startX;
    const dy = ev.clientY - this.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (this.longPressTimer) {
      this.debug('longpress cancelled by pointerup');
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
      this.removeLongpressCancelListeners();
    }

    // If longpress was recognized, reset on pointerup so the next gesture can start cleanly
    if (this.pressFired) {
      this.debug('pointerup after longpress: resetting gesture state');
      this.reset();
      return;
    }

    // Swipe detection
    if (duration <= this._swipeMaxDuration) {
      if (
        (this.lockedAxis === 'x' && absDx >= this._swipeMinDistance) ||
        (!this.lockedAxis && absDx >= this._swipeMinDistance && absDx >= absDy)
      ) {
        this.debug('swipe detected', { direction: dx > 0 ? 'right' : 'left', dx, dy, duration });
        this.zone.run(() => {
          if (dx > 0) {
            this.swiperight.emit(new CustomEvent('swiperight', { detail: { dx, dy, duration } }));
          } else {
            this.swipeleft.emit(new CustomEvent('swipeleft', { detail: { dx, dy, duration } }));
          }
        });
      } else if (
        (this.lockedAxis === 'y' && absDy >= this._swipeMinDistance) ||
        (!this.lockedAxis && absDy >= this._swipeMinDistance && absDy > absDx)
      ) {
        this.debug('swipe detected', { direction: dy > 0 ? 'down' : 'up', dx, dy, duration });
        this.zone.run(() => {
          if (dy > 0) {
            this.swipedown.emit(new CustomEvent('swipedown', { detail: { dx, dy, duration } }));
          } else {
            this.swipeup.emit(new CustomEvent('swipeup', { detail: { dx, dy, duration } }));
          }
        });
      }
    }
    // Double tap detection
    if (this.currentPointerType !== 'mouse' && absDx <= this._tapSlop && absDy <= this._tapSlop && duration < this._longPressMs) {
      const now = endTime;
      const dt = now - this.lastTapTime;
      const dist = Math.hypot(ev.clientX - this.lastTapX, ev.clientY - this.lastTapY);
      if (dt <= this._doubleTapInterval && dist <= this._tapSlop) {
        this.zone.run(() => this.doubletap.emit(new CustomEvent('doubletap', { detail: { x: ev.clientX, y: ev.clientY, dt } })));
        this.lastTapTime = 0;
        this.potentialDoubleTap = false; // completed
      } else {
        this.lastTapTime = now;
        this.lastTapX = ev.clientX;
        this.lastTapY = ev.clientY;
      }
    }

    // If it was a tap (not long press) record data for next pointerdown's potentialDoubleTap evaluation
    if (!this.pressFired && absDx <= this._tapSlop && absDy <= this._tapSlop && duration < this._longPressMs) {
      this.lastTapUpTime = endTime;
      this.lastTapUpX = ev.clientX;
      this.lastTapUpY = ev.clientY;
    } else {
      // Reset potential double tap tracking if gesture was swipe or press
      this.potentialDoubleTap = false;
    }

    this.reset();
  };

  private onPointerCancel = (ev: PointerEvent) => {
    const el = this.host.nativeElement;
    this.debug('pointercancel', {
      pointerId: ev.pointerId,
      pointerType: ev.pointerType,
      event: ev,
      documentActiveElement: document.activeElement,
      elementIsConnected: el.isConnected,
      elementVisibility: el.offsetParent !== null,
      hasPointerCapture: typeof el.hasPointerCapture === 'function' ? el.hasPointerCapture(ev.pointerId) : undefined,
      documentHidden: document.hidden
    });
    // Always handle pointercancel: clear timers and reset to avoid stuck states (esp. Chrome)
    if (ev.pointerId === this.pointerId) {
      if (this.longPressTimer) {
        this.debug('longpress cancelled by pointercancel');
        window.clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
        this.removeLongpressCancelListeners();
      }
      this.reset();
    }
  };

  private addLongpressCancelListeners() {
    this.debug('addLongpressCancelListeners');
    // Cancel longpress on pointermove, pointerleave, pointerout, lostpointercapture, blur
    const cancel = (ev?: Event) => {
      this.debug('longpress cancelled by event', ev?.type);
      if (this.longPressTimer) {
        window.clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
      }
      this.removeLongpressCancelListeners();
    };
    const el = this.host.nativeElement;
    const doc = document;
    const captureOpts: AddEventListenerOptions = { capture: true };
    // store targets explicitly so removal can be precise
    // handlers added to element and document
    this.cancelLongpressHandlers = [
      { type: 'pointermove', handler: cancel, opts: captureOpts, targets: ['el', 'doc'] },
      { type: 'pointerleave', handler: cancel, opts: captureOpts, targets: ['el', 'doc'] },
      { type: 'pointerout', handler: cancel, opts: captureOpts, targets: ['el', 'doc'] },
      { type: 'lostpointercapture', handler: cancel, opts: captureOpts, targets: ['el', 'doc'] },
      // blur should be attached to window for cross-browser coverage
      { type: 'blur', handler: cancel, opts: captureOpts, targets: ['window'] },
    ];
    for (const entry of this.cancelLongpressHandlers) {
      const { type, handler, opts, targets } = entry as CancelHandlerEntry;
      if (targets && targets.includes('el')) el.addEventListener(type, handler, opts as AddEventListenerOptions);
      if (targets && targets.includes('doc')) doc.addEventListener(type, handler, opts as AddEventListenerOptions);
      if (targets && targets.includes('window')) window.addEventListener(type, handler, opts as AddEventListenerOptions);
    }
  }

  private removeLongpressCancelListeners() {
    this.debug('removeLongpressCancelListeners');
    const el = this.host.nativeElement;
    const doc = document;
    for (const entry of this.cancelLongpressHandlers) {
      const { type, handler, opts, targets } = entry as CancelHandlerEntry;
      if (targets && targets.includes('el')) el.removeEventListener(type, handler, opts as AddEventListenerOptions);
      if (targets && targets.includes('doc')) doc.removeEventListener(type, handler, opts as AddEventListenerOptions);
      if (targets && targets.includes('window')) window.removeEventListener(type, handler, opts as AddEventListenerOptions);
    }
    this.cancelLongpressHandlers = [];
  }

  private reset() {
    this.debug('reset gesture state');
    // Release pointer capture if still held before clearing pointerId
    try {
      const el = this.host.nativeElement;
      if (this.pointerId !== null && typeof el.releasePointerCapture === 'function') {
        el.releasePointerCapture(this.pointerId);
      }
    } catch {
      /* ignore release errors */
    }

    this.pointerId = null;
    this.tracking = false;
    this.pressFired = false;
    this.currentPointerType = null;
    this.lockedAxis = null;
    this.removeLongpressCancelListeners();
    // Do not reset potentialDoubleTap here; it is cleared on pointerup logic or after completion
    // Do not call removeSuppression() here – we only clear suppression on real pointer up/cancel
  }

  private debug(...args: unknown[]) {
    if ((this.constructor as typeof GestureDirective).DEBUG) {
      console.debug(`[GestureDirective][#${this._instanceId}]`, ...args);
    }
  }
}
