import { TestBed } from '@angular/core/testing';
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
import { DatasetService } from './data-set.service';
import { Injector } from '@angular/core';

describe('AppNetworkInitService', () => {
  let service: AppNetworkInitService;

  const isLoggedIn$ = new BehaviorSubject<boolean>(false);
  const state$ = new BehaviorSubject<ConnectionState>(ConnectionState.Disconnected);

  const mockConnection = {
    initializeConnection: jasmine.createSpy('initializeConnection').and.resolveTo()
  };

  const mockAuth = {
    isLoggedIn$,
    login: jasmine.createSpy('login').and.resolveTo()
  };

  const mockConnectionStateMachine = {
    state$,
    currentState: ConnectionState.Disconnected,
    getHttpRetryWindowMs: jasmine.createSpy('getHttpRetryWindowMs').and.returnValue(4321),
    isHTTPConnected: jasmine.createSpy('isHTTPConnected').and.returnValue(false),
    enableWebSocketMode: jasmine.createSpy('enableWebSocketMode'),
    startWebSocketConnection: jasmine.createSpy('startWebSocketConnection')
  };

  const mockRouter = {
    navigate: jasmine.createSpy('navigate').and.resolveTo(true)
  };

  const mockStorage = {
    waitUntilReady: jasmine.createSpy('waitUntilReady').and.resolveTo(true),
    getConfig: jasmine.createSpy('getConfig').and.resolveTo({}),
    bootstrapRemoteContext: jasmine.createSpy('bootstrapRemoteContext')
  };

  const mockInternetReachability = {
    start: jasmine.createSpy('start')
  };

  const mockDatasetService = {
    waitUntilReady: jasmine.createSpy('waitUntilReady').and.resolveTo()
  };

  const mockInjector = {
    get: jasmine.createSpy('get').and.callFake((token: unknown) => {
      if (token === DatasetService) {
        return mockDatasetService;
      }
      return null;
    })
  };

  beforeEach(() => {
    isLoggedIn$.next(false);
    state$.next(ConnectionState.Disconnected);
    mockConnectionStateMachine.currentState = ConnectionState.Disconnected;
    mockConnectionStateMachine.getHttpRetryWindowMs.calls.reset();
    mockConnectionStateMachine.isHTTPConnected.calls.reset();
    mockConnectionStateMachine.enableWebSocketMode.calls.reset();
    mockConnectionStateMachine.startWebSocketConnection.calls.reset();

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
