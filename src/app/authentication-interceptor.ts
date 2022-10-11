
import { Injectable } from '@angular/core';
import { HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http'
import { AuththeticationService, AuthorizationToken } from './auththetication.service';

@Injectable()
export class AuthenticationInterceptor implements HttpInterceptor {
  private authToken: AuthorizationToken = null;

  constructor(private auth: AuththeticationService) {
    // Observe the auth token from the Auth service.
    this.auth.authToken$.subscribe((token: AuthorizationToken) => {
      this.authToken = token;
    });
  }

  intercept(req: HttpRequest<any>, next: HttpHandler) {
    let authReq = req.clone();

    if (this.authToken) {
      // Clone the request and replace the original headers with
      // cloned headers, updated with the authorization.
      authReq = req.clone({
        headers: req.headers.set('authorization', "JWT " + this.authToken.token)
      });
    }
    // send cloned request with header to the next handler.
    return next.handle(authReq);
  }
}
