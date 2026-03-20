import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, Route, RouterOutlet, provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { SettingsService } from './core/services/settings.service';

class MockSettingsService {
  public splitShellEnabled = false;

  public getSplitShellEnabled(): boolean {
    return this.splitShellEnabled;
  }
}

@Component({
  selector: 'test-route-target',
  template: ''
})
class TestRouteTargetComponent {}

@Component({
  selector: 'test-router-host',
  imports: [RouterOutlet],
  template: '<router-outlet />'
})
class TestRouterHostComponent {}

describe('app.routes split-shell integration', () => {
  let router: Router;
  let settings: MockSettingsService;

  beforeEach(async () => {
    const testRoutes: Route[] = routes.map((route) => {
      if (route.path === 'dashboard/:id') {
        return { ...route, component: TestRouteTargetComponent };
      }

      if (route.path === 'chartplotter/:id') {
        return { ...route, loadComponent: () => Promise.resolve(TestRouteTargetComponent) };
      }

      if (route.path === '**') {
        return { ...route, component: TestRouteTargetComponent };
      }

      return route;
    });

    await TestBed.configureTestingModule({
      imports: [TestRouterHostComponent],
      providers: [
        provideRouter(testRoutes),
        { provide: SettingsService, useClass: MockSettingsService }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    settings = TestBed.inject(SettingsService) as unknown as MockSettingsService;
    const fixture = TestBed.createComponent(TestRouterHostComponent);
    fixture.detectChanges();
  });

  it('routes root URL through wildcard + guard to /chartplotter/0 when split-shell is enabled', async () => {
    settings.splitShellEnabled = true;

    await router.navigateByUrl('/');

    expect(router.url).toBe('/chartplotter/0');
  });

  it('routes /chartplotter without id to /dashboard/0 when split-shell is disabled', async () => {
    settings.splitShellEnabled = false;

    await router.navigateByUrl('/chartplotter');

    expect(router.url).toBe('/dashboard/0');
  });

  it('routes /dashboard/:id to /chartplotter/:id when split-shell is enabled', async () => {
    settings.splitShellEnabled = true;

    await router.navigateByUrl('/dashboard/7');

    expect(router.url).toBe('/chartplotter/7');
  });
});
