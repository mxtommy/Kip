import { MatIconModule } from '@angular/material/icon';
import { Component, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { NotificationsService } from '../../services/notifications.service';

@Component({
  selector: 'notification-badge',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatBadgeModule],
  templateUrl: './notification-badge.component.html',
  styleUrl: './notification-badge.component.scss',
})
export class NotificationBadgeComponent {
  private _notifications = inject(NotificationsService);
  protected hasNotifications = output<boolean>();
  protected notificationsInfo = toSignal(this._notifications.observerNotificationsInfo());

  protected openNotificationMenu(): void {
    const sidenavEvent = new Event('openRightSidenav', { bubbles: true, cancelable: true });
    window.document.dispatchEvent(sidenavEvent);
  }
}
