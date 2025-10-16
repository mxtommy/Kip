import { HTTP_INTERCEPTORS, HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { BehaviorSubject } from 'rxjs';
import { AuthenticationInterceptor } from './authentication-interceptor';
import { AuthenticationService, IAuthorizationToken } from '../services/authentication.service';

class AuthServiceStub {
  private _token$ = new BehaviorSubject<IAuthorizationToken>({ token: 'stub-token' } as IAuthorizationToken);
  public authToken$ = this._token$.asObservable();
}

describe('AuthenticationInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthenticationService, useClass: AuthServiceStub },
        { provide: HTTP_INTERCEPTORS, useClass: AuthenticationInterceptor, multi: true }
      ]
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should attach JWT Authorization header when token is available', () => {
    http.get('/api/test').subscribe();
    const req = httpMock.expectOne('/api/test');
    expect(req.request.headers.get('authorization')).toBe('JWT stub-token');
    req.flush({ ok: true });
  });
});
