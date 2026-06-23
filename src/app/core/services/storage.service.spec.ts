import { TestBed } from '@angular/core/testing';
import { HttpTestingController } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StorageService } from './storage.service';
import { IConfig } from '../interfaces/app-settings.interfaces';
import { ensureLocalStorage } from '../../../test-helpers/local-storage.test-helper';

const blankConfig = (): IConfig => ({ app: null, theme: null, dashboards: [] });

describe('StorageService', () => {
  let service: StorageService;
  let http: HttpTestingController;

  beforeEach(() => {
    ensureLocalStorage();
    // Provide StorageService in the module so its deps resolve to the global test stubs
    // (AuthenticationService / SignalKConnectionService) instead of the real root services.
    TestBed.configureTestingModule({ providers: [StorageService] });
    service = TestBed.inject(StorageService);
    http = TestBed.inject(HttpTestingController);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('write-safety guard', () => {
    beforeEach(() => {
      service.storageServiceReady$.next(true);
      service.activeConfigFileVersion = 11;
    });

    afterEach(() => http.verify());

    it('setConfig rejects an empty config name', async () => {
      await expect(service.setConfig('user', '', blankConfig())).rejects.toThrow(/name/i);
      http.expectNone(() => true);
    });

    it('removeItem throws on an empty name', () => {
      expect(() => service.removeItem('user', '')).toThrow(/name/i);
      http.expectNone(() => true);
    });

    it('patchConfig does not POST when the active slot name is unset', () => {
      service.sharedConfigName = undefined as unknown as string;
      service.patchConfig('Dashboards', []);
      http.expectNone(() => true);
    });

    it('patchConfig POSTs a patch targeting the active slot when set', () => {
      service.sharedConfigName = 'cockpit';
      service.patchConfig('Dashboards', [{ id: 'd1' }]);
      const req = http.expectOne((r) => r.method === 'POST');
      // JSON Patch op path is namespaced by the active slot name
      expect(req.request.body[0].path).toBe('/cockpit/dashboards');
      req.flush(null);
    });
  });

  describe('awaitQueueDrain', () => {
    beforeEach(() => {
      service.storageServiceReady$.next(true);
      service.activeConfigFileVersion = 11;
      service.sharedConfigName = 'p';
    });

    it('resolves true immediately when the queue is empty', async () => {
      await expect(service.awaitQueueDrain(1000)).resolves.toBe(true);
    });

    it('resolves true once a queued write completes', async () => {
      service.patchConfig('Dashboards', []);
      const drain = service.awaitQueueDrain(2000);
      http.expectOne(() => true).flush(null);
      await expect(drain).resolves.toBe(true);
      http.verify();
    });

    it('resolves false (best-effort) when a write stalls past the timeout', async () => {
      service.patchConfig('Dashboards', []);
      await expect(service.awaitQueueDrain(40)).resolves.toBe(false);
      // drain the stalled request so the test ends clean
      http.expectOne(() => true).flush(null);
      http.verify();
    });

    it('a failed write does not wedge the queue (later writes still process)', async () => {
      service.patchConfig('Dashboards', []);
      http.expectOne(() => true).flush('boom', { status: 500, statusText: 'err' });
      service.patchConfig('Dashboards', []);
      const drain = service.awaitQueueDrain(2000);
      http.expectOne(() => true).flush(null);
      await expect(drain).resolves.toBe(true);
      http.verify();
    });
  });
});
