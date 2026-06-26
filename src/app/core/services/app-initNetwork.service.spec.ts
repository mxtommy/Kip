import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { AppNetworkInitService, IBootstrapIssue } from './app-initNetwork.service';
import { IConfig, IConnectionConfig } from '../interfaces/app-settings.interfaces';
import { SignalKConnectionService } from './signalk-connection.service';
import { AuthenticationService, ILoginStatus } from './authentication.service';
import { SsoRedirectService } from './sso-redirect.service';
import { ConnectionState, ConnectionStateMachine } from './connection-state-machine.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { DataService } from './data.service';
import { StorageService } from './storage.service';
import { InternetReachabilityService } from './internet-reachability.service';
import { DatasetStreamService } from './dataset-stream.service';
import { Injector } from '@angular/core';
import { ensureLocalStorage } from '../../../test-helpers/local-storage.test-helper';

// jsdom has no FontFace; preloadFonts() constructs one during the end-to-end initNetworkServices runs.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (typeof (globalThis as any).FontFace === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).FontFace = class { load() { return Promise.resolve(this); } };
}

describe('AppNetworkInitService', () => {
    let service: AppNetworkInitService;

    const isLoggedIn$ = new BehaviorSubject<boolean>(false);
    const state$ = new BehaviorSubject<ConnectionState>(ConnectionState.Disconnected);

    const mockConnection = {
        initializeConnection: vi.fn().mockResolvedValue(undefined)
    };

    const mockAuth = {
        isLoggedIn$,
        authMode: 'token' as 'cookie' | 'token',
        loginStatusValue: null as ILoginStatus | null,
        refreshLoginStatus: vi.fn().mockResolvedValue(null),
        login: vi.fn().mockResolvedValue(undefined)
    };

    const mockSsoRedirect = {
        attemptAutoRedirect: vi.fn().mockReturnValue('redirected'),
        resetBudget: vi.fn(),
        isBudgetExhausted: vi.fn().mockReturnValue(false),
        manualSignIn: vi.fn()
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
        ensureLocalStorage();
        isLoggedIn$.next(false);
        state$.next(ConnectionState.Disconnected);
        mockConnectionStateMachine.currentState = ConnectionState.Disconnected;
        mockConnectionStateMachine.getHttpRetryWindowMs.mockClear();
        mockConnectionStateMachine.isHTTPConnected.mockClear();
        mockConnectionStateMachine.enableWebSocketMode.mockClear();
        mockConnectionStateMachine.startWebSocketConnection.mockClear();
        mockAuth.authMode = 'token';
        mockAuth.loginStatusValue = null;
        mockAuth.refreshLoginStatus.mockClear();
        mockRouter.navigate.mockClear();
        mockSsoRedirect.attemptAutoRedirect.mockClear().mockReturnValue('redirected');
        mockSsoRedirect.resetBudget.mockClear();
        mockSsoRedirect.isBudgetExhausted.mockClear().mockReturnValue(false);

        TestBed.configureTestingModule({
            providers: [
                AppNetworkInitService,
                { provide: SignalKConnectionService, useValue: mockConnection },
                { provide: AuthenticationService, useValue: mockAuth },
                { provide: SsoRedirectService, useValue: mockSsoRedirect },
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

    function handleCookieAuth(status: ILoginStatus | null): 'redirecting' | 'proceed' | 'auth-blocked' {
        return (service as unknown as { handleCookieAuth: (s: ILoginStatus | null) => 'redirecting' | 'proceed' | 'auth-blocked' }).handleCookieAuth(status);
    }

    function routeToReauth(): void {
        (service as unknown as { routeToReauth: () => void }).routeToReauth();
    }

    function latestIssue(): IBootstrapIssue {
        let issue: IBootstrapIssue = { reason: 'none' };
        service.bootstrapIssue$.subscribe(i => (issue = i)).unsubscribe();
        return issue;
    }

    function setConnConfig(cfg: Partial<IConnectionConfig>): void {
        (service as unknown as { config: Partial<IConnectionConfig> }).config = cfg;
    }
    function migrate(remoteConfig: IConfig | null): void {
        (service as unknown as { migrateRemoteControlToDevice: (r: IConfig | null) => void }).migrateRemoteControlToDevice(remoteConfig);
    }
    function storedConn(): IConnectionConfig | null {
        const raw = localStorage.getItem('connectionConfig');
        return raw ? JSON.parse(raw) : null;
    }

    describe('migrateRemoteControlToDevice (connectionConfig v12 -> v13)', () => {
        const baseV12: Partial<IConnectionConfig> = { configVersion: 12, useSharedConfig: true, isRemoteControl: false, instanceName: '' };

        it('shared boot lifts the profile identity and stamps v13 once', () => {
            localStorage.removeItem('connectionConfig');
            setConnConfig({ ...baseV12 });
            migrate({ app: { isRemoteControl: true, instanceName: 'Helm' } } as unknown as IConfig);
            expect(storedConn()?.isRemoteControl).toBe(true);
            expect(storedConn()?.instanceName).toBe('Helm');
            expect(storedConn()?.configVersion).toBe(13);
        });

        it('local boot lifts the identity from the local appConfig', () => {
            localStorage.removeItem('connectionConfig');
            localStorage.setItem('appConfig', JSON.stringify({ isRemoteControl: true, instanceName: 'Mast' }));
            setConnConfig({ ...baseV12, useSharedConfig: false });
            migrate(null);
            expect(storedConn()?.isRemoteControl).toBe(true);
            expect(storedConn()?.instanceName).toBe('Mast');
            expect(storedConn()?.configVersion).toBe(13);
        });

        it('degraded shared boot (no profile) defers: version stays 12, nothing persisted', () => {
            localStorage.removeItem('connectionConfig');
            setConnConfig({ ...baseV12, useSharedConfig: true });
            migrate(null);
            expect(storedConn()).toBeNull();
            expect((service as unknown as { config: IConnectionConfig }).config.configVersion).toBe(12);
        });

        it('is a no-op when already migrated (version >= 13)', () => {
            localStorage.removeItem('connectionConfig');
            setConnConfig({ ...baseV12, configVersion: 13 });
            migrate({ app: { isRemoteControl: true, instanceName: 'X' } } as unknown as IConfig);
            expect(storedConn()).toBeNull();
        });
    });

    describe('cookie-mode bootstrap auth (Unit 6)', () => {
        it('logged-in: proceeds without resetting the budget here (reset deferred to a clean bootstrap)', () => {
            expect(handleCookieAuth({ status: 'loggedIn' })).toBe('proceed');
            expect(mockSsoRedirect.resetBudget).not.toHaveBeenCalled();
            expect(mockSsoRedirect.attemptAutoRedirect).not.toHaveBeenCalled();
        });

        it('null/unreachable loginStatus: fails closed to auth-blocked, not anonymous-open', () => {
            expect(handleCookieAuth(null)).toBe('auth-blocked');
            expect(mockSsoRedirect.attemptAutoRedirect).not.toHaveBeenCalled();
            expect(latestIssue()).toEqual({ reason: 'auth-blocked', cause: 'sign-in-required' });
        });
    });

    describe('mid-bootstrap 401 re-auth routing (Unit 6)', () => {
        it('token mode routes to /login', () => {
            mockAuth.authMode = 'token';
            routeToReauth();
            expect(mockRouter.navigate).toHaveBeenCalledWith(['/login']);
            expect(mockSsoRedirect.attemptAutoRedirect).not.toHaveBeenCalled();
        });

        it('cookie mode with oidcAutoLogin auto-redirects (budget-guarded)', () => {
            mockAuth.authMode = 'cookie';
            mockAuth.loginStatusValue = { status: 'loggedIn', oidcAutoLogin: true };
            mockSsoRedirect.attemptAutoRedirect.mockReturnValue('redirected');

            routeToReauth();

            expect(mockSsoRedirect.attemptAutoRedirect).toHaveBeenCalledWith(mockAuth.loginStatusValue);
            expect(mockRouter.navigate).not.toHaveBeenCalled();
        });

        it('cookie mode honors oidcAutoLogin:false (no auto-redirect on a 401)', () => {
            mockAuth.authMode = 'cookie';
            mockAuth.loginStatusValue = { status: 'loggedIn', oidcAutoLogin: false };

            routeToReauth();

            expect(mockSsoRedirect.attemptAutoRedirect).not.toHaveBeenCalled();
            expect(latestIssue()).toEqual({ reason: 'auth-blocked', cause: 'sign-in-required' });
        });

        it('cookie mode surfaces auth-blocked when the budget is exhausted (no infinite 401 loop)', () => {
            mockAuth.authMode = 'cookie';
            mockAuth.loginStatusValue = { status: 'loggedIn', oidcAutoLogin: true };
            mockSsoRedirect.attemptAutoRedirect.mockReturnValue('budget-exhausted');
            mockSsoRedirect.isBudgetExhausted.mockReturnValue(true);

            routeToReauth();

            expect(latestIssue()).toEqual({ reason: 'auth-blocked', cause: 'budget-exhausted' });
        });

        it('not-logged-in + authRequired + oidcAutoLogin: auto-redirects to SSO', () => {
            mockSsoRedirect.attemptAutoRedirect.mockReturnValue('redirected');
            const status: ILoginStatus = { status: 'notLoggedIn', authenticationRequired: true, oidcAutoLogin: true, oidcEnabled: true };

            expect(handleCookieAuth(status)).toBe('redirecting');

            expect(mockSsoRedirect.attemptAutoRedirect).toHaveBeenCalledWith(status);
        });

        it('budget exhausted: proceeds with an auth-blocked/budget-exhausted issue, no loop', () => {
            mockSsoRedirect.attemptAutoRedirect.mockReturnValue('budget-exhausted');
            mockSsoRedirect.isBudgetExhausted.mockReturnValue(true);

            expect(handleCookieAuth({ status: 'notLoggedIn', authenticationRequired: true, oidcAutoLogin: true })).toBe('auth-blocked');

            expect(latestIssue()).toEqual({ reason: 'auth-blocked', cause: 'budget-exhausted' });
        });

        it('oidcAutoLogin disabled: does not auto-redirect, surfaces sign-in-required', () => {
            const status: ILoginStatus = { status: 'notLoggedIn', authenticationRequired: true, oidcAutoLogin: false, oidcEnabled: true };

            expect(handleCookieAuth(status)).toBe('auth-blocked');

            expect(mockSsoRedirect.attemptAutoRedirect).not.toHaveBeenCalled();
            expect(latestIssue()).toEqual({ reason: 'auth-blocked', cause: 'sign-in-required' });
        });

        it('authentication not required: anonymous read, no redirect, no auth-blocked issue', () => {
            expect(handleCookieAuth({ status: 'notLoggedIn', authenticationRequired: false })).toBe('proceed');

            expect(mockSsoRedirect.attemptAutoRedirect).not.toHaveBeenCalled();
            expect(latestIssue().reason).not.toBe('auth-blocked');
        });
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

    // End-to-end initNetworkServices() runs — these pin the seam between handleCookieAuth and the
    // finally that an isolated handleCookieAuth test cannot see (the original P0 loop-guard hole).
    describe('cookie-mode bootstrap end-to-end (Unit 6 loop-guard seam)', () => {
        it('budget-exhausted: keeps the auth-blocked recovery state and does NOT reset the budget', async () => {
            mockAuth.authMode = 'cookie';
            mockAuth.refreshLoginStatus.mockResolvedValue({ status: 'notLoggedIn', authenticationRequired: true, oidcAutoLogin: true });
            mockSsoRedirect.attemptAutoRedirect.mockReturnValue('budget-exhausted');
            mockSsoRedirect.isBudgetExhausted.mockReturnValue(true);

            await service.initNetworkServices();

            expect(latestIssue()).toEqual({ reason: 'auth-blocked', cause: 'budget-exhausted' });
            expect(mockSsoRedirect.resetBudget).not.toHaveBeenCalled();
        });

        it('null loginStatus: keeps the auth-blocked recovery state and does NOT reset the budget', async () => {
            mockAuth.authMode = 'cookie';
            mockAuth.refreshLoginStatus.mockResolvedValue(null);

            await service.initNetworkServices();

            expect(latestIssue()).toEqual({ reason: 'auth-blocked', cause: 'sign-in-required' });
            expect(mockSsoRedirect.resetBudget).not.toHaveBeenCalled();
        });

        it('logged-in clean bootstrap resets the budget', async () => {
            mockAuth.authMode = 'cookie';
            mockAuth.refreshLoginStatus.mockImplementation(async () => { isLoggedIn$.next(true); return { status: 'loggedIn' }; });

            await service.initNetworkServices();

            expect(mockSsoRedirect.resetBudget).toHaveBeenCalled();
        });

        it('does not double-start the WebSocket when a connect is already in flight at the finally', async () => {
            mockAuth.authMode = 'cookie';
            mockAuth.refreshLoginStatus.mockImplementation(async () => { isLoggedIn$.next(true); return { status: 'loggedIn' }; });
            mockConnectionStateMachine.currentState = ConnectionState.WebSocketConnecting;

            await service.initNetworkServices();

            expect(mockConnectionStateMachine.startWebSocketConnection).not.toHaveBeenCalled();
        });

        it('starts the WebSocket once from a fresh HTTPConnected state', async () => {
            mockAuth.authMode = 'token';
            mockConnectionStateMachine.currentState = ConnectionState.HTTPConnected;

            await service.initNetworkServices();

            expect(mockConnectionStateMachine.startWebSocketConnection).toHaveBeenCalledTimes(1);
        });
    });
});
