import { TestBed, inject } from '@angular/core/testing';

import { SignalkService } from './signalk.service';

describe('SignalkService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SignalkService]
    });
  });

  it('should be created', inject([SignalkService], (service: SignalkService) => {
    expect(service).toBeTruthy();
  }));
});
