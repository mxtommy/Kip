import { Injectable, signal } from '@angular/core';
import screenfull from 'screenfull';
declare let NoSleep: any; //3rd party library

@Injectable({
  providedIn: 'root'
})
export class uiEventService {
  public isDragging = signal<boolean>(false);
  public fullscreenStatus = signal<boolean>(false);
  public fullscreenSupported = signal<boolean>(true);
  public noSleepStatus = signal<boolean>(false);
  public noSleepSupported = signal<boolean>(true);
  private noSleep = new NoSleep();
  private initialTouchX: number | null = null;
  private initialTouchY: number | null = null;
  private hotkeyListeners = new Map<(key: string, event: KeyboardEvent) => void, EventListener>();

  constructor() {
    if (screenfull.isEnabled) {
      screenfull.on('change', () => {
        this.fullscreenStatus.set(screenfull.isFullscreen);
        if (!screenfull.isFullscreen) {
          this.noSleep.disable();
        }
      });
    } else {
      this.fullscreenSupported.set(false);
      console.log('[Actions Menu] Fullscreen mode is not supported by device/browser.');
    }

    this.checkNoSleepSupport();
    if (this.checkPwaMode() && this.noSleepSupported() && !this.noSleepStatus()) {
      this.toggleNoSleep();
    }
  }

  private checkNoSleepSupport(): void {
    try {
      this.noSleep = new NoSleep();
      if (typeof this.noSleep.enable !== 'function' || typeof this.noSleep.disable !== 'function') {
        throw new Error('[Actions Menu] NoSleep methods not available');
      }
    } catch (error) {
      this.noSleepSupported.set(false);
      console.warn('[Actions Menu] NoSleep is not supported by this device/browser.');
    }
  }

  private checkPwaMode(): boolean {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone !== undefined;
    console.log('[Actions Menu] PWA mode:', isStandalone);
    return isStandalone;
  }

  private toggleNoSleep(): void {
    if (this.noSleepSupported()) {
      if (!this.noSleepStatus()) {
        this.noSleep.enable();
      } else {
        this.noSleep.disable();
      }
      this.noSleepStatus.set(!this.noSleepStatus());
      console.log('[Actions Menu] NoSleep active:', this.noSleepStatus());
    }
  }

  public toggleFullScreen(): void {
    if (screenfull.isEnabled) {
      if (!this.fullscreenStatus()) {
        screenfull.request();
        this.noSleep.enable();
      } else {
        if (screenfull.isFullscreen) {
          screenfull.exit();
        }
        this.noSleep.disable();
      }
      this.fullscreenStatus.set(!this.fullscreenStatus());
    } else {
      this.fullscreenSupported.set(false);
      console.log('[Actions Menu] Fullscreen mode is not supported by this browser.');
    }
  }

  public addGestureListeners(
    onSwipeLeft: (e: Event) => void,
    onSwipeRight: (e: Event) => void
  ): void {
    const boundPreventGestures = this.preventBrowserHistorySwipeGestures.bind(this);
    document.addEventListener('openLeftSidenav', onSwipeLeft);
    document.addEventListener('openRightSidenav', onSwipeRight);
    document.addEventListener('touchstart', boundPreventGestures, { passive: false });
    document.addEventListener('touchmove', boundPreventGestures, { passive: false });
    document.addEventListener('touchend', boundPreventGestures);
    document.addEventListener('touchcancel', boundPreventGestures);
  }

  public removeGestureListeners(
    onSwipeLeft: (e: Event) => void,
    onSwipeRight: (e: Event) => void
  ): void {
    const boundPreventGestures = this.preventBrowserHistorySwipeGestures.bind(this);
    document.removeEventListener('openLeftSidenav', onSwipeLeft);
    document.removeEventListener('openRightSidenav', onSwipeRight);
    document.removeEventListener('touchstart', boundPreventGestures);
    document.removeEventListener('touchmove', boundPreventGestures);
    document.removeEventListener('touchend', boundPreventGestures);
    document.removeEventListener('touchcancel', boundPreventGestures);
  }

  public preventBrowserHistorySwipeGestures(e: TouchEvent): void {
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
}
