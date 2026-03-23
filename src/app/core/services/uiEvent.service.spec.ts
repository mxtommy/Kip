import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { uiEventService } from './uiEvent.service';

describe('GestureService', () => {
  let service: uiEventService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(uiEventService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
