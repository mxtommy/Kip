import { Component, OnDestroy } from '@angular/core';
import { NotificationsService, INotificationMessage, IAlarmInfo } from '../core/services/notifications.service';
import { Observable, Subscription, filter, iif, map, of, switchMap } from 'rxjs';
import { INotificationConfig } from '../core/interfaces/app-settings.interfaces';
import { MatDivider } from '@angular/material/divider';
import { MatActionList, MatListItem } from '@angular/material/list';
import { MatTooltip } from '@angular/material/tooltip';
import { MatBadge } from '@angular/material/badge';
import { NgIf, AsyncPipe, NgFor, NgTemplateOutlet } from '@angular/common';
import { MatMenuTrigger, MatMenu, MatMenuItem, MatMenuModule } from '@angular/material/menu';
import { MatButton } from '@angular/material/button';

interface IMenuItem {
  [key: string]: any;
  label: string;
  Alarm?: INotificationMessage;
}

interface INotificationInfo extends IAlarmInfo{
  blinkWarn: boolean;
  blinkCrit: boolean;
}

@Component({
    selector: 'app-alarm-menu',
    templateUrl: './alarm-menu.component.html',
    styleUrls: ['./alarm-menu.component.scss'],
    standalone: true,
    imports: [MatButton, MatMenuModule, MatBadge, MatTooltip, MatDivider, MatListItem, AsyncPipe, NgFor, NgIf]
})
export class AlarmMenuComponent implements OnDestroy {
  private static readonly NORMAL_STATE = "normal";
  private notificationServiceSettingsSubscription: Subscription = null;
  private notifications$: Observable<INotificationMessage[]> = this.notificationsService.observe().pipe(
    filter(notification => notification !== null)
  );
  public menuNotifications$ = this.notifications$.pipe(
    switchMap(notifications =>
      iif(
        () => this.notificationConfig.devices.showNormalState,
        of(notifications),
        of(notifications.filter(
          msg => msg.notification.state !== AlarmMenuComponent.NORMAL_STATE
        ))
      )
    )
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
    })
  );

  public notificationConfig: INotificationConfig;

  constructor(private notificationsService: NotificationsService) {
    // Get service configuration
    this.notificationServiceSettingsSubscription = this.notificationsService.getNotificationServiceConfigAsO().subscribe((config: INotificationConfig) => {
      this.notificationConfig = config;
    });
  }

  public mutePlayer(state: boolean): void {
    this.notificationsService.mutePlayer(state);
  }

  public ackAlarm(path: string, timeout: number = 0): void {
    this.notificationsService.acknowledge(path, timeout);
  }

  ngOnDestroy() {
    this.notificationServiceSettingsSubscription?.unsubscribe();
  }

}
