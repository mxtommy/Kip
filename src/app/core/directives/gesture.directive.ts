import { Directive, DestroyRef, ElementRef, NgZone, inject, input, output } from '@angular/core';

/**
 * GestureDirective
 * Standalone lightweight gesture providing:
 *  - swipeleft / swiperight / swipeup / swipedown
 *  - press (long press)
 *  - doubletap
 *
 * Uses Pointer Events; runs tracking outside Angular and re-enters only on emit.
 */
@Directive({
  selector: '[kipGestures]'
})
export class GestureDirective {
  // Static counter for instance IDs (debugging)
  private static _instanceCounter = 0;
  private readonly _instanceId: number;
  // Config inputs (can be overridden via property binding)
  // Default values for touch; will be dynamically adjusted per pointer type
  swipeMinDistance = input(30);      // px
  swipeMaxDuration = input(600);     // ms
  longPressMs = input(500);          // ms (matches prior Hammer config)
  doubleTapInterval = input(300);    // ms
  tapSlop = input(20);               // px radius for tap/double tap
  pressMoveSlop = input(10);         // px allowed before cancelling press

  // Dynamically adjusted gesture thresholds (set on pointerdown)
  private _swipeMinDistance = 30;
  private _swipeMaxDuration = 600;
  private _longPressMs = 500;
  private _doubleTapInterval = 300;
  private _tapSlop = 20;
  private _pressMoveSlop = 10;

  // Outputs (signal-based)
  swipeleft = output<Event>();
  swiperight = output<Event>();
  swipeup = output<Event>();
  swipedown = output<Event>();
  press = output<Event>();
  doubletap = output<Event>();

  private readonly zone = inject(NgZone);
  private readonly destroyRef = inject(DestroyRef);
  private readonly host = inject(ElementRef<HTMLElement>);
  // No external drag state

  // Debug flag: set to true to enable gesture debug logging
  private static readonly DEBUG = true;

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private tracking = false;
  private longPressTimer: number | null = null;
  private pressFired = false;
  // Robust cancellation listeners
  private cancelLongpressHandlers: { type: string, handler: EventListenerOrEventListenerObject, opts?: unknown }[] = [];

  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private currentPointerType: string | null = null;
  private lastTapUpTime = 0; // time of last pointerup treated as tap
  private lastTapUpX = 0;
  private lastTapUpY = 0;
  private potentialDoubleTap = false; // set on pointerdown if within interval+slop of last tap up


  constructor() {
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
      el.addEventListener('pointerup', this.onPointerUp, { passive: true });
      el.addEventListener('pointercancel', this.onPointerCancel, { passive: true });
      el.addEventListener('lostpointercapture', this.onPointerCancel, { passive: true });
      // Native mouse dblclick fallback (improves reliability after drag interactions)
      el.addEventListener('dblclick', this.onNativeDblClick, { passive: true });

      this.destroyRef.onDestroy(() => {
        el.removeEventListener('pointerdown', this.onPointerDown);
        el.removeEventListener('pointermove', this.onPointerMove);
        el.removeEventListener('pointerup', this.onPointerUp);
        el.removeEventListener('pointercancel', this.onPointerCancel);
        el.removeEventListener('lostpointercapture', this.onPointerCancel);
        el.removeEventListener('dblclick', this.onNativeDblClick);
        if (this.longPressTimer) window.clearTimeout(this.longPressTimer);
      });
    });

    // Track drag end time (flag flips true->false). If isDragging flips often we simply overwrite.
    // No external drag tracking needed
  }

  private onNativeDblClick = (ev: MouseEvent) => {
    // Emit a synthetic doubletap (mouse scenario) unless a touch doubletap already emitted recently
    const evt = new CustomEvent('doubletap', { detail: { x: ev.clientX, y: ev.clientY, native: true } });
    this.zone.run(() => this.doubletap.emit(evt));
    this.lastTapTime = 0; // reset sequence to avoid immediate re-trigger from pointer logic
  };

  private debug(...args: unknown[]) {
    if ((this.constructor as typeof GestureDirective).DEBUG) {
      console.debug(`[GestureDirective][#${this._instanceId}]`, ...args);
    }
  }

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

    // Dynamically adjust gesture thresholds based on pointer type
    switch (ev.pointerType) {
      case 'touch':
        this._swipeMinDistance = this.swipeMinDistance(); // 30px
        this._swipeMaxDuration = this.swipeMaxDuration(); // 600ms
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
          this.pressFired = true;
          const evt = new CustomEvent('press', { detail: { x: this.startX, y: this.startY, center: { x: this.startX, y: this.startY } } });
          this.zone.run(() => this.press.emit(evt));
        }
        this.removeLongpressCancelListeners();
      }, this._longPressMs);
    }
  };

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
    }

    // If longpress was recognized, do NOT reset state here; let the menu/component handle closing.
    if (this.pressFired) {
      this.debug('pointerup after longpress: not resetting gesture state');
      return;
    }

    // Swipe detection
    if (duration <= this._swipeMaxDuration) {
      if (absDx >= this._swipeMinDistance && absDx >= absDy) {
        this.debug('swipe detected', { direction: dx > 0 ? 'right' : 'left', dx, dy, duration });
        this.zone.run(() => {
          if (dx > 0) {
            this.swiperight.emit(new CustomEvent('swiperight', { detail: { dx, dy, duration } }));
          } else {
            this.swipeleft.emit(new CustomEvent('swipeleft', { detail: { dx, dy, duration } }));
          }
        });
      } else if (absDy >= this._swipeMinDistance && absDy > absDx) {
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
    // Diagnostic logging for pointercancel
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
    this.cancelLongpressHandlers = [
      { type: 'pointermove', handler: cancel, opts: true },
      { type: 'pointerleave', handler: cancel, opts: true },
      { type: 'pointerout', handler: cancel, opts: true },
      { type: 'lostpointercapture', handler: cancel, opts: true },
      { type: 'blur', handler: cancel, opts: true },
    ];
    for (const { type, handler, opts } of this.cancelLongpressHandlers) {
      el.addEventListener(type, handler, opts);
      doc.addEventListener(type, handler, opts);
    }
  }

  private removeLongpressCancelListeners() {
    this.debug('removeLongpressCancelListeners');
    const el = this.host.nativeElement;
    const doc = document;
    for (const { type, handler, opts } of this.cancelLongpressHandlers) {
      el.removeEventListener(type, handler, opts);
      doc.removeEventListener(type, handler, opts);
    }
    this.cancelLongpressHandlers = [];
  }

  private reset() {
    this.debug('reset gesture state');
    this.pointerId = null;
    this.tracking = false;
    this.pressFired = false;
    this.currentPointerType = null;
    this.removeLongpressCancelListeners();
    // Do not reset potentialDoubleTap here; it is cleared on pointerup logic or after completion
    // Do not call removeSuppression() here – we only clear suppression on real pointer up/cancel
  }
}
