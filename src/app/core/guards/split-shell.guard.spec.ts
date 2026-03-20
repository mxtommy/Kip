import { TestBed } from '@angular/core/testing';
import { Route, Router, UrlSegment, UrlTree } from '@angular/router';
import { SettingsService } from '../services/settings.service';
import { splitShellGuard } from './split-shell.guard';

class MockSettingsService {
  public splitShellEnabled = false;

  public getSplitShellEnabled(): boolean {
    return this.splitShellEnabled;
  }
}

describe('splitShellGuard', () => {
  let settings: MockSettingsService;
  let router: jasmine.SpyObj<Router>;
  let defaultTree: UrlTree;

  const runGuard = (segments: string[]) => TestBed.runInInjectionContext(() =>
    splitShellGuard({} as Route, segments.map(s => new UrlSegment(s, {})))
  );

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['createUrlTree']);
    defaultTree = {} as UrlTree;
    router.createUrlTree.and.returnValue(defaultTree);

    TestBed.configureTestingModule({
      providers: [
        { provide: SettingsService, useClass: MockSettingsService },
        { provide: Router, useValue: router }
      ]
    });

    settings = TestBed.inject(SettingsService) as unknown as MockSettingsService;
  });

  it('normalizes root URL to chartplotter/0 when split-shell is enabled', () => {
    settings.splitShellEnabled = true;

    const result = runGuard([]);

    expect(router.createUrlTree).toHaveBeenCalledWith(['chartplotter', '0']);
    expect(result).toBe(defaultTree);
  });

  it('normalizes root URL to dashboard/0 when split-shell is disabled', () => {
    settings.splitShellEnabled = false;

    const result = runGuard([]);

    expect(router.createUrlTree).toHaveBeenCalledWith(['dashboard', '0']);
    expect(result).toBe(defaultTree);
  });

  it('normalizes /chartplotter without id to /chartplotter/0 when split-shell is enabled', () => {
    settings.splitShellEnabled = true;

    const result = runGuard(['chartplotter']);

    expect(router.createUrlTree).toHaveBeenCalledWith(['chartplotter', '0']);
    expect(result).toBe(defaultTree);
  });

  it('normalizes /dashboard without id to /chartplotter/0 when split-shell is enabled', () => {
    settings.splitShellEnabled = true;

    const result = runGuard(['dashboard']);

    expect(router.createUrlTree).toHaveBeenCalledWith(['chartplotter', '0']);
    expect(result).toBe(defaultTree);
  });

  it('normalizes /chartplotter without id to /dashboard/0 when split-shell is disabled', () => {
    settings.splitShellEnabled = false;

    const result = runGuard(['chartplotter']);

    expect(router.createUrlTree).toHaveBeenCalledWith(['dashboard', '0']);
    expect(result).toBe(defaultTree);
  });

  it('redirects /dashboard/:id to /chartplotter/:id when split-shell is enabled', () => {
    settings.splitShellEnabled = true;

    const result = runGuard(['dashboard', '3']);

    expect(router.createUrlTree).toHaveBeenCalledWith(['chartplotter', '3']);
    expect(result).toBe(defaultTree);
  });

  it('redirects /chartplotter/:id to /dashboard/:id when split-shell is disabled', () => {
    settings.splitShellEnabled = false;

    const result = runGuard(['chartplotter', '4']);

    expect(router.createUrlTree).toHaveBeenCalledWith(['dashboard', '4']);
    expect(result).toBe(defaultTree);
  });

  it('allows /chartplotter/:id when split-shell is enabled', () => {
    settings.splitShellEnabled = true;

    const result = runGuard(['chartplotter', '1']);

    expect(result).toBeTrue();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('allows /dashboard/:id when split-shell is disabled', () => {
    settings.splitShellEnabled = false;

    const result = runGuard(['dashboard', '1']);

    expect(result).toBeTrue();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });

  it('allows unrelated routes', () => {
    settings.splitShellEnabled = true;

    const result = runGuard(['settings']);

    expect(result).toBeTrue();
    expect(router.createUrlTree).not.toHaveBeenCalled();
  });
});
