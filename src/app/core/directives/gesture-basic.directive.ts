import { Directive, DestroyRef, ElementRef, NgZone, inject, input, output, effect } from '@angular/core';
import { uiEventService } from '../services/uiEvent.service';

/**
 * GestureBasicDirective
 * Standalone lightweight replacement for Hammer.js providing:
 *  - swipeleft / swiperight / swipeup / swipedown
 *  - press (long press)
 *  - doubletap
 *
 * Uses Pointer Events; runs tracking outside Angular and re-enters only on emit.
 */
@Directive({
  selector: '[kipGestures]',
  standalone: true
})
export class GestureBasicDirective {
  // Config inputs (can be overridden via property binding)
  swipeMinDistance = input(30);      // px
  swipeMaxDuration = input(600);     // ms
  longPressMs = input(500);          // ms (matches prior Hammer config)
  doubleTapInterval = input(300);    // ms
  tapSlop = input(20);               // px radius for tap/double tap
  pressMoveSlop = input(10);         // px allowed before cancelling press

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
  private readonly uiEvent = inject(uiEventService);

  private pointerId: number | null = null;
  private startX = 0;
  private startY = 0;
  private startTime = 0;
  private tracking = false;
  private longPressTimer: number | null = null;
  private pressFired = false;
  private suppressionActive = false; // blocks post-press pointer moves initiating drags
  private docPointerMoveSuppress?: (e: Event) => void;
  private docPointerDownSuppress?: (e: Event) => void;
  private docTouchMoveSuppress?: (e: Event) => void;
  private docTouchStartSuppress?: (e: Event) => void;
  private docMouseMoveSuppress?: (e: Event) => void;
  private docMouseDownSuppress?: (e: Event) => void;

  private lastTapTime = 0;
  private lastTapX = 0;
  private lastTapY = 0;
  private currentPointerType: string | null = null;
  private lastTapUpTime = 0; // time of last pointerup treated as tap
  private lastTapUpX = 0;
  private lastTapUpY = 0;
  private potentialDoubleTap = false; // set on pointerdown if within interval+slop of last tap up

  private dragEndedAt = 0;

  constructor() {
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
  this.removeSuppression();
      });
    });

    // Track drag end time (flag flips true->false). If isDragging flips often we simply overwrite.
    effect(() => {
      const dragging = this.uiEvent.isDragging();
      if (!dragging) {
        this.dragEndedAt = performance.now();
      }
    });
  }

  private onNativeDblClick = (ev: MouseEvent) => {
    // Emit a synthetic doubletap (mouse scenario) unless a touch doubletap already emitted recently
    const evt = new CustomEvent('doubletap', { detail: { x: ev.clientX, y: ev.clientY, native: true } });
    this.zone.run(() => this.doubletap.emit(evt));
    this.lastTapTime = 0; // reset sequence to avoid immediate re-trigger from pointer logic
  };

  private onPointerDown = (ev: PointerEvent) => {
    if (this.pointerId !== null) return; // single pointer only
    this.pointerId = ev.pointerId;
    this.tracking = true;
    this.pressFired = false;
  this.currentPointerType = ev.pointerType || null;
  // Determine if this pointerdown is the 2nd tap of a double tap sequence (used to suppress long press)
  const now = performance.now();
  const dtFromLastUp = now - this.lastTapUpTime;
  const distFromLastUp = Math.hypot(ev.clientX - this.lastTapUpX, ev.clientY - this.lastTapUpY);
  this.potentialDoubleTap = dtFromLastUp <= this.doubleTapInterval() && distFromLastUp <= this.tapSlop();
  // We no longer hard-abort when isDragging() is true, because the flag can linger briefly after a drag.
  // Instead we simply avoid scheduling a long press while active drag is flagged.
    this.startX = ev.clientX;
    this.startY = ev.clientY;
  this.startTime = performance.now();
  // Pointer capture to consolidate move/up events (important on iOS inside transformed elements)
  try { (ev.target as HTMLElement).setPointerCapture(ev.pointerId); } catch { /* ignore */ }

  if (this.longPressTimer) window.clearTimeout(this.longPressTimer);
  // Schedule long press only if drag not active at scheduling time; if a drag starts (movement), pointermove cancels it.
  if (!this.uiEvent.isDragging() && !this.potentialDoubleTap) {
      this.longPressTimer = window.setTimeout(() => {
    if (!this.tracking || this.uiEvent.isDragging()) return; // guard re-check
        const dx = ev.clientX - this.startX;
        const dy = ev.clientY - this.startY;
        const sinceDrag = performance.now() - this.dragEndedAt;
        const extraSlop = (sinceDrag < 350 && this.currentPointerType === 'touch') ? 15 : 0;
        if (Math.abs(dx) <= (this.pressMoveSlop() + extraSlop) && Math.abs(dy) <= (this.pressMoveSlop() + extraSlop)) {
          this.pressFired = true;
          const evt = new CustomEvent('press', { detail: { x: this.startX, y: this.startY, center: { x: this.startX, y: this.startY } } });
          this.zone.run(() => this.press.emit(evt));
          // After a long press triggers UI (bottom sheet), suppress further pointer movement
          this.addSuppression(ev);
        }
      }, this.longPressMs());
    }
  };

  private onPointerMove = (ev: PointerEvent) => {
    if (!this.tracking || ev.pointerId !== this.pointerId) return;
    if (!this.pressFired) {
      const dx = ev.clientX - this.startX;
      const dy = ev.clientY - this.startY;
      const sinceDrag = performance.now() - this.dragEndedAt;
      const extraSlop = (sinceDrag < 350 && this.currentPointerType === 'touch') ? 15 : 0;
      const moveSlop = this.pressMoveSlop() + extraSlop;
      if (this.uiEvent.isDragging() || Math.abs(dx) > moveSlop || Math.abs(dy) > moveSlop) {
        if (this.longPressTimer) { window.clearTimeout(this.longPressTimer); this.longPressTimer = null; }
      }
    }
  };

  private onPointerUp = (ev: PointerEvent) => {
    if (!this.tracking || ev.pointerId !== this.pointerId) return;
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    const dx = ev.clientX - this.startX;
    const dy = ev.clientY - this.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (this.longPressTimer) { window.clearTimeout(this.longPressTimer); this.longPressTimer = null; }

    if (!this.pressFired) {
      // Swipe detection
      if (duration <= this.swipeMaxDuration()) {
        if (absDx >= this.swipeMinDistance() && absDx >= absDy) {
          this.zone.run(() => (dx > 0 ? this.swiperight.emit(new CustomEvent('swiperight', { detail: { dx, dy, duration } })) : this.swipeleft.emit(new CustomEvent('swipeleft', { detail: { dx, dy, duration } }))));
        } else if (absDy >= this.swipeMinDistance() && absDy > absDx) {
          this.zone.run(() => (dy > 0 ? this.swipedown.emit(new CustomEvent('swipedown', { detail: { dx, dy, duration } })) : this.swipeup.emit(new CustomEvent('swipeup', { detail: { dx, dy, duration } }))));
        }
      }
      // Double tap detection
  if (this.currentPointerType !== 'mouse' && absDx <= this.tapSlop() && absDy <= this.tapSlop() && duration < this.longPressMs()) {
        const now = endTime;
        const dt = now - this.lastTapTime;
        const dist = Math.hypot(ev.clientX - this.lastTapX, ev.clientY - this.lastTapY);
        if (dt <= this.doubleTapInterval() && dist <= this.tapSlop()) {
          this.zone.run(() => this.doubletap.emit(new CustomEvent('doubletap', { detail: { x: ev.clientX, y: ev.clientY, dt } })));
          this.lastTapTime = 0;
          this.potentialDoubleTap = false; // completed
        } else {
          this.lastTapTime = now;
          this.lastTapX = ev.clientX;
          this.lastTapY = ev.clientY;
        }
      }
    }

    // If it was a tap (not long press) record data for next pointerdown's potentialDoubleTap evaluation
    if (!this.pressFired && absDx <= this.tapSlop() && absDy <= this.tapSlop() && duration < this.longPressMs()) {
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
    if (ev.pointerId === this.pointerId) {
      if (this.longPressTimer) { window.clearTimeout(this.longPressTimer); this.longPressTimer = null; }
      this.reset();
    }
  };

  private reset() {
    this.pointerId = null;
    this.tracking = false;
    this.pressFired = false;
  this.currentPointerType = null;
  // Do not reset potentialDoubleTap here; it is cleared on pointerup logic or after completion
    // Do not call removeSuppression() here – we only clear suppression on real pointer up/cancel
  }

  /** Prevent subsequent drag initiation after a long press opened UI. */
  private addSuppression(originalEv: PointerEvent) {
    if (this.suppressionActive) return;
    this.suppressionActive = true;
    // Capture-phase suppressors on document so movement outside host is also blocked
    this.docPointerMoveSuppress = (e: Event) => {
      if (this.suppressionActive) {
        e.stopImmediatePropagation();
        // Prevent default to avoid scrolling during suppression
        if (e.cancelable) e.preventDefault();
      }
    };
    this.docPointerDownSuppress = (e: Event) => {
      if (this.suppressionActive) {
        e.stopImmediatePropagation();
        if (e.cancelable) e.preventDefault();
      }
    };
    this.docTouchMoveSuppress = (e: Event) => {
      if (this.suppressionActive) {
        e.stopImmediatePropagation();
        if (e.cancelable) e.preventDefault();
      }
    };
    this.docTouchStartSuppress = (e: Event) => {
      if (this.suppressionActive) {
        e.stopImmediatePropagation();
        if (e.cancelable) e.preventDefault();
      }
    };
    this.docMouseMoveSuppress = (e: Event) => {
      if (this.suppressionActive) {
        e.stopImmediatePropagation();
        if (e.cancelable) e.preventDefault();
      }
    };
    this.docMouseDownSuppress = (e: Event) => {
      if (this.suppressionActive) {
        e.stopImmediatePropagation();
        if (e.cancelable) e.preventDefault();
      }
    };
    document.addEventListener('pointermove', this.docPointerMoveSuppress, { capture: true, passive: false });
    document.addEventListener('pointerdown', this.docPointerDownSuppress, { capture: true, passive: false });
    document.addEventListener('touchmove', this.docTouchMoveSuppress, { capture: true, passive: false });
  document.addEventListener('touchstart', this.docTouchStartSuppress, { capture: true, passive: false });
    document.addEventListener('mousemove', this.docMouseMoveSuppress, { capture: true, passive: false });
    document.addEventListener('mousedown', this.docMouseDownSuppress, { capture: true, passive: false });

    // Dispatch synthetic end/cancel to release drag libs. For touch on iOS, prefer pointercancel to avoid Gridstack e.screenX errors.
    try {
      const src = originalEv as PointerEvent & { screenX?: number; screenY?: number };
      const sx = (typeof src.screenX === 'number') ? src.screenX : originalEv.clientX;
      const sy = (typeof src.screenY === 'number') ? src.screenY : originalEv.clientY;
      if (originalEv.pointerType === 'mouse') {
        const upEv = new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          pointerId: originalEv.pointerId,
          pointerType: originalEv.pointerType,
          clientX: originalEv.clientX,
          clientY: originalEv.clientY,
          screenX: sx,
          screenY: sy,
        });
        (originalEv.target as HTMLElement).dispatchEvent(upEv);
        const mouseUp = new MouseEvent('mouseup', {
          bubbles: true,
          cancelable: true,
          clientX: originalEv.clientX,
          clientY: originalEv.clientY,
          screenX: sx,
          screenY: sy,
          button: 0
        });
        (originalEv.target as HTMLElement).dispatchEvent(mouseUp);
      } else if (originalEv.pointerType === 'touch') {
        // Use pointercancel instead of pointerup, provide screen coords to satisfy libs expecting them.
        const cancelEv = new PointerEvent('pointercancel', {
          bubbles: true,
          cancelable: true,
          pointerId: originalEv.pointerId,
          pointerType: originalEv.pointerType,
          clientX: originalEv.clientX,
          clientY: originalEv.clientY,
          screenX: sx,
          screenY: sy,
        });
        (originalEv.target as HTMLElement).dispatchEvent(cancelEv);
        // Optionally fire touchcancel (ignore if construction restricted)
        try {
          const touchCancel = new TouchEvent('touchcancel', { bubbles: true, cancelable: true });
          (originalEv.target as HTMLElement).dispatchEvent(touchCancel);
        } catch { /* ignore */ }
      }
    } catch { /* ignore synthetic dispatch errors */ }

    // Remove suppression on the next real pointerup/cancel (user releases)
    const clear = (e: Event) => {
      // Ensure same pointer (where possible)
      if (e instanceof PointerEvent && this.pointerId !== null && e.pointerId !== this.pointerId) return;
      this.removeSuppression();
      document.removeEventListener('pointerup', clear, true);
      document.removeEventListener('pointercancel', clear, true);
      document.removeEventListener('touchend', clear, true);
      document.removeEventListener('touchcancel', clear, true);
    };
    document.addEventListener('pointerup', clear, true);
    document.addEventListener('pointercancel', clear, true);
    document.addEventListener('touchend', clear, true);
    document.addEventListener('touchcancel', clear, true);
  }

  private removeSuppression() {
    if (!this.suppressionActive) return;
    this.suppressionActive = false;
    if (this.docPointerMoveSuppress) document.removeEventListener('pointermove', this.docPointerMoveSuppress, true);
    if (this.docPointerDownSuppress) document.removeEventListener('pointerdown', this.docPointerDownSuppress, true);
    if (this.docTouchMoveSuppress) document.removeEventListener('touchmove', this.docTouchMoveSuppress, true);
  if (this.docTouchStartSuppress) document.removeEventListener('touchstart', this.docTouchStartSuppress, true);
  if (this.docMouseMoveSuppress) document.removeEventListener('mousemove', this.docMouseMoveSuppress, true);
  if (this.docMouseDownSuppress) document.removeEventListener('mousedown', this.docMouseDownSuppress, true);
    this.docPointerMoveSuppress = undefined;
    this.docPointerDownSuppress = undefined;
    this.docTouchMoveSuppress = undefined;
  this.docTouchStartSuppress = undefined;
  this.docMouseMoveSuppress = undefined;
  this.docMouseDownSuppress = undefined;
  }
}
