import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject, Subscription } from 'rxjs';
import { IStreamStatus, SignalKDeltaService } from './signalk-delta.service';
import { IConnectionConfig } from '../interfaces/app-settings.interfaces';
import { AppSettingsService } from './app-settings.service';
import { SignalKDataService } from './signalk-data.service';

const modePath: string = 'self.environment.mode';

/**
 * Snack-bar notification message interface.
 */
export interface AppNotification {
  message: string;
  duration: number;
  silent: boolean;
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

  constructor(
    private settings: AppSettingsService,
    private delta: SignalKDeltaService,
    private sk: SignalKDataService,
  ) {
    this.autoNightMode = this.settings.getAutoNightMode();
    this.autoNightModeObserver();
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
              if (this.sk.getPathObject(modePath) !== null) {

                // capture none nightMode theme name changes
                this.autoNightModeThemeSubscription = this.settings.getThemeNameAsO().subscribe(theme => {
                  if (theme != 'nightMode')
                  this.dayTheme = theme;
                });

                const connConf: IConnectionConfig = this.settings.getConnectionConfig(); // get app UUUID

                this.autoNightModePathSubscription = this.sk.subscribePath(connConf.kipUUID, modePath, 'default').subscribe(mode => {
                  if (mode.value == 'night' && this.sunValue != mode.value) {
                    this.sunValue = mode.value;
                    this.settings.setThemeName('nightMode');
                  } else if (mode.value == 'day' && this.sunValue != mode.value) {
                    this.sunValue = mode.value;
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
    if (!this.sk.getPathObject(modePath)) {
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

  ngOnDestroy(): void {
    this.autoNightModeSubscription?.unsubscribe();
    this.autoNightModePathSubscription?.unsubscribe();
    this.autoNightModeThemeSubscription?.unsubscribe();
    this.autoNightDeltaStatus?.unsubscribe();
    clearTimeout(this.pathTimer);
  }

}
