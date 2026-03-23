import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { EMPTY } from 'rxjs';
import { ConnectionStateMachine } from './connection-state-machine.service';
import { InternetReachabilityService } from './internet-reachability.service';

describe('InternetReachabilityService', () => {
    let service: InternetReachabilityService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                {
                    provide: ConnectionStateMachine,
                    useValue: {
                        status$: EMPTY,
                    },
                },
            ],
        });
        service = TestBed.inject(InternetReachabilityService);
    });

    afterEach(() => {
        service.ngOnDestroy();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('marks internet as available after successful probe', async () => {
        vi.spyOn(window, 'fetch').mockReturnValue(Promise.resolve({ status: 204 } as Response));

        service.start();
        await Promise.resolve();
        await Promise.resolve();

        expect(service.isReachable()).toBe(true);
        expect(service.internetAvailable()).toBe(true);
        expect(service.lastError()).toBeNull();
        expect(window.fetch).toHaveBeenCalledTimes(1);
    });

    it('treats opaque probe response as reachable', async () => {
        vi.spyOn(window, 'fetch').mockReturnValue(Promise.resolve({ type: 'opaque', status: 0 } as Response));

        service.start();
        await Promise.resolve();
        await Promise.resolve();

        expect(service.isReachable()).toBe(true);
        expect(service.internetAvailable()).toBe(true);
        expect(service.lastError()).toBeNull();
    });

    it('retries after failure and recovers on next successful probe', async () => {
        vi.useFakeTimers();
        try {
            const fetchSpy = vi
                .spyOn(window, 'fetch')
                .mockReturnValueOnce(Promise.reject(new Error('offline')))
                .mockReturnValueOnce(Promise.resolve({ status: 204 } as Response));

            service.start();
            await Promise.resolve();
            await Promise.resolve();

            expect(service.isReachable()).toBe(false);
            expect(service.internetAvailable()).toBe(false);
            expect(service.lastError()).toBe('Internet reachability probe failed');

            await vi.advanceTimersByTimeAsync(5000);

            expect(fetchSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
            expect(service.isReachable()).toBe(true);
            expect(service.internetAvailable()).toBe(true);
            expect(service.lastError()).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('start is idempotent', async () => {
        const fetchSpy = vi.spyOn(window, 'fetch').mockReturnValue(Promise.resolve({ status: 204 } as Response));

        service.start();
        await Promise.resolve();
        await Promise.resolve();

        const callCountAfterFirstStart = fetchSpy.mock.calls.length;

        service.start();
        await Promise.resolve();
        await Promise.resolve();

        expect(fetchSpy.mock.calls.length).toBe(callCountAfterFirstStart);
    });
});
