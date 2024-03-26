
import { Injectable, OnDestroy } from '@angular/core';
import { HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http'
import { AuthenticationService, IAuthorizationToken } from '../services/authentication.service';
import { Subscription } from 'rxjs';

@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor, OnDestroy {
  private authToken: IAuthorizationToken = null;
  private authTokenSubscription: Subscription = null;

  constructor(private auth: AuthenticationService) {
    // Observe the auth token from the Auth service.
    this.authTokenSubscription = this.auth.authToken$.subscribe((token: IAuthorizationToken) => {
      this.authToken = token;
    });
  }

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    let authReq = req.clone();

    if (this.authToken) {
      // Clone the request and replace the original headers with
      // with the authorization token.
      authReq = req.clone({
        headers: req.headers.set('authorization', "JWT " + this.authToken.token)
      });
    }
    // send cloned request with header to the next handler.
    return next.handle(authReq);
  }

  ngOnDestroy(): void {
    this.authTokenSubscription?.unsubscribe();
  }
}
