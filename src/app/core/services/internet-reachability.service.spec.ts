import { TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { InternetReachabilityService } from './internet-reachability.service';

describe('InternetReachabilityService', () => {
  let service: InternetReachabilityService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(InternetReachabilityService);
  });

  afterEach(() => {
    service.ngOnDestroy();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('marks internet as available after successful probe', fakeAsync(() => {
    spyOn(window, 'fetch').and.returnValue(Promise.resolve({ status: 204 } as Response));

    service.start();
    flushMicrotasks();

    expect(service.isReachable()).toBeTrue();
    expect(service.internetAvailable()).toBeTrue();
    expect(service.lastError()).toBeNull();
    expect(window.fetch).toHaveBeenCalledTimes(1);
  }));

  it('treats opaque probe response as reachable', fakeAsync(() => {
    spyOn(window, 'fetch').and.returnValue(Promise.resolve({ type: 'opaque', status: 0 } as Response));

    service.start();
    flushMicrotasks();

    expect(service.isReachable()).toBeTrue();
    expect(service.internetAvailable()).toBeTrue();
    expect(service.lastError()).toBeNull();
  }));

  it('retries after failure and recovers on next successful probe', fakeAsync(() => {
    spyOn(window, 'fetch').and.returnValues(
      Promise.reject(new Error('offline')),
      Promise.resolve({ status: 204 } as Response)
    );

    service.start();
    flushMicrotasks();

    expect(service.isReachable()).toBeFalse();
    expect(service.internetAvailable()).toBeFalse();
    expect(service.lastError()).toBe('Internet reachability probe failed');

    tick(5000);
    flushMicrotasks();

    expect(window.fetch).toHaveBeenCalledTimes(2);
    expect(service.isReachable()).toBeTrue();
    expect(service.internetAvailable()).toBeTrue();
    expect(service.lastError()).toBeNull();
  }));

  it('start is idempotent', fakeAsync(() => {
    spyOn(window, 'fetch').and.returnValue(Promise.resolve({ status: 204 } as Response));

    service.start();
    service.start();
    flushMicrotasks();

    expect(window.fetch).toHaveBeenCalledTimes(1);
  }));
});
