/**
 * This Service handles app notifications sent by the Signal K server.
 */
import { Injectable, OnDestroy, inject } from '@angular/core';
import { BehaviorSubject, map, Observable, Subscription } from 'rxjs';
import { SettingsService } from "./settings.service";
import { ToastService } from './toast.service';
import { INotificationConfig } from '../interfaces/app-settings.interfaces';
import { DefaultNotificationConfig } from '../../../default-config/config.blank.notification.const';
import { SignalkRequestsService } from './signalk-requests.service';
import { DataService } from './data.service';
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
  private settings = inject(SettingsService);
  private toastService = inject(ToastService);
  private audioBlockedNotificationShown = false;
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

  // --- HTMLAudioElement (audio) state ----------------------------------------
  // Cache one player per track id and reuse across switches.
  private _players = new Map<number, HTMLAudioElement>();
  private _activeAlarmSoundtrack: number = null;
  private _isMuted = false;

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

  private emitNotifications(): void {
    // Emit a new array reference so signal-based consumers (toSignal/computed/effect)
    // are notified even when we mutate the internal array in-place.
    this._notifications$.next([...this._notifications]);
  }

  /**
   * Stream of all known notification entries keyed by Signal K path.
   *
   * Notes:
   * - The array may contain entries with only `meta` (no `value`) when a notification was deleted
   *   but metadata has been received.
   * - Consumers should treat emitted arrays/items as read-only.
   */
  public observeNotifications(): Observable<INotification[]> {
    return this._notifications$.asObservable();
  }

  private addValue(msg: ISignalKDataValueUpdate) {
    this._notifications.push({ path: msg.path, value: msg.value });
    this.updateNotificationsState();
    this.emitNotifications();
  }

  private updateValue(msg: ISignalKDataValueUpdate) {
    const idx = this._notifications.findIndex(item => item.path == msg.path);
    if (idx >= 0) {
      const prev = this._notifications[idx];
      this._notifications[idx] = { ...prev, value: { ...msg.value } };
      this.updateNotificationsState();
      this.emitNotifications();
    } else {
      console.log("[Notification Service] Update path not found for: " + msg.path);
    }
  }

  private deleteValue(path: string): void {
    const idx = this._notifications.findIndex(n => n.path == path);
    if (idx >= 0) {
      const prev = this._notifications[idx];
      // Keep the notification entry (and any meta) but remove its live value.
      this._notifications[idx] = { ...prev, value: undefined };
      this.updateNotificationsState();
      this.emitNotifications();
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
      isMuted: this._isMuted
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
    const idx = this._notifications.findIndex(i => i.path == metaDelta.path);
    if (idx >= 0) {
      const prev = this._notifications[idx];
      this._notifications[idx] = { ...prev, meta: metaDelta.meta };
    } else {
      this._notifications.push({ path: metaDelta.path, meta: metaDelta.meta });
    }
    this.emitNotifications();
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
        this._isMuted) {
      aSev = 0;
    }
    if (!message.value['method'].includes(Methods.Visual)) {
      vSev = 0;
    }

    return { aSev, vSev };
  }

  /**
   * Sends a Signal K PUT to update the notification method(s) for the given notification path.
   *
   * The method array typically contains `Methods.Sound` and/or `Methods.Visual`.
   *
   * @param path Notification base path (e.g. `notifications.xxx.yyy`).
   * @param method Method list to apply.
   */
  public setSkMethod(path: string, method: TMethod[]) {
    this.requests.putRequest(`${path}.method`, method, UUID.create());
  }

  /**
   * Sends a Signal K PUT to update the notification state for the given notification path.
   *
   * @param path Notification base path (e.g. `notifications.xxx.yyy`).
   * @param state Signal K state string (see `States`).
   */
  public setSkState(path: string, state: string) {
    this.requests.putRequest(`${path}.state`, state, UUID.create());
  }

  /**
   * Stream of aggregated alarm info used by the UI for badges/visual state.
   *
   * Derived from the current notifications list, user settings, and mute state.
   */
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

  private getPlayer(track: number): HTMLAudioElement {
    const existing = this._players.get(track);
    if (existing) return existing;
    const name = alarmTrack[track];
    if (!name) {
      console.warn('[Notification Service] Unknown track id', track);
      return this.getPlayer(1000);
    }
    const player = new Audio(`assets/${name}.mp3`);
    player.preload = 'auto';
    player.loop = true;
    player.muted = this._isMuted;
    this._players.set(track, player);
    return player;
  }

  /**
   * Mutes/unmutes the currently playing alarm sound (if any).
   *
   * Also updates the emitted alarm summary (`isMuted`) and may influence computed audio severity.
   */
  mutePlayer(state: boolean) {
    if (this._activeAlarmSoundtrack != null && this._activeAlarmSoundtrack !== 1000) {
      const p = this._players.get(this._activeAlarmSoundtrack);
      if (p) p.muted = state;
    }
    this._isMuted = state;
    this.updateNotificationsState();
  }

  /**
   * Switches the active looping alarm track.
   *
   * Track ids map to: 1000=stop/silent, 1001=alert, 1002=warn, 1003=alarm, 1004=emergency.
   * This stops the previously active audio player (but keeps it cached for reuse).
   */
  playAlarm(trackId: number) {
    if (this._activeAlarmSoundtrack === trackId) return;

    // Stop previous track (do not unload to allow reuse)
    if (this._activeAlarmSoundtrack != null) {
      const prev = this._players.get(this._activeAlarmSoundtrack);
      if (prev) {
        prev.pause();
        prev.currentTime = 0;
      }
    }

    if (trackId === 1000) {
      this._activeAlarmSoundtrack = 1000;
      return;
    }

    const player = this.getPlayer(trackId);
    this._activeAlarmSoundtrack = trackId;
    player.muted = this._isMuted;
    player.currentTime = 0;
    player.play().catch(err => {
      // Autoplay blocked by browser policy - requires user interaction first
      console.debug('Alarm audio playback blocked:', err.message);
      if (!this.audioBlockedNotificationShown) {
        this.audioBlockedNotificationShown = true;
        // Show persistent toast requiring user interaction to dismiss
        const blockRef = this.toastService.show(
          'Alarm sounds blocked by browser. Closing this message will enable audio.',
          0, // No timeout - requires user to close
          true, // Silent to avoid recursion
          'warn'
        );
        // Reset flag when user dismisses, allowing audio to work after interaction
        blockRef.afterDismissed().subscribe(() => {
          this.audioBlockedNotificationShown = false;
        });
      }
    });
  }

  /**
   * Stream of the current notification configuration used by this service.
   * Emits whenever settings are changed.
   */
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

    // Stop and release all cached audio players
    for (const p of this._players.values()) {
      try {
        p.pause();
        p.currentTime = 0;
        p.src = '';
      } catch {
        // ignore audio cleanup errors
      }
    }
    this._players.clear();
  }
}
