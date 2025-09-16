import { MatIconModule } from '@angular/material/icon';
import { Component, inject, ElementRef, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { NotificationsService } from '../../services/notifications.service';

@Component({
  selector: 'notification-badge',
  imports: [MatButtonModule, MatIconModule, MatBadgeModule],
  templateUrl: './notification-badge.component.html',
  styleUrls: ['./notification-badge.component.scss'],
})
export class NotificationBadgeComponent {
  protected badgeButton = viewChild.required<ElementRef<HTMLButtonElement>>('badgeButton');
  private readonly _notifications = inject(NotificationsService);
  protected readonly notificationsInfo = toSignal(this._notifications.observerNotificationsInfo());

  protected openNotificationMenu(): void {
    const sidenavEvent = new Event('openRightSidenav', { bubbles: true, cancelable: true });
    window.document.dispatchEvent(sidenavEvent);
  }

  protected onKeyDown(e: KeyboardEvent): void {
    const k = e.key?.toLowerCase();
    if (k === 'enter' || k === ' ' || k === 'spacebar') {
      e.preventDefault();
      this.openNotificationMenu();
    }
  }

  /**
   * Focus the badge button. Called by consumers (for example the overlay service)
   * to move keyboard focus into the badge after it is attached.
   */
  public focus(): void {
    try {
      const btnRef = this.badgeButton && this.badgeButton();
      const native = btnRef && (btnRef as ElementRef<HTMLButtonElement>).nativeElement;
      if (native && typeof native.focus === 'function') native.focus();
    } catch { /* ignore */ }
  }
}
