/**
 * This Service handles app notifications sent by the Signal K server.
 */
import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';

import { AppSettingsService } from "./app-settings.service";
import { INotificationConfig } from '../interfaces/app-settings.interfaces';
import { DefaultNotificationConfig } from '../../../default-config/config.blank.notification.const';
import { SignalkRequestsService } from './signalk-requests.service';
import { DataService } from './data.service';
import { Howl } from 'howler';
import { isEqual } from 'lodash-es';
import { UUID } from '../../utils/uuid';
import { TMethod, ISignalKDataValueUpdate, ISkMetadata, ISignalKNotification, States, Methods } from '../interfaces/signalk-interfaces';
import { IMeta } from '../interfaces/app-interfaces';


const alarmTrack = {
  1000 : 'notification', //filler
  1001 : 'alert',
  1002 : 'warn',
  1003 : 'alarm',
  1004 : 'emergency',
};

export interface INotification {
  path: string;
  value?: ISignalKNotification;
  meta?: ISkMetadata;
}

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
    nominal: { sound: 0, visual: 0 },
    alert: { sound: 1, visual: 0 },
    warn: { sound: 2, visual: 1 },
    alarm: { sound: 3, visual: 2 },
    emergency: { sound: 4, visual: 2 },
  };
  private _notificationSettingsSubscription: Subscription = null;
  private _notificationDataStreamSubscription: Subscription = null;
  private _notificationMetaStreamSubscription: Subscription = null;
  private _resetServiceSubscription: Subscription = null;

  private _notificationConfig: INotificationConfig;
  private _notificationConfig$: BehaviorSubject<INotificationConfig> = new BehaviorSubject<INotificationConfig>(DefaultNotificationConfig);

  private _notifications: INotification[] = []; // local array of Alarms with path as index key
  private _notifications$ = new BehaviorSubject<INotification[] | null>(null);
  private _alarmsInfo$: BehaviorSubject<IAlarmInfo> = new BehaviorSubject<IAlarmInfo>({audioSev: 0, visualSev: 0, alarmCount: 0, isMuted: false});

  // sounds properties
  private _howlPlayer: Howl;
  private _activeAlarmSoundtrack: number = null;
  private _activeHowlId: number = null;
  private _isHowlIdMuted: boolean = false;

  // Notification acknowledge timeouts references
  private _lastEmittedValue: IAlarmInfo = null;

  constructor(
    private settings: AppSettingsService,
    private data: DataService,
    private requests: SignalkRequestsService
    ) {
    // Observer of Notification Service configuration changes
    this._notificationSettingsSubscription = this.settings.getNotificationServiceConfigAsO().subscribe((config: INotificationConfig) => {
      this._notificationConfig = config;
      this.reset();
      this._notificationConfig$.next(config); // push to observers
      if (this._notificationConfig.disableNotifications && !this._notificationDataStreamSubscription?.closed) {
        this.stopNotificationStream();
      }
      if (!this._notificationConfig.disableNotifications && (this._notificationDataStreamSubscription === null || this._notificationDataStreamSubscription?.closed)) {
          this.startNotificationStream();
      }
      if (this._notificationConfig.sound.disableSound) {
        this.playAlarm(1000); // will stop any playing track if any
      } else {
        this.updateNotificationsState(); //see if any we need to start playing again
      }
    });

    this._resetServiceSubscription = this.data.isResetService().subscribe(reset => {
        reset ? this.reset() : null;
      });

    // Init audio player
    this._howlPlayer = this.getPlayer(1000);
   }

  private startNotificationStream() {
    this._notificationDataStreamSubscription = this.data.getNotificationMsg().subscribe((msg: ISignalKDataValueUpdate) => {
      this.processNotificationDeltaMsg(msg);
    });

    this._notificationMetaStreamSubscription = this.data.getNotificationMeta().subscribe((meta: IMeta) => {
      this.processNotificationDeltaMeta(meta);
    });
  }

  private stopNotificationStream() {
  this._notificationDataStreamSubscription?.unsubscribe();
  this._notificationMetaStreamSubscription?.unsubscribe();
  this.reset();
  }

  /**
   * Reset the notifications array and send empty notifications array to observers
   */
  private reset() {
    if (this._notificationConfig.disableNotifications) {
      this._notifications = [];
      this._notifications$.next([]);
    }
    this.updateNotificationsState();
  }

  /**
   * Returns a notification Observable of notification or null.
   */
  public observe(): Observable<INotification[] | null> {
    return this._notifications$.asObservable();
  }

  private addValue(msg: ISignalKDataValueUpdate) {
    this._notifications.push({ path: msg.path, value: msg.value });
    this.updateNotificationsState();
    this._notifications$.next(this._notifications);
  }

  private updateValue(msg: ISignalKDataValueUpdate) {
    const notificationToUpdate = this._notifications.find(item => item.path == msg.path);
    if (notificationToUpdate) {
      notificationToUpdate.value = {...msg.value};
      this.updateNotificationsState();
      this._notifications$.next(this._notifications);
    } else {
      console.log("[Notification Service] Update path not found for: " + msg.path);
    }
  }

  private deleteValue(path: string): void {
    const notification = this._notifications.find(notification => notification.path == path);
    if (notification) {
      delete notification.value;
      this.updateNotificationsState();
      this._notifications$.next(this._notifications);
    } else {
      console.log("[Notification Service] Notification to delete not found for: " + path);
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
      if (!alarm.value || !('method' in alarm.value)) {
        continue;
      }

      if ((alarm.value['state'] === States.Normal && !this._notificationConfig.devices.showNormalState) ||
          (alarm.value['state'] === States.Nominal && !this._notificationConfig.devices.showNominalState)) {
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
      isMuted: this._isHowlIdMuted
    };

    if (!isEqual(newValue, this._lastEmittedValue)) {
      this._alarmsInfo$.next(newValue);
      this._lastEmittedValue = newValue;
    }
  }

  /**
   * Process Notification Delta received from Signal K server.
   * @param notificationDelta Notification Delta object received from Signal K server.
   */
  private processNotificationDeltaMsg(notificationDelta: ISignalKDataValueUpdate) {
    if (notificationDelta.path.startsWith("notifications.security")) {
      return; // as per sbender this part is not ready in the spec - Don't add to alarms
    }

    if (notificationDelta.value === null) {
      // Notification has been deleted
      this.deleteValue(notificationDelta.path);
    } else {
      const existingNotification: INotification = this._notifications.find(item => item.path == notificationDelta.path);
      if (existingNotification) {
        if (!existingNotification.value) {
          this.updateValue(notificationDelta);
        } else {
          if ( (existingNotification.value['state'] !== notificationDelta.value['state'])
            || (existingNotification.value['message'] !== notificationDelta.value['message'])
            || !isEqual(existingNotification.value['method'], notificationDelta.value['method']) ) {
            this.updateValue(notificationDelta);
          }
        }
      } else {
        this.addValue(notificationDelta);
      }
    }
  }

  private processNotificationDeltaMeta(metaDelta: IMeta) {
    const existingNotification: INotification = this._notifications.find(item => item.path == metaDelta.path);
    if (existingNotification) {
      existingNotification.meta = metaDelta.meta;

    } else {
      this._notifications.push({path: metaDelta.path, meta: metaDelta.meta});
    }
    this._notifications$.next(this._notifications);
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
    const state = message.value['state'];
    const severity: ISeverityLevel = NotificationsService.ALARM_SEVERITIES[state];
    if (!severity) {
      console.log("[Notification Service] Unknown Notification State received from Signal K\n" + JSON.stringify(message));
      return { aSev: 0, vSev: 0 };
    }

    let aSev = severity.sound;
    let vSev = severity.visual;

    if (!message.value['method'].includes(Methods.Sound) || this._notificationConfig.sound[`mute${state.charAt(0).toUpperCase() + state.slice(1)}`]) {
      aSev = 0;
    }
    if (!message.value['method'].includes(Methods.Visual)) {
      vSev = 0;
    }

    return { aSev, vSev };
  }

  /**
   * Set the method for a specific path.
   *
   * @param {string} path Path to set method for
   * @param {TMethod[]} method Method to set. See TMethod for definition.
   * @memberof NotificationsService
   */
  public setSkMethod(path: string, method: TMethod[]) {
    this.requests.putRequest(
      `${path}.method`,
      method,
      UUID.create()
    );
  }

  /**
   * Set the state for a specific path.
   *
   * @param {string} path Path to set state for
   * @param {string} state State to set. See TState for definition.
   * @memberof NotificationsService
   */
  public setSkState(path: string, state: string) {
    this.requests.putRequest(
      `${path}.state`,
      state,
      UUID.create()
    );
  }

  public observerNotificationInfo() {
    return this._alarmsInfo$.asObservable();
  }

  /**
   * Load player with a specific track in loop mode.
   * @param track track ID to play. See const for definition
   */
  getPlayer(track: number): Howl {
    this._activeAlarmSoundtrack = track;
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
          this._howlPlayer.once('unlock', function() {
            this._howlPlayer.play();
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
    this._howlPlayer.mute(state, this._activeHowlId);
    this._isHowlIdMuted = state;
    this.updateNotificationsState(); //make sure to push updated info tro alarm menu
  }

   /**
   * play audio notification sound
   * @param trackId track to play
   */
   playAlarm(trackId: number) {
    if (this._activeAlarmSoundtrack == trackId) {   // same track, do nothing
      return;
    }
    if (trackId == 1000) {   // Stop track
      if (this._howlPlayer) {
        this._howlPlayer.stop();
      }
      this._activeAlarmSoundtrack = 1000;
      return;
    }
    this._howlPlayer.stop();
    this._howlPlayer = this.getPlayer(trackId);
    this._activeHowlId = this._howlPlayer.play();
  }

  /**
   * Returns the Notification Configuration Observable.
   *
   * @return {*}  {Observable<INotificationConfig>}
   * @memberof NotificationsService
   */
  public observeNotificationConfiguration(): Observable<INotificationConfig> {
    return this._notificationConfig$.asObservable();
  }

  ngOnDestroy(): void {
    this._notificationSettingsSubscription?.unsubscribe();
    this._resetServiceSubscription?.unsubscribe();
    this._notificationConfig$.complete();
    this._notifications$.complete();
    this._alarmsInfo$.complete();
  }
}
