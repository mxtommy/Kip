import { inject } from '@angular/core';
import { CanMatchFn, Route, UrlSegment, Router, UrlTree } from '@angular/router';
import { AppSettingsService } from '../services/app-settings.service';

/**
 * Guard transparently redirects between standard dashboard route and split view route
 * based on the global freeboard shell enabled flag. It preserves route params and query params.
 */
export const splitShellGuard: CanMatchFn = (route: Route, segments: UrlSegment[]): boolean | UrlTree => {
  const settings = inject(AppSettingsService);
  const router = inject(Router);
  const enabled = settings.getSplitShellEnabled();
  const url = '/' + segments.map(s => s.path).join('/');

  // Routes we map:
  // /dashboard/:id -> /dashboard-split/:id when enabled
  // /dashboard-split/:id -> /dashboard/:id when disabled
  const isSplit = url.startsWith('/chartplotter');
  const isDash = url.startsWith('/dashboard');

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
