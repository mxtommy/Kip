import { TestBed } from '@angular/core/testing';

import { SignalkPluginsService } from './signalk-plugins.service';

describe('SignalkPluginsService', () => {
  let service: SignalkPluginsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SignalkPluginsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
