import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { AppNetworkInitService } from './app-initNetwork.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { AuthenticationService } from './authentication.service';
import { ConnectionState, ConnectionStateMachine } from './connection-state-machine.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { DataService } from './data.service';
import { StorageService } from './storage.service';
import { InternetReachabilityService } from './internet-reachability.service';
import { DatasetStreamService } from './dataset-stream.service';
import { Injector } from '@angular/core';

describe('AppNetworkInitService', () => {
    let service: AppNetworkInitService;

    const isLoggedIn$ = new BehaviorSubject<boolean>(false);
    const state$ = new BehaviorSubject<ConnectionState>(ConnectionState.Disconnected);

    const mockConnection = {
        initializeConnection: vi.fn().mockResolvedValue(undefined)
    };

    const mockAuth = {
        isLoggedIn$,
        login: vi.fn().mockResolvedValue(undefined)
    };

    const mockConnectionStateMachine = {
        state$,
        currentState: ConnectionState.Disconnected,
        getHttpRetryWindowMs: vi.fn().mockReturnValue(4321),
        isHTTPConnected: vi.fn().mockReturnValue(false),
        enableWebSocketMode: vi.fn(),
        startWebSocketConnection: vi.fn()
    };

    const mockRouter = {
        navigate: vi.fn().mockResolvedValue(true)
    };

    const mockStorage = {
        waitUntilReady: vi.fn().mockResolvedValue(true),
        getConfig: vi.fn().mockResolvedValue({}),
        bootstrapRemoteContext: vi.fn()
    };

    const mockInternetReachability = {
        start: vi.fn()
    };

    const mockDatasetService = {
        waitUntilReady: vi.fn().mockResolvedValue(undefined)
    };

    const mockInjector = {
        get: vi.fn().mockImplementation((token: unknown) => {
            if (token === DatasetStreamService) {
                return mockDatasetService;
            }
            return null;
        })
    };

    beforeEach(() => {
        isLoggedIn$.next(false);
        state$.next(ConnectionState.Disconnected);
        mockConnectionStateMachine.currentState = ConnectionState.Disconnected;
        mockConnectionStateMachine.getHttpRetryWindowMs.mockClear();
        mockConnectionStateMachine.isHTTPConnected.mockClear();
        mockConnectionStateMachine.enableWebSocketMode.mockClear();
        mockConnectionStateMachine.startWebSocketConnection.mockClear();

        TestBed.configureTestingModule({
            providers: [
                AppNetworkInitService,
                { provide: SignalKConnectionService, useValue: mockConnection },
                { provide: AuthenticationService, useValue: mockAuth },
                { provide: ConnectionStateMachine, useValue: mockConnectionStateMachine },
                { provide: Router, useValue: mockRouter },
                { provide: SignalKDeltaService, useValue: {} },
                { provide: DataService, useValue: {} },
                { provide: StorageService, useValue: mockStorage },
                { provide: InternetReachabilityService, useValue: mockInternetReachability },
                { provide: Injector, useValue: mockInjector }
            ]
        });
        service = TestBed.inject(AppNetworkInitService);
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should use connection retry window when no timeout is provided', async () => {
        mockConnectionStateMachine.currentState = ConnectionState.HTTPConnected;

        const result = await (service as unknown as {
            waitForHttpRetryCompletion: (timeoutMs?: number) => Promise<ConnectionState | null>;
        }).waitForHttpRetryCompletion();

        expect(mockConnectionStateMachine.getHttpRetryWindowMs).toHaveBeenCalledWith(2000);
        expect(result).toBe(ConnectionState.HTTPConnected);
    });

    it('should skip connection retry window lookup when explicit timeout is provided', async () => {
        mockConnectionStateMachine.currentState = ConnectionState.PermanentFailure;

        const result = await (service as unknown as {
            waitForHttpRetryCompletion: (timeoutMs?: number) => Promise<ConnectionState | null>;
        }).waitForHttpRetryCompletion(100);

        expect(mockConnectionStateMachine.getHttpRetryWindowMs).not.toHaveBeenCalled();
        expect(result).toBe(ConnectionState.PermanentFailure);
    });
});
