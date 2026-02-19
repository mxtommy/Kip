import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { IEndpointStatus, SignalKConnectionService } from './signalk-connection.service';
import { KipSeriesService } from './kip-series.service';

class SignalKConnectionServiceStub {
  public serverServiceEndpoint$ = new BehaviorSubject<IEndpointStatus>({
    operation: 0,
    message: 'Not connected',
    serverDescription: null,
    httpServiceUrl: null,
    WsServiceUrl: null
  });
}

describe('KipSeriesService', () => {
  let service: KipSeriesService;
  let httpMock: HttpTestingController;
  let connectionStub: SignalKConnectionServiceStub;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        KipSeriesService,
        { provide: SignalKConnectionService, useClass: SignalKConnectionServiceStub }
      ]
    });

    service = TestBed.inject(KipSeriesService);
    httpMock = TestBed.inject(HttpTestingController);
    connectionStub = TestBed.inject(SignalKConnectionService) as unknown as SignalKConnectionServiceStub;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should return null when plugin endpoint is unavailable', async () => {
    const response = await service.reconcileSeries([
      {
        seriesId: 'widget-1:datachart',
        datasetUuid: 'widget-1',
        ownerWidgetUuid: 'widget-1',
        path: 'navigation.speedThroughWater'
      }
    ]);

    expect(response).toBeNull();
    httpMock.expectNone(() => true);
  });

  it('should post series definitions to kip plugin reconcile endpoint', async () => {
    connectionStub.serverServiceEndpoint$.next({
      operation: 2,
      message: 'Connected',
      serverDescription: 'Signal K',
      httpServiceUrl: 'http://localhost:3000/signalk/v1/api/',
      WsServiceUrl: 'ws://localhost:3000/signalk/v1/stream'
    });

    const payload = [
      {
        seriesId: 'widget-1:datachart',
        datasetUuid: 'widget-1',
        ownerWidgetUuid: 'widget-1',
        ownerWidgetSelector: 'widget-data-chart',
        path: 'navigation.speedThroughWater',
        source: 'default',
        timeScale: 'minute',
        period: 10,
        enabled: true
      }
    ];

    const promise = service.reconcileSeries(payload);

    const req = httpMock.expectOne((request) =>
      request.url === 'http://localhost:3000/plugins/kip/series/reconcile'
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({
      created: 1,
      updated: 0,
      deleted: 0,
      total: 1
    });

    const response = await promise;
    expect(response).toEqual({ created: 1, updated: 0, deleted: 0, total: 1 });
  });
});
