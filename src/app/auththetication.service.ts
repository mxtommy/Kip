import { HttpClient, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { BehaviorSubject, timer, throwError, lastValueFrom } from 'rxjs';
import { filter, map, switchMap } from "rxjs/operators";

export interface IAuthorizationToken {
  expiry: number;
  token: string;
  isDeviceAccessToken: boolean;
}

const serverLoginPath = '/signalk/v1/auth/login';
const serverLogoutPath = '/signalk/v1/auth/logout';
const serverValidateTokenPath = '/signalk/v1/auth/validate';

@Injectable({
  providedIn: 'root'
})
export class AuththeticationService {
  private _IsLoggedIn$ = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this._IsLoggedIn$.asObservable();
  private _authToken$ = new BehaviorSubject<IAuthorizationToken>(null);
  public authToken$ = this._authToken$.asObservable();
  private serverUrl: string = null;

  constructor(
    private http: HttpClient
    )
  {
    // load local storage token
    const token: IAuthorizationToken = JSON.parse(localStorage.getItem('authorization_token'));
    if (token) {
      if (this.isTokenExpired(token.expiry)) {
        console.warn('[Authentication Service] Session Token expired. Deleting token');
        localStorage.removeItem('authorization_token');
      } else {
        this._IsLoggedIn$.next(!!token);
        this._authToken$.next(token);
        if (token.isDeviceAccessToken)
          console.log('[Authentication Service] Device Access Token found in Local Storage');
          else
          console.log('[Authentication Service] Session Authorization Token found in Local Storage');
      }
    }

    // Token SUbject subcription to handle token expiration and renewal
    this._authToken$.pipe(
      filter((token: IAuthorizationToken) => !!token),
        map((token: IAuthorizationToken) => token.expiry),
        switchMap((expiry: number) => timer(this.getTokenExpirationDate(expiry-1))),
      )
      .subscribe(() => {
        let token: IAuthorizationToken = JSON.parse(localStorage.getItem('authorization_token'));

        if (token.isDeviceAccessToken) {
          console.error('[Authentication Service] Device Access Token expired. Manually renew token using SignalK Connection Tab');
        } else {

          if (this.isTokenExpired(token.expiry)) {
            console.warn('[Authentication Service] User session Token expired');

          } else {
            console.log('[Authentication Service] User session Token expires soon. Renewing token.');
            console.log("[Authentication Service] \nToken Expiry" + this.getTokenExpirationDate(token.expiry) + "\nTimeout at: " + this.getTokenExpirationDate(token.expiry - 1)); // renew 1 min before expiration

            this.renewToken()
              .subscribe((validateTokenResponse) => {
                const keys = validateTokenResponse.headers.keys();
                let headers = keys.map(key =>
                  `${key}: ${validateTokenResponse.headers.get(key)}`);

                  //TODO: test and fix renewToken!

                console.log({ ...validateTokenResponse.body! });
                console.log(validateTokenResponse.headers.get('authorization'));
                this.setSession(validateTokenResponse.headers.get('authorization'));
              });
          }
        }
      }
    );
  }

  /**
   * ASync server login API function. Handles logout, token and logged in status
   *
   * @param {{ usr: string; pwd: string; newUrl?: string; }} { usr, pwd, newUrl }
   * @return {*}  {Promise<void>}
   * @memberof AuththeticationService
   */
  public async login({ usr, pwd, newUrl }: { usr: string; pwd: string; newUrl?: string; }): Promise<void> {
    if (newUrl) {
      if ((this.serverUrl != newUrl) && this.serverUrl) {
        this.deleteToken();
      }
      this.serverUrl = newUrl;
    }

    if (this._IsLoggedIn$.getValue()) {
      this.logout();
    }

    await lastValueFrom(this.http.post(this.serverUrl + serverLoginPath, {"username" : usr, "password" : pwd}, {observe: 'response'}))
      .then((loginResponse: HttpResponse<any>) => {
          console.log("[Authentication Service] User " + usr + " login successful");
          this.setSession(loginResponse.body.token);
      })
      .catch(error => {
        this.handleError(error);
      });
  }

  private handleError(error: HttpErrorResponse) {
    if (error.status === 0) {
      // A client-side or network error occurred. Handle it accordingly.
      console.error('[Authentication Service] An error occurred:', error.error);
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
   * @memberof AuththeticationService
   */
  private setSession(token: string): void {
    if (!!token) {
      const expiry = (JSON.parse(atob(token.split('.')[1]))).exp;
      let authorizationToken: IAuthorizationToken = {
        'token' : null, 'expiry' : null, 'isDeviceAccessToken' : false
      };

      if (this.isTokenExpired(expiry)) {
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
   * @memberof AuththeticationService
   */
  private isTokenExpired(expiry: number): boolean {
    return (Math.floor((new Date).getTime() / 1000)) >= expiry;
  }

  /**
   * Provided you pass the expiration value of a token, this fonction will returns
   * the expiration date as a date object
   *
   * @private
   * @param {number} expiry Expiration date value defined in milliseconds
   * @return {*}  {Date} UTC expiration date
   * @memberof AuththeticationService
   */
  private getTokenExpirationDate(expiry: number): Date {
    const date = new Date(0);
    date.setUTCSeconds(expiry);
    return date;
  }

  private renewToken() {
    return this.http.post<any>(this.serverUrl + serverValidateTokenPath, null, {observe: 'response'});
  }

  /**
   * Async function to server logout API to killl the session token, deletes the
   * token from local storage and sets isLoggedIn$ to false
   *
   * @return {*}  {Promise<void>}
   * @memberof AuththeticationService
   */
  public async logout(): Promise<void> {
    localStorage.removeItem('authorization_token');
    await lastValueFrom(this.http.put(this.serverUrl + serverLogoutPath, null))
      .then((response) => {
        this._IsLoggedIn$.next(false);
        this._authToken$.next(null);
        console.log("[Authentication Service] User logged out");
    })
    .catch(error => {
      console.error(error)
    });
    //TODO: below should be removed once the sk bug is fixed
    this._IsLoggedIn$.next(false);
    this._authToken$.next(null);
  }

  public deleteToken() {
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

      if (this.isTokenExpired(expiry)) {
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

  /**
   * Sets the destination URL the authentification service should use to and handle
   * user login requests and session tokens.
   *
   * @memberof AuththeticationService
   */
  public set signalkUrl(u : string) {
    this.serverUrl = u;
  }
}
