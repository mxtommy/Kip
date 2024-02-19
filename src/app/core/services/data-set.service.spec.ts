import { TestBed, inject } from '@angular/core/testing';

import { DataSetService } from './data-set.service';

describe('DataSetService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DataSetService]
    });
  });

  it('should be created', inject([DataSetService], (service: DataSetService) => {
    expect(service).toBeTruthy();
  }));
});
