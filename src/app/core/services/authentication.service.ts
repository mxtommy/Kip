import { SignalKConnectionService, IEndpointStatus } from './signalk-connection.service';
import { HttpClient, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, combineLatest, lastValueFrom, Subscription, timeout } from 'rxjs';
import { distinctUntilChanged, map } from "rxjs/operators";

export interface IAuthorizationToken {
  expiry: number;
  token: string;
  isDeviceAccessToken: boolean;
}

/**
 * Auth carriage mode, derived synchronously from the connection config:
 * - 'cookie': KIP is served same-origin as the Signal K server; the httpOnly session cookie
 *   carries auth (no token header / WS token param).
 * - 'token': cross-origin; auth is carried by the stored JWT (header + WS query param).
 */
export type AuthMode = 'cookie' | 'token';

/**
 * Parsed subset of the Signal K server's `GET /skServer/loginStatus` response. Drives cookie-mode
 * session state and carries the login/OIDC descriptors the bootstrap redirect needs. All fields are
 * optional because the response shape is owned by the server and is treated defensively (fail-closed:
 * a session is only "logged in" when {@link status} is exactly `'loggedIn'`).
 */
export interface ILoginStatus {
  status?: string;
  authenticationRequired?: boolean;
  userLevel?: string;
  username?: string;
  oidcEnabled?: boolean;
  oidcAutoLogin?: boolean;
  oidcLoginUrl?: string;
  oidcProviderName?: string;
}

const defaultApiPath = '/signalk/v1/'; // Use as default for new server URL changes. We do a Login before ConnectionService has time to send the new endpoitn url
const loginEndpoint = 'auth/login';
const logoutEndpoint = 'auth/logout';
const loginStatusPath = '/skServer/loginStatus'; // server-origin, not the /signalk/v1 API base
const loginStatusTimeoutMs = 5000; // bounded so a hung endpoint cannot block the APP_INITIALIZER
const tokenRenewalBuffer = 60; // nb of seconds before token expiration
const MAX_TIMEOUT_MS = 2147483647; // Maximum safe delay for setTimeout (~24.8 days)

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService implements OnDestroy {
  private http = inject(HttpClient);
  private conn = inject(SignalKConnectionService);

  private _IsLoggedIn$ = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this._IsLoggedIn$.asObservable();
  private _authToken$ = new BehaviorSubject<IAuthorizationToken>(null);
  public authToken$ = this._authToken$.asObservable();

  // Latest parsed loginStatus (cookie mode only; null until refreshed or on any failure).
  private _loginStatus$ = new BehaviorSubject<ILoginStatus | null>(null);
  public loginStatus$ = this._loginStatus$.asObservable();

  /** Latest parsed loginStatus, read synchronously (e.g. by the SSO redirect). Null until refreshed. */
  public get loginStatusValue(): ILoginStatus | null {
    return this._loginStatus$.getValue();
  }

  /**
   * A real per-user identity is present: cookie-mode logged-in session, or a non-device token in
   * token mode. Profiles availability and user-scope applicationData key off this, not token presence.
   */
  public isUserSession$ = combineLatest([this._authToken$, this._loginStatus$]).pipe(
    map(([token, status]) => this.deriveIsUserSession(token, status)),
    distinctUntilChanged()
  );

  /**
   * The current session can write user-scope data: a user session that is not server-side read-only.
   * Write affordances (config save, profile create/rename/delete/switch) gate on this so a read-only
   * session does not present controls that silently fail server-side.
   */
  public canWriteUserData$ = combineLatest([this._authToken$, this._loginStatus$]).pipe(
    map(([token, status]) => this.deriveCanWriteUserData(token, status)),
    distinctUntilChanged()
  );

  private connectionEndpointSubscription: Subscription = null;
  private authTokenSubscription: Subscription = null;
  private renewalTimerId: ReturnType<typeof setTimeout> | null = null; // Node & browser compatible handle
  private isRenewingToken = false; // Prevent overlapping renewals

  // Network connection
  private loginUrl = null;
  private logoutUrl = null;

  constructor()
  {
    // load local storage token
    const token: IAuthorizationToken = JSON.parse(localStorage.getItem('authorization_token'));
    if (token) {
      if (token.isDeviceAccessToken) {
        if (token.expiry === null) {
          console.log('[Authentication Service] Device Access Token found with expiry: NEVER');
          this._authToken$.next(token);
        } else if (this.isTokenExpired(token.expiry)) {
          console.log("[Authentication Service] Device Access Token expired. Deleting token");
          localStorage.removeItem('authorization_token');
        } else {
          // We don't set logged . This is not a Session token.
          console.log('[Authentication Service] Device Access Token found in Local Storage');
          this._authToken$.next(token);
        }
      } else if (this.authMode === 'cookie') {
        // Cookie mode (same-origin): the SSO/session cookie is authoritative, so a stored user
        // token is ignored for carriage (authToken$ stays null). Device tokens are still kept
        // (above) as the unattended same-origin fallback.
        console.log('[Authentication Service] User session token ignored in cookie mode (session cookie is authoritative)');
      } else {
        // Token mode (cross-origin): keep the unexpired user JWT across reloads (Option A — the
        // session JWT is the persisted credential now that the plaintext password is not stored).
        if (token.expiry === null) {
          console.log('[Authentication Service] User session token found with expiry: NEVER');
          this._IsLoggedIn$.next(true);
          this._authToken$.next(token);
        } else if (this.isTokenExpired(token.expiry)) {
          console.log('[Authentication Service] User session token expired. Deleting token');
          localStorage.removeItem('authorization_token');
        } else {
          console.log('[Authentication Service] User session token found in Local Storage');
          this._IsLoggedIn$.next(true);
          this._authToken$.next(token);
        }
      }
    }

    // Token Subject subscription (react only when expiry changes) to schedule chunked renewal timer
    this.authTokenSubscription = this._authToken$
      .pipe(distinctUntilChanged((prev, curr) => prev?.expiry === curr?.expiry))
      .subscribe(token => {
        // Clear any previous scheduled timer
        if (this.renewalTimerId) {
          clearTimeout(this.renewalTimerId);
          this.renewalTimerId = null;
        }
        if (!token || token.expiry == null) {
          return; // Nothing to schedule (e.g., device token w/out expiry or logout)
        }
        this.scheduleRenewalChunk(token);
      });

    // Endpoint connection observer
    this.connectionEndpointSubscription =  this.conn.serverServiceEndpoint$.subscribe((endpoint: IEndpointStatus) => {
      if (endpoint.operation === 2) {
        const httpApiUrl: string = endpoint.httpServiceUrl.substring(0, endpoint.httpServiceUrl.length - 4); // this removes 'api/' from the end
        this.loginUrl = httpApiUrl + loginEndpoint;
        this.logoutUrl = httpApiUrl + logoutEndpoint;
      }
    });
  }

  /**
   * Synchronous auth carriage mode (no async / no connection discovery), so the HTTP interceptor
   * and bootstrap can branch on it from the very first request. See {@link AuthMode}.
   */
  public get authMode(): AuthMode {
    return this.authModeForConfig(this.readConnectionConfig());
  }

  /**
   * Resolves the carriage mode for a given connection config (not necessarily the stored one — the
   * Connectivity tab uses this to pre-check a config being edited). Cookie mode when proxy is enabled
   * (endpoints rewrite to the app origin) or the server URL resolves to the app origin (an empty URL
   * defaults to it). Conservative on any gap: an unreadable config or unparseable URL is token mode.
   */
  public authModeForConfig(config: { proxyEnabled?: boolean; signalKUrl?: string } | null): AuthMode {
    if (!config) {
      return 'token';
    }
    if (config.proxyEnabled) {
      return 'cookie';
    }
    if (!config.signalKUrl) {
      return 'cookie';
    }
    try {
      return new URL(config.signalKUrl).origin === window.location.origin ? 'cookie' : 'token';
    } catch {
      return 'token';
    }
  }

  private readConnectionConfig(): { proxyEnabled?: boolean; signalKUrl?: string } | null {
    try {
      return JSON.parse(localStorage.getItem('connectionConfig'));
    } catch {
      return null;
    }
  }

  /**
   * Cookie mode: query `GET /skServer/loginStatus` with credentials so the httpOnly session cookie
   * authenticates the probe, and derive session state from it (fail-closed). Returns the parsed
   * status (including OIDC descriptors for the bootstrap redirect), or null on any failure or in
   * token mode (where loginStatus is not consulted). The request targets the served origin — in
   * cookie mode the effective Signal K origin equals `window.location.origin` by definition — not the
   * post-discovery `/signalk/v1` base.
   */
  public async refreshLoginStatus(): Promise<ILoginStatus | null> {
    if (this.authMode !== 'cookie') {
      return null;
    }
    const url = window.location.origin + loginStatusPath;
    try {
      const raw = await lastValueFrom(this.http.get<ILoginStatus>(url, { withCredentials: true }).pipe(timeout(loginStatusTimeoutMs)));
      return this.applyLoginStatus(raw);
    } catch {
      // Unreachable, non-2xx, or unparseable response: treat as not logged in.
      return this.applyLoginStatus(null);
    }
  }

  private applyLoginStatus(raw: unknown): ILoginStatus | null {
    const status: ILoginStatus | null = raw && typeof raw === 'object' ? (raw as ILoginStatus) : null;
    this._loginStatus$.next(status);
    this._IsLoggedIn$.next(status?.status === 'loggedIn');
    return status;
  }

  private deriveIsUserSession(token: IAuthorizationToken | null, status: ILoginStatus | null): boolean {
    if (this.authMode === 'cookie') {
      return status?.status === 'loggedIn';
    }
    return !!token && !token.isDeviceAccessToken;
  }

  private deriveCanWriteUserData(token: IAuthorizationToken | null, status: ILoginStatus | null): boolean {
    if (this.authMode === 'cookie') {
      return status?.status === 'loggedIn' && this.isWriteUserLevel(status.userLevel);
    }
    // Token mode has no loginStatus; a user token has always been treated as write-capable.
    return !!token && !token.isDeviceAccessToken;
  }

  /**
   * Whether a Signal K userLevel (skPrincipal.permissions) can write user-scope data. SK treats
   * 'admin' and 'readwrite' as write-capable; 'readonly' (or an absent level) cannot. Note this is
   * NOT loginStatus.readOnlyAccess — that field is the server's allow_readonly (anonymous read)
   * config and is independent of the signed-in user's permission.
   */
  private isWriteUserLevel(userLevel?: string): boolean {
    return userLevel === 'admin' || userLevel === 'readwrite';
  }

  private scheduleRenewalChunk(token: IAuthorizationToken) {
    const now = Date.now();
    const bufferedRenewMs = (token.expiry - tokenRenewalBuffer) * 1000; // ms timestamp when we WANT to renew
    const remaining = bufferedRenewMs - now;

    if (remaining <= 0) {
      // We have reached or passed the buffered renewal point
      this.handleTokenRenewal();
      return;
    }

    const delay = Math.min(remaining, MAX_TIMEOUT_MS);
    if (delay !== remaining) {
      console.log(`[Authentication Service] Large renewal delay (${remaining} ms). Scheduling first chunk of ${delay} ms.`);
    } else {
      console.log(`[Authentication Service] Scheduling token renewal in ${delay} ms (buffered target: ${new Date(bufferedRenewMs).toISOString()})`);
    }

    this.renewalTimerId = setTimeout(() => {
      this.renewalTimerId = null;
      // Re-check conditions; token might have changed
      const current = this._authToken$.getValue();
      if (!current || current.expiry !== token.expiry) {
        // Token changed or removed; new subscription handler will reschedule if needed
        return;
      }
      this.scheduleRenewalChunk(token); // recurse / advance to next chunk or perform renewal
    }, delay);
  }

  private handleTokenRenewal(): void {
    if (this.isRenewingToken) {
      console.warn('[Authentication Service] Token renewal already in progress.');
      return;
    }

    this.isRenewingToken = true;

    const token: IAuthorizationToken = JSON.parse(localStorage.getItem('authorization_token'));
    if (!token) {
      console.warn('[Authentication Service] No token found in local storage. Cannot renew.');
      this.isRenewingToken = false;
      return;
    }

    if (token.isDeviceAccessToken) {
      console.warn('[Authentication Service] Device Access Token expired. Manual renewal required.');
      this.isRenewingToken = false;
    } else {
      const nowSec = Math.floor(Date.now() / 1000);
      const remainingSec = token.expiry - nowSec;
      if (this.isTokenExpired(token.expiry)) {
        console.log('[Authentication Service] User session Token expired. Cannot renew.');
        this.isRenewingToken = false;
      } else if (remainingSec > tokenRenewalBuffer) {
        // Premature trigger (e.g., due to large timeout chunk boundary). Reschedule properly.
        console.log(`[Authentication Service] Renewal trigger fired early; ${remainingSec}s remaining (> buffer ${tokenRenewalBuffer}s). Rescheduling.`);
        this.isRenewingToken = false;
        this.scheduleRenewalChunk(token);
      } else {
        // No silent refresh available: auth/validate is unimplemented on the server and the
        // plaintext password is no longer stored. Surface re-login by dropping the token rather
        // than re-POSTing stored credentials.
        console.log(`[Authentication Service] User session token within renewal window (${remainingSec}s remaining); no refresh available. Signing out to surface re-login.`);
        this.deleteToken();
        this.isRenewingToken = false;
      }
    }
  }

  /**
   * ASync server login API function. Handles logout, token and logged in status. Use
   * newUrl param to indicate against what server the login should take place, if it's
   * not the current server (if we are changing the sk URL). This param must be used
   * as the AuthenticationService has no dependency on AppSettings Service and once
   * AuthenticationService is instantiated, newUrl is the only way to change its
   * target endpoint.
   *
   * @param {{ usr: string; pwd: string; newUrl?: string; }} { usr, pwd, newUrl }
   * @return {*}  {Promise<void>}
   * @throws {Error} If the login URL is not set or if the HTTP request fails.
   * @memberof AuthenticationService
   *
   * @description
   * This method may throw errors or return a rejected promise if login fails due to network issues,
   * invalid credentials, or server errors. Consumers should handle errors using try/catch or .catch().
   */
  public async login({ usr, pwd, newUrl }: { usr: string; pwd: string; newUrl?: string; }): Promise<void> {
    let serverLoginFullUrl: string;
    if (newUrl) {
      serverLoginFullUrl = newUrl.replace(/\/+$/, '') + defaultApiPath + loginEndpoint;
    } else {
      serverLoginFullUrl = this.loginUrl;
    }


    if (this._IsLoggedIn$.getValue()) {
      await this.logout(true);
    }
    if (!serverLoginFullUrl) {
      console.error("[Authentication Service] Login URL is not set. Cannot perform login.");
      this.deleteToken();
      throw new Error("Login URL is not set.");
    }
    await lastValueFrom(this.http.post<{ token: string }>(serverLoginFullUrl, {"username" : usr, "password" : pwd}, {observe: 'response'}))
      .then((loginResponse: HttpResponse<{ token: string }>) => {
          console.log("[Authentication Service] User " + usr + " login successful");
          this.setSession(loginResponse.body.token);
      })
      .catch(error => {
        this.deleteToken();
        this.handleError(error);
      });
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      this.deleteToken();
    }
    throw error;
  }

  /**
   * Sets the in-memory session token details (token and extracted expiration date)
   * post user authentication and save it to LocalStorage.
   *
   * @private
   * @param {*} token token returned by the login API call
   * @memberof AuthenticationService
   */
  private setSession(token: string): void {
    if (token) {
      const expiry = (JSON.parse(atob(token.split('.')[1]))).exp;
      const authorizationToken: IAuthorizationToken = {
        'token' : null, 'expiry' : null, 'isDeviceAccessToken' : false
      };

      if(expiry === undefined) {
        authorizationToken.token = token;
        console.log("[Authentication Service] User Session Token received. Token Expiration: NEVER");
        this._IsLoggedIn$.next(true);
        this._authToken$.next(authorizationToken);
        localStorage.setItem('authorization_token', JSON.stringify(authorizationToken));
      } else if (this.isTokenExpired(expiry)) {
        console.log("[Authentication Service] Received expired Session Token from server");
      } else {
        authorizationToken.token = token;
        authorizationToken.expiry = expiry;
        console.log("[Authentication Service] Session Authorization Token received. Token Expiration: " + this.getTokenExpirationDate(authorizationToken.expiry));
        this._IsLoggedIn$.next(true);
        this._authToken$.next(authorizationToken);
        localStorage.setItem('authorization_token', JSON.stringify(authorizationToken));
      }
    }
  }

  /**
   * Validates if a token is expired.
   *
   * @private
   * @param {number} expiry Expiration date in ms extracted from the token
   * @return {*}  {boolean} True if expired
   * @memberof AuthenticationService
   */
  private isTokenExpired(expiry: number): boolean {
    return (Math.floor((new Date).getTime() / 1000)) >= expiry;
  }

  /**
   * Returns a Date() object based on a expiry value of a token. If you
   * include optional param buffer, it will return a date, minus this value.
   * Use buffer as a time window to renew a token.
   *
   * @private
   * @param {number} dateAsSeconds Expiration date value in seconds (starting from 1970...)
   * @param {number} buffer Optional value in seconds. will deduct the returned Date by the buffer value
   * @return {*}  {Date} UTC expiration date
   * @memberof AuthenticationService
   */
  private getTokenExpirationDate(dateAsSeconds: number, buffer?: number): Date {
    let date = new Date(0);

    if(buffer) {
      const bufferedDate = new Date(0);
      bufferedDate.setUTCSeconds(dateAsSeconds - buffer);
      date = bufferedDate;
    } else {
      date.setUTCSeconds(dateAsSeconds);
    }
    return date;
  }

  /**
   * Async function to server logout API to kill the session token, deletes the
   * token from local storage and sets isLoggedIn$ to false
   *
   * @return {*}  {Promise<void>}
   * @memberof AuthenticationService
   */
  public async logout(isLoginAction: boolean): Promise<void> {
    localStorage.removeItem('authorization_token');
    await lastValueFrom(this.http.put(this.logoutUrl, null))
      .then(() => {
        this._IsLoggedIn$.next(false);
        if (!isLoginAction) {
          this._authToken$.next(null);
        }
        console.log("[Authentication Service] User logged out");
    })
    .catch(error => {
      console.error(error)
    });
  }

  public deleteToken() {
    if (!this._authToken$) {
      return;
    }

    console.log('[Authentication Service] Deleting Authorization token');
    localStorage.removeItem('authorization_token');
    this._IsLoggedIn$.next(false);
    this._authToken$.next(null);
  }

  public setDeviceAccessToken(token: string): void {
    if (token) {
      const expiry = (JSON.parse(atob(token.split('.')[1]))).exp;
      const authorizationToken: IAuthorizationToken = {
        'token' : null, 'expiry' : null, 'isDeviceAccessToken' : true
      };

      if(expiry === undefined) {
        authorizationToken.token = token;
        console.log("[Authentication Service] Device Access Token received. Token Expiration: NEVER");
        this._IsLoggedIn$.next(false);
        this._authToken$.next(authorizationToken);
        localStorage.setItem('authorization_token', JSON.stringify(authorizationToken));
      } else if (this.isTokenExpired(expiry)) {
        console.log("[Authentication Service] Received expired Device Access Token from server");

      } else {
        authorizationToken.token = token;
        authorizationToken.expiry = expiry;
        console.log("[Authentication Service] Device Access Token received. Token Expiration: " + this.getTokenExpirationDate(authorizationToken.expiry));
        this._IsLoggedIn$.next(false);
        this._authToken$.next(authorizationToken);
        localStorage.setItem('authorization_token', JSON.stringify(authorizationToken));
      }
    }
  }

  ngOnDestroy(): void {
    this.connectionEndpointSubscription?.unsubscribe();
    this.authTokenSubscription?.unsubscribe();
    if (this.renewalTimerId) {
      clearTimeout(this.renewalTimerId);
      this.renewalTimerId = null;
    }
  }
}
