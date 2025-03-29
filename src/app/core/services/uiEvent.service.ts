import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class uiEventService {
  public isDragging = signal<boolean>(false);
  private initialTouchX: number | null = null;
  private initialTouchY: number | null = null;

  constructor() { }

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
