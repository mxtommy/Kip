import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationsService, IAlarm, IAlarmMsg } from '../core/services/notifications.service';
import { BehaviorSubject, Subscription, filter, tap } from 'rxjs';
import { INotificationConfig } from '../core/interfaces/app-settings.interfaces';
import { MatDivider } from '@angular/material/divider';
import { MatActionList, MatListItem } from '@angular/material/list';
import { MatTooltip } from '@angular/material/tooltip';
import { MatBadge } from '@angular/material/badge';
import { NgIf, AsyncPipe } from '@angular/common';
import { MatMenuTrigger, MatMenu, MatMenuItem } from '@angular/material/menu';
import { MatButton } from '@angular/material/button';

interface IMenuNode {
  [key: string]: any;
  label: string;
  childNode?: [IMenuItem | IMenuNode];
}
interface IMenuItem {
  [key: string]: any;
  label: string;
  Alarm?: IAlarm;
}


@Component({
    selector: 'app-alarm-menu',
    templateUrl: './alarm-menu.component.html',
    styleUrls: ['./alarm-menu.component.scss'],
    standalone: true,
    imports: [MatButton, MatMenuTrigger, NgIf, MatBadge, MatMenu, MatMenuItem, MatTooltip, MatActionList, MatDivider, MatListItem, AsyncPipe]
})
export class AlarmMenuComponent implements OnInit, OnDestroy {

  private alarmSubscription: Subscription = null;
  private notificationServiceSettingsSubscription: Subscription = null;
  private alarmInfoSubscription: Subscription = null;

  private msg$ = this.notificationsService.getAlarms().pipe(filter(messages => messages !== null));
  public alarm$ = this.msg$.pipe(/* tap(x => console.warn(x)),*/ filter((msgs: IAlarmMsg[]) => (msgs?.every(msg => msg.alarm.notification.state == "normal") && !this.notificationConfig.devices.showNormalState)))

  alarmMenu: { [key: string]: string | IMenuItem | IMenuItem } = {}; // local menu array with string key

  // Menu properties
  alarmCount: number = 0;
  unAckAlarms: number = 0;
  blinkWarn: boolean = false;
  blinkCrit: boolean = false;

  isMuted: boolean = false;
  notificationConfig: INotificationConfig;

  constructor(private notificationsService: NotificationsService) {
    this.notificationServiceSettingsSubscription = this.notificationsService.getNotificationServiceConfigAsO().subscribe((config: INotificationConfig) => {
      this.notificationConfig = config;
    });
  }

  ngOnInit() {
        // this.alarm$.subscribe(msg => {
        //   console.log(msg);
        // })

    // init alarm info
    this.alarmInfoSubscription = this.notificationsService.getAlarmInfo().subscribe(info => {
      this.unAckAlarms = info.unackCount;
      this.isMuted = info.isMuted;
      this.alarmCount = info.alarmCount;
      switch(info.visualSev) {
        case 0:
          this.blinkWarn = false;
          this.blinkCrit = false;
          break;
        case 1:
          this.blinkWarn = true;
          this.blinkCrit = false;
          break;
        case 2:
          this.blinkCrit = true;
          this.blinkWarn = false;
      }
    });
  }

  mutePlayer(state) {
    this.notificationsService.mutePlayer(state);
  }

  createMenuRootItem(itemLabel: string): IMenuNode | null {
    let item: IMenuNode = {
      label: itemLabel
    }

    if(Object.entries(this.alarmMenu).length) {
      let i = Object.keys(this.alarmMenu).indexOf(itemLabel);
      if(i == -1) {
        console.log("Root: " + itemLabel + " not found. Search index: " + i);
        return item;
      } else {
        console.log("Root: " + itemLabel + " found. Search index: " + i);
        console.log(JSON.stringify(Object.values(this.alarmMenu)));
        return null;
      }
    }
    console.log(JSON.stringify(Object.values(this.alarmMenu)));
    return item;
  }

  createMenuChildItem(itemLabel: string, pathPositionIndex: number, pathArray: string[], alarm: IAlarm): IMenuItem | IMenuNode {
    let item;

    const lastPosition = pathArray.length - 1;
    let parentLabel = pathArray[pathPositionIndex - 1];
    let indexParentNode = Object.keys(this.alarmMenu).indexOf(pathArray[parentLabel]);

    if (pathPositionIndex != lastPosition) {
      item = {
        label: pathArray[pathPositionIndex],
      }
    } else {
      item = {
        label: pathArray[pathPositionIndex],
        Alarm: alarm,
      }
    }

    for (const [label, menuNode] of Object.entries(this.alarmMenu)) {
        if (label == parentLabel) {
          console.log(JSON.stringify(menuNode));
          menuNode['childNode'] = item;

          if (pathPositionIndex != lastPosition) {
            pathPositionIndex++;
            if (pathPositionIndex != (lastPosition)) {
              item = {
                label: pathArray[pathPositionIndex]
              }
            } else {
              item = {
                label: pathArray[pathPositionIndex],
                Alarm: alarm,
              }
            }
            menuNode['childNode'][0].childNode = item;
          }
        }
      }

    return null;
  }


  ackAlarm(path: string, timeout: number = 0) {
    this.notificationsService.acknowledgeAlarm(path, timeout);
  }


  /**
   * Used by ngFor to tracks alarm items by key for menu optimization
   * @param alarm object in question
   */
  trackAlarmPath(index, alarm) {
    return alarm ? alarm.value.path : undefined;
  }

  ngOnDestroy() {
    this.notificationServiceSettingsSubscription?.unsubscribe();
    this.alarmSubscription?.unsubscribe();
    this.alarmInfoSubscription?.unsubscribe();
  }

}
