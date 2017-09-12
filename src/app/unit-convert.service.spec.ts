import { TestBed, inject } from '@angular/core/testing';

import { UnitConvertService } from './unit-convert.service';

describe('UnitConvertService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [UnitConvertService]
    });
  });

  it('should be created', inject([UnitConvertService], (service: UnitConvertService) => {
    expect(service).toBeTruthy();
  }));
});
