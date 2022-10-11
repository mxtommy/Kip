import { TestBed } from '@angular/core/testing';

import { AppInitService } from './app-init.service';

describe('AppConfigService', () => {
  let service: AppInitService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AppInitService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
