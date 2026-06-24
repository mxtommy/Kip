
import { Injectable, OnDestroy, inject } from '@angular/core';
import { HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http'
import { AuthenticationService, IAuthorizationToken } from '../services/authentication.service';
import { Subscription } from 'rxjs';

@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor, OnDestroy {
  private auth = inject(AuthenticationService);

  private authToken: IAuthorizationToken = null;
  private authTokenSubscription: Subscription = null;

  constructor() {
    // Observe the auth token from the Auth service.
    this.authTokenSubscription = this.auth.authToken$.subscribe((token: IAuthorizationToken) => {
      this.authToken = token;
    });
  }

  intercept(req: HttpRequest<unknown>, next: HttpHandler) {
    // Branch on mode first. In cookie mode the same-origin httpOnly session cookie carries auth, so
    // send credentials and never attach a JWT header — even if a stale token is still in storage.
    // Scope withCredentials to same-origin requests: a cross-origin request in cookie mode (e.g. the
    // discovery GET under proxy + cross-origin URL) gets neither — the cookie cannot flow cross-origin
    // and a stale token stays suppressed.
    if (this.auth.authMode === 'cookie') {
      return next.handle(this.isSameOrigin(req.url) ? req.clone({ withCredentials: true }) : req.clone());
    }

    // Token mode (cross-origin): the cookie cannot flow, so attach the JWT header when present.
    let authReq = req.clone();
    if (this.authToken) {
      authReq = req.clone({
        headers: req.headers.set('authorization', "JWT " + this.authToken.token)
      });
    }
    return next.handle(authReq);
  }

  private isSameOrigin(url: string): boolean {
    try {
      // Relative URLs resolve against the app origin.
      return new URL(url, window.location.origin).origin === window.location.origin;
    } catch {
      return false;
    }
  }

  ngOnDestroy(): void {
    this.authTokenSubscription?.unsubscribe();
  }
}
