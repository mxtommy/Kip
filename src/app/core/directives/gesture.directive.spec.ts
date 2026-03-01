import { Component } from '@angular/core';
import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { GestureDirective } from './gesture.directive';

@Component({
  selector: 'test-gesture-host',
  imports: [GestureDirective],
  template: `
    <div
      id="host"
      kipGestures
      [mode]="mode"
      [longPressMs]="longPressMs"
      [pressMoveSlop]="pressMoveSlop"
      [swipeMinDistance]="swipeMinDistance"
      [swipeMaxDuration]="swipeMaxDuration"
      [enableDoubleTap]="enableDoubleTap"
      (press)="onPress($event)"
      (swipeleft)="onSwipeleft($event)"
      (swiperight)="onSwiperight($event)"
      (doubletap)="onDoubletap($event)">
    </div>
  `
})
class TestHostComponent {
  /**
   * Active gesture mode for the directive under test.
   * @returns Current gesture mode value.
   * @example
   * this.mode = 'press';
   */
  public mode: 'all' | 'horizontal' | 'dashboard' | 'press' | 'editor' = 'press';
  /**
   * Long-press threshold in milliseconds.
   * @returns Current long-press duration.
   * @example
   * this.longPressMs = 120;
   */
  public longPressMs = 120;
  /**
   * Movement slop allowed for long-press recognition.
   * @returns Current press move slop threshold.
   * @example
   * this.pressMoveSlop = 12;
   */
  public pressMoveSlop = 12;
  /**
   * Minimum swipe distance used by the directive.
   * @returns Current swipe distance threshold.
   * @example
   * this.swipeMinDistance = 30;
   */
  public swipeMinDistance = 30;
  /**
   * Maximum swipe duration used by the directive.
   * @returns Current swipe duration threshold.
   * @example
   * this.swipeMaxDuration = 600;
   */
  public swipeMaxDuration = 600;
  /**
   * Toggle for double-tap recognition.
   * @returns True when double-tap is enabled.
   * @example
   * this.enableDoubleTap = false;
   */
  public enableDoubleTap = true;
  /**
   * Count of press events emitted by the directive.
   * @returns Total number of press events seen.
   * @example
   * const count = this.pressCount;
   */
  public pressCount = 0;
  /**
   * Count of swipe-left events emitted by the directive.
   * @returns Total number of swipe-left events seen.
   * @example
   * const count = this.swipeLeftCount;
   */
  public swipeLeftCount = 0;
  /**
   * Count of swipe-right events emitted by the directive.
   * @returns Total number of swipe-right events seen.
   * @example
   * const count = this.swipeRightCount;
   */
  public swipeRightCount = 0;
  /**
   * Count of double-tap events emitted by the directive.
   * @returns Total number of double-tap events seen.
   * @example
   * const count = this.doubleTapCount;
   */
  public doubleTapCount = 0;

  /**
   * Handle long-press output from the directive.
   * @param _event Press event payload.
   * @returns void
   * @example
   * this.onPress(event);
   */
  public onPress(_event: CustomEvent<{ x: number; y: number }>): void {
    this.pressCount += 1;
  }

  /**
   * Handle swipe-left output from the directive.
   * @param _event Swipe-left event payload.
   * @returns void
   * @example
   * this.onSwipeleft(event);
   */
  public onSwipeleft(_event: CustomEvent<{ dx: number; dy: number; duration: number }>): void {
    this.swipeLeftCount += 1;
  }

  /**
   * Handle swipe-right output from the directive.
   * @param _event Swipe-right event payload.
   * @returns void
   * @example
   * this.onSwiperight(event);
   */
  public onSwiperight(_event: CustomEvent<{ dx: number; dy: number; duration: number }>): void {
    this.swipeRightCount += 1;
  }

  /**
   * Handle double-tap output from the directive.
   * @param _event Double-tap event payload.
   * @returns void
   * @example
   * this.onDoubletap(event);
   */
  public onDoubletap(_event: CustomEvent<{ x: number; y: number; dt: number }>): void {
    this.doubleTapCount += 1;
  }
}

const POINTER_ID = 1;

function createPointerEvent(type: string, init: PointerEventInit): PointerEvent {
  if (typeof PointerEvent !== 'undefined') {
    return new PointerEvent(type, { bubbles: true, cancelable: true, ...init });
  }
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperty(event, 'clientX', { value: init.clientX ?? 0 });
  Object.defineProperty(event, 'clientY', { value: init.clientY ?? 0 });
  Object.defineProperty(event, 'pointerId', { value: init.pointerId ?? POINTER_ID });
  Object.defineProperty(event, 'pointerType', { value: init.pointerType ?? 'touch' });
  return event;
}

function dispatchPointerEvent(el: Element, type: string, init: PointerEventInit): void {
  el.dispatchEvent(createPointerEvent(type, init));
}

describe('GestureDirective', () => {
  let hostEl: HTMLElement;
  let component: TestHostComponent;
  let now = 1000;

  beforeEach(async () => {
    spyOn(performance, 'now').and.callFake(() => now);
    await TestBed.configureTestingModule({
      imports: [TestHostComponent]
    }).compileComponents();

    const fixture = TestBed.createComponent(TestHostComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    hostEl = fixture.nativeElement.querySelector('#host') as HTMLElement;
  });

  it('emits press after long-press threshold', fakeAsync(() => {
    component.mode = 'press';
    component.longPressMs = 80;
    now = 2000;

    dispatchPointerEvent(hostEl, 'pointerdown', {
      clientX: 100,
      clientY: 100,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    tick(80);

    expect(component.pressCount).toBe(1);
    expect(component.swipeLeftCount).toBe(0);
    expect(component.swipeRightCount).toBe(0);
  }));

  it('emits swiperight for horizontal swipe', fakeAsync(() => {
    component.mode = 'horizontal';
    component.swipeMinDistance = 30;
    component.swipeMaxDuration = 600;
    now = 3000;

    dispatchPointerEvent(hostEl, 'pointerdown', {
      clientX: 50,
      clientY: 60,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    dispatchPointerEvent(hostEl, 'pointermove', {
      clientX: 110,
      clientY: 60,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    now = 3200;

    dispatchPointerEvent(hostEl, 'pointerup', {
      clientX: 110,
      clientY: 60,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    expect(component.swipeRightCount).toBe(1);
    expect(component.swipeLeftCount).toBe(0);
    expect(component.pressCount).toBe(0);
  }));

  it('emits doubletap for two taps within interval', fakeAsync(() => {
    component.mode = 'press';
    component.enableDoubleTap = true;
    component.doubleTapCount = 0;
    component.longPressMs = 400;
    now = 4000;

    dispatchPointerEvent(hostEl, 'pointerdown', {
      clientX: 20,
      clientY: 20,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    now = 4050;

    dispatchPointerEvent(hostEl, 'pointerup', {
      clientX: 20,
      clientY: 20,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    now = 4200;

    dispatchPointerEvent(hostEl, 'pointerdown', {
      clientX: 20,
      clientY: 20,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    now = 4250;

    dispatchPointerEvent(hostEl, 'pointerup', {
      clientX: 20,
      clientY: 20,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    expect(component.doubleTapCount).toBe(1);
  }));

  it('suppresses long-press when movement exceeds press slop', fakeAsync(() => {
    component.mode = 'press';
    component.longPressMs = 80;
    component.pressMoveSlop = 8;
    now = 5000;

    dispatchPointerEvent(hostEl, 'pointerdown', {
      clientX: 100,
      clientY: 100,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    dispatchPointerEvent(hostEl, 'pointermove', {
      clientX: 130,
      clientY: 100,
      pointerId: POINTER_ID,
      pointerType: 'touch'
    });

    tick(100);

    expect(component.pressCount).toBe(0);
  }));

  it('suppresses gestures when multi-pointer is active', fakeAsync(() => {
    component.mode = 'press';
    component.longPressMs = 80;
    now = 6000;

    dispatchPointerEvent(hostEl, 'pointerdown', {
      clientX: 10,
      clientY: 10,
      pointerId: 1,
      pointerType: 'touch'
    });

    dispatchPointerEvent(hostEl, 'pointerdown', {
      clientX: 12,
      clientY: 12,
      pointerId: 2,
      pointerType: 'touch'
    });

    tick(100);

    expect(component.pressCount).toBe(0);
    expect(component.doubleTapCount).toBe(0);
  }));
});
