import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { NotificationsService } from '../../services/notifications.service';
import { Methods, States } from '../../interfaces/signalk-interfaces';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { SlicePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { map, combineLatest } from 'rxjs';
import isEqual from 'lodash-es/isEqual';

@Component({
  selector: 'menu-notifications',
  templateUrl: './menu-notifications.component.html',
  styleUrls: ['./menu-notifications.component.scss'],
  imports: [MatListModule, MatButtonModule, MatBadgeModule, MatTooltipModule, MatIconModule, SlicePipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MenuNotificationsComponent {
  private readonly _notificationsService = inject(NotificationsService);
  private readonly _notifications$ = this._notificationsService.observeNotifications();
  protected readonly notificationConfig = toSignal(this._notificationsService.observeNotificationConfiguration(), { requireSync: true });

  /**
   * menuNotifications is driven by both the notifications stream and the
   * notification configuration. Use combineLatest so changes to config
   * immediately reflect in the derived list.
   */
  protected readonly menuNotifications = toSignal(
    combineLatest([this._notifications$, this._notificationsService.observeNotificationConfiguration()]).pipe(
      map(([notifications, cfg]) => {
        const statesToFilter: States[] = [];
        if (!cfg.devices.showNormalState) statesToFilter.push(States.Normal);
        if (!cfg.devices.showNominalState) statesToFilter.push(States.Nominal);

        return notifications
          .filter(item => item.value && item.value.state && !statesToFilter.includes(item.value.state as States))
          .filter(item => item.value && item.value.method && item.value.method.includes(Methods.Visual));
      })
    ),
    { requireSync: true, equal: isEqual }
  );
  protected isMuted = false;

  protected mutePlayer(state: boolean): void {
    this.isMuted = state;
    this._notificationsService.mutePlayer(state);
  }

  protected silence(path: string): void {
    this._notificationsService.setSkMethod(path, [Methods.Visual]);
  }

  protected clear(path: string): void {
    this._notificationsService.setSkState(path, States.Normal);
  }
}
