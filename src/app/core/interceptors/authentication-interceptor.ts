
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
    if (this.auth.authMode === 'cookie') {
      return next.handle(req.clone({ withCredentials: true }));
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

  ngOnDestroy(): void {
    this.authTokenSubscription?.unsubscribe();
  }
}
