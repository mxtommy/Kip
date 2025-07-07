import { Component, inject } from '@angular/core';
import { NotificationsService } from '../../services/notifications.service';
import { Methods, States } from '../../interfaces/signalk-interfaces';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { SlicePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import isEqual from 'lodash-es/isEqual';

@Component({
    selector: 'menu-notifications',
    templateUrl: './menu-notifications.component.html',
    styleUrls: ['./menu-notifications.component.scss'],
    standalone: true,
    imports: [MatListModule, MatButtonModule, MatBadgeModule, MatTooltipModule, MatIconModule, SlicePipe]
})
export class MenuNotificationsComponent {
  private _notificationsService = inject(NotificationsService);
  private _notifications$ = this._notificationsService.observeNotifications();
  protected notificationConfig = toSignal(this._notificationsService.observeNotificationConfiguration(), {requireSync: true});
  protected menuNotifications = toSignal(this._notifications$.pipe(
    map(notifications => {
      // Define states filter
      const statesToFilter = [];
      if (!this.notificationConfig().devices.showNormalState) {
        statesToFilter.push(States.Normal);
      }
      if (!this.notificationConfig().devices.showNominalState) {
        statesToFilter.push(States.Nominal);
      }

      // Filter notifications based on the states
      return notifications.filter(
        item => item.value && item.value.state && !statesToFilter.includes(item.value.state)
      );
    }),
    map(notifications => notifications.filter(
      item => item.value && item.value.method && item.value.method.includes(Methods.Visual)
    ))
  ), {requireSync: true , equal: isEqual});
  protected isMuted = false;

  protected mutePlayer(state: boolean): void {
    this.isMuted = state;
    this._notificationsService.mutePlayer(state);
  }

  protected silence(path: string): void {
    this._notificationsService.setSkMethod(path, [ Methods.Visual ]);
  }

  protected clear(path: string): void {
    this._notificationsService.setSkState(path, States.Normal);
  }
}
