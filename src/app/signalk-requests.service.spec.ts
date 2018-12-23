import { TestBed } from '@angular/core/testing';

import { SignalkRequestsService } from './signalk-requests.service';

describe('SignalkRequestsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: SignalkRequestsService = TestBed.get(SignalkRequestsService);
    expect(service).toBeTruthy();
  });
});
