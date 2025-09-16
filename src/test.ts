// Angular 20+ test setup: use the public testing entrypoint instead of deep zone.js paths.
// Deep imports like 'zone.js/dist/async-test' were removed from the package exports in zone.js >=0.14.
// The single 'zone.js/testing' import wires up jasmine patches & async/fakeAsync helpers.
import 'zone.js'; // Included for completeness (often auto-included by CLI polyfills)
// Mark global test flag before anything else so app code can detect test context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__KIP_TEST__ = true;
// Neutralize hard navigations that break Karma connection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loc: any = window.location;
try {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      ...loc,
  reload: () => { console.warn('[TEST] location.reload() called'); },
  replace: () => { console.warn('[TEST] location.replace() called'); }
    }
  });
} catch { /* ignore if not allowed */ }
import 'zone.js/testing';
import './test-shims/steelseries-shim';
// Global test configuration (providers, stubs) inlined to avoid module resolution issues.
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MatDialogRef } from '@angular/material/dialog';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UnitsService } from './app/core/services/units.service';
import { HttpClient } from '@angular/common/http';
import { AppNetworkInitService } from './app/core/services/app-initNetwork.service';
import { AuthenticationService } from './app/core/services/authentication.service';
import { ActivatedRoute } from '@angular/router';
// Global provider setup (HttpClient, RouterTestingModule, animation & material stubs, etc.)
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// First, initialize the Angular testing environment.
const testBed = getTestBed();
testBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
class MatBottomSheetRefStub { dismiss(): void { /* noop */ } }
class MatDialogRefStub { close(): void { /* noop */ } }
class AppNetworkInitServiceStub { /* noop for tests */ }
const HttpClientStub: Partial<HttpClient> = {};
class AuthenticationServiceStub {
  // Minimal stub surface for tests that inject AuthenticationService
  // Minimal observable-like stub used in many specs. Keep shape small and typed to avoid lint.
  public isLoggedIn$ = { subscribe: () => ({ unsubscribe: () => void 0 }) };
  login = async () => {};
  logout = async () => {};
}
const ActivatedRouteStub = { snapshot: {}, params: {}, queryParams: {} } as Partial<ActivatedRoute>;
// Consolidated global TestBed configuration to avoid ordering surprises and make
// global providers explicit in one place.
testBed.configureTestingModule({
  imports: [RouterTestingModule],
  providers: [
    // HTTP helpers: testing provider is preferred for specs; keep interceptor wiring if some tests rely on it
    provideHttpClient(withInterceptorsFromDi()),
    provideHttpClientTesting(),
    // Animation & utility services
    provideNoopAnimations(),
    UnitsService,
    // Material stubs and tokens
    { provide: MAT_DIALOG_DATA, useValue: {} },
    { provide: MatBottomSheetRef, useClass: MatBottomSheetRefStub },
    { provide: MatDialogRef, useClass: MatDialogRefStub },
    // Common DI stubs used by many suites
    { provide: HttpClient, useValue: HttpClientStub },
    { provide: AppNetworkInitService, useClass: AppNetworkInitServiceStub },
    { provide: AuthenticationService, useClass: AuthenticationServiceStub },
    { provide: ActivatedRoute, useValue: ActivatedRouteStub }
  ]
});

// Angular CLI will find and run specs automatically (FindTestsPlugin). No manual __karma__.start().
console.log('[TEST BOOTSTRAP] Global test environment configured. Waiting for spec auto-discovery...');
