import { Component, inject, OnDestroy } from '@angular/core';
import { NotificationsService } from '../../services/notifications.service';
import { Subscription, map } from 'rxjs';
import { INotificationConfig } from '../../interfaces/app-settings.interfaces';
import { Methods, States } from '../../interfaces/signalk-interfaces';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
    selector: 'menu-notifications',
    templateUrl: './menu-notifications.component.html',
    styleUrls: ['./menu-notifications.component.scss'],
    standalone: true,
    imports: [MatListModule, MatButtonModule, MatBadgeModule, MatTooltipModule, MatIconModule]
})
export class MenuNotificationsComponent implements OnDestroy {
  private notificationsService = inject(NotificationsService);
  protected notificationServiceSettingsSubscription: Subscription = null;
  private _notifications$ = this.notificationsService.observeNotifications();
  protected menuNotifications = toSignal(this._notifications$.pipe(
    map(notifications => {
      // Define states filter
      const statesToFilter = [];
      if (!this.notificationConfig.devices.showNormalState) {
        statesToFilter.push(States.Normal);
      }
      if (!this.notificationConfig.devices.showNominalState) {
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
  ));
  protected notificationConfig: INotificationConfig;
  protected isMuted: boolean = false;

  constructor() {
    // Get service configuration
    this.notificationServiceSettingsSubscription = this.notificationsService.observeNotificationConfiguration().subscribe((config: INotificationConfig) => {
      this.notificationConfig = config;
    });
  }

  protected mutePlayer(state: boolean): void {
    this.isMuted = state;
    this.notificationsService.mutePlayer(state);
  }

  protected silence(path: string): void {
    this.notificationsService.setSkMethod(path, [ Methods.Visual ]);
  }

  protected clear(path: string): void {
    this.notificationsService.setSkState(path, States.Normal);
  }

  ngOnDestroy() {
    this.notificationServiceSettingsSubscription?.unsubscribe();
  }

}
