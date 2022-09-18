import { TestBed } from '@angular/core/testing';

import { TimersService } from './timers.service';

describe('TimersService', () => {
  let service: TimersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
