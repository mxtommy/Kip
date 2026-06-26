import { inject, Injectable } from '@angular/core';
import { AuthenticationService, ILoginStatus } from './authentication.service';
import { buildLoginRedirectUrl, isSafeReturnTo } from '../utils/login-redirect.util';

const REDIRECT_BUDGET_KEY = 'kip.ssoRedirectAttempts';
const MAX_REDIRECT_ATTEMPTS = 3;
const ADMIN_LOGIN_URL = '/admin/#/login'; // non-OIDC same-origin fallback login

export type TAutoRedirectOutcome = 'redirected' | 'budget-exhausted';

/**
 * Owns the cookie-mode SSO redirect: where to send the browser to sign in, and a reload-surviving
 * attempt budget so a kiosk with oidcAutoLogin cannot loop forever. The budget lives in
 * sessionStorage (per-tab, cleared on a fresh session), resets on a confirmed login, and is bypassed
 * by an explicit user sign-in.
 */
@Injectable({ providedIn: 'root' })
export class SsoRedirectService {
  private readonly auth = inject(AuthenticationService);

  public attempts(): number {
    try {
      const raw = window.sessionStorage.getItem(REDIRECT_BUDGET_KEY);
      const n = raw ? parseInt(raw, 10) : 0;
      return Number.isFinite(n) && n > 0 ? n : 0;
    } catch {
      return 0;
    }
  }

  public isBudgetExhausted(): boolean {
    return this.attempts() >= MAX_REDIRECT_ATTEMPTS;
  }

  public resetBudget(): void {
    try {
      window.sessionStorage.removeItem(REDIRECT_BUDGET_KEY);
    } catch {
      /* ignore */
    }
  }

  private recordAttempt(): void {
    try {
      window.sessionStorage.setItem(REDIRECT_BUDGET_KEY, String(this.attempts() + 1));
    } catch {
      /* ignore */
    }
  }

  /**
   * Whether the reload-surviving budget storage actually works. If sessionStorage is blocked (some
   * kiosk WebViews, private modes), the budget cannot bound a cross-reload loop, so auto-redirect must
   * fail closed rather than redirect forever.
   */
  private budgetStorageWorks(): boolean {
    try {
      const probe = `${REDIRECT_BUDGET_KEY}.probe`;
      window.sessionStorage.setItem(probe, '1');
      // Read back: a storage that accepts writes but silently discards them (some locked-down kiosk
      // WebViews) would otherwise leave the budget permanently at 0 and loop. Fail closed on a mismatch.
      const persisted = window.sessionStorage.getItem(probe) === '1';
      window.sessionStorage.removeItem(probe);
      return persisted;
    } catch {
      return false;
    }
  }

  private resolveLoginUrl(status: ILoginStatus | null): string {
    if (status?.oidcEnabled && status.oidcLoginUrl) {
      return status.oidcLoginUrl;
    }
    return ADMIN_LOGIN_URL;
  }

  private currentReturnTo(): string | undefined {
    const relative = window.location.pathname + window.location.search + window.location.hash;
    return isSafeReturnTo(relative) ? relative : undefined;
  }

  /**
   * Bootstrap auto-redirect to the SK login. Honors the budget, records an attempt and navigates, or
   * reports the budget is spent so the caller can show the auth-blocked recovery state instead.
   */
  public attemptAutoRedirect(status: ILoginStatus | null): TAutoRedirectOutcome {
    // Fail closed: if the budget cannot be tracked across reloads, do not auto-redirect (an explicit
    // user Sign in still can). Treating an untrackable budget as "0 attempts" would loop forever.
    if (!this.budgetStorageWorks() || this.isBudgetExhausted()) {
      return 'budget-exhausted';
    }
    this.recordAttempt();
    this.navigate(buildLoginRedirectUrl({
      loginUrl: this.resolveLoginUrl(status),
      returnTo: this.currentReturnTo()
    }));
    return 'redirected';
  }

  /**
   * Explicit user sign-in (recovery). Resets the budget and disables SK auto-login (noAutoLogin) so a
   * manual retry is not immediately bounced back by an auto-login loop.
   */
  public manualSignIn(): void {
    this.resetBudget();
    this.navigate(buildLoginRedirectUrl({
      loginUrl: this.resolveLoginUrl(this.auth.loginStatusValue),
      returnTo: this.currentReturnTo(),
      noAutoLogin: true
    }));
  }

  protected navigate(url: string): void {
    window.location.replace(url);
  }
}
