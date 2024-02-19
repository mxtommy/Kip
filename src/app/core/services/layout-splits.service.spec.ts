import { TestBed, inject } from '@angular/core/testing';

import { LayoutSplitsService } from './layout-splits.service';

describe('LayoutSplitsService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LayoutSplitsService]
    });
  });

  it('should be created', inject([LayoutSplitsService], (service: LayoutSplitsService) => {
    expect(service).toBeTruthy();
  }));
});
