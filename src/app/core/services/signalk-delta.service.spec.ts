import { TestBed, inject } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SignalKDeltaService } from './signalk-delta.service';

describe('SignalkDeltaService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SignalKDeltaService]
    });
  });

  it('should be created', inject([SignalKDeltaService], (service: SignalKDeltaService) => {
    expect(service).toBeTruthy();
  }));
});
