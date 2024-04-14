import { Component, OnDestroy } from '@angular/core';
import { NotificationsService, INotification, IAlarmInfo } from '../core/services/notifications.service';
import { Observable, Subscription, filter, iif, map, of, switchMap, tap } from 'rxjs';
import { INotificationConfig } from '../core/interfaces/app-settings.interfaces';
import { MatDivider } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatBadgeModule } from '@angular/material/badge';
import { NgIf, AsyncPipe, NgFor } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { Methods, States } from '../core/interfaces/signalk-interfaces';
import { METHODS } from 'http';

interface INotificationInfo extends IAlarmInfo{
  blinkWarn: boolean;
  blinkCrit: boolean;
}

@Component({
    selector: 'app-alarm-menu',
    templateUrl: './alarm-menu.component.html',
    styleUrls: ['./alarm-menu.component.scss'],
    standalone: true,
    imports: [MatButtonModule, MatMenuModule, MatBadgeModule, MatTooltipModule, MatDivider, AsyncPipe, NgFor, NgIf]
})
export class AlarmMenuComponent implements OnDestroy {
  private notificationServiceSettingsSubscription: Subscription = null;
  private notifications$: Observable<INotification[]> = this.notificationsService.observe().pipe(
    filter(notification => notification !== null));
  public menuNotifications$ = this.notifications$.pipe(
    switchMap(notifications =>
      iif(
        () => this.notificationConfig.devices.showNormalState,
        of(notifications),
        of(notifications.filter(
          item => item.value && item.value.state !== States.Normal
        ))
      )
    ),
    map(notifications => notifications.filter(
      item => item.value && item.value.method && item.value.method.includes(Methods.Visual)
    ))
  );
  public notificationInfo$ = this.notificationsService.observerNotificationInfo().pipe(
    map((info: IAlarmInfo) => {
      let blinkWarn = false;
      let blinkCrit = false;

      switch(info.visualSev) {
        case 1:
          blinkWarn = true;
          break;
        case 2:
          blinkCrit = true;
          break;
      }

      return {
        ...info,
        blinkWarn,
        blinkCrit
      } as INotificationInfo;
    }));
  public notificationConfig: INotificationConfig;

  constructor(private notificationsService: NotificationsService) {
    // Get service configuration
    this.notificationServiceSettingsSubscription = this.notificationsService.observeNotificationConfiguration().subscribe((config: INotificationConfig) => {
      this.notificationConfig = config;
    });
  }

  public mutePlayer(state: boolean): void {
    this.notificationsService.mutePlayer(state);
  }

  public silence(path: string): void {
    this.notificationsService.setSkMethod(path, [ Methods.Visual ]);
  }

  public clear(path: string): void {
    this.notificationsService.setSkState(path, States.Normal);
  }

  ngOnDestroy() {
    this.notificationServiceSettingsSubscription?.unsubscribe();
  }

}
