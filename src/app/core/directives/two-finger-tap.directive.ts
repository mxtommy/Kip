import { Directive, input, output } from '@angular/core';

interface PointerStart {
  x: number;
  y: number;
}

/**
 * Detects a two-finger tap on the host element and emits a single event when it completes.
 */
@Directive({
  selector: '[twoFingerTap]',
  host: {
    '(pointerdown)': 'onPointerDown($event)',
    '(pointermove)': 'onPointerMove($event)',
    '(pointerup)': 'onPointerUp($event)',
    '(pointercancel)': 'onPointerCancel($event)'
  }
})
export class TwoFingerTapDirective {
  /**
   * Enables or disables the two-finger tap detector.
   *
   * Parameters: none.
   * Returns: the current enabled signal accessor.
   *
   * @example
   * <div twoFingerTap [twoFingerTapEnabled]="true"></div>
   */
  twoFingerTapEnabled = input(true);

  /**
   * Maximum duration in milliseconds between the two-finger touch start and end.
   *
   * Parameters: none.
   * Returns: the configured max duration signal accessor.
   *
   * @example
   * <div twoFingerTap [twoFingerTapMaxDurationMs]="450"></div>
   */
  twoFingerTapMaxDurationMs = input(450);

  /**
   * Maximum movement in pixels allowed for each finger.
   *
   * Parameters: none.
   * Returns: the configured movement threshold signal accessor.
   *
   * @example
   * <div twoFingerTap [twoFingerTapMoveThresholdPx]="24"></div>
   */
  twoFingerTapMoveThresholdPx = input(24);

  /**
   * When true, the directive calls preventDefault/stopPropagation on a valid tap.
   *
   * Parameters: none.
   * Returns: the configured prevent-default signal accessor.
   *
   * @example
   * <div twoFingerTap [twoFingerTapPreventDefault]="true"></div>
   */
  twoFingerTapPreventDefault = input(true);

  /**
   * Emits when a valid two-finger tap is detected.
   *
   * Parameters: none.
  * Returns: output emitter that carries the pointer event that ended the gesture.
   *
   * @example
   * <div twoFingerTap (twoFingerTap)="onTwoFingerTap($event)"></div>
   */
  twoFingerTap = output<PointerEvent>();

  private readonly pointers = new Map<number, PointerStart>();
  private candidate = false;
  private moved = false;
  private startedAtMs = 0;
  private blocked = false;

  public onPointerDown(event: PointerEvent): void {
    if (!this.twoFingerTapEnabled() || event.pointerType !== 'touch') {
      return;
    }

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2 && !this.blocked) {
      this.candidate = true;
      this.moved = false;
      this.startedAtMs = Date.now();
      return;
    }

    if (this.pointers.size > 2) {
      this.blocked = true;
      this.resetTracking(false);
    }
  }

  public onPointerMove(event: PointerEvent): void {
    if (!this.candidate || event.pointerType !== 'touch') {
      return;
    }

    const start = this.pointers.get(event.pointerId);
    if (!start) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    if (Math.hypot(deltaX, deltaY) > this.twoFingerTapMoveThresholdPx()) {
      this.moved = true;
    }
  }

  public onPointerUp(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      return;
    }

    this.pointers.delete(event.pointerId);

    if (this.blocked) {
      if (this.pointers.size === 0) {
        this.blocked = false;
      }
      return;
    }

    if (!this.candidate || this.pointers.size > 0) {
      return;
    }

    const elapsedMs = Date.now() - this.startedAtMs;
    const isValidTap = !this.moved && elapsedMs <= this.twoFingerTapMaxDurationMs();

    this.resetTracking(false);

    if (!isValidTap) {
      return;
    }

    if (this.twoFingerTapPreventDefault()) {
      event.preventDefault();
      event.stopPropagation();
    }

    this.twoFingerTap.emit(event);
  }

  public onPointerCancel(event: PointerEvent): void {
    if (event.pointerType !== 'touch') {
      return;
    }

    this.pointers.delete(event.pointerId);
    if (this.pointers.size === 0) {
      this.resetTracking(true);
    }
  }

  private resetTracking(keepBlocked: boolean): void {
    this.pointers.clear();
    this.candidate = false;
    this.moved = false;
    this.startedAtMs = 0;
    if (!keepBlocked) {
      this.blocked = false;
    }
  }
}
