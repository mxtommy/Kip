import { Injectable, signal } from '@angular/core';
import screenfull from 'screenfull';
declare var NoSleep: any; //3rd party library

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
      console.warn('[Actions Menu] Fullscreen mode is not supported by this device/browser.');
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
      console.log('[Actions Menu] NoSleep:', this.noSleepStatus());
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
      console.warn('[Actions Menu] Fullscreen mode is not supported by this browser.');
    }
  }

  public addGestureListeners(
    onSwipeLeft: (e: Event) => void,
    onSwipeRight: (e: Event) => void,
    preventBrowserHistorySwipeGestures: (e: TouchEvent) => void
  ): void {
    document.addEventListener('openLeftSidenav', onSwipeLeft);
    document.addEventListener('openRightSidenav', onSwipeRight);
    document.addEventListener('touchstart', preventBrowserHistorySwipeGestures, { passive: false });
    document.addEventListener('touchmove', preventBrowserHistorySwipeGestures, { passive: false });
    document.addEventListener('touchend', preventBrowserHistorySwipeGestures);
    document.addEventListener('touchcancel', preventBrowserHistorySwipeGestures);
  }

  public removeGestureListeners(
    onSwipeLeft: (e: Event) => void,
    onSwipeRight: (e: Event) => void,
    preventBrowserHistorySwipeGestures: (e: TouchEvent) => void
  ): void {
    document.removeEventListener('openLeftSidenav', onSwipeLeft);
    document.removeEventListener('openRightSidenav', onSwipeRight);
    document.removeEventListener('touchstart', preventBrowserHistorySwipeGestures);
    document.removeEventListener('touchmove', preventBrowserHistorySwipeGestures);
    document.removeEventListener('touchend', preventBrowserHistorySwipeGestures);
    document.removeEventListener('touchcancel', preventBrowserHistorySwipeGestures);
  }

  public preventBrowserHistorySwipeGestures(e: TouchEvent): void {
    if (e.touches.length === 1) {
      const touch = e.touches[0];

      if (e.type === 'touchstart') {
        this.initialTouchX = touch.clientX;
        this.initialTouchY = touch.clientY;
        if (this.initialTouchX < 20 || this.initialTouchX > window.innerWidth - 20) {
          e.preventDefault();
        }
      } else if (e.type === 'touchmove' && this.initialTouchX !== null && this.initialTouchY !== null) {
        const deltaX = Math.abs(touch.clientX - this.initialTouchX);
        const deltaY = Math.abs(touch.clientY - this.initialTouchY);

        if (deltaX > deltaY && (this.initialTouchX < 20 || this.initialTouchX > window.innerWidth - 20)) {
          e.preventDefault();
        }
      } else if (e.type === 'touchend' || e.type === 'touchcancel') {
        this.initialTouchX = null;
        this.initialTouchY = null;
      }
    }
  }

  public addHotkeyListener(callback: (event: KeyboardEvent) => void): void {
    document.addEventListener('keydown', callback);
  }

  public removeHotkeyListener(callback: (event: KeyboardEvent) => void): void {
    document.removeEventListener('keydown', callback);
  }
}
