import { TestBed, inject } from '@angular/core/testing';

import { SignalKDeltaService } from './signalk-delta.service';

describe('SignalkDeltaService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SignalKDeltaService]
    });
  });

  it('should be created', inject([SignalKDeltaService], (service: SignalKDeltaService) => {
    expect(service).toBeTruthy();
  }));
});
