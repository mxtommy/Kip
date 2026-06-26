import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BehaviorSubject } from 'rxjs';
import { SignalKDeltaService } from './signalk-delta.service';
import { AuthenticationService } from './authentication.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { ConnectionStateMachine } from './connection-state-machine.service';

class AuthStub {
  isLoggedIn$ = new BehaviorSubject<boolean>(false);
  authToken$ = new BehaviorSubject<unknown>(null);
  authMode: 'cookie' | 'token' = 'token';
  refreshLoginStatus = vi.fn(async () => null);
}

class ConnStub {
  serverServiceEndpoint$ = new BehaviorSubject<{ operation: number; WsServiceUrl?: string; subscribeAll?: boolean }>({ operation: 0 });
  setServerInfo(): void { /* noop */ }
}

class CsmStub {
  state$ = new BehaviorSubject<string>('Disconnected');
  setWebSocketRetryCallback = vi.fn();
  isFullyConnected = vi.fn(() => false);
  isHTTPConnected = vi.fn(() => true);
  startWebSocketConnection = vi.fn();
  onWebSocketConnected = vi.fn();
  onWebSocketError = vi.fn();
  currentState = 'HTTPConnected';
}

interface DeltaInternals { buildWebSocketUrl(): string }

function setup() {
  const auth = new AuthStub();
  const conn = new ConnStub();
  const csm = new CsmStub();
  TestBed.configureTestingModule({
    providers: [
      SignalKDeltaService,
      { provide: AuthenticationService, useValue: auth },
      { provide: SignalKConnectionService, useValue: conn },
      { provide: ConnectionStateMachine, useValue: csm },
    ]
  });
  const service = TestBed.inject(SignalKDeltaService);
  return { service, auth, conn, csm };
}

describe('SignalKDeltaService', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
  });

  it('should be created', () => {
    expect(setup().service).toBeTruthy();
  });

  describe('WebSocket token carriage by mode (Unit 4)', () => {
    it('cookie mode omits &token= even when a token is present', () => {
      const { service, auth, conn } = setup();
      auth.authMode = 'cookie';
      conn.serverServiceEndpoint$.next({ operation: 2, WsServiceUrl: 'wss://host/signalk/v1/stream', subscribeAll: false });
      auth.authToken$.next({ token: 'should-not-appear', expiry: null, isDeviceAccessToken: false });

      const url = (service as unknown as DeltaInternals).buildWebSocketUrl();
      expect(url).not.toContain('token=');
      expect(url.startsWith('wss://host/signalk/v1/stream')).toBe(true);
    });

    it('token mode appends &token= when a token is present', () => {
      const { service, auth, conn } = setup();
      auth.authMode = 'token';
      conn.serverServiceEndpoint$.next({ operation: 2, WsServiceUrl: 'wss://host/signalk/v1/stream', subscribeAll: false });
      auth.authToken$.next({ token: 'abc123', expiry: 9999999999, isDeviceAccessToken: false });

      const url = (service as unknown as DeltaInternals).buildWebSocketUrl();
      expect(url).toContain('&token=abc123');
    });
  });

  describe('cookie-mode session-driven (re)connect (Unit 4)', () => {
    it('a login transition triggers a WS (re)connect via the isFullyConnected guard', () => {
      const { auth, csm } = setup();
      auth.authMode = 'cookie';
      csm.startWebSocketConnection.mockClear();

      auth.isLoggedIn$.next(true);

      expect(csm.startWebSocketConnection).toHaveBeenCalled();
    });

    it('does not start a WS connect when already fully connected (no double-connect)', () => {
      const { auth, csm } = setup();
      auth.authMode = 'cookie';
      csm.isFullyConnected.mockReturnValue(true);
      csm.startWebSocketConnection.mockClear();

      auth.isLoggedIn$.next(true);

      expect(csm.startWebSocketConnection).not.toHaveBeenCalled();
    });

    it('does not start a second WS connect while one is already in flight (WebSocketConnecting)', () => {
      const { auth, csm } = setup();
      auth.authMode = 'cookie';
      // Bootstrap already opened the socket: not yet Connected, but a connect is in flight.
      csm.isFullyConnected.mockReturnValue(false);
      csm.currentState = 'WebSocketConnecting';
      csm.startWebSocketConnection.mockClear();

      auth.isLoggedIn$.next(true);

      expect(csm.startWebSocketConnection).not.toHaveBeenCalled();
    });

    it('token mode does not drive the cookie reconnect path on a login transition', () => {
      const { auth, csm } = setup();
      auth.authMode = 'token';
      csm.startWebSocketConnection.mockClear();

      auth.isLoggedIn$.next(true);

      expect(csm.startWebSocketConnection).not.toHaveBeenCalled();
    });
  });

  describe('cookie-mode loginStatus re-check on WS drop (Unit 4)', () => {
    it('re-checks loginStatus on a non-clean close', () => {
      const { service, auth } = setup();
      auth.authMode = 'cookie';
      auth.refreshLoginStatus.mockClear();

      service.socketWSCloseEvent$.next({ wasClean: false } as CloseEvent);

      expect(auth.refreshLoginStatus).toHaveBeenCalled();
    });

    it('does not re-check loginStatus on a clean close', () => {
      const { service, auth } = setup();
      auth.authMode = 'cookie';
      auth.refreshLoginStatus.mockClear();

      service.socketWSCloseEvent$.next({ wasClean: true } as CloseEvent);

      expect(auth.refreshLoginStatus).not.toHaveBeenCalled();
    });

    it('token mode does not re-check loginStatus on a non-clean close', () => {
      const { service, auth } = setup();
      auth.authMode = 'token';
      auth.refreshLoginStatus.mockClear();

      service.socketWSCloseEvent$.next({ wasClean: false } as CloseEvent);

      expect(auth.refreshLoginStatus).not.toHaveBeenCalled();
    });
  });
});
