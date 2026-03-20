import { inject } from '@angular/core';
import { CanMatchFn, Route, UrlSegment, Router, UrlTree } from '@angular/router';
import { SettingsService } from '../services/settings.service';

/**
 * Guard transparently redirects between standard dashboard route and split view route
 * based on the global freeboard shell enabled flag. It preserves route params and query params.
 */
export const splitShellGuard: CanMatchFn = (route: Route, segments: UrlSegment[]): boolean | UrlTree => {
  const settings = inject(SettingsService);
  const router = inject(Router);
  const enabled = settings.getSplitShellEnabled();
  const url = '/' + segments.map(s => s.path).join('/');
  const defaultTarget = enabled ? 'chartplotter' : 'dashboard';

  // Routes we map:
  // /dashboard/:id -> /chartplotter/:id when enabled
  // /chartplotter/:id -> /dashboard/:id when disabled
  const isSplit = url.startsWith('/chartplotter');
  const isDash = url.startsWith('/dashboard');

  // Normalize no-id entry URLs to dashboard index 0.
  // This keeps '/' and '/chartplotter' behavior consistent with '/chartplotter/0'.
  if (segments.length === 0) {
    return router.createUrlTree([defaultTarget, '0']);
  }

  if (segments.length === 1 && (segments[0].path === 'chartplotter' || segments[0].path === 'dashboard')) {
    return router.createUrlTree([defaultTarget, '0']);
  }

  if (enabled && isDash && !isSplit) {
    const id = segments.length > 1 ? segments[1].path : undefined;
    return router.createUrlTree(['chartplotter', id ?? '']);
  }
  if (!enabled && isSplit) {
    const id = segments.length > 1 ? segments[1].path : undefined;
    return router.createUrlTree(['dashboard', id ?? '']);
  }
  return true; // allow if already correct
};
