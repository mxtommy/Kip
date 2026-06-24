/**
* This Service uses the APP_INITIALIZER feature to dynamically load
* network service (SignalKConnection & Authentication) when the app is initialized,
* before loading appComponent and other stuff.
*
* @usage must return a Promise in all cases or will block app from loading.
* All execution in this service delays app start. Keep code small and simple.
**/
import { inject, Injectable, Injector, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { IConfig, IConnectionConfig } from "../interfaces/app-settings.interfaces";
import { SignalKConnectionService } from "./signalk-connection.service";
import { AuthenticationService, ILoginStatus } from './authentication.service';
import { SsoRedirectService } from './sso-redirect.service';
import { DefaultConnectionConfig } from '../../../default-config/config.blank.const';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { DataService } from './data.service';
import { SignalKDeltaService } from './signalk-delta.service';
import { IStorageRemoteBootstrapContext, StorageService } from './storage.service';
import { ConnectionState, ConnectionStateMachine } from './connection-state-machine.service';
import { InternetReachabilityService } from './internet-reachability.service';
import { DatasetStreamService } from './dataset-stream.service';

const configFileVersion = 11; // used to change the Signal K configuration storage file name (ie. 9.0.0.json) that contains the configuration definitions. Applies only to remote storage.
const CONNECTION_CONFIG_KEY = 'connectionConfig';
export type TBootstrapStatus = 'starting' | 'ready' | 'degraded';
export type TBootstrapIssueReason = 'none' | 'missing-shared-config' | 'network-unreachable' | 'unauthorized' | 'unknown' | 'auth-blocked';
export type TAuthBlockedCause = 'budget-exhausted' | 'sign-in-required';

export interface IBootstrapIssue {
  reason: TBootstrapIssueReason;
  statusCode?: number;
  sharedConfigName?: string;
  legacyUpgradeAvailable?: boolean;
  cause?: TAuthBlockedCause;
}

@Injectable()
export class AppNetworkInitService implements OnDestroy {
  private config: IConnectionConfig;
  private isLoggedIn: boolean = null;
  private loggedInSubscription: Subscription = null;

  private readonly connection = inject(SignalKConnectionService);
  private readonly auth = inject(AuthenticationService);
  private readonly ssoRedirect = inject(SsoRedirectService);
  private readonly connectionStateMachine = inject(ConnectionStateMachine);
  private readonly router = inject(Router);
  private readonly delta = inject(SignalKDeltaService); // Init to get data before app starts
  private readonly data = inject(DataService); // Init to get data before app starts
  private readonly storage = inject(StorageService); // Init to get data before app starts
  private readonly internetReachability = inject(InternetReachabilityService);
  private readonly injector = inject(Injector);
  private datasetService: DatasetStreamService | null = null;
  private readonly _bootstrapStatus$ = new BehaviorSubject<TBootstrapStatus>('starting');
  private readonly _bootstrapIssue$ = new BehaviorSubject<IBootstrapIssue>({ reason: 'none' });

  constructor () {
    this.loggedInSubscription = this.auth.isLoggedIn$.subscribe((isLoggedIn) => {
      this.isLoggedIn = isLoggedIn;
    })
  }

  /**
   * Whether remote (server applicationData) config should be bootstrapped: cookie mode regardless of
   * the stored useSharedConfig flag, or cross-origin shared config. Mirrors SettingsService storage
   * routing so the two never disagree (avoids the cookie-mode localStorage split-brain).
   */
  private useServerStorage(): boolean {
    return this.auth.authMode === 'cookie' || !!this.config?.useSharedConfig;
  }

  /**
   * Cookie-mode bootstrap decision from loginStatus. Returns 'redirecting' when the browser is being
   * sent to the SK/SSO login (caller should stop), or 'proceed' otherwise:
   * - loggedIn   → reset the redirect budget; the storage bootstrap then runs (isLoggedIn is true).
   * - notLoggedIn + authRequired → auto-redirect when allowed by oidcAutoLogin and the budget; else
   *   surface the auth-blocked recovery state (budget exhausted, or a manual sign-in is required).
   * - auth not required → anonymous read; proceed with no redirect.
   */
  private handleCookieAuth(status: ILoginStatus | null): 'redirecting' | 'proceed' | 'auth-blocked' {
    if (status?.status === 'loggedIn') {
      // The budget reset is deferred to a genuinely completed bootstrap (see initNetworkServices'
      // finally), so a loggedIn -> applicationData-401 -> reauth path cannot reset-then-loop.
      return 'proceed';
    }
    if (!status) {
      // loginStatus unreachable/unparseable: fail closed — do not assume anonymous-open access.
      this._bootstrapIssue$.next({ reason: 'auth-blocked', cause: 'sign-in-required' });
      return 'auth-blocked';
    }
    if (status.authenticationRequired) {
      return this.attemptCookieRedirect(status) === 'redirecting' ? 'redirecting' : 'auth-blocked';
    }
    // authentication explicitly not required: anonymous read access, no redirect.
    return 'proceed';
  }

  /**
   * Cookie-mode redirect-or-block decision shared by the bootstrap path and the mid-bootstrap 401
   * path. Auto-redirects when oidcAutoLogin allows and the budget permits; otherwise surfaces the
   * auth-blocked recovery state (budget exhausted, or a manual sign-in is required).
   */
  private attemptCookieRedirect(status: ILoginStatus | null): 'redirecting' | 'blocked' {
    if (status?.oidcAutoLogin !== false && this.ssoRedirect.attemptAutoRedirect(status) === 'redirected') {
      return 'redirecting';
    }
    this._bootstrapIssue$.next({
      reason: 'auth-blocked',
      cause: this.ssoRedirect.isBudgetExhausted() ? 'budget-exhausted' : 'sign-in-required'
    });
    return 'blocked';
  }

  /**
   * Mode-aware re-authentication routing for a mid-bootstrap 401. Cookie mode reuses the same
   * oidcAutoLogin/budget-guarded decision as the bootstrap path (so a 401 cannot loop past the
   * budget, and honors oidcAutoLogin:false); token mode routes to /login.
   */
  private routeToReauth(): void {
    if (this.auth.authMode === 'cookie') {
      this.attemptCookieRedirect(this.auth.loginStatusValue);
      return;
    }
    this.router.navigate(['/login']);
  }

  public async initNetworkServices() {
    let startupDegraded = false;
    let redirecting = false;
    this.loadLocalStorageConfig();
    this.preloadFonts();
    this.internetReachability.start();

    try {
      if (this.config?.signalKUrl !== undefined && this.config.signalKUrl !== null) {
        // Use SignalKConnectionService to initialize connection with the configured URL
        await this.connection.initializeConnection(
          {url: this.config.signalKUrl, new: false},
          this.config.proxyEnabled,
          this.config.signalKSubscribeAll
        );
      }

      // Cookie mode (same-origin): session state comes from loginStatus, not a credential login.
      if (this.auth.authMode === 'cookie') {
        const status = await this.auth.refreshLoginStatus();
        const outcome = this.handleCookieAuth(status);
        if (outcome === 'redirecting') {
          redirecting = true;
          return; // browser is navigating to the SK/SSO login
        }
        if (outcome === 'auth-blocked') {
          // Not authorized and not auto-redirecting: keep the auth-blocked recovery state (set by
          // handleCookieAuth), do not reset the loop budget, and finish degraded (not 'ready') so the
          // recovery UI shows. Returning here also avoids the 'reason: none' overwrite below.
          startupDegraded = true;
          this._bootstrapStatus$.next('degraded');
          return;
        }
      }

      // Token mode (cross-origin) credential login. Never runs in cookie mode (no stored password).
      if (this.auth.authMode !== 'cookie' && !this.isLoggedIn && this.config?.signalKUrl && this.config?.useSharedConfig && this.config?.loginName && this.config?.loginPassword) {
        await this.login();
      }

      if (this.isLoggedIn && this.useServerStorage()) {
        // Wait for storage to be fully ready before accessing it
        const storageReady = await this.storage.waitUntilReady();
        if (!storageReady) {
          throw new Error('[AppInit Network Service] StorageService did not become ready in time. Cannot bootstrap remote configuration.');
        } else {
          const remoteConfig = await this.storage.getConfig('user', this.config.sharedConfigName, configFileVersion);
          const bootstrapContext: IStorageRemoteBootstrapContext = {
            sharedConfigName: this.config.sharedConfigName,
            configFileVersion,
            initConfig: remoteConfig
          };
          this.storage.bootstrapRemoteContext(bootstrapContext);
        }
      }

      this._bootstrapIssue$.next({ reason: 'none' });

      // Seed datasets after authentication (if required) so History API calls are authenticated.
      // This ensures all chart data is ready before any widget components are created.
      await this.getDatasetService().waitUntilReady();

      // Cookie mode handled its own redirect/auth-blocked state above; only token mode falls to /login.
      if (this.auth.authMode !== 'cookie' && !this.isLoggedIn && this.config?.signalKUrl && this.config?.useSharedConfig) {
        this.router.navigate(['/login']); // need to set credentials
      }

    } catch (error) {
      startupDegraded = true;
      if (error?.status === 404 && this.config?.useSharedConfig) {
        const legacyUpgradeAvailable = await this.probeLegacyUpgradeAvailability(this.config.sharedConfigName);
        this._bootstrapIssue$.next({
          reason: 'missing-shared-config',
          statusCode: 404,
          sharedConfigName: this.config.sharedConfigName,
          legacyUpgradeAvailable
        });
      } else if (error?.status === 0) {
        this._bootstrapIssue$.next({ reason: 'network-unreachable', statusCode: 0 });
      } else if (error?.status === 401) {
        this._bootstrapIssue$.next({ reason: 'unauthorized', statusCode: 401 });
      } else {
        this._bootstrapIssue$.next({ reason: 'unknown', statusCode: error?.status });
      }

      if (error.status === 0) {
        const finalState = await this.waitForHttpRetryCompletion();
        if (finalState === ConnectionState.HTTPConnected || this.connectionStateMachine.isHTTPConnected()) {
          console.warn('[AppInit Network Service] Initial connection recovered during retry cycle. Skipping fallback route.');
        } else {
          console.warn("[AppInit Network Service] Initialization failed after HTTP retries. Redirecting to settings page.");
          await this.router.navigate(['/options']);
        }
      } else if (error.status === 401) {
        console.warn("[AppInit Network Service] Initialization failed. Unauthorized access. Routing to re-authentication.");
        this.routeToReauth();
      } else {
        console.warn("[AppInit Network Service] Initialization failed. Error: ", JSON.stringify(error));
        await this.router.navigate(['/options']);
      }
      console.warn('[AppInit Network Service] Startup continuing in degraded mode to allow UI feedback.');
      this._bootstrapStatus$.next('degraded');
      return;
    } finally {
      if (!startupDegraded && !redirecting) {
        // A clean, non-redirecting bootstrap is a stable state: clear the SSO redirect loop budget so
        // a future genuine logout gets a fresh set of attempts. Not reset on the redirect/degraded
        // paths, so a loggedIn -> 401 -> reauth loop stays bounded.
        this.ssoRedirect.resetBudget();
      }
      if (!startupDegraded) {
        this._bootstrapStatus$.next('ready');
      }
      console.log("[AppInit Network Service] Initialization completed");
      // Enable WebSocket functionality now that initialization is complete
      this.connectionStateMachine.enableWebSocketMode();

      // Start the WebSocket only on a clean bootstrap from a fresh HTTPConnected state. Skip it when
      // degraded/redirecting (e.g. the cookie auth-blocked path, where HTTP is connected but there is
      // no session — an anonymous WS would just churn behind the recovery toast), and when the delta
      // service's isLoggedIn$ reconnect has already driven the state to WebSocketConnecting (starting
      // again would close and reopen the in-flight socket).
      if (this.connectionStateMachine.currentState === ConnectionState.HTTPConnected && !startupDegraded && !redirecting) {
        console.log("[AppInit Network Service] Starting WebSocket connection after initialization");
        this.connectionStateMachine.startWebSocketConnection();
      }
    }
  }

  /**
   * Emits the APP_INITIALIZER bootstrap lifecycle status.
   *
   * @returns {Observable<TBootstrapStatus>} Stream of bootstrap status values.
   *
   * @example
   * this.appNetworkInit.bootstrapStatus$
   *   .subscribe(status => console.log('Bootstrap status', status));
   */
  public get bootstrapStatus$(): Observable<TBootstrapStatus> {
    return this._bootstrapStatus$.asObservable();
  }

  /**
   * Emits detailed bootstrap issue metadata for degraded startup scenarios.
   *
   * @returns {Observable<IBootstrapIssue>} Stream of bootstrap issue descriptors.
   *
   * @example
   * this.appNetworkInit.bootstrapIssue$
   *   .subscribe(issue => console.log(issue.reason, issue.sharedConfigName));
   */
  public get bootstrapIssue$(): Observable<IBootstrapIssue> {
    return this._bootstrapIssue$.asObservable();
  }

  private getDatasetService(): DatasetStreamService {
    if (!this.datasetService) {
      this.datasetService = this.injector.get(DatasetStreamService);
    }
    return this.datasetService;
  }

  private async waitForHttpRetryCompletion(timeoutMs?: number): Promise<ConnectionState | null> {
    const effectiveTimeoutMs = timeoutMs ?? this.connectionStateMachine.getHttpRetryWindowMs(2000);
    const terminalStates = new Set<ConnectionState>([
      ConnectionState.HTTPConnected,
      ConnectionState.PermanentFailure,
    ]);

    const current = this.connectionStateMachine.currentState;
    if (terminalStates.has(current)) {
      return current;
    }

    return new Promise<ConnectionState | null>((resolve) => {
      const timeoutId = window.setTimeout(() => {
        subscription.unsubscribe();
        resolve(null);
      }, effectiveTimeoutMs);

      const subscription = this.connectionStateMachine.state$.subscribe((state: ConnectionState) => {
        if (!terminalStates.has(state)) {
          return;
        }

        clearTimeout(timeoutId);
        subscription.unsubscribe();
        resolve(state);
      });
    });
  }

  private async probeLegacyUpgradeAvailability(sharedConfigName: string): Promise<boolean> {
    if (!sharedConfigName) {
      return false;
    }

    try {
      const legacyConfig = await this.storage.getConfig('user', sharedConfigName, 9) as IConfig;
      const legacyConfigVersion = legacyConfig?.app?.configVersion;
      return legacyConfigVersion === 10;
    } catch {
      return false;
    }
  }

  private async login(): Promise<void> {
    if (!this.isLoggedIn && this.config.useSharedConfig && this.config.loginName && this.config.loginPassword) {
      try {
        await this.auth.login({ usr: this.config.loginName, pwd: this.config.loginPassword });
      } catch (error) {
        if (error.status === 0) {
          this.router.navigate(['/settings']);
        } else if (error.status === 401) {
          this.router.navigate(['/login']);
        }
        throw error;  // Re-throw the error to be handled by the caller
      }
    }
  }

  private setLocalStorageConfig(): void {
    localStorage.setItem(CONNECTION_CONFIG_KEY, JSON.stringify(this.config));
  }

  private loadLocalStorageConfig(): void {
    this.config = JSON.parse(localStorage.getItem(CONNECTION_CONFIG_KEY));

    if (!this.config) {
      this.config = DefaultConnectionConfig;
      this.config.signalKUrl = window.location.origin;
      console.log(`[AppInit Network Service] Connection Configuration not found. Creating configuration using Auto-Discovery URL: ${this.config.signalKUrl}`);
      this.setLocalStorageConfig();
    } else if (!this.config.signalKUrl) {
      this.config.signalKUrl = window.location.origin;
      this.setLocalStorageConfig();
      console.log(`[AppInit Network Service] Config found with no server URL. Setting Auto-Discovery URL: ${this.config.signalKUrl}`);
    }

    if (this.config.configVersion == 9) {
      this.config.configVersion = 10;
      this.setLocalStorageConfig();
      console.log(`[AppInit Network Service] Upgrading Connection version from 9 to 10`);
    }
    if (this.config.configVersion == 10) {
      this.config.configVersion = 11;
      this.setLocalStorageConfig();
      console.log(`[AppInit Network Service] Upgrading Connection version from 10 to 11`);
    }
    if (this.config.configVersion == 11) {
      this.config.configVersion = 12;
      this.setLocalStorageConfig();
      console.log(`[AppInit Network Service] Upgrading Connection version from 11 to 12`);
    }
  }

  private preloadFonts (): void {
    // Preload fonts else browser can delay and cause canvas font issues
    const fonts = [
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOlCnqEu92Fr1MmSU5fChc4AMP6lbBP.woff2)",
        options: {
          weight: "300",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOlCnqEu92Fr1MmSU5fBBc4AMP6lQ.woff2)",
        options: {
          weight: "300",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOmCnqEu92Fr1Mu7GxKKTU1Kvnz.woff2)",
        options: {
          weight: "400",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOmCnqEu92Fr1Mu4mxKKTU1Kg.woff2)",
        options: {
          weight: "400",
          style: "normal"
        }
      },
    {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOlCnqEu92Fr1MmEU9fChc4AMP6lbBP.woff2)",
        options: {
          weight: "500",
          style: "normal"
        }
      },
      {
        family: "Roboto",
        src: "url(./assets/google-fonts/KFOlCnqEu92Fr1MmEU9fBBc4AMP6lQ.woff2)",
        options: {
          weight: "500",
          style: "normal"
        }
      }
    ];

    for (const {family, src, options} of fonts) {
      const font = new FontFace(family, src, options);
      font.load()
        .then(() =>
          document.fonts.add(font)
      )
        .catch(err =>
          console.log(`[AppInit Network Service] Error loading fonts: ${err}`)
        );
    }
  }

  ngOnDestroy(): void {
    this.loggedInSubscription?.unsubscribe();
  }
}
