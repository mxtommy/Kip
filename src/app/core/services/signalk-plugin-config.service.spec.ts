import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SignalKConnectionService } from './signalk-connection.service';
import { SignalkPluginConfigService } from './signalk-plugin-config.service';

class SignalKConnectionServiceStub {
  public signalKURL = { url: 'http://localhost:3000' };
}

describe('SignalkPluginConfigService', () => {
  let service: SignalkPluginConfigService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SignalkPluginConfigService,
        { provide: SignalKConnectionService, useClass: SignalKConnectionServiceStub }
      ]
    });

    service = TestBed.inject(SignalkPluginConfigService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should list plugins and normalize state', async () => {
    const promise = service.listPlugins();

    const req = httpMock.expectOne('http://localhost:3000/plugins');
    expect(req.request.method).toBe('GET');
    req.flush([
      {
        id: 'autopilot',
        name: 'Autopilot',
        packageName: 'autopilot',
        keywords: ['nav'],
        version: '1.0.0',
        description: 'Autopilot plugin',
        schema: { type: 'object' },
        data: {
          configuration: { provider: 'raymarine' },
          enabled: true,
          enableLogging: false,
          enableDebug: false
        }
      }
    ]);

    const result = await promise;
    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }
    expect(result.data.length).toBe(1);
    expect(result.data[0].id).toBe('autopilot');
    expect(result.data[0].state.enabled).toBeTrue();
    expect(result.capabilities.listSupported).toBeTrue();
  });

  it('should fallback to /plugins list when /plugins/{id} returns 404', async () => {
    const promise = service.getPlugin('autopilot');

    const detailReq = httpMock.expectOne('http://localhost:3000/plugins/autopilot');
    expect(detailReq.request.method).toBe('GET');
    detailReq.flush({}, { status: 404, statusText: 'Not Found' });

    await Promise.resolve();

    const listReq = httpMock.expectOne('http://localhost:3000/plugins');
    expect(listReq.request.method).toBe('GET');
    listReq.flush([
      {
        id: 'autopilot',
        name: 'Autopilot',
        packageName: 'autopilot',
        keywords: [],
        version: '1.0.0',
        description: 'Autopilot plugin',
        schema: null,
        data: {
          configuration: {},
          enabled: true,
          enableLogging: false,
          enableDebug: false
        }
      }
    ]);

    const result = await promise;
    expect(result.ok).toBeTrue();
    expect(result.capabilities.detailSupported).toBeFalse();
    expect(result.capabilities.detailFallbackToList).toBeTrue();
  });

  it('should preserve unknown keys when saving partial config', async () => {
    const promise = service.savePluginConfig('autopilot', {
      configuration: { mode: 'wind' }
    });

    const detailReq = httpMock.expectOne('http://localhost:3000/plugins/autopilot');
    detailReq.flush({}, { status: 404, statusText: 'Not Found' });

    await Promise.resolve();

    const listReq = httpMock.expectOne('http://localhost:3000/plugins');
    listReq.flush([
      {
        id: 'autopilot',
        name: 'Autopilot',
        packageName: 'autopilot',
        keywords: [],
        version: '1.0.0',
        description: 'Autopilot plugin',
        schema: null,
        data: {
          configuration: { vendor: 'raymarine', mode: 'auto' },
          enabled: true,
          enableLogging: false,
          enableDebug: false
        }
      }
    ]);

    await new Promise(resolve => setTimeout(resolve, 0));

    const saveReq = httpMock.expectOne('http://localhost:3000/plugins/autopilot/config');
    expect(saveReq.request.method).toBe('POST');
    expect(saveReq.request.body.configuration.vendor).toBe('raymarine');
    expect(saveReq.request.body.configuration.mode).toBe('wind');
    saveReq.flush({ ok: true });

    const result = await promise;
    expect(result.ok).toBeTrue();
  });

  it('should validate dependency as config-mismatch when required keys differ', async () => {
    const promise = service.validateDependency({
      pluginId: 'autopilot',
      requiredConfig: { provider: 'pypilot' }
    });

    const detailReq = httpMock.expectOne('http://localhost:3000/plugins/autopilot');
    detailReq.flush({}, { status: 404, statusText: 'Not Found' });

    await Promise.resolve();

    const listReq = httpMock.expectOne('http://localhost:3000/plugins');
    listReq.flush([
      {
        id: 'autopilot',
        name: 'Autopilot',
        packageName: 'autopilot',
        keywords: [],
        version: '1.0.0',
        description: 'Autopilot plugin',
        schema: null,
        data: {
          configuration: { provider: 'raymarine' },
          enabled: true,
          enableLogging: false,
          enableDebug: false
        }
      }
    ]);

    const result = await promise;
    expect(result.ok).toBeTrue();
    if (!result.ok) {
      return;
    }
    expect(result.data.status).toBe('config-mismatch');
    expect(result.data.missingKeys).toEqual(['provider']);
  });

  it('should normalize schema and flag unsupported keywords', () => {
    const normalized = service.normalizePluginSchema({
      type: 'object',
      properties: {
        mode: {
          type: 'string',
          enum: ['auto', 'wind']
        },
        advanced: {
          type: 'object',
          oneOf: [{ type: 'object' }]
        }
      },
      required: ['mode']
    });

    expect(normalized.hasSchema).toBeTrue();
    expect(normalized.fields.length).toBe(2);
    const modeField = normalized.fields.find(field => field.key === 'mode');
    expect(modeField?.required).toBeTrue();
    const advancedField = normalized.fields.find(field => field.key === 'advanced');
    expect(advancedField?.unsupportedKeywords).toContain('oneOf');
  });
});
