import { Injectable, OnDestroy, signal } from '@angular/core';
import screenfull from 'screenfull';
import NoSleep from '@zakj/no-sleep';

@Injectable({
  providedIn: 'root'
})
export class uiEventService implements OnDestroy {
  public isDragging = signal<boolean>(false);
  public fullscreenStatus = signal<boolean>(false);
  public fullscreenSupported = signal<boolean>(true);
  public noSleepStatus = signal<boolean>(false);
  public noSleepSupported = signal<boolean>(true);
  private noSleep: { enable: () => void; disable: () => void } | null = null;
  private initialTouchX: number | null = null;
  private initialTouchY: number | null = null;
  private hotkeyListeners = new Map<(key: string, event: KeyboardEvent) => void, EventListener>();
  // Stored bound gesture handler so remove works (otherwise bind() creates new fn)
  private boundPreventGestures: EventListener | null = null;
  private readonly fullscreenChangeHandler = () => {
    this.fullscreenStatus.set(screenfull.isFullscreen);
    if (!screenfull.isFullscreen) {
      // On exit, disable NoSleep if we enabled it purely for fullscreen
      if (this.noSleep && this.noSleepStatus()) {
        try { this.noSleep.disable(); } catch { /* ignore disable errors */ }
        this.noSleepStatus.set(false);
      }
    }
  };

  constructor() {
    // Skip side-effectful logic during unit tests to avoid reloads / timers
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isTest = (window as any).__KIP_TEST__;
    if (!isTest) {
      if (screenfull.isEnabled) {
        screenfull.on('change', this.fullscreenChangeHandler);
      } else {
        this.fullscreenSupported.set(false);
        console.log('[UI Event Service] Fullscreen mode is not supported by device/browser.');
      }

      this.checkNoSleepSupport();
      if (this.checkPwaMode() && this.noSleepSupported() && !this.noSleepStatus()) {
        this.toggleNoSleep();
      }
    } else {
      // In tests mark features unsupported to short-circuit code paths gracefully
      this.fullscreenSupported.set(false);
      this.noSleepSupported.set(false);
    }
  }

  private checkNoSleepSupport(): void {
    try {
      if (!this.noSleep) {
        this.noSleep = new NoSleep();
      }
      if (!this.noSleep || typeof this.noSleep.enable !== 'function' || typeof this.noSleep.disable !== 'function') {
        throw new Error('[UI Event Service] NoSleep methods not available');
      }
    } catch (error) {
      this.noSleepSupported.set(false);
      console.warn(`[UI Event Service] NoSleep is not supported by this device/browser. Error: ${error}`);
      this.noSleep = null;
    }
  }

  private checkPwaMode(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone !== undefined;
    console.log('[UI Event Service] PWA mode:', isStandalone);
    return isStandalone;
  }

  private toggleNoSleep(): void {
    if (this.noSleepSupported()) {
      if (!this.noSleepStatus()) {
        if (!this.noSleep) this.checkNoSleepSupport();
        try { this.noSleep?.enable(); } catch (e) { console.warn('[UI Event Service] Failed to enable NoSleep:', e); }
      } else {
        try { this.noSleep?.disable(); } catch { /* ignore */ }
      }
      this.noSleepStatus.set(!this.noSleepStatus());
      console.log('[UI Event Service] NoSleep active:', this.noSleepStatus());
    }
  }

  public toggleFullScreen(): void {
    if (screenfull.isEnabled) {
      if (!this.fullscreenStatus()) {
        screenfull.request();
        if (!this.noSleepStatus()) {
          if (!this.noSleep) this.checkNoSleepSupport();
          try { this.noSleep?.enable(); this.noSleepStatus.set(true); } catch { /* enable failed */ }
        }
      } else {
        if (screenfull.isFullscreen) {
          screenfull.exit();
        }
        if (this.noSleepStatus()) { try { this.noSleep?.disable(); } catch { /* ignore */ } this.noSleepStatus.set(false); }
      }
      this.fullscreenStatus.set(!this.fullscreenStatus());
    } else {
      this.fullscreenSupported.set(false);
      console.log('[UI Event Service] Fullscreen mode is not supported by this browser.');
    }
  }

  public addGestureListeners(onSwipeLeft: (e: Event | CustomEvent) => void, onSwipeRight: (e: Event | CustomEvent) => void): void {
    if (!this.boundPreventGestures) {
      this.boundPreventGestures = this.preventBrowserHistorySwipeGestures.bind(this);
    }
    document.addEventListener('openLeftSidenav', onSwipeLeft);
    document.addEventListener('openRightSidenav', onSwipeRight);
    document.addEventListener('touchstart', this.boundPreventGestures, { passive: false });
    document.addEventListener('touchmove', this.boundPreventGestures, { passive: false });
    document.addEventListener('touchend', this.boundPreventGestures);
    document.addEventListener('touchcancel', this.boundPreventGestures);
  }

  public removeGestureListeners(onSwipeLeft: (e: Event | CustomEvent) => void, onSwipeRight: (e: Event | CustomEvent) => void): void {
    document.removeEventListener('openLeftSidenav', onSwipeLeft);
    document.removeEventListener('openRightSidenav', onSwipeRight);
    if (this.boundPreventGestures) {
      document.removeEventListener('touchstart', this.boundPreventGestures);
      document.removeEventListener('touchmove', this.boundPreventGestures);
      document.removeEventListener('touchend', this.boundPreventGestures);
      document.removeEventListener('touchcancel', this.boundPreventGestures);
    }
  }

  public preventBrowserHistorySwipeGestures(e: TouchEvent): void {
    if (!(e instanceof TouchEvent)) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      const edgeThreshold = 30; // More reliable threshold

      if (e.type === 'touchstart') {
        this.initialTouchX = touch.clientX;
        this.initialTouchY = touch.clientY;
      } else if (e.type === 'touchmove' && this.initialTouchX !== null && this.initialTouchY !== null) {
        const deltaX = Math.abs(touch.clientX - this.initialTouchX);
        const deltaY = Math.abs(touch.clientY - this.initialTouchY);

        // Prevent only strong horizontal swipes from the screen edges
        if (
          deltaX > 10 && deltaX > deltaY && (this.initialTouchX < edgeThreshold || this.initialTouchX > window.innerWidth - edgeThreshold)
        ) {
          e.preventDefault();
        }

        // Prevent downward swipe (pull-to-refresh)
        if (deltaY > 10 && this.initialTouchY < 50) {
          e.preventDefault();
        }
      } else if (e.type === 'touchend' || e.type === 'touchcancel') {
        this.initialTouchX = null;
        this.initialTouchY = null;
      }
    }
  }

  public addHotkeyListener(
    callback: (key: string, event: KeyboardEvent) => void,
    options?: { keys?: string[]; ctrlKey?: boolean; shiftKey?: boolean }
  ): void {
    const wrappedCallback: EventListener = (event: Event) => {
      if (event instanceof KeyboardEvent) {
        const normalizedKey = event.key.toLowerCase(); // Normalize key to lowercase
        // Apply optional filters
        if (options) {
          if (options.keys && !options.keys.includes(normalizedKey)) {
            return; // Skip if the key is not in the allowed list
          }
          if (options.ctrlKey !== undefined && event.ctrlKey !== options.ctrlKey) {
            return; // Skip if ctrlKey does not match
          }
          if (options.shiftKey !== undefined && event.shiftKey !== options.shiftKey) {
            return; // Skip if shiftKey does not match
          }
        }

        callback(normalizedKey, event); // Pass normalized key and event to the callback
      } else {
        console.warn("[uiEvent Service] Non-keyboard event detected in addHotkeyListener:", event);
      }
    };

    this.hotkeyListeners.set(callback, wrappedCallback);
    document.addEventListener('keydown', wrappedCallback);
  }

  public removeHotkeyListener(callback: (key: string, event: KeyboardEvent) => void): void {
    const wrappedCallback = this.hotkeyListeners.get(callback);
    if (wrappedCallback) {
      document.removeEventListener('keydown', wrappedCallback);
      this.hotkeyListeners.delete(callback);
    }
  }

  ngOnDestroy(): void {
    // Cleanup screenfull listener (mainly for tests / HMR safety)
    if (screenfull.isEnabled) {
      try { screenfull.off('change', this.fullscreenChangeHandler); } catch { /* ignore */ }
    }
    // Disable NoSleep to release resources
    if (this.noSleep && this.noSleepStatus()) {
      try { this.noSleep.disable(); } catch { /* ignore */ }
    }
    this.noSleep = null;
    // Remove any globally added gesture listeners if still present
    if (this.boundPreventGestures) {
      document.removeEventListener('touchstart', this.boundPreventGestures);
      document.removeEventListener('touchmove', this.boundPreventGestures);
      document.removeEventListener('touchend', this.boundPreventGestures);
      document.removeEventListener('touchcancel', this.boundPreventGestures);
      this.boundPreventGestures = null;
    }
    // Hotkeys
    for (const [, listener] of this.hotkeyListeners.entries()) {
      document.removeEventListener('keydown', listener);
    }
    this.hotkeyListeners.clear();
  }
}
