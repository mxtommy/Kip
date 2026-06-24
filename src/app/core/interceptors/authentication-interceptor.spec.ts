import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, afterEach } from 'vitest';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { AuthenticationInterceptor } from './authentication-interceptor';
import { AuthenticationService, AuthMode, IAuthorizationToken } from '../services/authentication.service';

class AuthServiceStub {
  private _token$ = new BehaviorSubject<IAuthorizationToken | null>({ token: 'stub-token' } as IAuthorizationToken);
  public authToken$ = this._token$.asObservable();
  public authMode: AuthMode = 'token';
  setToken(token: IAuthorizationToken | null): void { this._token$.next(token); }
}

describe('AuthenticationInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let auth: AuthServiceStub;

  beforeEach(() => {
    auth = new AuthServiceStub();
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthenticationService, useValue: auth },
        { provide: HTTP_INTERCEPTORS, useClass: AuthenticationInterceptor, multi: true }
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('token mode: attaches the JWT Authorization header and does not send credentials', () => {
    auth.authMode = 'token';
    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('authorization')).toBe('JWT stub-token');
    expect(req.request.withCredentials).toBe(false);
    req.flush({ ok: true });
  });

  it('cookie mode: sends credentials and no Authorization header, even with a stored token', () => {
    auth.authMode = 'cookie';
    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.withCredentials).toBe(true);
    expect(req.request.headers.has('authorization')).toBe(false);
    req.flush({ ok: true });
  });

  it('cookie mode: a cross-origin request gets neither credentials nor a token header', () => {
    auth.authMode = 'cookie';
    http.get('https://boat.example:3443/signalk/').subscribe();
    const req = httpMock.expectOne('https://boat.example:3443/signalk/');
    expect(req.request.withCredentials).toBe(false);
    expect(req.request.headers.has('authorization')).toBe(false);
    req.flush({ ok: true });
  });

  it('token mode without a token: no header and no credentials', () => {
    auth.authMode = 'token';
    auth.setToken(null);
    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.has('authorization')).toBe(false);
    expect(req.request.withCredentials).toBe(false);
    req.flush({ ok: true });
  });
});
