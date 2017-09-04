import { TestBed, inject } from '@angular/core/testing';

import { SignalkFullService } from './signalk-full.service';

describe('SignalkFullService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SignalkFullService]
    });
  });

  it('should be created', inject([SignalkFullService], (service: SignalkFullService) => {
    expect(service).toBeTruthy();
  }));
});
