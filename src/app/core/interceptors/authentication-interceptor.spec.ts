import { TestBed } from '@angular/core/testing';
import { AuthenticationInterceptor } from './authentication-interceptor';
import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';

describe('AuthenticationInterceptor', () => {
  it('should create an instance', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptorsFromDi()),
        { provide: HTTP_INTERCEPTORS, useClass: AuthenticationInterceptor, multi: true }
      ]
    });
    const interceptor = TestBed.inject(HTTP_INTERCEPTORS).find((i: unknown) => i instanceof AuthenticationInterceptor) as AuthenticationInterceptor | undefined;
    expect(interceptor).toBeTruthy();
  });
});
