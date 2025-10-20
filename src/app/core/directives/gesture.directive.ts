/**
 * GestureDirective — design notes
 *
 * Lightweight, standalone gesture recognizer built on Pointer Events. Designed for dashboard widgets and containers.
 *
 * Core characteristics
 * - Runs pointer tracking outside Angular's zone to minimize change detection churn.
 * - Emits gestures both as Angular outputs and as bubbling DOM CustomEvents (detail payloads are strongly typed).
 * - Single-pointer recognition only (no multi-touch) with per-pointer-type thresholds (mouse | touch | pen).
 * - Robust long-press logic with explicit cancellation and teardown to avoid leaked handlers or capture.
 * - Per-lane ownership (horizontal | vertical | press) to reduce contention across nested hosts.
 * - Mode/toggle gating (all | horizontal | dashboard | press | editor, plus enablePress/enableDoubleTap), and rebroadcast gating.
 * - Diagnostics are opt-in and can be toggled at runtime (console helper, localStorage persistence).
 *
 * Supported gestures (emitted events):
 * - swipeleft, swiperight, swipeup, swipedown, press, doubletap
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
 *  - Touch-action: the directive sets `touch-action: none` on the host to ensure pointer streams (helps iOS/Safari).
 *    If the host needs native scroll/zoom, mount the directive on a smaller overlay element instead of the scroller.
 *  - Context menu: the directive prevents the native contextmenu on the host to avoid pointer sequence aborts.
 *    If a widget needs right-click, place the directive on a child overlay, not the interactive element itself.
 *  - Inputs are Angular signals (`input(...)`), so everything is bindable from templates.
 *  - Pointer capture policy: capture is enabled for touch/pen (to keep continuity across child boundaries),
 *    and disabled for mouse to preserve native hover/click behaviors in Material/CDK components.
 *  - Long-press cancel sources: pointermove and lostpointercapture for all pointers; pointerleave/out and window blur
 *    only for touch/pen (mouse ignores blur to avoid aborting legitimate presses after dialog focus changes).
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
 *    [mode]="'press'"
 *    [enablePress]="true"
 *    [enableDoubleTap]="true"
 *    [longPressMs]="500"
 *    (press)="onPress($event)"
 *    (doubletap)="onDoubleTap($event)">
 *  </div>
 */
@Directive({ selector: '[kipGestures]' })
export class GestureDirective {
  // Debug flag: set to true to enable gesture debug logging
  private static readonly DEBUG = false;
  // Service-level Chrome/macOS detection
  private readonly isChromeOnMac: boolean;
  // Firefox detection (used to suppress ghost click after long-press)
  private readonly isFirefox: boolean;
  // Suppress scheduling new gestures immediately after a long-press fires (ms deadline via performance.now())
  private static _suppressAllGesturesUntil = 0;
  // Static counter for instance IDs (debugging)
  private static _instanceCounter = 0;
  private readonly _instanceId: number;
  // Per-lane ownership so press-only hosts don't block global horizontal or dashboard vertical lanes.
  // Each pointerId can be owned independently for: horizontal (h), vertical (v), press/tap (p)
  private static _laneOwners = new Map<number, { h?: number; v?: number; p?: number }>();
  // Track currently active pointerIds to detect new sequences and clear stale owners
  private static _activePointers = new Set<number>();
  // Track instance id -> host element, for diagnostics on lane ownership across instances
  private static _instanceToEl = new Map<number, HTMLElement>();

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

  // Mode and enable/disable controls
  /**
   * Recognition mode scoping which gestures are considered:
   * - 'all': swipes (H+V), press, doubletap
   * - 'horizontal': horizontal swipes only (no press/doubletap)
   * - 'dashboard': vertical swipes + press (+ doubletap if enabled)
   * - 'press': press (+ doubletap if enabled), no swipes
   * - 'editor': press + doubletap only, no swipes
   */
  mode = input<'all' | 'horizontal' | 'dashboard' | 'press' | 'editor'>('all');
  /** When true, directive ignores pointer sequences and won't emit gestures. */
  disableGestures = input(false);
  /** Enable/disable press gesture (honored in modes that allow press). */
  enablePress = input(true);
  /** Enable/disable doubletap gesture (honored in modes that allow doubletap). */
  enableDoubleTap = input(true);
  /** When true, also dispatch document-level UI events for horizontal swipes (openLeftSidenav/openRightSidenav). */
  bridgeUiEvents = input(false);

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
  // Track which lanes this instance acquired for current pointer
  private ownedLanes: { h: boolean; v: boolean; p: boolean } = { h: false, v: false, p: false };

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
  // Track which element holds pointer capture for this sequence (target-based capture)
  private captureEl: Element | null = null;

  // Move samples ring buffer (used only when debug is enabled)
  private static readonly MOVES_BUFFER_SIZE = 120;
  private moveSamples: { t: number; x: number; y: number; source: 'move' | 'raw' }[] = [];


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
    // Track instance host element for cross-instance ownership diagnostics
    try { (GestureDirective as typeof GestureDirective)._instanceToEl.set(this._instanceId, this.host.nativeElement); } catch { /* ignore */ }
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
        // Additional suppression to avoid UA long-press hints and selection on Chrome/Android/ChromeOS
        if (!el.style.userSelect) el.style.userSelect = 'none';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((el.style as any).webkitUserSelect === '') (el.style as any).webkitUserSelect = 'none';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (el.style as any).webkitTapHighlightColor = 'transparent';
      }
      // Register in capture phase so we get events before children/libs (reduces re-target/cancel issues)
      // pointerdown passive:false so we can preventDefault on iOS if needed to stop native behavior
      el.addEventListener('pointerdown', this.onPointerDown, { passive: false, capture: true });
      // Movement: both pointermove and pointerrawupdate feed the same handler to keep behavior consistent.
      el.addEventListener('pointermove', this.onPointerMove, { passive: true, capture: true });
      // raw updates provide higher-fidelity movement in Chrome; ignored by other browsers
      el.addEventListener('pointerrawupdate', this.onPointerRawUpdate as EventListener, { passive: true, capture: true } as AddEventListenerOptions);
      // Use capture for touch/pen reliability; for mouse, pointerup in bubble keeps native click working
      el.addEventListener('pointerup', this.onPointerUp, { passive: true });
      el.addEventListener('pointercancel', this.onPointerCancel, { passive: true, capture: true });
      // Guard lostpointercapture to avoid aborting valid touch/pen long-press on Chrome/Android/ChromeOS
      el.addEventListener('lostpointercapture', this.onLostPointerCapture, { passive: true, capture: true });
      // Native mouse dblclick fallback (improves reliability after drag interactions)
      el.addEventListener('dblclick', this.onNativeDblClick, { passive: true });
      // Re-emit bubbling gesture events from children as directive outputs on this host
      const rebroadcast = (e: Event) => {
        const evt = e as CustomEvent;
        // Avoid re-emitting events that originated from this instance
        const origin = (evt.detail as unknown as { __gid?: number })?.__gid;
        if (origin === this._instanceId) return;
        if (this.disableGestures()) return; // muted
        const targetEl = evt.target as Element | null;
        const fromChild = !!(targetEl && targetEl !== this.host.nativeElement && this.host.nativeElement.contains(targetEl));
        // Gate rebroadcast based on mode/flags
        const allowH = this.modeAllowsHorizontal();
        const allowV = this.modeAllowsVertical();
        let allowP = this.modeAllowsPress();
        let allowDT = this.modeAllowsDoubleTap();
        // Pass-through: if a descendant already recognized press/doubletap, let it bubble up
        // even when this container's mode disables them (e.g., 'horizontal').
        if (fromChild && (evt.type === 'press' || evt.type === 'doubletap')) {
          allowP = allowP || evt.type === 'press';
          allowDT = allowDT || evt.type === 'doubletap';
        }
        // Do not rebroadcast press/doubletap that originated from a widget container
        // when this host is not that widget container (prevents grid from handling widget press)
        if ((evt.type === 'press' || evt.type === 'doubletap')) {
          const hostEl = this.host.nativeElement as Element;
          const widgetEl = targetEl && typeof (targetEl as Element).closest === 'function'
            ? (targetEl as Element).closest('.widget-container')
            : null;
          // If the event target is within a widget container and this host is not that widget, skip
          if (widgetEl && widgetEl !== hostEl) {
            allowP = false;
            allowDT = false;
          }
          // Additionally: if host is the grid root and the event originated inside a grid item,
          // suppress rebroadcast so the item's overlay/child can own press/doubletap.
          const hostIsGridRoot = (hostEl as HTMLElement).classList?.contains('grid-stack') ||
            (hostEl as HTMLElement).tagName?.toLowerCase() === 'gridstack';
          const inGridItem = targetEl && typeof (targetEl as Element).closest === 'function'
            ? (targetEl as Element).closest('.grid-stack-item')
            : null;
          if (hostIsGridRoot && inGridItem) {
            allowP = false;
            allowDT = false;
            this.debug('suppress grid-root rebroadcast for press/doubletap inside grid-stack-item', {
              host: this.elDesc(hostEl as HTMLElement),
              target: this.elDesc(targetEl ?? undefined),
              inGridItem: this.elDesc(inGridItem as HTMLElement)
            });
          }
        }
        this.debug('rebroadcast gate', {
          type: evt.type,
          allowH, allowV, allowP, allowDT,
          fromChild,
          target: this.elDesc(targetEl ?? undefined),
          host: this.elDesc(this.host.nativeElement),
          mode: this.mode()
        });
        // Ensure parent outputs run inside Angular so listeners trigger change detection
        this.zone.run(() => {
          switch (evt.type) {
            case 'press':
              if (allowP) {
                this.debug('rebroadcast emit: press');
                this.press.emit(evt as CustomEvent<{ x: number; y: number; center?: { x: number; y: number } }>);
              }
              break;
            case 'doubletap':
              if (allowDT) {
                this.debug('rebroadcast emit: doubletap');
                this.doubletap.emit(evt as CustomEvent<{ x: number; y: number; dt: number }>);
              }
              break;
            case 'swipeleft':
              if (allowH) {
                this.debug('rebroadcast emit: swipeleft');
                this.swipeleft.emit(evt as CustomEvent<{ dx: number; dy: number; duration: number }>);
              }
              break;
            case 'swiperight':
              if (allowH) {
                this.debug('rebroadcast emit: swiperight');
                this.swiperight.emit(evt as CustomEvent<{ dx: number; dy: number; duration: number }>);
              }
              break;
            case 'swipeup':
              if (allowV) {
                this.debug('rebroadcast emit: swipeup');
                this.swipeup.emit(evt as CustomEvent<{ dx: number; dy: number; duration: number }>);
              }
              break;
            case 'swipedown':
              if (allowV) {
                this.debug('rebroadcast emit: swipedown');
                this.swipedown.emit(evt as CustomEvent<{ dx: number; dy: number; duration: number }>);
              }
              break;
          }
        });
      };
      const rebroadcastOpts: AddEventListenerOptions = { passive: true };
      el.addEventListener('press', rebroadcast as EventListener, rebroadcastOpts);
      el.addEventListener('doubletap', rebroadcast as EventListener, rebroadcastOpts);
      el.addEventListener('swipeleft', rebroadcast as EventListener, rebroadcastOpts);
      el.addEventListener('swiperight', rebroadcast as EventListener, rebroadcastOpts);
      el.addEventListener('swipeup', rebroadcast as EventListener, rebroadcastOpts);
      el.addEventListener('swipedown', rebroadcast as EventListener, rebroadcastOpts);

      // Block context menu to avoid Chrome aborting pointer sequences
      el.addEventListener('contextmenu', this.onContextMenu, { passive: false });

      this.destroyRef.onDestroy(() => {
        el.removeEventListener('pointerdown', this.onPointerDown, { capture: true } as AddEventListenerOptions);
        el.removeEventListener('pointermove', this.onPointerMove, { capture: true } as AddEventListenerOptions);
        el.removeEventListener('pointerrawupdate', this.onPointerRawUpdate as EventListener, { capture: true } as AddEventListenerOptions);
        // pointerup was added without capture; remove without capture
        el.removeEventListener('pointerup', this.onPointerUp);
        el.removeEventListener('pointercancel', this.onPointerCancel, { capture: true } as AddEventListenerOptions);
        el.removeEventListener('lostpointercapture', this.onLostPointerCapture, { capture: true } as AddEventListenerOptions);
        el.removeEventListener('dblclick', this.onNativeDblClick);
        el.removeEventListener('press', rebroadcast as EventListener, rebroadcastOpts);
        el.removeEventListener('doubletap', rebroadcast as EventListener, rebroadcastOpts);
        el.removeEventListener('swipeleft', rebroadcast as EventListener, rebroadcastOpts);
        el.removeEventListener('swiperight', rebroadcast as EventListener, rebroadcastOpts);
        el.removeEventListener('swipeup', rebroadcast as EventListener, rebroadcastOpts);
        el.removeEventListener('swipedown', rebroadcast as EventListener, rebroadcastOpts);
        el.removeEventListener('contextmenu', this.onContextMenu);
        if (this.longPressTimer) {
          window.clearTimeout(this.longPressTimer);
          this.longPressTimer = null;
        }

        // Ensure any ad-hoc cancel listeners attached to document/element are removed
        this.removeLongpressCancelListeners();

        // Release lane ownership and clear activePointers if a gesture was in-flight
        try {
          if (this.pointerId !== null) {
            const map = (this.constructor as typeof GestureDirective)._laneOwners;
            const owners = map.get(this.pointerId);
            if (owners) {
              this.debug('onDestroy: releasing lane ownership', { pointerId: this.pointerId, ownersBefore: owners, ownedByThis: this.ownedLanes, instanceId: this._instanceId });
              if (this.ownedLanes.h && owners.h === this._instanceId) delete owners.h;
              if (this.ownedLanes.v && owners.v === this._instanceId) delete owners.v;
              if (this.ownedLanes.p && owners.p === this._instanceId) delete owners.p;
              if (!owners.h && !owners.v && !owners.p) map.delete(this.pointerId); else map.set(this.pointerId, owners);
              this.debug('onDestroy: lane owners after release', { pointerId: this.pointerId, owners });
            }
            const deleted = (this.constructor as typeof GestureDirective)._activePointers.delete(this.pointerId);
            this.debug('onDestroy: activePointers delete', { pointerId: this.pointerId, deleted });
          }
        } catch { /* ignore */ }

        // Release pointer capture if it was set (target-based capture)
        try {
          if (this.pointerId !== null && this.captureEl && 'releasePointerCapture' in this.captureEl) {
            this.captureEl.releasePointerCapture(this.pointerId);
          }
        } catch {
          /* ignore release errors */
        }
        this.pointerId = null;
        this.captureEl = null;
        this.tracking = false;
        try { (GestureDirective as typeof GestureDirective)._instanceToEl.delete(this._instanceId); } catch { /* ignore */ }
      });
    });
  }

  private onNativeDblClick = (ev: MouseEvent) => {
    // Emit a synthetic doubletap (mouse scenario) unless a touch doubletap already emitted recently
    if (this.disableGestures()) return;
    if (!this.modeAllowsDoubleTap()) return;
    const evt = new CustomEvent('doubletap', { detail: { x: ev.clientX, y: ev.clientY, dt: 0 } });
    this.zone.run(() => this.doubletap.emit(evt));
    this.lastTapTime = 0; // reset sequence to avoid immediate re-trigger from pointer logic
  };

  private onPointerDown = (ev: PointerEvent) => {
    // Defensive: if prior state wasn't fully reset (e.g., dialog interactions), clear it now
    if (this.tracking || this.pressFired || this.longPressTimer) {
      this.debug('pointerdown with stale state; force reset', {
        tracking: this.tracking,
        pressFired: this.pressFired,
        hasTimer: !!this.longPressTimer
      });
      this.reset();
    }
    // Global suppression window (after a long-press) to avoid re-triggering press on next click in dialogs
    const now0 = performance.now();
    const until = (this.constructor as typeof GestureDirective)._suppressAllGesturesUntil;
    if (now0 < until) {
      this.debug('pointerdown suppressed by global window after longpress', {
        now: Math.round(now0),
        suppressUntil: Math.round(until),
        remainingMs: Math.round(until - now0)
      });
      return;
    }
    if (this.disableGestures()) { return; }
    this.debug('pointerdown', {
      x: ev.clientX,
      y: ev.clientY,
      pointerId: ev.pointerId,
      pointerType: ev.pointerType,
      sourceElement: ev.target instanceof Element ? ev.target.outerHTML : String(ev.target)
    });
    if (this.pointerId !== null) return; // single pointer only per instance
    // If no gestures are allowed in current mode/flags, ignore
    const allowH = this.modeAllowsHorizontal();
    const allowV = this.modeAllowsVertical();
    let allowPress = this.modeAllowsPress();
    let allowDT = this.modeAllowsDoubleTap();
    // Prefer child widgets for press/doubletap when the target is inside a widget container and
    // this host is not that widget container. Applies across modes so widget long-press wins.
    {
      const targetEl = ev.target as Element | null;
      const hostEl = this.host.nativeElement as Element;
      const widgetEl = targetEl && typeof (targetEl as Element).closest === 'function'
        ? (targetEl as Element).closest('.widget-container')
        : null;
      if (widgetEl && widgetEl !== hostEl) {
        allowPress = false;
        allowDT = false;
      }
      // Additionally: if host is the grid root and the press originates inside a grid item,
      // let the item's overlay/child own press/doubletap instead of the grid.
      const hostIsGridRoot = (hostEl as HTMLElement).classList?.contains('grid-stack') ||
        (hostEl as HTMLElement).tagName?.toLowerCase() === 'gridstack';
      const inGridItem = targetEl && typeof (targetEl as Element).closest === 'function'
        ? (targetEl as Element).closest('.grid-stack-item')
        : null;
      if (hostIsGridRoot && inGridItem) {
        allowPress = false;
        allowDT = false;
        this.debug('suppress grid-root press/doubletap for event inside grid-stack-item', {
          host: this.elDesc(hostEl as HTMLElement),
          target: this.elDesc(targetEl ?? undefined),
          inGridItem: this.elDesc(inGridItem as HTMLElement)
        });
      }
    }
    if (!allowH && !allowV && !allowPress && !allowDT) {
      this.debug('ignoring pointerdown: no gestures enabled for current mode');
      return;
    }
    // Try to acquire lanes for this pointer
    const wantP = allowPress || allowDT;
    const ownersMap = (this.constructor as typeof GestureDirective)._laneOwners;
    const activeSet = (this.constructor as typeof GestureDirective)._activePointers;
    // If this is the first handler seeing this pointerId for this sequence, clear any stale owners
    if (!activeSet.has(ev.pointerId)) {
      activeSet.add(ev.pointerId);
      if (ownersMap.has(ev.pointerId)) {
        this.debug('new pointer sequence; clearing stale lane owners', { pointerId: ev.pointerId, prevOwners: ownersMap.get(ev.pointerId) });
        ownersMap.delete(ev.pointerId);
      }
    }
    const owners = ownersMap.get(ev.pointerId) ?? {};
    // Diagnostic: if press lane already owned, log relationships between owner/host/target
    if (owners.p !== undefined) {
      const ownerId = owners.p;
      const ownerEl = (this.constructor as typeof GestureDirective)._instanceToEl.get(ownerId!);
      const hostEl = this.host.nativeElement;
      const tgt = (ev.target as Element | null) ?? null;
      const rel = this.ownerRelationshipSummary(ownerEl ?? null, hostEl, tgt);
      this.debug('pre-acquire owners (press lane already owned)', { owners, ownerId, ownerEl: this.elDesc(ownerEl), hostEl: this.elDesc(hostEl), targetEl: this.elDesc(tgt), rel });
    } else {
      this.debug('pre-acquire owners', { owners });
    }
    this.ownedLanes = { h: false, v: false, p: false };
    if (allowH && owners.h === undefined) { owners.h = this._instanceId; this.ownedLanes.h = true; }
    if (allowV && owners.v === undefined) { owners.v = this._instanceId; this.ownedLanes.v = true; }
    if (wantP && owners.p === undefined) { owners.p = this._instanceId; this.ownedLanes.p = true; }
    this.debug('lane acquisition', {
      allowH, allowV, allowPress, allowDT,
      wantP,
      acquired: this.ownedLanes,
      existingOwners: owners
    });
    // If we didn't acquire any lane, another instance already owns all relevant lanes; ignore
    if (!this.ownedLanes.h && !this.ownedLanes.v && !this.ownedLanes.p) {
      // Further diagnostics when press is desired but not owned
      if (wantP && owners.p !== undefined) {
        const ownerId = owners.p;
        const ownerEl = (this.constructor as typeof GestureDirective)._instanceToEl.get(ownerId!);
        const hostEl = this.host.nativeElement;
        const tgt = (ev.target as Element | null) ?? null;
        const rel = this.ownerRelationshipSummary(ownerEl ?? null, hostEl, tgt);
        this.debug('ignoring pointerdown: press lane not owned', { owners, ownerId, ownerEl: this.elDesc(ownerEl), hostEl: this.elDesc(hostEl), targetEl: this.elDesc(tgt), rel });
      } else {
        this.debug('ignoring pointerdown: other instance owns relevant lanes', { owners });
      }
      return;
    }

    this.pointerId = ev.pointerId;
    ownersMap.set(ev.pointerId, owners);
    this.tracking = true;
    this.pressFired = false;
    this.currentPointerType = ev.pointerType || null;
    this.lockedAxis = null;
  this.captureEl = null;

    // Reset move samples buffer if debugging
    if (this.isDebugEnabled()) {
      this.moveSamples = [{ t: performance.now(), x: ev.clientX, y: ev.clientY, source: 'move' }];
    }

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
        // Relax slop to tolerate tiny panel jitter on Android/ChromeOS/iOS
        this._pressMoveSlop = Math.max(this.pressMoveSlop(), 16);
        break;
      case 'pen':
        this._swipeMinDistance = 20;
        this._swipeMaxDuration = 500;
        this._longPressMs = 500;
        this._doubleTapInterval = 250;
        this._tapSlop = 10;
        this._pressMoveSlop = 2;
        break;
      case 'mouse':
      default:
        this._swipeMinDistance = 15;
        this._swipeMaxDuration = 400;
        this._longPressMs = 500;
        this._doubleTapInterval = 250;
        this._tapSlop = 8;
        this._pressMoveSlop = 2;
        break;
    }

    // Log computed thresholds for this pointer sequence
    this.debug('thresholds', {
      pointerType: ev.pointerType,
      swipeMinDistance: this._swipeMinDistance,
      swipeMaxDuration: this._swipeMaxDuration,
      longPressMs: this._longPressMs,
      doubleTapInterval: this._doubleTapInterval,
      tapSlop: this._tapSlop,
      pressMoveSlop: this._pressMoveSlop,
      axisLockThreshold: this.axisLockThreshold
    });

    // Double tap logic (only when enabled)
    const now = performance.now();
    const dtFromLastUp = now - this.lastTapUpTime;
    const distFromLastUp = Math.hypot(ev.clientX - this.lastTapUpX, ev.clientY - this.lastTapUpY);
    this.potentialDoubleTap = allowDT && (dtFromLastUp <= this._doubleTapInterval && distFromLastUp <= this._tapSlop);
    this.startX = ev.clientX;
    this.startY = ev.clientY;
    this.startTime = performance.now();
    // Pointer capture policy (target-based):
    // - For touch/pen, capture on the ORIGINAL EVENT TARGET to preserve pointerup delivery to interactive children (e.g., SVG controls),
    //   while still maintaining stream continuity if the pointer briefly leaves the element.
    // - For mouse, do NOT capture to preserve native hover/click behavior.
    if (ev.pointerType !== 'mouse') {
      const tgt = (ev.target as Element | null) ?? null;
      const capEl: Element = tgt ?? this.host.nativeElement;
      try {
        if ('setPointerCapture' in capEl) {
          capEl.setPointerCapture(ev.pointerId);
          this.captureEl = capEl;
          this.debug('setPointerCapture success', {
            pointerId: ev.pointerId,
            pointerType: ev.pointerType,
            captureElement: this.elDesc(capEl as HTMLElement)
          });
        } else {
          this.captureEl = null;
          this.debug('setPointerCapture unavailable on element');
        }
      } catch {
        this.captureEl = null;
        this.debug('setPointerCapture failed', { pointerId: ev.pointerId, pointerType: ev.pointerType });
      }
    }
    if (this.longPressTimer) {
      this.debug('longpress timer cleared on pointerdown');
      window.clearTimeout(this.longPressTimer);
    }
    if (!this.potentialDoubleTap && allowPress && this.ownedLanes.p) {
      // Since we are going to track a possible long-press, suppress UA long-press hint/context menu (touch/pen only)
      if (this.currentPointerType !== 'mouse') {
        try { ev.preventDefault(); } catch { /* ignore */ }
      }
      // Add robust cancellation listeners
      this.addLongpressCancelListeners();
      this.debug('longpress timer scheduled', {
        scheduleAt: Math.round(performance.now()),
        firesAt: Math.round(performance.now() + this._longPressMs),
        longPressMs: this._longPressMs,
        pressMoveSlop: this._pressMoveSlop,
        ownedLanes: this.ownedLanes,
        pointerType: this.currentPointerType
      });
      this.longPressTimer = window.setTimeout(() => {
        this.debug('longpress timer fired', { tracking: this.tracking, firedAt: Math.round(performance.now()) });
        if (!this.tracking) {
          this.debug('longpress cancelled: not tracking');
          return;
        }
        const dx = ev.clientX - this.startX;
        const dy = ev.clientY - this.startY;
        if (Math.abs(dx) <= this._pressMoveSlop && Math.abs(dy) <= this._pressMoveSlop) {
          this.debug('longpress recognized', { x: this.startX, y: this.startY });
          // Firefox: suppress the synthetic click on pointerup that targets the newly opened dialog
          // Apply only for touch/pen to avoid interfering with intentional mouse clicks
          if (this.isFirefox && this.currentPointerType !== 'mouse') this.suppressNextClick(500);
          // Start a short global suppression window so the immediate next tap does not schedule another long-press (touch/pen only)
          if (this.currentPointerType !== 'mouse') {
            (this.constructor as typeof GestureDirective)._suppressAllGesturesUntil = performance.now() + 600;
            this.debug('set global suppression window after longpress', { until: Math.round((this.constructor as typeof GestureDirective)._suppressAllGesturesUntil) });
          }
          this.pressFired = true;
          const detail = { x: this.startX, y: this.startY, center: { x: this.startX, y: this.startY } };
          this.zone.run(() => this.emitPressEvent(detail));
          // Immediately reset to release lane owners for this pointer sequence
          this.reset();
        }
        // Timer has fired; ensure we don't treat it as pending anymore
        this.longPressTimer = null;
        this.removeLongpressCancelListeners();
      }, this._longPressMs);
    } else {
      this.debug('longpress not scheduled', {
        potentialDoubleTap: this.potentialDoubleTap,
        allowPress,
        ownedPressLane: this.ownedLanes.p,
        reason: this.potentialDoubleTap ? 'awaiting doubletap' : (!allowPress ? 'press disabled by mode/flag' : (!this.ownedLanes.p ? 'press lane not owned' : 'unknown')),
        ownersForPointer: owners
      });
    }
  };

  // Guarded lostpointercapture: ignore during active touch/pen long-press sequences
  private onLostPointerCapture = (ev: PointerEvent) => {
    if (ev.pointerId !== this.pointerId) return;
    if (this.currentPointerType !== 'mouse' && this.longPressTimer) {
      this.debug('ignore lostpointercapture during active touch/pen long-press');
      return;
    }
    this.onPointerCancel(ev);
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

  private onPointerMove = (ev: PointerEvent) => this.handlePointerMotion(ev, 'move');

  // Chrome sends pointerrawupdate for high-frequency movement; mirror pointermove logic via shared handler
  private onPointerRawUpdate = (ev: PointerEvent) => this.handlePointerMotion(ev, 'raw');

  private handlePointerMotion(ev: PointerEvent, source: 'move' | 'raw') {
    if (!this.tracking || ev.pointerId !== this.pointerId) return;
    if (this.pressFired) return; // Suppress drag after longpress
    this.recordMove(ev, source);
    // Allow small movement during long-press; cancel only if movement exceeds pressMoveSlop
    if (this.longPressTimer) {
      const dxAbs = Math.abs(ev.clientX - this.startX);
      const dyAbs = Math.abs(ev.clientY - this.startY);
      if (dxAbs > this._pressMoveSlop || dyAbs > this._pressMoveSlop) {
        this.debug(`longpress cancelled by pointer${source === 'raw' ? 'rawupdate' : 'move'}: moved beyond slop`, { dx: dxAbs, dy: dyAbs, slop: this._pressMoveSlop });
        window.clearTimeout(this.longPressTimer);
        this.longPressTimer = null;
        this.removeLongpressCancelListeners();
      }
    }
    // Establish axis lock when movement exceeds a small threshold to better classify swipes
    if (!this.lockedAxis) {
      const dx = ev.clientX - this.startX;
      const dy = ev.clientY - this.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      if (absDx >= this.axisLockThreshold || absDy >= this.axisLockThreshold) {
        this.lockedAxis = absDx >= absDy ? 'x' : 'y';
        this.debug(`axis locked${source === 'raw' ? ' (raw)' : ''}`, { axis: this.lockedAxis, dx, dy });
      }
    }
  }

  private onPointerUp = (ev: PointerEvent) => {
    this.debug('pointerup', { x: ev.clientX, y: ev.clientY, pointerId: ev.pointerId });
    if (!this.tracking || ev.pointerId !== this.pointerId) return;
    this.finishGesture(ev, false);
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
    if (!this.tracking || ev.pointerId !== this.pointerId) return;
    // Try to salvage a swipe on cancel (common when another component captures the pointer)
    this.finishGesture(ev, true);
  };

  // Common end-of-gesture logic used by pointerup and pointercancel.
  // On cancel, we still attempt to recognize a swipe with the data we have.
  private finishGesture(ev: PointerEvent, cancelled: boolean) {
    this.debug('finishGesture begin', {
      cancelled,
      hasTimer: !!this.longPressTimer,
      pressFired: this.pressFired,
      ownedLanes: this.ownedLanes
    });
    // Mark pointerId inactive for new sequences to start clean
    try {
      const deleted = (this.constructor as typeof GestureDirective)._activePointers.delete(ev.pointerId);
      this.debug('activePointers delete', { pointerId: ev.pointerId, deleted });
    } catch { /* ignore */ }
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    const dx = ev.clientX - this.startX;
    const dy = ev.clientY - this.startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (this.longPressTimer) {
      this.debug(`longpress cancelled by ${cancelled ? 'pointercancel' : 'pointerup'}`, {
        durationMs: Math.round(duration),
        absDx, absDy,
        pressMoveSlop: this._pressMoveSlop
      });
      window.clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
      this.removeLongpressCancelListeners();
    }

    // If longpress was recognized, reset so the next gesture can start cleanly
    if (this.pressFired) {
      this.debug(`${cancelled ? 'pointercancel' : 'pointerup'} after longpress: resetting gesture state`);
      this.reset();
      return;
    }

    // Swipe detection (also attempted on cancel), gated by mode
    const withinDuration = duration <= this._swipeMaxDuration;
    if (withinDuration) {
      const _allowH = this.modeAllowsHorizontal();
      const _allowV = this.modeAllowsVertical();
      const horizontalOk =
        _allowH && this.ownedLanes.h && ((this.lockedAxis === 'x' && absDx >= this._swipeMinDistance) ||
          (!this.lockedAxis && absDx >= this._swipeMinDistance && absDx >= absDy));
      const verticalOk =
        _allowV && this.ownedLanes.v && ((this.lockedAxis === 'y' && absDy >= this._swipeMinDistance) ||
          (!this.lockedAxis && absDy >= this._swipeMinDistance && absDy > absDx));
      this.debug('swipe gating', { allowH: _allowH, allowV: _allowV, owned: this.ownedLanes, lockedAxis: this.lockedAxis, horizontalOk, verticalOk });

      if (horizontalOk) {
        this.debugSwipeDecision({
          phase: 'recognized',
          axis: 'x',
          dx, dy, absDx, absDy, duration,
          reason: cancelled ? 'horizontal swipe (on cancel)' : 'horizontal swipe',
        });
        this.debug('swipe detected', { direction: dx > 0 ? 'right' : 'left', dx, dy, duration });
        this.zone.run(() => {
          if (dx > 0) this.emitSwipeEvent('swiperight', { dx, dy, duration });
          else this.emitSwipeEvent('swipeleft', { dx, dy, duration });
        });
        this.reset();
        return;
      } else if (verticalOk) {
        this.debugSwipeDecision({
          phase: 'recognized',
          axis: 'y',
          dx, dy, absDx, absDy, duration,
          reason: cancelled ? 'vertical swipe (on cancel)' : 'vertical swipe',
        });
        this.debug('swipe detected', { direction: dy > 0 ? 'down' : 'up', dx, dy, duration });
        this.zone.run(() => {
          if (dy > 0) this.emitSwipeEvent('swipedown', { dx, dy, duration });
          else this.emitSwipeEvent('swipeup', { dx, dy, duration });
        });
        this.reset();
        return;
      }

      // Only log rejection on non-cancel path to avoid noise
      if (!cancelled) {
        const primaryAxis: 'x' | 'y' = this.lockedAxis ?? (absDx >= absDy ? 'x' : 'y');
        const primaryDist = primaryAxis === 'x' ? absDx : absDy;
        const reasonParts = [] as string[];
        if (primaryDist < this._swipeMinDistance) reasonParts.push(`distance ${Math.round(primaryDist)}px < min ${this._swipeMinDistance}px`);
        if (!this.lockedAxis && ((primaryAxis === 'x' && absDy > absDx) || (primaryAxis === 'y' && absDx > absDy))) reasonParts.push('orthogonal movement dominated');
        this.debugSwipeDecision({
          phase: 'rejected',
          axis: primaryAxis,
          dx, dy, absDx, absDy, duration,
          reason: reasonParts.join('; ') || 'fell through conditions'
        });
      }
    } else if (!cancelled) {
      // Duration too long: likely not a swipe. Log decision details on non-cancel path.
      this.debugSwipeDecision({
        phase: 'rejected',
        axis: this.lockedAxis ?? (absDx >= absDy ? 'x' : 'y'),
        dx, dy, absDx, absDy, duration,
        reason: `duration ${Math.round(duration)}ms exceeds max ${this._swipeMaxDuration}ms`,
      });
    }

    // Double tap detection (only on non-cancel, since cancel means we lost the sequence), gated by mode/flag
    if (!cancelled && this.ownedLanes.p && this.modeAllowsDoubleTap() && this.currentPointerType !== 'mouse' && absDx <= this._tapSlop && absDy <= this._tapSlop && duration < this._longPressMs) {
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

    // If it was a tap (not long press) record data for next pointerdown's potentialDoubleTap evaluation (only on non-cancel)
    if (!cancelled && !this.pressFired && absDx <= this._tapSlop && absDy <= this._tapSlop && duration < this._longPressMs) {
      this.lastTapUpTime = endTime;
      this.lastTapUpX = ev.clientX;
      this.lastTapUpY = ev.clientY;
    } else {
      // Reset potential double tap tracking if gesture was swipe or press
      this.potentialDoubleTap = false;
    }

    this.reset();
  }

  private addLongpressCancelListeners() {
    this.debug('addLongpressCancelListeners');
    // Cancel longpress only on explicit pointercancel (UA/system), plus window blur for touch/pen
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
    const handlers: CancelHandlerEntry[] = [
      { type: 'pointercancel', handler: cancel, opts: captureOpts, targets: ['el', 'doc'] },
    ];
    // For touch/pen, keep a safety net on window blur only
    if (this.currentPointerType !== 'mouse') {
      handlers.push({ type: 'blur', handler: cancel, opts: captureOpts, targets: ['window'] });
    }
    this.cancelLongpressHandlers = handlers;
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
      if (this.pointerId !== null && this.captureEl && 'releasePointerCapture' in this.captureEl) {
        this.captureEl.releasePointerCapture(this.pointerId);
      }
    } catch {
      /* ignore release errors */
    }

    // release per-lane ownership for this pointerId
    try {
      if (this.pointerId !== null) {
        const map = (this.constructor as typeof GestureDirective)._laneOwners;
        const owners = map.get(this.pointerId);
        if (owners) {
          this.debug('releasing lane ownership', { pointerId: this.pointerId, ownersBefore: owners, ownedByThis: this.ownedLanes, instanceId: this._instanceId });
          if (this.ownedLanes.h && owners.h === this._instanceId) delete owners.h;
          if (this.ownedLanes.v && owners.v === this._instanceId) delete owners.v;
          if (this.ownedLanes.p && owners.p === this._instanceId) delete owners.p;
          if (!owners.h && !owners.v && !owners.p) map.delete(this.pointerId); else map.set(this.pointerId, owners);
          this.debug('lane owners after release', { pointerId: this.pointerId, owners });
        }
      }
    } catch { /* ignore */ }
    // Important: clear activePointers before nulling pointerId to avoid leaks on press path
    try {
      if (this.pointerId !== null) {
        const deleted = (this.constructor as typeof GestureDirective)._activePointers.delete(this.pointerId);
        this.debug('activePointers delete (reset)', { pointerId: this.pointerId, deleted });
      }
    } catch { /* ignore */ }
    this.pointerId = null;
  this.captureEl = null;
    this.tracking = false;
    this.pressFired = false;
    this.currentPointerType = null;
    this.lockedAxis = null;
    this.ownedLanes = { h: false, v: false, p: false };
    this.removeLongpressCancelListeners();
    // Do not reset potentialDoubleTap here; it is cleared on pointerup logic or after completion
    // Do not call removeSuppression() here – we only clear suppression on real pointer up/cancel
  }

  private isDebugEnabled(): boolean {
    try {
      return (this.constructor as typeof GestureDirective).DEBUG;
    } catch {
      return (this.constructor as typeof GestureDirective).DEBUG;
    }
  }

  private recordMove(ev: PointerEvent, source: 'move' | 'raw') {
    if (!this.isDebugEnabled()) return;
    this.moveSamples.push({ t: performance.now(), x: ev.clientX, y: ev.clientY, source });
    if (this.moveSamples.length > (this.constructor as typeof GestureDirective).MOVES_BUFFER_SIZE) {
      this.moveSamples.shift();
    }
  }

  private debugSwipeDecision(info: {
    phase: 'recognized' | 'rejected';
    axis: 'x' | 'y' | null;
    dx: number; dy: number; absDx: number; absDy: number; duration: number;
    reason: string;
    velocity?: number;
  }) {
    if (!this.isDebugEnabled()) return;
    const samples = this.moveSamples;
    const last = samples[samples.length - 1];
    // compute recent (last 100ms) velocity on primary axis as additional context
    let recentVel: number | undefined;
    if (samples.length >= 2) {
      const endT = last?.t ?? performance.now();
      const windowMs = 100;
      let idx = samples.length - 2;
      while (idx >= 0 && endT - samples[idx].t < windowMs) idx--;
      idx = Math.max(0, idx);
      const s = samples[idx];
      const dt = Math.max(1, (last?.t ?? endT) - s.t);
      const ddx = (last?.x ?? 0) - s.x;
      const ddy = (last?.y ?? 0) - s.y;
      const primary = info.axis === 'x' ? Math.abs(ddx) : Math.abs(ddy);
      recentVel = primary / dt; // px/ms over ~100ms
    }
    this.debug('swipe decision', {
      phase: info.phase,
      axis: info.axis,
      dx: info.dx,
      dy: info.dy,
      absDx: info.absDx,
      absDy: info.absDy,
      durationMs: Math.round(info.duration),
      velocityAvgPxPerMs: info.velocity ?? ((info.axis === 'x' ? info.absDx : info.absDy) / Math.max(1, info.duration)),
      recentVelocity100msPxPerMs: recentVel,
      minDistance: this._swipeMinDistance,
      maxDuration: this._swipeMaxDuration,
      lockedAxis: this.lockedAxis,
      reason: info.reason,
      samplesCount: samples.length,
      firstSample: samples[0],
      lastSample: samples[samples.length - 1]
    });
  }

  private debug(...args: unknown[]) {
    if (this.isDebugEnabled()) {
      console.debug(`[GestureDirective][#${this._instanceId}]`, ...args);
    }
  }

  // Emit via Angular outputs AND dispatch a bubbling DOM CustomEvent so ancestors can listen too.
  private emitSwipeEvent(name: 'swipeleft' | 'swiperight' | 'swipeup' | 'swipedown', detail: { dx: number; dy: number; duration: number }) {
    (detail as unknown as { __gid?: number }).__gid = this._instanceId;
    const evt = new CustomEvent(name, { detail, bubbles: true, composed: true });
    try { this.host.nativeElement.dispatchEvent(evt); } catch { /* ignore */ }
    this.debug('emitSwipeEvent', { name, detail });
    // Optional bridge to global UI events for app shell listeners
    if (this.bridgeUiEvents() && (name === 'swipeleft' || name === 'swiperight')) {
      try {
        const bridge = name === 'swipeleft' ? 'openLeftSidenav' : 'openRightSidenav';
        document.dispatchEvent(new CustomEvent(bridge, { detail }));
      } catch { /* ignore */ }
    }
    switch (name) {
      case 'swipeleft': this.swipeleft.emit(evt as CustomEvent<{ dx: number; dy: number; duration: number }>); break;
      case 'swiperight': this.swiperight.emit(evt as CustomEvent<{ dx: number; dy: number; duration: number }>); break;
      case 'swipeup': this.swipeup.emit(evt as CustomEvent<{ dx: number; dy: number; duration: number }>); break;
      case 'swipedown': this.swipedown.emit(evt as CustomEvent<{ dx: number; dy: number; duration: number }>); break;
    }
  }

  private emitPressEvent(detail: { x: number; y: number; center?: { x: number; y: number } }) {
    // Minimal cooldown to avoid duplicate invocations if rebroadcast and direct emit race
    const now = performance.now();
    if (now - (this as { _lastPressEmitTs?: number })._lastPressEmitTs! < 80) {
      this.debug('press emit suppressed by cooldown');
      return;
    }
    (this as { _lastPressEmitTs?: number })._lastPressEmitTs = now;
    (detail as unknown as { __gid?: number }).__gid = this._instanceId;
    const evt = new CustomEvent('press', { detail, bubbles: true, composed: true });
    try { this.host.nativeElement.dispatchEvent(evt); } catch { /* ignore */ }
    this.debug('emitPressEvent', { detail });
    this.press.emit(evt as CustomEvent<{ x: number; y: number; center?: { x: number; y: number } }>);
  }

  private emitDoubleTapEvent(detail: { x: number; y: number; dt: number }) {
    (detail as unknown as { __gid?: number }).__gid = this._instanceId;
    const evt = new CustomEvent('doubletap', { detail, bubbles: true, composed: true });
    try { this.host.nativeElement.dispatchEvent(evt); } catch { /* ignore */ }
    this.doubletap.emit(evt as CustomEvent<{ x: number; y: number; dt: number }>);
  }

  // Mode helpers
  private modeAllowsHorizontal(): boolean {
    const m = this.mode();
    if (this.disableGestures()) return false;
    return m === 'all' || m === 'horizontal';
  }
  private modeAllowsVertical(): boolean {
    const m = this.mode();
    if (this.disableGestures()) return false;
    return m === 'all' || m === 'dashboard';
  }
  private modeAllowsPress(): boolean {
    const m = this.mode();
    if (this.disableGestures()) return false;
    const allows = m === 'all' || m === 'dashboard' || m === 'press' || m === 'editor';
    return allows && this.enablePress();
  }
  private modeAllowsDoubleTap(): boolean {
    const m = this.mode();
    if (this.disableGestures()) return false;
    // no doubletap in 'horizontal' mode to avoid global capture of taps
    const allows = m === 'all' || m === 'dashboard' || m === 'press' || m === 'editor';
    return allows && this.enableDoubleTap();
  }

  // ----------- Diagnostics helpers (debug only) -----------
  private elDesc(el: Element | null | undefined): string | null {
    if (!el) return null;
    try {
      const h = el as HTMLElement;
      const tag = el.tagName?.toLowerCase?.() ?? 'node';
      const id = h.id ? `#${h.id}` : '';
      const clsStr = (h.className && typeof h.className === 'string') ? h.className : '';
      const cls = clsStr ? '.' + clsStr.split(/\s+/).filter(Boolean).slice(0, 4).join('.') : '';
      return `${tag}${id}${cls}`;
    } catch { return 'node'; }
  }

  private ownerRelationshipSummary(ownerEl: Element | null, hostEl: Element, targetEl: Element | null) {
    try {
      const rel = {
        owner: this.elDesc(ownerEl),
        host: this.elDesc(hostEl),
        target: this.elDesc(targetEl),
        ownerIsConnected: ownerEl ? (ownerEl as HTMLElement).isConnected : null,
        hostIsConnected: (hostEl as HTMLElement).isConnected,
        targetIsConnected: targetEl ? (targetEl as HTMLElement).isConnected : null,
        targetInOwner: ownerEl && targetEl ? ownerEl.contains(targetEl) : null,
        targetInHost: targetEl ? hostEl.contains(targetEl) : null,
        ownerInHost: ownerEl ? hostEl.contains(ownerEl) : null,
        hostInOwner: ownerEl ? ownerEl.contains(hostEl) : null,
      } as Record<string, unknown>;
      return rel;
    } catch {
      return {};
    }
  }
}

// Global debug toggler and boot-time enablement
(() => {
  try {
    // Enable via persisted localStorage flag only (URL parameter support removed)
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('kip:gesturesDebug') : null;
    if (stored === '1') {
      (GestureDirective as unknown as { DEBUG: boolean }).DEBUG = true;
    }
    // Expose console helper: kipGesturesDebug(true|false) or kipGesturesDebug() to toggle
    const w = window as unknown as { kipGesturesDebug?: (on?: boolean) => boolean };
    w.kipGesturesDebug = (on?: boolean) => {
      const ctor = GestureDirective as unknown as { DEBUG: boolean };
      if (typeof on === 'boolean') ctor.DEBUG = on; else ctor.DEBUG = !ctor.DEBUG;
      try { localStorage.setItem('kip:gesturesDebug', ctor.DEBUG ? '1' : '0'); } catch { /* ignore */ }
      console.info('KIP gestures debug:', ctor.DEBUG);
      return ctor.DEBUG;
    };
  } catch {
    /* ignore */
  }
})();
