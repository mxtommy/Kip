import { SignalKConnectionService, IEndpointStatus } from './signalk-connection.service';
import { HttpClient, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, lastValueFrom, Subscription } from 'rxjs';
import { distinctUntilChanged } from "rxjs/operators";

export interface IAuthorizationToken {
  expiry: number;
  token: string;
  isDeviceAccessToken: boolean;
}

const defaultApiPath = '/signalk/v1/'; // Use as default for new server URL changes. We do a Login before ConnectionService has time to send the new endpoitn url
const loginEndpoint = 'auth/login';
const logoutEndpoint = 'auth/logout';
const validateTokenEndpoint = 'auth/validate';
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
  private connectionEndpointSubscription: Subscription = null;
  private authTokenSubscription: Subscription = null;
  private renewalTimerId: ReturnType<typeof setTimeout> | null = null; // Node & browser compatible handle
  private isRenewingToken = false; // Prevent overlapping renewals

  // Network connection
  private loginUrl = null;
  private logoutUrl = null;
  private validateTokenUrl = null;

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
      } else {
        console.log('[Authentication Service] User session token found in Local Storage');
        console.log('[Authentication Service] Deleting user session token');
        localStorage.removeItem('authorization_token');
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
        this.validateTokenUrl = httpApiUrl + validateTokenEndpoint;
      }
    });
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
        console.log(`[Authentication Service] User session Token within renewal window (${remainingSec}s remaining). Renewing token...`);
        const connectionConfig = JSON.parse(localStorage.getItem('connectionConfig'));
        this.login({ usr: connectionConfig.loginName, pwd: connectionConfig.loginPassword })
          .then(() => {
            console.log('[Authentication Service] Token successfully renewed.');
          })
          .catch((error: HttpErrorResponse) => {
            console.error('[Authentication Service] Token renewal failed. Server returned:', error.error);
          })
          .finally(() => {
            this.isRenewingToken = false;
          });
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

  // not yet implemented by Signal K but part of the specs. Using contained token string expiration value instead for now
  private renewToken() {
    return this.http.post<HttpResponse<Response>>(this.validateTokenUrl, null, {observe: 'response'});
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
