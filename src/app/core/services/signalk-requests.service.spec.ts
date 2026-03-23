import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { SignalkRequestsService } from './signalk-requests.service';

describe('SignalkRequestsService', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: SignalkRequestsService = TestBed.inject(SignalkRequestsService);
    expect(service).toBeTruthy();
  });
});
