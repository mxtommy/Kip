import { TestBed, inject } from '@angular/core/testing';

import { SignalKDataService } from './signalk-data.service';

describe('SignalKDataService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SignalKDataService]
    });
  });

  it('should be created', inject([SignalKDataService], (service: SignalKDataService) => {
    expect(service).toBeTruthy();
  }));
});
