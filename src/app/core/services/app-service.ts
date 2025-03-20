import { inject, Injectable, OnDestroy, signal } from '@angular/core';
import { BehaviorSubject, Subject, Subscription } from 'rxjs';
import { IStreamStatus, SignalKDeltaService } from './signalk-delta.service';
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
  blueDim: string,
  blueDimmer: string,
  green: string,
  greenDim: string,
  greenDimmer: string,
  purple: string,
  purpleDim: string,
  purpleDimmer: string,
  yellow: string,
  yellowDim: string,
  yellowDimmer: string,
  pink: string,
  pinkDim: string,
  pinkDimmer: string,
  orange: string,
  orangeDim: string,
  orangeDimmer: string,
  white: string,
  whiteDim: string,
  whiteDimmer: string,
  grey: string,
  greyDim: string,
  greyDimmer: string,
  port: string,
  starboard: string,
  zoneNominal: string,
  zoneAlert: string,
  zoneWarn: string,
  zoneAlarm: string,
  zoneEmergency: string,
  background: string,
  cardColor: string,
}

@Injectable({
  providedIn: 'root'
})
export class AppService implements OnDestroy {
  public readonly configurableThemeColors: {label: string, value: string}[] = [
    {label: "White", value: "white"},
    {label: "Blue", value: "blue"},
    {label: "Green", value: "green"},
    {label: "Orange", value: "orange"},
    {label: "Yellow", value: "yellow"},
    {label: "Pink", value: "pink"},
    {label: "Purple", value: "purple"},
    {label: "Grey", value: "grey"}
  ];
  public isNightMode = signal<boolean>(false);
  private _autoNightDeltaStatus: Subscription = null;
  private _autoNightModeSubscription: Subscription = null;
  private _environmentModePathSubscription: Subscription = null;
  private _autoNightModeThemeSubscription: Subscription = null;

  public snackbarAppNotifications = new Subject<AppNotification>(); // for snackbar message
  public readonly cssThemeColorRoles$ = new BehaviorSubject<ITheme|null>(null);
  private readonly _cssThemeColorRoles: ITheme = null;
  private _settings = inject(AppSettingsService);
  private _delta = inject(SignalKDeltaService);
  private _data = inject(DataService);

  constructor() {
    this.autoNightModeObserver();
    this.readThemeCssRoleVariables();
    this._cssThemeColorRoles = this.cssThemeColorRoles$.getValue();
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
      cardColor: computedStyle.getPropertyValue('--kip-widget-card-background-color').trim(),
      blue: computedStyle.getPropertyValue('--kip-blue-color').trim(),
      blueDim: computedStyle.getPropertyValue('--kip-blue-dim-color').trim(),
      blueDimmer: computedStyle.getPropertyValue('--kip-blue-dimmer-color').trim(),
      green: computedStyle.getPropertyValue('--kip-green-color').trim(),
      greenDim: computedStyle.getPropertyValue('--kip-green-dim-color').trim(),
      greenDimmer: computedStyle.getPropertyValue('--kip-green-dimmer-color').trim(),
      grey: computedStyle.getPropertyValue('--kip-grey-color').trim(),
      greyDim: computedStyle.getPropertyValue('--kip-grey-dim-color').trim(),
      greyDimmer: computedStyle.getPropertyValue('--kip-grey-dimmer-color').trim(),
      orange: computedStyle.getPropertyValue('--kip-orange-color').trim(),
      orangeDim: computedStyle.getPropertyValue('--kip-orange-dim-color').trim(),
      orangeDimmer: computedStyle.getPropertyValue('--kip-orange-dimmer-color').trim(),
      pink: computedStyle.getPropertyValue('--kip-pink-color').trim(),
      pinkDim: computedStyle.getPropertyValue('--kip-pink-dim-color').trim(),
      pinkDimmer: computedStyle.getPropertyValue('--kip-pink-dimmer-color').trim(),
      purple: computedStyle.getPropertyValue('--kip-purple-color').trim(),
      purpleDim: computedStyle.getPropertyValue('--kip-purple-dim-color').trim(),
      purpleDimmer: computedStyle.getPropertyValue('--kip-purple-dimmer-color').trim(),
      white: computedStyle.getPropertyValue('--kip-white-color').trim(),
      whiteDim: computedStyle.getPropertyValue('--kip-white-dim-color').trim(),
      whiteDimmer: computedStyle.getPropertyValue('--kip-white-dimmer-color').trim(),
      yellow: computedStyle.getPropertyValue('--kip-yellow-color').trim(),
      yellowDim: computedStyle.getPropertyValue('--kip-yellow-dim-color').trim(),
      yellowDimmer: computedStyle.getPropertyValue('--kip-yellow-dimmer-color').trim(),
      port: computedStyle.getPropertyValue('--kip-port-color').trim(),
      starboard: computedStyle.getPropertyValue('--kip-starboard-color').trim(),
      zoneNominal: computedStyle.getPropertyValue('--kip-zone-nominal-color').trim(),
      zoneAlert: computedStyle.getPropertyValue('--kip-zone-alert-color').trim(),
      zoneWarn: computedStyle.getPropertyValue('--kip-zone-warn-color').trim(),
      zoneAlarm: computedStyle.getPropertyValue('--kip-zone-alarm-color').trim(),
      zoneEmergency: computedStyle.getPropertyValue('--kip-zone-emergency-color').trim(),
    };
    this.cssThemeColorRoles$.next(cssThemeRolesColor);
  }

  public get cssThemeColors() : ITheme {
    return this._cssThemeColorRoles;
  }

  public setBrightness(brightness: number): void {
    const root = document.documentElement;
    root.style.setProperty('--kip-nightModeBrightness', `${brightness}`);
  }

  public toggleDayNightMode(mode: string): void {
    switch (mode) {
      case 'day':
        this.setBrightness(1);
        this.isNightMode.set(false);
        break;

      case 'night':
        this.setBrightness(this._settings.getNightModeBrightness());
        this.isNightMode.set(true);
        break;

      default:
        break;
    }
  }

  private autoNightModeObserver(): void {
    this._autoNightModeSubscription = this._settings.getAutoNightModeAsO().subscribe(modeEnabled => {
      if (modeEnabled) {
        this.environmentModeObserver();
      } else {
        this._environmentModePathSubscription?.unsubscribe();
      }
    });
  }

  private environmentModeObserver(): void {
    const deltaStatus = this._delta.getDataStreamStatusAsO(); // wait for delta service to start
    this._autoNightDeltaStatus = deltaStatus.subscribe(stat => {
      stat as IStreamStatus;
      if(stat.operation == 2) {
          this._environmentModePathSubscription = this._data.subscribePath(modePath, 'default').subscribe(path => {
            if (this._settings.getAutoNightMode()) {
              path.data.value === 'night' ? this.toggleDayNightMode('night') : this.toggleDayNightMode('day');
            }
          });
      }
    });
  }

  public  validateAutoNightModeSupported(): boolean {
    if (!this._data.getPathObject(modePath)) {
      this.sendSnackbarNotification("Dependency Error: self.environment.mode path was not found. To enable Automatic Night Mode, verify that the following Signal K requirements are met: 1) The Derived Data plugin is installed and enabled. 2) The plugin's Sun:Sets environment.sun parameter is checked.", 0);
      return false;
    }
    return true;
  }

  ngOnDestroy(): void {
    this._autoNightModeSubscription?.unsubscribe();
    this._environmentModePathSubscription?.unsubscribe();
    this._autoNightModeThemeSubscription?.unsubscribe();
    this._autoNightDeltaStatus?.unsubscribe();
  }

}
