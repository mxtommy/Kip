import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { RemoteDashboardsService } from './remote-dashboards.service';

describe('RemoteDashboardsService', () => {
  let service: RemoteDashboardsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RemoteDashboardsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
