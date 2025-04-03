import { SignalKConnectionService, IEndpointStatus } from './signalk-connection.service';
import { HttpClient, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, timer, lastValueFrom, Subscription } from 'rxjs';
import { filter, map, switchMap } from "rxjs/operators";

export interface IAuthorizationToken {
  expiry: number;
  token: string;
  isDeviceAccessToken: boolean;
}

const defaultApiPath = '/signalk/v1/'; // Use as default for new server URL changes. We do a Login before ConnectionService has time to send the new endpoitn url
const loginEndpoint = 'auth/login';
const logoutEndpoint = 'auth/logout';
const validateTokenEndpoint = 'auth/validate';
const tokenRenewalBuffer: number = 60; // nb of seconds before token expiration

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

    // Token Subject subscription to handle token expiration and renewal
    this.authTokenSubscription = this._authToken$.pipe(
      filter((token: IAuthorizationToken) => (!!token && token.expiry !== null)),
        map((token: IAuthorizationToken) => token.expiry),
        switchMap((expiry: number) => timer(this.getTokenExpirationDate(expiry, tokenRenewalBuffer))),
      )
      .subscribe(() => {
        let token: IAuthorizationToken = JSON.parse(localStorage.getItem('authorization_token'));
        if (token.isDeviceAccessToken) {
          console.warn('[Authentication Service] Device Access Token expired. Manually renew token using SignalK Connection Tab');
        } else {
          if (this.isTokenExpired(token.expiry)) {
            console.log('[Authentication Service] User session Token expired');
          } else {
            let connectionConfig = JSON.parse(localStorage.getItem('connectionConfig'));
            console.log('[Authentication Service] User session Token expires soon. Renewing token.');
            console.log("[Authentication Service] \nToken Expiry: " + this.getTokenExpirationDate(token.expiry) + "\nTimeout at: " + this.getTokenExpirationDate(token.expiry, tokenRenewalBuffer));
            this.login({ usr: connectionConfig.loginName, pwd: connectionConfig.loginPassword })
            .catch( (error: HttpErrorResponse) => {
              console.error("[AppInit Service] Token renewal failure. Server returned: " + JSON.stringify(error.error));
            });
          }
        }
      }
    );

    // Endpoint connection observer
    this.connectionEndpointSubscription =  this.conn.serverServiceEndpoint$.subscribe((endpoint: IEndpointStatus) => {
      if (endpoint.operation === 2) {
        let httpApiUrl: string = endpoint.httpServiceUrl.substring(0, endpoint.httpServiceUrl.length - 4); // this removes 'api/' from the end
        this.loginUrl = httpApiUrl + loginEndpoint;
        this.logoutUrl = httpApiUrl + logoutEndpoint;
        this.validateTokenUrl = httpApiUrl + validateTokenEndpoint;
      }
    });
  }

  /**
   * ASync server login API function. Handles logout, token and logged in status. Use
   * newUrl param to indicate against what server the login should take place, if it's
   * not the current server (if we are changing the sk URL). This param must be used
   * as the AuthenticationService has no dependency on AppSettings Service and once
   * AuthenticationService is intanciated, newUrl is the only way to change it's
   * tartget endpoint.
   *
   * @param {{ usr: string; pwd: string; newUrl?: string; }} { usr, pwd, newUrl }
   * @return {*}  {Promise<void>}
   * @memberof AuthenticationService
   */
  public async login({ usr, pwd, newUrl }: { usr: string; pwd: string; newUrl?: string; }): Promise<void> {
    let serverLoginFullUrl: string;
    if (newUrl) {
      serverLoginFullUrl = newUrl + defaultApiPath + loginEndpoint;
    } else {
      serverLoginFullUrl = this.loginUrl;
    }


    if (this._IsLoggedIn$.getValue()) {
      await this.logout(true);
    }
    await lastValueFrom(this.http.post(serverLoginFullUrl, {"username" : usr, "password" : pwd}, {observe: 'response'}))
      .then((loginResponse: HttpResponse<any>) => {
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
      console.error('[Authentication Service] An error occurred:', error.error);
      this.deleteToken();
    } else {
      // The backend returned an unsuccessful response code.
      // The response body may contain clues as to what went wrong.
      console.error(`[Authentication Service] Backend returned code ${error.status}, body was: `, error.error);
    }
    // Return an observable with a user-facing error message.
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
    if (!!token) {
      const expiry = (JSON.parse(atob(token.split('.')[1]))).exp;
      let authorizationToken: IAuthorizationToken = {
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
      let bufferedDate = new Date(0);
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
      .then((response) => {
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
      let authorizationToken: IAuthorizationToken = {
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
  }
}
