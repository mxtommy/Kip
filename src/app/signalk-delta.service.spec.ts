import { TestBed, inject } from '@angular/core/testing';

import { SignalkDeltaService } from './signalk-delta.service';

describe('SignalkDeltaService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SignalkDeltaService]
    });
  });

  it('should be created', inject([SignalkDeltaService], (service: SignalkDeltaService) => {
    expect(service).toBeTruthy();
  }));
});
