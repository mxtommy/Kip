import { TestBed } from '@angular/core/testing';

import { WidgetBaseService } from './widget-base.service';

describe('WidgetBaseService', () => {
  let service: WidgetBaseService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(WidgetBaseService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
