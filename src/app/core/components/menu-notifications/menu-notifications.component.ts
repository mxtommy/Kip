import { Component, inject, OnDestroy, output } from '@angular/core';
import { NotificationsService, INotification, IAlarmInfo } from '../../services/notifications.service';
import { Observable, Subscription, filter, map, tap } from 'rxjs';
import { INotificationConfig } from '../../interfaces/app-settings.interfaces';
import { Methods, States } from '../../interfaces/signalk-interfaces';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { AsyncPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';

interface INotificationInfo extends IAlarmInfo{
  isWarn: boolean;
  isAlarmEmergency: boolean;
}

@Component({
    selector: 'menu-notifications',
    templateUrl: './menu-notifications.component.html',
    styleUrls: ['./menu-notifications.component.scss'],
    standalone: true,
    imports: [ MatListModule, MatButtonModule, MatBadgeModule, MatTooltipModule, AsyncPipe, MatIconModule ]
})
export class MenuNotificationsComponent implements OnDestroy {
  private notificationsService = inject(NotificationsService);
  protected notificationServiceSettingsSubscription: Subscription = null;
  protected notifications$: Observable<INotification[]> = this.notificationsService.observe().pipe(
    filter(notification => notification !== null));
  protected menuNotifications$ = this.notifications$.pipe(
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
  );
  protected notificationInfo$ = this.notificationsService.observerNotificationInfo().pipe(
    map((info: IAlarmInfo) => {
      let isWarn = false;
      let isAlarmEmergency = false;

      switch(info.visualSev) {
        case 1:
          isWarn = true;
          break;
        case 2:
          isAlarmEmergency = true;
          break;
      }

      return {
        ...info,
        isWarn,
        isAlarmEmergency
      } as INotificationInfo;
    }),
    tap((notificationInfo: INotificationInfo) => {
      // Update notification visibility
      if (notificationInfo.alarmCount <= 0) {
        console.log('Hidden. Count: ' + notificationInfo.alarmCount);
        this.hasNotifications.emit(false);
        this.notificationsBtnVisibility = 'hidden';
      } else {
        console.log('Visible. Count: ' + notificationInfo.alarmCount);
        this.hasNotifications.emit(true);
        this.notificationsBtnVisibility = 'visible';
      }
    })

  );
  protected notificationConfig: INotificationConfig;
  protected toggleSidenav = output<boolean>();
  protected hasNotifications = output<boolean>();
  protected notificationsBtnVisibility: string = 'hidden';
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
