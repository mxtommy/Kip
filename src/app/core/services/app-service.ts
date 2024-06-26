import { Injectable, OnDestroy } from '@angular/core';
import { BehaviorSubject, Observable, Subject, Subscription } from 'rxjs';
import { IStreamStatus, SignalKDeltaService } from './signalk-delta.service';
import { IConnectionConfig } from '../interfaces/app-settings.interfaces';
import { AppSettingsService } from './app-settings.service';
import { DataService } from './data.service';

const modePath: string = 'self.environment.mode';

/**
 * Snack-bar notification message interface.
 */
export interface AppNotification {
  message: string;
  duration: number;
  silent: boolean;
}

/**
 * Kip theme hex colors
 *
 * @export
 * @interface ITheme
 */
export interface ITheme {
  blue: string,
  green: string,
  purple: string,
  yellow: string,
  pink: string,
  orange: string,
  white: string,
  grey: string,
  port: string,
  starboard: string,
  zoneNominal: string,
  zoneAlert: string,
  zoneWarn: string,
  zoneAlarm: string,
  zoneEmergency: string,
  background: string,
}

@Injectable({
  providedIn: 'root'
})
export class AppService implements OnDestroy {
  public autoNightMode: boolean; // from Config value
  private sunValue: string = 'day';
  private dayTheme: string;
  private autoNightDeltaStatus: Subscription = null;
  private autoNightModeSubscription: Subscription = null;
  private autoNightModePathSubscription: Subscription = null;
  private autoNightModeThemeSubscription: Subscription = null;
  public snackbarAppNotifications = new Subject<AppNotification>(); // for snackbar message
  private pathTimer = null;
  public readonly cssThemeColorRoles$ = new BehaviorSubject<ITheme|null>(null);

  constructor(
    private settings: AppSettingsService,
    private delta: SignalKDeltaService,
    private data: DataService,
  ) {
    this.autoNightMode = this.settings.getAutoNightMode();
    this.autoNightModeObserver();
    this.readThemeCssRoleVariables();

  }

  private autoNightModeObserver(): void {
    let deltaStatus = this.delta.getDataStreamStatusAsO(); // wait for delta service to start
    this.autoNightDeltaStatus = deltaStatus.subscribe(stat => {
      stat as IStreamStatus;
      if(stat.operation == 2) {

        this.pathTimer = setTimeout(() => { // Wait for path data to come in on startup
          const autoNightMode: Observable<boolean> = this.settings.getAutoNightModeAsO();

          this.autoNightModeSubscription = autoNightMode.subscribe(mode => {
            this.autoNightMode = mode;
            if (mode) {
              if (this.data.getPathObject(modePath) !== null) {

                // capture none nightMode theme name changes
                this.autoNightModeThemeSubscription = this.settings.getThemeNameAsO().subscribe(theme => {
                  if (theme != 'nightMode')
                  this.dayTheme = theme;
                });

                const connConf: IConnectionConfig = this.settings.getConnectionConfig(); // get app UUUID

                this.autoNightModePathSubscription = this.data.subscribePath(modePath, 'default').subscribe(newValue => {
                  if (newValue.data.value == 'night' && this.sunValue != newValue.data.value) {
                    this.sunValue = newValue.data.value;
                    this.settings.setThemeName('nightMode');
                  } else if (newValue.data.value == 'day' && this.sunValue != newValue.data.value) {
                    this.sunValue = newValue.data.value;
                    this.settings.setThemeName(this.dayTheme);
                  }
                });
              }
            }
          });
        }, 1500);
      }
    });
  }

  public validateAutoNightModeSupported(): boolean {
    if (!this.data.getPathObject(modePath)) {
      this.sendSnackbarNotification("Dependency Error: self.environment.mode path was not found. To enable Automatic Night Mode, verify that the following Signal K requirements are met: 1) The Derived Data plugin is installed and enabled. 2) The plugin's Sun:Sets environment.sun parameter is checked.", 0);
      return false;
    }
    return true;
  }

  public set autoNightModeConfig(isEnabled : boolean) {
    this.settings.setAutoNightMode(isEnabled);
  }

  /**
   * Display Kip Snackbar notification.
   *
   * @param message Text to be displayed.
   * @param duration Display duration in milliseconds before automatic dismissal.
   * Duration value of 0 is indefinite or until use clicks Dismiss button. Defaults
   *  to 10000 of no value is provided.
   * @param silent A boolean that defines if the notification should make no sound.
   * Defaults false.
   */
  public sendSnackbarNotification(message: string, duration: number = 10000, silent: boolean = false) {
    this.snackbarAppNotifications.next({ message: message, duration: duration, silent: silent});
  }

  /**
   * Observable to receive Kip app Snackbar notification. Use in app.component ONLY.
   *
   * @usageNotes To send a Snackbar notification, use sendSnackbarNotification().
   * Notifications are purely client side and have no relationship or
   * interactions with the Signal K server.
   */
  public getSnackbarAppNotifications() {
    return this.snackbarAppNotifications.asObservable();
  }

  private readThemeCssRoleVariables(): void {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const cssThemeRolesColor: ITheme = {
      background: computedStyle.getPropertyValue('--sys-background').trim(),
      blue: computedStyle.getPropertyValue('--kip-blue-color').trim(),
      green: computedStyle.getPropertyValue('--kip-green-color').trim(),
      grey: computedStyle.getPropertyValue('--kip-grey-color').trim(),
      orange: computedStyle.getPropertyValue('--kip-orange-color').trim(),
      pink: computedStyle.getPropertyValue('--kip-pink-color').trim(),
      purple: computedStyle.getPropertyValue('--kip-purple-color').trim(),
      white: computedStyle.getPropertyValue('--kip-white-color').trim(),
      yellow: computedStyle.getPropertyValue('--kip-yellow-color').trim(),
      port: computedStyle.getPropertyValue('--kip-port-color').trim(),
      starboard: computedStyle.getPropertyValue('--kip-starboard-color').trim(),
      zoneNominal: computedStyle.getPropertyValue('--kip-zone-nominal-color').trim(),
      zoneWarn: computedStyle.getPropertyValue('--kip-zone-warn-color').trim(),
      zoneAlert: computedStyle.getPropertyValue('--kip-zone-alert-color').trim(),
      zoneAlarm: computedStyle.getPropertyValue('--kip-zone-alarm-color').trim(),
      zoneEmergency: computedStyle.getPropertyValue('--kip-zone-emergency-color').trim(),
    };
    this.cssThemeColorRoles$.next(cssThemeRolesColor);
  }

  ngOnDestroy(): void {
    this.autoNightModeSubscription?.unsubscribe();
    this.autoNightModePathSubscription?.unsubscribe();
    this.autoNightModeThemeSubscription?.unsubscribe();
    this.autoNightDeltaStatus?.unsubscribe();
    clearTimeout(this.pathTimer);
  }

}
