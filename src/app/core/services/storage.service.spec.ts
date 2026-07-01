import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, Subject, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@angular/common/http';
import { StorageService } from './storage.service';
import { SignalKConnectionService } from './signalk-connection.service';
import { AuthenticationService } from './authentication.service';

describe('StorageService', () => {
  let service: StorageService;
  let httpMock: { post: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    httpMock = { post: vi.fn(), get: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        StorageService,
        { provide: HttpClient, useValue: httpMock },
        {
          provide: SignalKConnectionService,
          useValue: {
            serverServiceEndpoint$: new BehaviorSubject({ operation: 0 }),
            serverVersion$: new BehaviorSubject('2.0.0')
          }
        },
        { provide: AuthenticationService, useValue: { isLoggedIn$: new BehaviorSubject(false) } }
      ]
    });
    service = TestBed.inject(StorageService);
    // Force the service ready so removeItem's ensureReady() guard passes.
    service.storageServiceReady$.next(true);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('removeItem resolves only after the queued delete request completes', async () => {
    const post$ = new Subject<unknown>();
    httpMock.post.mockReturnValue(post$);

    let resolved = false;
    const done = service.removeItem('user', 'race-config').then(() => { resolved = true; });

    // The request is dispatched synchronously through the patch queue...
    expect(httpMock.post).toHaveBeenCalledTimes(1);
    // ...but the promise must not resolve until the server responds.
    await Promise.resolve();
    expect(resolved).toBe(false);

    post$.next(null);
    post$.complete();
    await done;

    expect(resolved).toBe(true);
  });

  it('removeItem rejects on failure yet the patch queue keeps processing', async () => {
    httpMock.post
      .mockReturnValueOnce(throwError(() => ({ status: 500, message: 'boom' })))
      .mockReturnValueOnce(of(null));

    await expect(service.removeItem('user', 'first')).rejects.toBeTruthy();
    // A failed delete must not kill the sequential queue for later operations.
    await expect(service.removeItem('user', 'second')).resolves.toBeUndefined();
    expect(httpMock.post).toHaveBeenCalledTimes(2);
  });
});
