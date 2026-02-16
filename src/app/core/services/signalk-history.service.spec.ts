import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { SignalKConnectionService, IEndpointStatus } from './signalk-connection.service';
import { SignalkHistoryService } from './signalk-history.service';

class SignalKConnectionServiceStub {
  public serverServiceEndpoint$ = new BehaviorSubject<IEndpointStatus>({
    operation: 0,
    message: 'Not connected',
    serverDescription: null,
    httpServiceUrl: null,
    WsServiceUrl: null
  });
}

describe('SignalkHistoryService', () => {
  let service: SignalkHistoryService;
  let httpMock: HttpTestingController;
  let connectionStub: SignalKConnectionServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SignalkHistoryService,
        { provide: SignalKConnectionService, useClass: SignalKConnectionServiceStub }
      ]
    });

    service = TestBed.inject(SignalkHistoryService);
    httpMock = TestBed.inject(HttpTestingController);
    connectionStub = TestBed.inject(SignalKConnectionService) as unknown as SignalKConnectionServiceStub;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null when history endpoint is unavailable', async () => {
    const response = await service.getValues({ paths: 'navigation.speedThroughWater:avg' });

    expect(response).toBeNull();
    httpMock.expectNone(() => true);
  });

  it('should fetch values from v2 history endpoint with resolution in seconds', async () => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    const promise = service.getValues({
      paths: 'navigation.speedThroughWater:avg',
      from: '2026-02-16T12:00:00.000Z',
      resolution: 1
    });

    const req = httpMock.expectOne((request) =>
      request.url === 'http://localhost:3000/signalk/v2/api/history/values'
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('paths')).toBe('navigation.speedThroughWater:avg');
    expect(req.request.params.get('from')).toBe('2026-02-16T12:00:00.000Z');
    expect(req.request.params.get('resolution')).toBe('1');

    req.flush({
      context: 'vessels.self',
      range: { from: '2026-02-16T12:00:00.000Z', to: '2026-02-16T12:01:00.000Z' },
      values: [{ path: 'navigation.speedThroughWater', method: 'avg' }],
      data: [['2026-02-16T12:00:00.000Z', 3.2]]
    });

    const response = await promise;
    expect(response).toBeTruthy();
    expect(response?.data.length).toBe(1);
  });

  it('should pass through string resolution without restriction', async () => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    const promise = service.getValues({
      paths: 'environment.wind.speedApparent:avg',
      resolution: 'PT1S'
    });

    const req = httpMock.expectOne((request) =>
      request.url === 'http://localhost:3000/signalk/v2/api/history/values'
    );
    expect(req.request.params.get('resolution')).toBe('PT1S');

    req.flush({
      context: 'vessels.self',
      range: { from: '2026-02-16T12:00:00.000Z', to: '2026-02-16T12:01:00.000Z' },
      values: [{ path: 'environment.wind.speedApparent', method: 'avg' }],
      data: []
    });

    const response = await promise;
    expect(response).toBeTruthy();
  });

  it('should pass numeric zero resolution when provided', async () => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    const promise = service.getValues({
      paths: 'navigation.courseOverGroundTrue:avg',
      resolution: 0
    });

    const req = httpMock.expectOne((request) =>
      request.url === 'http://localhost:3000/signalk/v2/api/history/values'
    );
    expect(req.request.params.get('resolution')).toBe('0');

    req.flush({
      context: 'vessels.self',
      range: { from: '2026-02-16T12:00:00.000Z', to: '2026-02-16T12:01:00.000Z' },
      values: [{ path: 'navigation.courseOverGroundTrue', method: 'avg' }],
      data: []
    });

    const response = await promise;
    expect(response).toBeTruthy();
  });

  it('should return null when history values endpoint returns 404 (plugin/API missing)', async () => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    const promise = service.getValues({
      paths: 'navigation.speedThroughWater:avg',
      resolution: 1
    });

    const req = httpMock.expectOne((request) =>
      request.url === 'http://localhost:3000/signalk/v2/api/history/values'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'Not Found' }, { status: 404, statusText: 'Not Found' });

    const response = await promise;
    expect(response).toBeNull();
  });

  it('should return null when history paths endpoint returns 500', async () => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    const promise = service.getPaths({
      from: '2026-02-16T12:00:00.000Z',
      to: '2026-02-16T12:01:00.000Z'
    });

    const req = httpMock.expectOne((request) =>
      request.url === 'http://localhost:3000/signalk/v2/api/history/paths'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ message: 'Server Error' }, { status: 500, statusText: 'Server Error' });

    const response = await promise;
    expect(response).toBeNull();
  });
});
