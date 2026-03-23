import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
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
