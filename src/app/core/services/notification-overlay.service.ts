import { Injectable, inject, Injector, OnDestroy } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';
import { NotificationBadgeComponent } from '../components/notification-badge/notification-badge.component';

/**
 * Service that manages the floating notification badge overlay.
 *
 * Implementation notes:
 * - The badge is rendered in a CDK Overlay as a ComponentPortal so it is not
 *   nested inside GridStack-managed DOM. This prevents reparenting/detach bugs.
 * - The overlay container is created by the AppOverlayContainer provider and
 *   thus lives inside the application root stacking context.
 * - Consumers should call `open()` and `close()` to control visibility. `toggle()`
 *   is a convenience helper. `isOpen()` provides a safe read-only status.
 * - The service implements `OnDestroy` to guarantee disposal of the overlay
 *   if the service is torn down (important for tests and app teardown).
 */
@Injectable({ providedIn: 'root' })
export class NotificationOverlayService implements OnDestroy {
  private overlayRef: OverlayRef | null = null;
  private readonly overlay = inject(Overlay);
  private readonly injector = inject(Injector);

  open() {
    if (this.overlayRef) return;
    this.overlayRef = this.overlay.create({
      hasBackdrop: false,
      panelClass: 'notification-overlay-panel',
      positionStrategy: this.overlay.position().global().bottom('20px').left('20px'),
      scrollStrategy: this.overlay.scrollStrategies.reposition()
    });

    const portal = new ComponentPortal(NotificationBadgeComponent, null, this.injector);
    const attached = this.overlayRef.attach(portal);
    // Best-effort focus handling to improve keyboard accessibility. We attempt
    // to call a `focus()` method on the component instance if present; if not,
    // query the overlay pane for the badge button element and focus it.
    // Fail silently — accessibility is a progressive enhancement here.
    try {
      const compInstance = attached && (attached.instance as unknown);
      if (compInstance && typeof (compInstance as { focus?: () => void }).focus === 'function') {
        (compInstance as { focus: () => void }).focus();
      } else {
        const pane = this.overlayRef.overlayElement as HTMLElement | null;
        const btn = pane && pane.querySelector('button[mat-fab], .layout-action-btn') as HTMLElement | null;
        if (btn && typeof btn.focus === 'function') btn.focus();
      }
    } catch {
      // ignore focus errors — do not surface to consumers
    }
  }

  close() {
    // Defensive close: dispose overlay if present and always clear the reference
    // We swallow throwables from dispose() to avoid breaking caller flows where
    // overlay disposal may fail during shutdown.
    try {
      if (this.overlayRef) this.overlayRef.dispose();
    } catch (err) {
      console.warn('[NotificationOverlayService] dispose failed', err);
    } finally {
      this.overlayRef = null;
    }
  }

  toggle(shouldOpen: boolean) {
    if (shouldOpen) this.open(); else this.close();
  }

  /**
   * Return true when an overlay instance is attached and not yet disposed.
   * Prefer this over probing internal fields directly.
   */
  public isOpen(): boolean {
    return !!this.overlayRef;
  }

  ngOnDestroy(): void {
    // Ensure any live overlay is disposed during service destruction. Swallow
    // errors to be robust during application shutdown.
    try {
      if (this.overlayRef) this.overlayRef.dispose();
    } catch {
      /* ignore */
    } finally {
      this.overlayRef = null;
    }
  }
}
