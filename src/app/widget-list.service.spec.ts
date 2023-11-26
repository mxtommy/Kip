import { TestBed, inject } from '@angular/core/testing';

import { WidgetListService } from './widget-list.service';

describe('WidgetListService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WidgetListService]
    });
  });

  it('should be created', inject([WidgetListService], (service: WidgetListService) => {
    expect(service).toBeTruthy();
  }));
});
