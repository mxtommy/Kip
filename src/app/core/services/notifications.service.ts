/**
 * This Angular Service handles both app notifications to the Snackbar and Signal K
 * Alert Notifications
 */
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import { AppSettingsService } from "./app-settings.service";
import { INotificationConfig } from '../interfaces/app-settings.interfaces';
import { DefaultNotificationConfig } from '../../../default-config/config.blank.notification.const';
import { SignalKDeltaService, INotification, IStreamStatus } from './signalk-delta.service';
import { SignalkRequestsService } from './signalk-requests.service';
import { Howl } from 'howler';
import { isEqual } from 'lodash-es';
import { UUID } from '../../utils/uuid';
import { TMethod } from '../interfaces/signalk-interfaces';


const alarmTrack = {
  1000 : 'notification', //filler
  1001 : 'alert',
  1002 : 'warn',
  1003 : 'alarm',
  1004 : 'emergency',
};


/**
 * Alarm information, some stats used
 */
export interface IAlarmInfo {
  audioSev: number;
  visualSev: number;
  alarmCount: number;
  isMuted: boolean;
}

interface ISeverityLevel {
  sound: number;
  visual: number;
}

interface IAlarmSeverities {
  [key: string]: ISeverityLevel;
}


@Injectable({
  providedIn: 'root'
})
export class NotificationsService implements OnDestroy {
  private static readonly ALARM_SEVERITIES: IAlarmSeverities = {
    normal: { sound: 0, visual: 0 },
    alert: { sound: 1, visual: 1 },
    warn: { sound: 2, visual: 1 },
    alarm: { sound: 3, visual: 2 },
    emergency: { sound: 4, visual: 2 },
  };
  private notificationSettingsSubscription: Subscription = null;
  private notificationStreamSubscription: Subscription = null;
  private _notificationConfig: INotificationConfig;
  public notificationConfig$: BehaviorSubject<INotificationConfig> = new BehaviorSubject<INotificationConfig>(DefaultNotificationConfig);

  private _notifications: INotification[] = []; // local array of Alarms with path as index key
  private notifications$ = new BehaviorSubject<INotification[] | null>(null);
  private alarmsInfo$: BehaviorSubject<IAlarmInfo> = new BehaviorSubject<IAlarmInfo>({audioSev: 0, visualSev: 0, alarmCount: 0, isMuted: false});

  // sounds properties
  private howlPlayer: Howl;
  private activeAlarmSoundtrack: number = null;
  private activeHowlId: number = null;
  private isHowlIdMuted: boolean = false;

  // Notification acknowledge timeouts references
  private lastEmittedValue: IAlarmInfo = null;

  constructor(
    private appSettingsService: AppSettingsService,
    private deltaService: SignalKDeltaService,
    private requests: SignalkRequestsService
    ) {
    // Observer of Notification Service configuration changes
    this.notificationSettingsSubscription = this.appSettingsService.getNotificationServiceConfigAsO().subscribe((config: INotificationConfig) => {
      this._notificationConfig = config;
      this.reset();
      this.notificationConfig$.next(config); // push to observers
      if (this._notificationConfig.disableNotifications && !this.notificationStreamSubscription?.closed) {
        this.stopNotificationStream();
      }
      if (!this._notificationConfig.disableNotifications && (this.notificationStreamSubscription === null || this.notificationStreamSubscription?.closed)) {
          this.startNotificationStream();
      }
      if (this._notificationConfig.sound.disableSound) {
        this.playAlarm(1000); // will stop any playing track if any
      } else {
        this.updateNotificationsState(); //see if any we need to start playing again
      }
    });

    // Observer of server connection status to reset notifications on SK reconnect
    this.deltaService.streamEndpoint$.subscribe((streamStatus: IStreamStatus) => {
      if (streamStatus.operation === 2) {
        this.reset();
      }
    });

    // Init audio player
    this.howlPlayer = this.getPlayer(1000);
   }

  private startNotificationStream() {
  this.notificationStreamSubscription = this.deltaService.subscribeNotificationsUpdates().subscribe((msg: INotification) => {
    this.processNotificationDelta(msg);
  });
  }

  private stopNotificationStream() {
  this.notificationStreamSubscription?.unsubscribe();
  this.reset();
  }

  /**
   * Reset the notifications array and send empty notifications array to observers
   */
  private reset() {
    this._notifications = [];
    this.updateNotificationsState();
    this.notifications$.next([]);
  }

  /**
   * Returns an Observable of type alarms containing alarms. Used
   * by observers whom are interested in Alarms such as Widgets and Alarm menu.
   */
  public observe(): Observable<any> {
    return this.notifications$.asObservable();
  }

  /**
   * Add notification to the notifications array
   * @param msg Signal K notification message
   */
  private add(notification: INotification) {
    this._notifications.push(notification);
    this.updateNotificationsState();
    this.notifications$.next(this._notifications);
  }

  /**
   * Update notification data received from SignalK. ie. alarm.notification
   * @param notification
   */
  private update(notification: INotification) {
    let notificationToUpdate = this._notifications.find(item => item.path == notification.path);
    if (notificationToUpdate) {
      notificationToUpdate.notification = {...notification.notification};
      this.updateNotificationsState();
      this.notifications$.next(this._notifications);
    } else {
      console.log("[Notification Service] Notification to update not found: " + notification.path);
    }
  }

  /**
   * Delete alarm by path
   * @param path
   */
  private delete(path: string): void {
    const index = this._notifications.findIndex(notification => notification.path == path);
    if (index > -1) {
      this._notifications.splice(index, 1);
      this.updateNotificationsState();
      this.notifications$.next(this._notifications);
    } else {
      console.log("[Notification Service] Notification to delete not found: " + path);
    }
  }

  /**
   * Checks all alarms for worst state, and sets any visual and Audio notification severity.
   */
  private updateNotificationsState() {
    let audioSev = 0;
    let visualSev = 0;
    let activeNotifications: number = 0;

    for (const alarm of this._notifications) {
      if (!('method' in alarm.notification)) {
        continue;
      }

      if (alarm.notification['state'] === 'normal' && !this._notificationConfig.devices.showNormalState) {
        continue;
      }

      activeNotifications++;
      const { aSev, vSev } = this.getNotificationSeverity(alarm);
      audioSev = Math.max(audioSev, aSev);
      visualSev = Math.max(visualSev, vSev);
    }

    if (!this._notificationConfig.sound.disableSound) {
      this.playAlarm(1000 + audioSev);
    }

    const newValue: IAlarmInfo = {
      audioSev: audioSev,
      visualSev: visualSev,
      alarmCount: activeNotifications,
      isMuted: this.isHowlIdMuted
    };

    if (!isEqual(newValue, this.lastEmittedValue)) {
      this.alarmsInfo$.next(newValue);
      this.lastEmittedValue = newValue;
    }
  }

  /**
   * Process Notification Delta received from Signal K server.
   * @param notificationDelta Notification Delta object received from Signal K server.
   */
  private processNotificationDelta(notificationDelta: INotification) {
    if (/^notifications.security./.test(notificationDelta.path)) {
      return; // as per sbender this part is not ready in the spec - Don't add to alarms
    }

    if (notificationDelta.notification === null) {
      // Notification has been removed/cleared on server
      this.delete(notificationDelta.path);
    } else {
      const existingNotification: INotification = this._notifications.find(item => item.path == notificationDelta.path);
      if (existingNotification) {
        if ( (existingNotification.notification['state'] !== notificationDelta.notification['state'])
              || (existingNotification.notification['message'] !== notificationDelta.notification['message'])
              || !isEqual(existingNotification.notification['method'], notificationDelta.notification['method']) ) {
          this.update(notificationDelta);
          console.log(notificationDelta.notification);
        }
      } else {
        this.add(notificationDelta);
        console.log(notificationDelta.notification);
      }
    }
  }

  /**
   * Returns visual and audio severity levels based on
   * the Notification State and Method.
   *
   * @private
   * @param {*} message Notification message
   * @return {*}  {{ aSev: any; vSev: any; }} Audio and Visual severity levels
   * @memberof NotificationsService
   */
  private getNotificationSeverity(message: INotification): { aSev: number; vSev: number; } {
    const state = message.notification['state'];
    const severity: ISeverityLevel = NotificationsService.ALARM_SEVERITIES[state];
    if (!severity) {
      console.log("[Notification Service] Unknown Notification State received from Signal K\n" + JSON.stringify(message));
      return { aSev: 0, vSev: 0 };
    }

    let aSev = severity.sound;
    let vSev = severity.visual;

    if (message.notification['method'].includes('sound') && this._notificationConfig.sound[`mute${state.charAt(0).toUpperCase() + state.slice(1)}`]) {
      aSev = 0;
    }
    if (!message.notification['method'].includes('visual')) {
      vSev = 0;
    }

    return { aSev, vSev };
  }

  public setSkMethod(path: string, method: TMethod[]) {
    this.requests.putRequest(
      `${path}.method`,
      method,
      UUID.create()
    );
  }

  public setSkState(path: string, state: string) {
    this.requests.putRequest(
      `${path}.state`,
      state,
      UUID.create()
    );
  }

  public observerNotificationInfo() {
    return this.alarmsInfo$.asObservable();
  }

  /**
   * Load player with a specific track in loop mode.
   * @param track track ID to play. See const for definition
   */
   getPlayer(track: number): Howl {
    this.activeAlarmSoundtrack = track;
    const player = new Howl({
        src: ['assets/' + alarmTrack[track] + '.mp3'],
        autoplay: false,
        preload: true,
        loop: true,
        onend: function() {
          // console.log('Finished!');
        },
        onloaderror: function() {
          console.log("player onload error");
        },
        onplayerror: function() {
          console.log("player locked");
          this.howlPlayer.once('unlock', function() {
            this.howlPlayer.play();
          });
        }
      });
    return player;
  }

  /**
  * mute Howl Player active track ei.: howlId. Note Howl howlId is not the
  * same as Player Soundtrack TrackId which represents the selected sound file.
  * @param state sound muted boolean state
  */
  mutePlayer(state) {
    this.howlPlayer.mute(state, this.activeHowlId);
    this.isHowlIdMuted = state;
    this.updateNotificationsState(); //make sure to push updated info tro alarm menu
  }

   /**
   * play audio notification sound
   * @param trackId track to play
   */
   playAlarm(trackId: number) {
    if (this.activeAlarmSoundtrack == trackId) {   // same track, do nothing
      return;
    }
    if (trackId == 1000) {   // Stop track
      if (this.howlPlayer) {
        this.howlPlayer.stop();
      }
      this.activeAlarmSoundtrack = 1000;
      return;
    }
    this.howlPlayer.stop();
    this.howlPlayer = this.getPlayer(trackId);
    this.activeHowlId = this.howlPlayer.play();
  }

  public getNotificationServiceConfigAsO(): Observable<INotificationConfig> {
    return this.notificationConfig$.asObservable();
  }

  ngOnDestroy(): void {
    this.notificationSettingsSubscription?.unsubscribe();
    this.notificationStreamSubscription?.unsubscribe();
  }
}
