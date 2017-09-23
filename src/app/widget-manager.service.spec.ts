import { TestBed, inject } from '@angular/core/testing';

import { WidgetManagerService } from './widget-manager.service';

describe('WidgetManagerService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WidgetManagerService]
    });
  });

  it('should be created', inject([WidgetManagerService], (service: WidgetManagerService) => {
    expect(service).toBeTruthy();
  }));
});
