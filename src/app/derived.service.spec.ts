import { TestBed, inject } from '@angular/core/testing';

import { DerivedService } from './derived.service';

describe('DerivedService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DerivedService]
    });
  });

  it('should be created', inject([DerivedService], (service: DerivedService) => {
    expect(service).toBeTruthy();
  }));
});
