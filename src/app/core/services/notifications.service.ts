/**
 * This Service handles app notifications sent by the Signal K server.
 */
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs';

import { AppSettingsService } from "./app-settings.service";
import { INotificationConfig } from '../interfaces/app-settings.interfaces';
import { DefaultNotificationConfig } from '../../../default-config/config.blank.notification.const';
import { SignalkRequestsService } from './signalk-requests.service';
import { DataService } from './data.service';
import { Howl } from 'howler';
import { isEqual } from 'lodash-es';
import { UUID } from '../utils/uuid.util';
import { TMethod, ISignalKDataValueUpdate, ISkMetadata, ISignalKNotification, States, Methods } from '../interfaces/signalk-interfaces';
import { IMeta } from '../interfaces/app-interfaces';

const alarmTrack = {
  1000: 'notification', // filler / silent (stop)
  1001: 'alert',
  1002: 'warn',
  1003: 'alarm',
  1004: 'emergency',
};

export interface INotification {
  path: string;
  value?: ISignalKNotification;
  meta?: ISkMetadata;
}

export interface IAlarmInfo {
  audioSev: number;
  visualSev: number;
  alarmCount: number;
  isMuted: boolean;
}

export interface INotificationInfo extends IAlarmInfo {
  isWarn: boolean;
  isAlarmEmergency: boolean;
}

interface ISeverityLevel {
  sound: number;
  visual: number;
}
type IAlarmSeverities = Record<string, ISeverityLevel>;

@Injectable({ providedIn: 'root' })
export class NotificationsService implements OnDestroy {
  private settings = inject(AppSettingsService);
  private data = inject(DataService);
  private requests = inject(SignalkRequestsService);

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
  private _notificationConfig$ = new BehaviorSubject<INotificationConfig>(DefaultNotificationConfig);

  private _notifications: INotification[] = [];
  private _notifications$ = new BehaviorSubject<INotification[]>([]);
  private _alarmsInfo$ = new BehaviorSubject<IAlarmInfo>({ audioSev: 0, visualSev: 0, alarmCount: 0, isMuted: false });

  // --- Howler (audio) state (FIXED LEAKS) ------------------------------------
  // Previous version created a new Howl each track change without unloading; onplayerror
  // used function() with wrong `this`. We now:
  // 1. Cache one Howl per track in _players (looping).
  // 2. Stop (not recreate) when switching tracks; reuse existing instance.
  // 3. Correct callbacks with arrow functions (lexical this not required).
  // 4. Unload all players on destroy.
  private _players = new Map<number, Howl>();
  private _activeAlarmSoundtrack: number = null;
  private _activeHowlId: number = null;
  private _isHowlIdMuted = false;

  private _lastEmittedValue: IAlarmInfo = null;

  constructor() {
    this._notificationSettingsSubscription = this.settings.getNotificationServiceConfigAsO()
      .subscribe((config: INotificationConfig) => {
        this._notificationConfig = config;
        this.reset();
        this._notificationConfig$.next(config);
        if (this._notificationConfig.disableNotifications && !this._notificationDataStreamSubscription?.closed) {
          this.stopNotificationStream();
        }
        if (!this._notificationConfig.disableNotifications &&
          (this._notificationDataStreamSubscription === null || this._notificationDataStreamSubscription?.closed)) {
          this.startNotificationStream();
        }
        if (this._notificationConfig.sound.disableSound) {
          this.playAlarm(1000);
        } else {
          this.updateNotificationsState();
        }
      });

    this._resetServiceSubscription = this.data.isResetService().subscribe(reset => {
      if (reset) this.reset();
    });

    // Pre-cache silent track player
    this.getPlayer(1000);
  }

  private startNotificationStream() {
    this._notificationDataStreamSubscription = this.data.getNotificationMsgObservable()
      .subscribe((msg: ISignalKDataValueUpdate) => this.processNotificationDeltaMsg(msg));

    this._notificationMetaStreamSubscription = this.data.getNotificationMetaObservable()
      .subscribe((meta: IMeta) => this.processNotificationDeltaMeta(meta));
  }

  private stopNotificationStream() {
    this._notificationDataStreamSubscription?.unsubscribe();
    this._notificationMetaStreamSubscription?.unsubscribe();
    this.reset();
  }

  private reset() {
    if (this._notificationConfig.disableNotifications) {
      this._notifications = [];
      this._notifications$.next([]);
    }
    this.updateNotificationsState();
  }

  public observeNotifications(): Observable<INotification[]> {
    return this._notifications$;
  }

  private addValue(msg: ISignalKDataValueUpdate) {
    this._notifications.push({ path: msg.path, value: msg.value });
    this.updateNotificationsState();
    this._notifications$.next(this._notifications);
  }

  private updateValue(msg: ISignalKDataValueUpdate) {
    const notificationToUpdate = this._notifications.find(item => item.path == msg.path);
    if (notificationToUpdate) {
      notificationToUpdate.value = { ...msg.value };
      this.updateNotificationsState();
      this._notifications$.next(this._notifications);
    } else {
      console.log("[Notification Service] Update path not found for: " + msg.path);
    }
  }

  private deleteValue(path: string): void {
    const notification = this._notifications.find(n => n.path == path);
    if (notification) {
      delete notification.value;
      this.updateNotificationsState();
      this._notifications$.next(this._notifications);
    } else {
      console.log("[Notification Service] Notification to delete not found for: " + path);
    }
  }

  private updateNotificationsState() {
    let audioSev = 0;
    let visualSev = 0;
    let activeNotifications = 0;

    for (const alarm of this._notifications) {
      if (!alarm.value || !('method' in alarm.value) || alarm.value.method.length === 0) continue;

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
      audioSev,
      visualSev,
      alarmCount: activeNotifications,
      isMuted: this._isHowlIdMuted
    };

    if (!isEqual(newValue, this._lastEmittedValue)) {
      this._alarmsInfo$.next(newValue);
      this._lastEmittedValue = newValue;
    }
  }

  private processNotificationDeltaMsg(delta: ISignalKDataValueUpdate) {
    if (delta.path.startsWith("notifications.security")) return;

    if (delta.value === null) {
      this.deleteValue(delta.path);
    } else {
      const existing = this._notifications.find(i => i.path == delta.path);
      if (existing) {
        if (!existing.value ||
            existing.value['state'] !== delta.value['state'] ||
            existing.value['message'] !== delta.value['message'] ||
            !isEqual(existing.value['method'], delta.value['method'])) {
          this.updateValue(delta);
        }
      } else {
        this.addValue(delta);
      }
    }
  }

  private processNotificationDeltaMeta(metaDelta: IMeta) {
    const existing = this._notifications.find(i => i.path == metaDelta.path);
    if (existing) {
      existing.meta = metaDelta.meta;
    } else {
      this._notifications.push({ path: metaDelta.path, meta: metaDelta.meta });
    }
    this._notifications$.next(this._notifications);
  }

  private getNotificationSeverity(message: INotification): { aSev: number; vSev: number } {
    const state = message.value['state'];
    const severity = NotificationsService.ALARM_SEVERITIES[state];
    if (!severity) {
      console.log("[Notification Service] Unknown Notification State\n" + JSON.stringify(message));
      return { aSev: 0, vSev: 0 };
    }

    let aSev = severity.sound;
    let vSev = severity.visual;

    if (!message.value['method'].includes(Methods.Sound) ||
        this._notificationConfig.sound[`mute${state.charAt(0).toUpperCase() + state.slice(1)}`] ||
        this._isHowlIdMuted) {
      aSev = 0;
    }
    if (!message.value['method'].includes(Methods.Visual)) {
      vSev = 0;
    }

    return { aSev, vSev };
  }

  public setSkMethod(path: string, method: TMethod[]) {
    this.requests.putRequest(`${path}.method`, method, UUID.create());
  }

  public setSkState(path: string, state: string) {
    this.requests.putRequest(`${path}.state`, state, UUID.create());
  }

  public observerNotificationsInfo(): Observable<INotificationInfo> {
    return this._alarmsInfo$.pipe(
      map((info: IAlarmInfo) => {
        let isWarn = false;
        let isAlarmEmergency = false;
        switch (info.visualSev) {
          case 1: isWarn = true; break;
          case 2: isAlarmEmergency = true; break;
        }
        return { ...info, isWarn, isAlarmEmergency } as INotificationInfo;
      })
    );
  }

  // ---- HOWLER FIXED IMPLEMENTATION -----------------------------------------

  private getPlayer(track: number): Howl {
    if (this._players.has(track)) return this._players.get(track);
    const name = alarmTrack[track];
    if (!name) {
      console.warn('[Notification Service] Unknown track id', track);
      return this.getPlayer(1000);
    }
    const player = new Howl({
      src: [`assets/${name}.mp3`],
      autoplay: false,
      preload: true,
      loop: true,
      onloaderror: (_id, err) => {
        console.log("[Notification Service] load error track:", track, err);
      },
      onplayerror: (_id, err) => {
        console.log("[Notification Service] play locked track:", track, err);
        player.once('unlock', () => player.play());
      }
    });
    this._players.set(track, player);
    return player;
  }

  mutePlayer(state: boolean) {
    if (this._activeAlarmSoundtrack != null && this._activeAlarmSoundtrack !== 1000) {
      const p = this._players.get(this._activeAlarmSoundtrack);
      if (p && this._activeHowlId != null) p.mute(state, this._activeHowlId);
    }
    this._isHowlIdMuted = state;
    this.updateNotificationsState();
  }

  playAlarm(trackId: number) {
    if (this._activeAlarmSoundtrack === trackId) return;

    // Stop previous track (do not unload to allow reuse)
    if (this._activeAlarmSoundtrack != null) {
      const prev = this._players.get(this._activeAlarmSoundtrack);
      prev?.stop();
    }

    if (trackId === 1000) {
      this._activeAlarmSoundtrack = 1000;
      this._activeHowlId = null;
      return;
    }

    const player = this.getPlayer(trackId);
    this._activeAlarmSoundtrack = trackId;
    this._activeHowlId = player.play();
    player.mute(this._isHowlIdMuted, this._activeHowlId);
  }

  // --------------------------------------------------------------------------

  public observeNotificationConfiguration(): Observable<INotificationConfig> {
    return this._notificationConfig$.asObservable();
  }

  ngOnDestroy(): void {
    this._notificationSettingsSubscription?.unsubscribe();
    this._resetServiceSubscription?.unsubscribe();
    this._notificationDataStreamSubscription?.unsubscribe();
    this._notificationMetaStreamSubscription?.unsubscribe();

    this._notificationConfig$.complete();
    this._notifications$.complete();
    this._alarmsInfo$.complete();

    // Unload all cached Howl instances
    for (const p of this._players.values()) {
      try { p.unload(); } catch {
        // Intentionally ignore errors during Howl unload
      }
    }
    this._players.clear();
  }
}
