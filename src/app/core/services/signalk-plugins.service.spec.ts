import { TestBed } from '@angular/core/testing';

import { SignalkPluginsService } from './signalk-plugins.service';
import { SignalkPluginConfigService } from './signalk-plugin-config.service';

describe('SignalkPluginsService', () => {
  let service: SignalkPluginsService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: SignalkPluginConfigService,
          useValue: {
            listPlugins: () => Promise.resolve({ ok: true, data: [], capabilities: { listSupported: true, detailSupported: true, saveConfigSupported: true, detailFallbackToList: false } })
          }
        }
      ]
    });
    service = TestBed.inject(SignalkPluginsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
