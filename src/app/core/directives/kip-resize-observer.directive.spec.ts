import { TestBed } from '@angular/core/testing';
import { ElementRef, NgZone } from '@angular/core';
import { KipResizeObserverDirective } from './kip-resize-observer.directive';

describe('KipResizeObserverDirective', () => {
  let originalResizeObserver: typeof ResizeObserver | undefined;
  let observeSpy: jasmine.Spy;
  let disconnectSpy: jasmine.Spy;

  beforeEach(() => {
    originalResizeObserver = globalThis.ResizeObserver;
    observeSpy = jasmine.createSpy('observe');
    disconnectSpy = jasmine.createSpy('disconnect');

    class ResizeObserverMock {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_callback: ResizeObserverCallback) {}

      observe = observeSpy;
      disconnect = disconnectSpy;
      unobserve = jasmine.createSpy('unobserve');
    }

    (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
      ResizeObserverMock as unknown as typeof ResizeObserver;

    TestBed.configureTestingModule({
      providers: [
        {
          provide: ElementRef,
          useValue: new ElementRef(document.createElement('div')),
        },
        {
          provide: NgZone,
          useFactory: () => new NgZone({ enableLongStackTrace: false }),
        },
      ],
    });
  });

  afterEach(() => {
    if (originalResizeObserver) {
      (globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
        originalResizeObserver;
      return;
    }
    delete (globalThis as Partial<typeof globalThis>).ResizeObserver;
  });

  it('should create an instance', () => {
    const directive = TestBed.runInInjectionContext(() => new KipResizeObserverDirective());

    expect(directive).toBeTruthy();
    expect(observeSpy).toHaveBeenCalled();

    directive.ngOnDestroy();
  });

  it('should disconnect resize observer on destroy', () => {
    const directive = TestBed.runInInjectionContext(() => new KipResizeObserverDirective());

    directive.ngOnDestroy();

    expect(disconnectSpy).toHaveBeenCalled();
  });
});
