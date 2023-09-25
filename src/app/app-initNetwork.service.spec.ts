import { TestBed } from '@angular/core/testing';

import { AppNetworkInitService } from './app-initNetwork.service';

describe('AppConfigService', () => {
  let service: AppNetworkInitService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppNetworkInitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
