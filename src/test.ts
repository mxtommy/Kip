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
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { MatDialogRef } from '@angular/material/dialog';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { UnitsService } from './app/core/services/units.service';
import { AppNetworkInitService } from './app/core/services/app-initNetwork.service';
import { AuthenticationService } from './app/core/services/authentication.service';
import { ActivatedRoute } from '@angular/router';
import { AppSettingsService } from './app/core/services/app-settings.service';
<<<<<<< HEAD
import { BehaviorSubject, Observable } from 'rxjs';
import { ReactiveFormsModule, FormGroupDirective, FormGroup } from '@angular/forms';
// Note: Avoid globally providing directive stubs for Host2 directives because it breaks their own specs.
// If a specific spec needs them, it should declare/provide local stubs in that spec.
import { SignalKConnectionService } from './app/core/services/signalk-connection.service';
import { ConnectionStateMachine } from './app/core/services/connection-state-machine.service';
import { SignalkPluginsService } from './app/core/services/signalk-plugins.service';
import { WidgetRuntimeDirective } from './app/core/directives/widget-runtime.directive';
import { WidgetStreamsDirective } from './app/core/directives/widget-streams.directive';
import { WidgetMetadataDirective } from './app/core/directives/widget-metadata.directive';
import { ENVIRONMENT_INITIALIZER, signal, inject as diInject } from '@angular/core';
import type { IWidgetSvcConfig } from './app/core/interfaces/widgets-interface';
import type { IAppConfig } from './app/core/interfaces/app-settings.interfaces';
import type { IUnitDefaults } from './app/core/services/units.service';
import type { IDatasetServiceDatasetConfig } from './app/core/services/data-set.service';
// Global provider setup (HttpClient, RouterTestingModule, animation & material stubs, etc.)
import { getTestBed, TestBed } from '@angular/core/testing';
import type { Provider } from '@angular/core';
=======
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
>>>>>>> origin/master
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting
} from '@angular/platform-browser-dynamic/testing';

// First, initialize the Angular testing environment.
const testBed = getTestBed();
testBed.initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());

// Note: Icon sprite registration happens in ENVIRONMENT_INITIALIZER and/or per-spec helper.
// Note: Keep logs strict, but apply a very narrow filter for known MatIcon noise only.
// Test-only console.error filter: hide the specific MatIconRegistry noise for ':dashboard-dashboard'
// without suppressing other errors. This avoids distracting lines when suites run in groups.
(() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const origError = (console.error as any).bind(console);
    // Match only the MatIcon failure format that includes a leading-colon icon name (empty namespace)
    // Examples seen: (a) "Error retrieving icon :dashboard-dashboard! ..."
    //                (b) ['ERROR', Error('Error retrieving icon :troubleshoot! ...'), ...]
    //                (c) other icons like ':remote-control'
    const colonMatIconMsg = /^Error retrieving icon\s*:[A-Za-z0-9_-]+\b/i;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (console.error as any) = (...args: any[]) => {
      try {
        const first = args?.[0];
        const second = args?.[1];
        // Case (a): first arg is the string message
  if (typeof first === 'string' && colonMatIconMsg.test(first)) return;
        // Case (b): first arg is 'ERROR' and second is an Error with the message
  if (first === 'ERROR' && second instanceof Error && typeof second.message === 'string' && colonMatIconMsg.test(second.message)) return;
      } catch { /* fall through to original */ }
      return origError(...args);
    };
  } catch { /* ignore */ }
})();
class MatBottomSheetRefStub { dismiss(): void { /* noop */ } }
class MatDialogRefStub { close(): void { /* noop */ } }
class AppNetworkInitServiceStub { /* noop for tests */ }
class AuthenticationServiceStub {
  // Minimal stub surface for tests that inject AuthenticationService
<<<<<<< HEAD
  private _isLoggedIn$ = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this._isLoggedIn$.asObservable();
  private _authToken$ = new BehaviorSubject<{ expiry: number | null; token: string | null; isDeviceAccessToken: boolean }>(null);
  public authToken$ = this._authToken$.asObservable();
  login = async () => { this._isLoggedIn$.next(true); };
  logout = async () => { this._isLoggedIn$.next(false); this._authToken$.next(null); };
}
// ActivatedRoute stub must expose observable params/queryParams for components piping them
const ActivatedRouteStub = {
  snapshot: { params: {}, queryParams: {} },
  params: new BehaviorSubject<Record<string, unknown>>({}),
  queryParams: new BehaviorSubject<Record<string, unknown>>({})
} as unknown as Partial<ActivatedRoute>;

// Minimal SignalK/Connection stubs to satisfy services that subscribe/pipe on these
interface IEndpointStatusStub { operation: number; httpServiceUrl?: string; WsServiceUrl?: string; subscribeAll?: boolean }
class SignalKConnectionServiceStub {
  public serverServiceEndpoint$ = new BehaviorSubject<IEndpointStatusStub>({ operation: 0, httpServiceUrl: '', WsServiceUrl: '', subscribeAll: false });
  public serverVersion$ = new BehaviorSubject<string>(null);
  // Provide a default URL object to satisfy services building API URLs
  public signalKURL = { url: 'http://localhost' } as { url: string };

  getServiceEndpointStatusAsO() {
    return this.serverServiceEndpoint$.asObservable();
  }
}
enum ConnectionStateStub { Idle = 0, WebSocketConnecting = 1, Connected = 2, Disconnected = 3, WebSocketError = 4, PermanentFailure = 5 }
class ConnectionStateMachineStub {
  public state$ = new BehaviorSubject<ConnectionStateStub>(ConnectionStateStub.Idle);
  // Minimal status$ stream matching the shape AppComponent expects to subscribe to
  public status$ = new BehaviorSubject<{ state: string; operation: number; message: string; retryCount?: number; maxRetries?: number; timestamp: Date }>({
    state: 'Disconnected',
    operation: 0,
    message: 'Test: not connected',
    timestamp: new Date()
  });
  setWebSocketRetryCallback(): void { /* noop */ }
  isFullyConnected(): boolean { return false; }
  startWebSocketConnection(): void { /* noop */ }
  onWebSocketConnected(): void { /* noop */ }
  onWebSocketError(): void { /* noop */ }
}

// Minimal stub for SignalkPluginsService to avoid network fetches in tests
class SignalkPluginsServiceStub implements Partial<SignalkPluginsService> {
  async isInstalled(): Promise<boolean> { return false; }
  async isEnabled(): Promise<boolean> { return false; }
}

// A robust global AppSettingsService stub exposing both sync getters and observable getters
class AppSettingsServiceStub {
  private themeNameSubject = new BehaviorSubject<string>('light');
  private redNightModeSubject = new BehaviorSubject<boolean>(false);
  private autoNightModeSubject = new BehaviorSubject<boolean>(false);
  private splitShellWidthRatioSubject = new BehaviorSubject<number>(0.3); // 30% default
  private splitShellEnabledSubject = new BehaviorSubject<boolean>(false);
  private splitShellSideSubject = new BehaviorSubject<'left' | 'right'>('left');
  private splitShellSwipeDisabledSubject = new BehaviorSubject<boolean>(false);
  private dashboards: unknown[] = [];
  private unitDefaultsSubject = new BehaviorSubject<Record<string, string>>({});
  private instanceNameSubject = new BehaviorSubject<string>('');
  private dataSets: unknown[] = [];
  private _isRemoteControlSubject = new BehaviorSubject<boolean>(false);
  private _configUpgradeSubject = new BehaviorSubject<boolean>(false);
  private nightModeBrightnessSubject = new BehaviorSubject<number>(0.2);
  // Connection & identity fields used by various services (RemoteDashboardsService, Freeboard, etc.)
  public signalkUrl = { url: 'http://localhost', new: false };
  private _kipUUID = 'test-uuid';
  private _connectionConfig: import('./app/core/interfaces/app-settings.interfaces').IConnectionConfig = {
    configVersion: 12,
    signalKUrl: 'http://localhost',
    proxyEnabled: false,
    signalKSubscribeAll: false,
    useDeviceToken: false,
    loginName: '',
    loginPassword: '',
    useSharedConfig: false,
    sharedConfigName: '',
    kipUUID: 'test-uuid'
  };
  private _notificationConfig = new BehaviorSubject<import('./app/core/interfaces/app-settings.interfaces').INotificationConfig>({
    disableNotifications: true,
    menuGrouping: false,
    security: { disableSecurity: true },
    devices: { disableDevices: true, showNormalState: false, showNominalState: false },
    sound: { disableSound: true, muteNormal: true, muteNominal: true, muteWarn: true, muteAlert: true, muteAlarm: true, muteEmergency: true }
  });

  // Observable getters used throughout the app
  getThemeNameAsO(): Observable<string> { return this.themeNameSubject.asObservable(); }
  getRedNightModeAsO(): Observable<boolean> { return this.redNightModeSubject.asObservable(); }
  getAutoNightModeAsO(): Observable<boolean> { return this.autoNightModeSubject.asObservable(); }

  // Synchronous getters for places not using observables
  getThemeName(): string { return this.themeNameSubject.value; }
  getRedNightMode(): boolean { return this.redNightModeSubject.value; }
  getAutoNightMode(): boolean { return this.autoNightModeSubject.value; }

  // Test utilities to control state from specs when needed
  setThemeName(name: string): void { this.themeNameSubject.next(name); }
  setRedNightMode(v: boolean): void { this.redNightModeSubject.next(v); }
  setAutoNightMode(v: boolean): void { this.autoNightModeSubject.next(v); }

  // Legacy helpers used by some components/specs
  getSplitShellSide(): 'left' | 'right' { return 'left'; }
  getSplitShellWidth(): number { return this.splitShellWidthRatioSubject.value; }
  setSplitShellWidth(v: number): void { this.splitShellWidthRatioSubject.next(v); }
  getSplitShellSwipeDisabledAsO(): Observable<boolean> { return this.splitShellSwipeDisabledSubject.asObservable(); }
  // Sync getter used by SettingsDisplayComponent
  getSplitShellSwipeDisabled(): boolean { return this.splitShellSwipeDisabledSubject.value; }
  // Split shell enabled/side APIs used in app
  getSplitShellEnabledAsO(): Observable<boolean> { return this.splitShellEnabledSubject.asObservable(); }
  getSplitShellEnabled(): boolean { return this.splitShellEnabledSubject.value; }
  setSplitShellEnabled(v: boolean): void { this.splitShellEnabledSubject.next(v); }
  getSplitShellSideAsO(): Observable<'left' | 'right'> { return this.splitShellSideSubject.asObservable(); }
  setSplitShellSide(v: 'left' | 'right'): void { this.splitShellSideSubject.next(v); }
  // Dashboards APIs used by DashboardService and specs
  getDashboardConfig(): unknown[] { return this.dashboards; }
  saveDashboards(d: unknown[]): void { this.dashboards = d; }

  // Units defaults used by UnitsService
  getDefaultUnitsAsO(): Observable<Record<string, string>> { return this.unitDefaultsSubject.asObservable(); }
  getDefaultUnits(): Record<string, string> { return this.unitDefaultsSubject.value; }
  setDefaultUnits(v: Record<string, string>): void { this.unitDefaultsSubject.next(v); }

  // Instance name used by RemoteDashboardsService and others
  getInstanceNameAsO(): Observable<string> { return this.instanceNameSubject.asObservable(); }
  getInstanceName(): string { return this.instanceNameSubject.value; }
  setInstanceName(v: string): void { this.instanceNameSubject.next(v); }

  // DataSets used by DataSetService
  getDataSets(): unknown[] { return this.dataSets; }
  saveDataSets(d: unknown[]): void { this.dataSets = d; }

  // Remote control mode flag used by RemoteDashboardsService and others
  getIsRemoteControlAsO(): Observable<boolean> { return this._isRemoteControlSubject.asObservable(); }
  getIsRemoteControl(): boolean { return this._isRemoteControlSubject.value; }
  setIsRemoteControl(v: boolean): void { this._isRemoteControlSubject.next(v); }

  // Minimal signal-like shim for configUpgrade used by DatasetService cleanup logic
  // Supports both reading as a function and optional .set(boolean) for specs that toggle it
  // Strongly-typed signal-like shim for configUpgrade
  private _buildConfigUpgradeShim() {
    type BoolSignalLike = (() => boolean) & { set: (v: boolean) => void };
    const getter = (() => this._configUpgradeSubject.value).bind(this) as () => boolean;
    const shim = Object.assign(getter, { set: (v: boolean) => this._configUpgradeSubject.next(!!v) }) as unknown as BoolSignalLike;
    return shim;
  }
  public configUpgrade = this._buildConfigUpgradeShim();

  // App-level getters used by multiple services
  public getAppConfig(): IAppConfig {
    return {
      configVersion: 12,
      autoNightMode: this.autoNightModeSubject.value,
      redNightMode: this.redNightModeSubject.value,
      nightModeBrightness: this.nightModeBrightnessSubject.value,
      isRemoteControl: this._isRemoteControlSubject.value,
      instanceName: this.instanceNameSubject.value,
      dataSets: this.dataSets as IDatasetServiceDatasetConfig[],
      unitDefaults: this.unitDefaultsSubject.value as IUnitDefaults,
      notificationConfig: this._notificationConfig.value,
      splitShellEnabled: false,
      splitShellSide: 'left',
      splitShellSwipeDisabled: false,
      splitShellWidth: 0.3
    };
  }

  public get KipUUID(): string { return this._kipUUID; }

  // Additional APIs required by various specs/services
  public getConnectionConfig() { return this._connectionConfig; }
  public setConnectionConfig(v: typeof this._connectionConfig) { this._connectionConfig = { ...v }; }
  public getNightModeBrightness(): number { return this.nightModeBrightnessSubject.value; }
  public getNotificationServiceConfigAsO(): Observable<import('./app/core/interfaces/app-settings.interfaces').INotificationConfig> { return this._notificationConfig.asObservable(); }
  public getNotificationConfig(): import('./app/core/interfaces/app-settings.interfaces').INotificationConfig { return this._notificationConfig.value; }
}

// Lightweight runtime directive stub so components can inject it in tests
class WidgetRuntimeDirectiveStub implements Partial<WidgetRuntimeDirective> {
  // Expose API surface commonly used by widgets; provide safe defaults
  public options = signal<IWidgetSvcConfig | undefined>({} as unknown as IWidgetSvcConfig);
  public firstPathKey = signal<string | undefined>(undefined);
  public getPathCfg(pathKey: string): string | undefined { void pathKey; return undefined; }
  public setRuntimeConfig(cfg: IWidgetSvcConfig | undefined): void { void cfg; }
  public initialize(defaultCfg: IWidgetSvcConfig | undefined, savedCfg: IWidgetSvcConfig | undefined): void { void defaultCfg; void savedCfg; }
}

// Lightweight streams directive stub so components can inject it in tests without wiring live data
class WidgetStreamsDirectiveStub implements Partial<WidgetStreamsDirective> {
  private _cfg: IWidgetSvcConfig | undefined;
  public setStreamsConfig(cfg: IWidgetSvcConfig | undefined): void { this._cfg = cfg; }
  public applyStreamsConfigDiff(cfg: IWidgetSvcConfig | undefined): void { this._cfg = cfg; }
  public observe(): void { /* no-op stub */ }
}

// Metadata directive stub to satisfy injections in widgets using zones metadata
class WidgetMetadataDirectiveStub implements Partial<WidgetMetadataDirective> {
  public zones = signal([]);
  public setMetaConfig(): void { /* noop */ }
  public applyMetaConfigDiff(): void { /* noop */ }
  public observe(): void { /* noop */ }
  public reset(): void { /* noop */ }
}
// Consolidated global TestBed configuration to avoid ordering surprises and make
// global providers explicit in one place.
testBed.configureTestingModule({
  imports: [RouterTestingModule, ReactiveFormsModule, MatIconModule],
  providers: [
    // Register SVG icons and normalize leading-colon icon names at environment init
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        try {
          // Ensure we only register once across multiple configureTestingModule calls
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = window as any;
          if (w.__KIP_ICONS_REGISTERED__) return;
          const iconRegistry = diInject(MatIconRegistry);
          const sanitizer = diInject(DomSanitizer);
          const xhr = new XMLHttpRequest();
          // Angular CLI test runner serves assets at /assets/... (see angular.json:test.options.assets)
          xhr.open('GET', '/assets/svg/icons.svg', false);
          xhr.send(null);
          if (xhr.status >= 200 && xhr.status < 300 && typeof xhr.responseText === 'string') {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xhr.responseText, 'image/svg+xml');
            // Register the whole set in supported namespaces (default and 'kip')
            const trusted = sanitizer.bypassSecurityTrustHtml(xhr.responseText);
            // Default (no namespace, svgIcon="name")
            iconRegistry.addSvgIconSetLiteral(trusted);
            // App-level namespace commonly used in KIP (svgIcon="kip:name")
            iconRegistry.addSvgIconSetInNamespace('kip', trusted);
            const svgs = Array.from(doc.querySelectorAll('svg[id]')) as SVGSVGElement[];
            for (const svg of svgs) {
              const id = svg.getAttribute('id');
              if (!id) continue;
              iconRegistry.addSvgIconLiteral(id, sanitizer.bypassSecurityTrustHtml(svg.outerHTML));
            }
            // Mark as registered to avoid rework in subsequent modules
            w.__KIP_ICONS_REGISTERED__ = true;
          } else {
            console.error(`[TEST BOOTSTRAP] Failed to load /assets/svg/icons.svg (status ${xhr.status}) — SVG icon ids will not be validated.`);
          }
        } catch (err) {
          console.error('[TEST BOOTSTRAP] Error while registering SVG icons for tests:', err);
        }
      }
    },
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
    { provide: MAT_BOTTOM_SHEET_DATA, useValue: {} },
    // Common DI stubs used by many suites
    { provide: AppNetworkInitService, useClass: AppNetworkInitServiceStub },
    { provide: AuthenticationService, useClass: AuthenticationServiceStub },
    { provide: ActivatedRoute, useValue: ActivatedRouteStub },
    { provide: AppSettingsService, useClass: AppSettingsServiceStub },
    // SignalK connection-related stubs to prevent heavy runtime and missing .pipe
    { provide: SignalKConnectionService, useClass: SignalKConnectionServiceStub },
    { provide: ConnectionStateMachine, useClass: ConnectionStateMachineStub },
    { provide: SignalkPluginsService, useClass: SignalkPluginsServiceStub },
    // Provide a root-level WidgetRuntimeDirective stub to satisfy injections in widget specs
    { provide: WidgetRuntimeDirective, useClass: WidgetRuntimeDirectiveStub },
    // Provide a root-level WidgetStreamsDirective stub for widget/component specs
    { provide: WidgetStreamsDirective, useClass: WidgetStreamsDirectiveStub },
    // Provide metadata directive stub globally
    { provide: WidgetMetadataDirective, useClass: WidgetMetadataDirectiveStub },
    // Forms control stub to satisfy FormGroupDirective injections
    { provide: FormGroupDirective, useValue: { control: new FormGroup({}) } as Partial<FormGroupDirective> }
  ]
});
=======
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
>>>>>>> origin/master

// Monkey-patch TestBed to always merge in our global imports/providers for every spec
const GLOBAL_IMPORTS = [RouterTestingModule, ReactiveFormsModule, MatIconModule];
type GlobalProvider = Provider | import('@angular/core').EnvironmentProviders;
const GLOBAL_PROVIDERS: GlobalProvider[] = [
  {
    provide: ENVIRONMENT_INITIALIZER,
    multi: true,
    useValue: () => {
      try {
        // No debug wrapper around MatIconRegistry in tests.
        // Ensure we only register once across multiple configureTestingModule calls
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const w2 = window as any;
        if (w2.__KIP_ICONS_REGISTERED__) return;
        const iconRegistry = diInject(MatIconRegistry);
        const sanitizer = diInject(DomSanitizer);
        const xhr = new XMLHttpRequest();
        // Angular CLI test runner serves assets at /assets/... (see angular.json:test.options.assets)
        xhr.open('GET', '/assets/svg/icons.svg', false);
        xhr.send(null);
        if (xhr.status >= 200 && xhr.status < 300 && typeof xhr.responseText === 'string') {
          const parser = new DOMParser();
          const doc = parser.parseFromString(xhr.responseText, 'image/svg+xml');
          // Register the whole set in supported namespaces (default and 'kip')
          const trusted = sanitizer.bypassSecurityTrustHtml(xhr.responseText);
          // Default (no namespace, svgIcon="name")
          iconRegistry.addSvgIconSetLiteral(trusted);
          // App-level namespace commonly used in KIP (svgIcon="kip:name")
          iconRegistry.addSvgIconSetInNamespace('kip', trusted);
          const svgs = Array.from(doc.querySelectorAll('svg[id]')) as SVGSVGElement[];
          for (const svg of svgs) {
            const id = svg.getAttribute('id');
            if (!id) continue;
            iconRegistry.addSvgIconLiteral(id, sanitizer.bypassSecurityTrustHtml(svg.outerHTML));
          }
          // Mark as registered to avoid rework in subsequent modules
          w2.__KIP_ICONS_REGISTERED__ = true;
        } else {
          console.error(`[TEST BOOTSTRAP] Failed to load /assets/svg/icons.svg (status ${xhr.status}) — SVG icon ids will not be validated.`);
        }
      } catch (err) {
        console.error('[TEST BOOTSTRAP] Error while registering SVG icons for tests:', err);
      }
    }
  },
  provideHttpClient(withInterceptorsFromDi()),
  provideHttpClientTesting(),
  provideNoopAnimations(),
  UnitsService,
  { provide: MAT_DIALOG_DATA, useValue: {} },
  { provide: MatBottomSheetRef, useClass: MatBottomSheetRefStub },
  { provide: MatDialogRef, useClass: MatDialogRefStub },
  { provide: MAT_BOTTOM_SHEET_DATA, useValue: {} },
  { provide: AppNetworkInitService, useClass: AppNetworkInitServiceStub },
  { provide: AuthenticationService, useClass: AuthenticationServiceStub },
  { provide: ActivatedRoute, useValue: ActivatedRouteStub },
  { provide: AppSettingsService, useClass: AppSettingsServiceStub },
  { provide: SignalKConnectionService, useClass: SignalKConnectionServiceStub },
  { provide: ConnectionStateMachine, useClass: ConnectionStateMachineStub },
  { provide: SignalkPluginsService, useClass: SignalkPluginsServiceStub },
  { provide: WidgetRuntimeDirective, useClass: WidgetRuntimeDirectiveStub },
  { provide: WidgetStreamsDirective, useClass: WidgetStreamsDirectiveStub },
  { provide: WidgetMetadataDirective, useClass: WidgetMetadataDirectiveStub },
  { provide: FormGroupDirective, useValue: { control: new FormGroup({}) } as Partial<FormGroupDirective> }
];

interface PartialTestingModule { imports?: unknown[]; providers?: unknown[] }
const tbPatched = TestBed as unknown as { configureTestingModule: (moduleDef: PartialTestingModule) => unknown };
const _origConfigure = tbPatched.configureTestingModule.bind(TestBed);
tbPatched.configureTestingModule = (moduleDef: PartialTestingModule = {}) => {
  moduleDef.imports = [...(moduleDef.imports ?? []), ...GLOBAL_IMPORTS];
  const localProviders = moduleDef.providers ?? [];
  const hasProvide = (prov: unknown): prov is { provide: unknown } => !!prov && typeof prov === 'object' && 'provide' in prov;
  const alreadyProvidesWidgetStreams = localProviders.some((p: unknown) => p === WidgetStreamsDirective || (hasProvide(p) && p.provide === WidgetStreamsDirective));
  const alreadyProvidesWidgetMetadata = localProviders.some((p: unknown) => p === WidgetMetadataDirective || (hasProvide(p) && p.provide === WidgetMetadataDirective));
  let globals = GLOBAL_PROVIDERS;
  if (alreadyProvidesWidgetStreams) {
    globals = globals.filter((p: unknown) => !(hasProvide(p) && p.provide === WidgetStreamsDirective));
  }
  if (alreadyProvidesWidgetMetadata) {
    globals = globals.filter((p: unknown) => !(hasProvide(p) && p.provide === WidgetMetadataDirective));
  }
  // Prepend globals so spec-local providers can override by later entries
  moduleDef.providers = [...globals, ...localProviders];
  return _origConfigure(moduleDef);
};

// Angular CLI will find and run specs automatically (FindTestsPlugin). No manual __karma__.start().
console.log('[TEST BOOTSTRAP] Global test environment configured. Waiting for spec auto-discovery...');
