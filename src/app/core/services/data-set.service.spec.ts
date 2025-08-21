import { TestBed, inject } from '@angular/core/testing';

import { DatasetService } from './data-set.service';

describe('DatasetService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [DatasetService]
    });
  });

  it('should be created', inject([DatasetService], (service: DatasetService) => {
    expect(service).toBeTruthy();
  }));
});
