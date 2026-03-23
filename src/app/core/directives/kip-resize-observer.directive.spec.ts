import type { Mock } from "vitest";
import { TestBed } from '@angular/core/testing';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ElementRef, NgZone } from '@angular/core';
import { KipResizeObserverDirective } from './kip-resize-observer.directive';

describe('KipResizeObserverDirective', () => {
    let originalResizeObserver: typeof ResizeObserver | undefined;
    let observeSpy: Mock;
    let disconnectSpy: Mock;

    beforeEach(() => {
        originalResizeObserver = globalThis.ResizeObserver;
        observeSpy = vi.fn();
        disconnectSpy = vi.fn();

        class ResizeObserverMock {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            constructor(_callback: ResizeObserverCallback) { }

            observe = observeSpy;
            disconnect = disconnectSpy;
            unobserve = vi.fn();
        }

        (globalThis as typeof globalThis & {
            ResizeObserver: typeof ResizeObserver;
        }).ResizeObserver =
            ResizeObserverMock as unknown as typeof ResizeObserver;

        const ngZoneMock: Pick<NgZone, 'run' | 'runOutsideAngular'> = {
            run: <T>(fn: (...args: unknown[]) => T): T => fn(),
            runOutsideAngular: <T>(fn: (...args: unknown[]) => T): T => fn(),
        };

        TestBed.configureTestingModule({
            providers: [
                {
                    provide: ElementRef,
                    useValue: new ElementRef(document.createElement('div')),
                },
                {
                    provide: NgZone,
                    useValue: ngZoneMock,
                },
            ],
        });
    });

    afterEach(() => {
        if (originalResizeObserver) {
            (globalThis as typeof globalThis & {
                ResizeObserver: typeof ResizeObserver;
            }).ResizeObserver =
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
