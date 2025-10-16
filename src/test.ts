// Angular 20+ test setup: use the public testing entrypoint instead of deep zone.js paths.
// Deep imports like 'zone.js/dist/async-test' were removed from the package exports in zone.js >=0.14.
// The single 'zone.js/testing' import wires up jasmine patches & async/fakeAsync helpers.
import 'zone.js'; // Included for completeness (often auto-included by CLI polyfills)
// Mark global test flag before anything else so app code can detect test context
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).__KIP_TEST__ = true;
// Neutralize hard navigation that break Karma connection
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
import { MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { UnitsService } from './app/core/services/units.service';
import { AppNetworkInitService } from './app/core/services/app-initNetwork.service';
import { AuthenticationService } from './app/core/services/authentication.service';
import { ActivatedRoute } from '@angular/router';
import { AppSettingsService } from './app/core/services/app-settings.service';
import { WidgetRuntimeDirective } from './app/core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from './app/core/directives/widget-streams.directive';
import { WidgetMetadataDirective } from './app/core/directives/widget-metadata.directive';
import { SignalKConnectionService } from './app/core/services/signalk-connection.service';
import { ConnectionStateMachine } from './app/core/services/connection-state-machine.service';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { ReactiveFormsModule, FormGroupDirective, UntypedFormGroup, UntypedFormBuilder } from '@angular/forms';
import { INotificationConfig } from './app/core/interfaces/app-settings.interfaces';
import { DefaultNotificationConfig } from './default-config/config.blank.notification.const';
import { MatIconRegistry } from '@angular/material/icon';
// Global provider setup (HttpClient, RouterTestingModule, animation & material stubs, etc.)
import { getTestBed, TestBed } from '@angular/core/testing';
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
class AuthenticationServiceStub {
  // Minimal stub surface for tests that inject AuthenticationService
  // Provide a real Observable with pipe() to satisfy consumers like StorageService.
  private _subject = new (class {
    private _subs: ((v: boolean) => void)[] = [];
    private _value = false;
    subscribe = (cb: (v: boolean) => void) => { this._subs.push(cb); cb(this._value); return { unsubscribe: () => void 0 }; };
    next = (v: boolean) => { this._value = v; this._subs.forEach(s => s(v)); };
    pipe = (...args: unknown[]) => { void args; return this; }; // very light-weight pipe-able stub
  })();
  public isLoggedIn$ = this._subject as unknown as { subscribe: (cb: (v: boolean) => void) => { unsubscribe: () => void }; pipe: (...args: unknown[]) => unknown };
  // Token stream used by SignalKDeltaService
  private _authSubject = new (class {
    private _subs: ((v: unknown) => void)[] = [];
    private _value: unknown = null;
    subscribe = (cb: (v: unknown) => void) => { this._subs.push(cb); cb(this._value); return { unsubscribe: () => void 0 }; };
    next = (v: unknown) => { this._value = v; this._subs.forEach(s => s(v)); };
    pipe = (...args: unknown[]) => { void args; return this; };
  })();
  public authToken$ = this._authSubject as unknown as { subscribe: (cb: (v: unknown) => void) => { unsubscribe: () => void }; pipe: (...args: unknown[]) => unknown };
  login = async () => { };
  logout = async () => { };
}
const ActivatedRouteStub: Partial<ActivatedRoute> = {
  snapshot: {} as unknown as ActivatedRoute['snapshot'],
  // Provide observable-like streams
  params: of({}),
  queryParams: of({})
};

// Host2 directive stubs for widgets that inject directives at runtime
class WidgetRuntimeDirectiveStub {
  options() {
    // Provide a minimal, benign config shape so templates that access cfg().options.xxx don't crash
    return {
      type: '',
      title: '',
      paths: {},
      options: {}
    } as unknown as Record<string, unknown>;
  }
}
class WidgetStreamsDirectiveStub {
  setStreamsConfig(cfg: unknown) { void cfg; }
  applyStreamsConfigDiff(cfg: unknown) { void cfg; }
  observe(key: string, cb: (v: unknown) => void) { void key; void cb; }
}
class WidgetMetadataDirectiveStub { }

// App settings stub used by components like SplitShellComponent
class AppSettingsServiceStub {
  // minimal connection fields used by components/services
  public signalkUrl = { url: 'http://localhost' };
  private _instanceName$ = new BehaviorSubject<string>('');
  private _isRemoteControl$ = new BehaviorSubject<boolean>(false);
  private _units$ = new BehaviorSubject<Record<string, unknown>>({});
  private _autoNightMode$ = new BehaviorSubject<boolean>(false);
  private _redNightMode$ = new BehaviorSubject<boolean>(false);
  private _themeName$ = new BehaviorSubject<string>('dark-theme');
  private _splitShellSwipeDisabled$ = new BehaviorSubject<boolean>(false);
  private _dashboards: unknown[] = [];
  private _dataSets: unknown[] = [];
  private _notificationCfg$ = new BehaviorSubject<INotificationConfig>(DefaultNotificationConfig);
  // Signal-like flag in real service; in tests return false (no upgrade)
  public configUpgrade = () => false as const;
  // Config version helper used by AppComponent upgrade overlay
  public getConfigVersion() { return 12; }
  private readonly _kipUuid = 'kip-uuid-test';
  get KipUUID() { return this._kipUuid; }
  getSplitShellSide() { return 'left'; }
  getSplitShellEnabled() { return false; }
  getSplitShellWidth() { return 0.5; }
  getSplitShellSwipeDisabled() { return false; }
  getSplitShellSwipeDisabledAsO() { return this._splitShellSwipeDisabled$.asObservable(); }
  getDashboardConfig() { return []; }
  saveDashboards(d: unknown) { void d; }
  // App config minimal surface
  getAppConfig() { return { configVersion: 12 }; }
  // Connection config minimal surface
  getConnectionConfig() {
    return {
      configVersion: 12,
      signalKUrl: this.signalkUrl.url,
      proxyEnabled: false,
      signalKSubscribeAll: false,
      useDeviceToken: true,
      loginName: '',
      loginPassword: '',
      useSharedConfig: false,
      sharedConfigName: 'local',
      kipUUID: this._kipUuid
    };
  }
  // Observables used in RemoteDashboardsService and UnitsService
  getInstanceNameAsO() { return this._instanceName$.asObservable(); }
  getIsRemoteControlAsO() { return this._isRemoteControl$.asObservable(); }
  // Synchronous getters used by some components
  getInstanceName() { return this._instanceName$.getValue(); }
  getIsRemoteControl() { return this._isRemoteControl$.getValue(); }
  getDefaultUnitsAsO() { return this._units$.asObservable(); }
  getDefaultUnits() { return this._units$.getValue(); }
  // AppService theme/night signals
  getAutoNightModeAsO() { return this._autoNightMode$.asObservable(); }
  getRedNightModeAsO() { return this._redNightMode$.asObservable(); }
  getThemeNameAsO() { return this._themeName$.asObservable(); }
  getAutoNightMode() { return this._autoNightMode$.getValue(); }
  getRedNightMode() { return this._redNightMode$.getValue(); }
  getThemeName() { return this._themeName$.getValue(); }
  getNightModeBrightness() { return 1; }
  // DatasetService usage
  getDataSets() { return this._dataSets; }
  saveDataSets(d: unknown[]) { this._dataSets = d; }
  // Notification config APIs
  getNotificationServiceConfigAsO() { return this._notificationCfg$.asObservable(); }
  getNotificationConfig() { return this._notificationCfg$.getValue(); }
  setNotificationConfig(notificationConfig: INotificationConfig) { this._notificationCfg$.next(notificationConfig); }
  // SplitShell persistence setter used by component
  setSplitShellWidth(ratio: number) { void ratio; }
}

// Connection state machine stub to satisfy services
class ConnectionStateMachineStub {
  private _state$ = new BehaviorSubject<number>(0);
  public state$ = this._state$.asObservable();
  // Back-compat alias used by AppComponent
  public status$ = this.state$;
  public currentState = 0;
  setWebSocketRetryCallback(cb: () => void) { void cb; }
  setHTTPRetryCallback(cb: () => void) { void cb; }
  onWebSocketConnected() { /* noop */ }
  onWebSocketError(reason: string) { void reason; }
  startWebSocketConnection() { /* noop */ }
  startHTTPDiscovery(msg?: string) { void msg; }
  onHTTPDiscoverySuccess() { /* noop */ }
  onHTTPDiscoveryError(msg?: string) { void msg; }
  isFullyConnected() { return false; }
  isHTTPConnected() { return true; }
}

// SignalK connection service stub for plugins service and others
class SignalKConnectionServiceStub {
  public signalKURL = { url: 'http://localhost' } as { url: string };
  private _endpoint$ = new BehaviorSubject({ operation: 0, message: 'Not connected', serverDescription: null, httpServiceUrl: null, WsServiceUrl: null });
  public serverServiceEndpoint$ = this._endpoint$;
  public serverVersion$ = new BehaviorSubject<string>(null);
  getServiceEndpointStatusAsO(): Observable<unknown> { return this._endpoint$.asObservable(); }
  setServerInfo(name: string, version: string, roles: string[]) { void name; void version; void roles; }
}
// Consolidated global TestBed configuration to avoid ordering surprises and make
// global providers explicit in one place.
// Default, global testing module pieces we want merged into every spec
const defaultImports = [RouterTestingModule, ReactiveFormsModule];
const defaultProviders = [
  provideHttpClient(withInterceptorsFromDi()),
  provideHttpClientTesting(),
  provideNoopAnimations(),
  UnitsService,
  // Some components inject FormGroupDirective from a parent form; provide a benign stub
  { provide: FormGroupDirective, useFactory: () => {
    const fb = new UntypedFormBuilder();
    const root = new UntypedFormGroup({
      // common controls some specs expect to exist
      multiChildCtrls: fb.control([])
    });
    // return a minimal directive-like object with a control property
    return { control: root } as unknown as FormGroupDirective;
  } },
  { provide: MAT_DIALOG_DATA, useValue: {} },
  { provide: MAT_BOTTOM_SHEET_DATA, useValue: {} },
  { provide: MatBottomSheetRef, useClass: MatBottomSheetRefStub },
  { provide: MatDialogRef, useClass: MatDialogRefStub },
  { provide: AppNetworkInitService, useClass: AppNetworkInitServiceStub },
  { provide: AuthenticationService, useClass: AuthenticationServiceStub },
  { provide: ActivatedRoute, useValue: ActivatedRouteStub },
  { provide: SignalKConnectionService, useClass: SignalKConnectionServiceStub },
  { provide: ConnectionStateMachine, useClass: ConnectionStateMachineStub },
  // Host2 directive & app service stubs
  { provide: WidgetRuntimeDirective, useClass: WidgetRuntimeDirectiveStub },
  { provide: WidgetStreamsDirective, useClass: WidgetStreamsDirectiveStub },
  { provide: WidgetMetadataDirective, useClass: WidgetMetadataDirectiveStub },
  { provide: AppSettingsService, useClass: AppSettingsServiceStub },
  // Avoid MatIconRegistry trying to load real icons in unit tests
  { provide: MatIconRegistry, useValue: {
    // Commonly used registration APIs
    addSvgIcon: () => {},
    addSvgIconInNamespace: () => {},
    addSvgIconLiteral: () => {},
    addSvgIconLiteralInNamespace: () => {},
    addSvgIconSet: () => {},
    addSvgIconSetInNamespace: () => {},
    addSvgIconSetLiteral: () => {},
    addSvgIconSetLiteralInNamespace: () => {},
    // Lookup/helpers used by MatIcon
    getNamedSvgIcon: () => {
      // Return a real SVG element to satisfy MatIcon._setSvgElement expectations
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      return of(svg);
    },
    classNameForSvg: () => 'mat-icon',
    classNameForFontAlias: (alias?: string) => alias || 'material-icons',
    setDefaultFontSetClass: (_cls: string | string[]) => { void _cls; },
    // Angular Material expects an array here when no fontSet is provided
    getDefaultFontSetClass: () => ['material-icons']
  } }
];

// Apply an initial base module with defaults
testBed.configureTestingModule({ imports: [...defaultImports], providers: [...defaultProviders] });

// Monkey-patch TestBed.configureTestingModule to always merge in defaults
type TestModuleMetadata = Parameters<typeof TestBed.configureTestingModule>[0];
const _origConfigure: typeof TestBed.configureTestingModule = TestBed.configureTestingModule.bind(TestBed);
(TestBed as { configureTestingModule: typeof TestBed.configureTestingModule }).configureTestingModule = ((moduleDef: TestModuleMetadata) => {
  const merged: TestModuleMetadata = {
    ...moduleDef,
    imports: [...defaultImports, ...(moduleDef?.imports ?? [])],
    providers: [...defaultProviders, ...(moduleDef?.providers ?? [])]
  };
  return _origConfigure(merged);
}) as typeof TestBed.configureTestingModule;

// Angular CLI will find and run specs automatically (FindTestsPlugin). No manual __karma__.start().
console.log('[TEST BOOTSTRAP] Global test environment configured. Waiting for spec auto-discovery...');
