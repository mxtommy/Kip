import { TestBed, inject } from '@angular/core/testing';

import { SignalKService } from './signalk.service';

describe('SignalkService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SignalKService]
    });
  });

  it('should be created', inject([SignalKService], (service: SignalKService) => {
    expect(service).toBeTruthy();
  }));
});
