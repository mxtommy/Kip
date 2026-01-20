export interface SwipeGuardOptions {
  /**
   * Distance in px before a gesture is considered a swipe.
   * Defaults to 30 to match existing boolean-switch behavior.
   */
  threshold?: number;
}

export interface SwipeGuard {
  onPointerDown(event: PointerEvent): void;
  onPointerMove(event: PointerEvent): void;
  /**
   * Returns true when the gesture should be treated as a click/tap.
   * Always resets the internal swipe state.
   */
  onPointerUp(event?: PointerEvent): boolean;
  /**
   * Cancels the current gesture and releases any pointer capture.
   */
  onPointerCancel(event?: PointerEvent): void;
  reset(): void;
}

export function createSwipeGuard(options: SwipeGuardOptions = {}): SwipeGuard {
  const threshold = options.threshold ?? 30;
  let isSwiping = false;
  let startX = 0;
  let startY = 0;
  let captureTarget: Element | null = null;
  let capturePointerId: number | null = null;

  const reset = () => {
    isSwiping = false;
    startX = 0;
    startY = 0;
    captureTarget = null;
    capturePointerId = null;
  };

  return {
    onPointerDown(event: PointerEvent): void {
      isSwiping = false;
      startX = event.clientX;
      startY = event.clientY;
      const target = event.currentTarget as Element | null;
      if (target && typeof (target as Element).setPointerCapture === 'function') {
        try {
          target.setPointerCapture(event.pointerId);
          captureTarget = target;
          capturePointerId = event.pointerId;
        } catch {
          // Ignore capture errors (e.g., pointer already captured)
        }
      }
    },
    onPointerMove(event: PointerEvent): void {
      const deltaX = Math.abs(event.clientX - startX);
      const deltaY = Math.abs(event.clientY - startY);
      if (deltaX > threshold || deltaY > threshold) {
        isSwiping = true;
      }
    },
    onPointerUp(event?: PointerEvent): boolean {
      if (captureTarget && capturePointerId !== null) {
        const target = captureTarget;
        if (typeof (target as Element).releasePointerCapture === 'function') {
          try {
            if (!event || (target as Element).hasPointerCapture?.(capturePointerId)) {
              (target as Element).releasePointerCapture(capturePointerId);
            }
          } catch {
            // Ignore release errors
          }
        }
      }
      const shouldFire = !isSwiping;
      reset();
      return shouldFire;
    },
    onPointerCancel(event?: PointerEvent): void {
      if (captureTarget && capturePointerId !== null) {
        const target = captureTarget;
        if (typeof (target as Element).releasePointerCapture === 'function') {
          try {
            if (!event || (target as Element).hasPointerCapture?.(capturePointerId)) {
              (target as Element).releasePointerCapture(capturePointerId);
            }
          } catch {
            // Ignore release errors
          }
        }
      }
      reset();
    },
    reset
  };
}
