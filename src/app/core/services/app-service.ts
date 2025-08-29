import { effect, inject, Injectable, signal, untracked } from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import { DomSanitizer } from '@angular/platform-browser';
import { BehaviorSubject, Subject } from 'rxjs';
import { AppSettingsService } from './app-settings.service';
import { DataService } from './data.service';
import { toSignal } from '@angular/core/rxjs-interop';
import packageInfo from '../../../../package.json';

/**
 * Snack-bar notification message interface.
 */
export interface AppNotification {
  message: string;
  action?: string;
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
  contrast: string,
  contrastDim: string,
  contrastDimmer: string,
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
export class AppService {
  readonly MODE_PATH: string = 'self.environment.mode';
  public readonly configurableThemeColors: {label: string, value: string}[] = [
    {label: "Contrast", value: "contrast"},
    {label: "Blue", value: "blue"},
    {label: "Green", value: "green"},
    {label: "Orange", value: "orange"},
    {label: "Yellow", value: "yellow"},
    {label: "Pink", value: "pink"},
    {label: "Purple", value: "purple"},
    {label: "Grey", value: "grey"}
  ];
  public snackbarAppNotifications = new Subject<AppNotification>(); // for snackbar message
  public readonly cssThemeColorRoles$ = new BehaviorSubject<ITheme|null>(null);
  private _cssThemeColorRoles: ITheme = null;
  private readonly _settings = inject(AppSettingsService);
  private readonly _data = inject(DataService);
  private readonly _iconRegistry = inject(MatIconRegistry);
  private readonly _sanitizer = inject(DomSanitizer);
  public isNightMode = signal<boolean>(false);
  private _useAutoNightMode = toSignal(this._settings.getAutoNightModeAsO(), { requireSync: true });
  private _theme = toSignal(this._settings.getThemeNameAsO(), { requireSync: true });
  private _redNightMode = toSignal(this._settings.getRedNightModeAsO(), { requireSync: true });
  private _environmentMode = toSignal(this._data.subscribePath(this.MODE_PATH, 'default'));

  public readonly appVersion = signal<string>(packageInfo.version);
  public readonly browserVersion = signal<string>('Unknown');
  public readonly osVersion = signal<string>('Unknown');

  constructor() {
    // Register SVG icon set globally (only once)
    this._iconRegistry.addSvgIconSet(
      this._sanitizer.bypassSecurityTrustResourceUrl('assets/svg/icons.svg')
    );

    effect(() => {
      if (this._theme() === 'light-theme') {
        document.body.classList.toggle('light-theme', this._theme() === 'light-theme');
      } else {
        // Remove the light theme class if it exists
        document.body.classList.remove('light-theme');
      }
    });

    effect(() => {
      const mode = this._environmentMode().data.value;
      if (this._useAutoNightMode()) {
        this.isNightMode.set(mode === "night");
        this.toggleDayNightMode();
      }
    });

    effect(() => {
      const redNightMode = this._redNightMode();

      untracked(() => {
        if (redNightMode) {
          this.toggleDayNightMode();
        } else {
          this.toggleDayNightMode();
        }
      });
    });

    this.readThemeCssRoleVariables();
    this._cssThemeColorRoles = this.cssThemeColorRoles$.getValue();

    this.browserVersion.set(this.getBrowserVersion());
    this.osVersion.set(this.getOSVersion());

    console.log("*********** KIP Version Information ***********");
    console.log(`** App Version: ${this.appVersion()}`);
    console.log(`** Browser Version: ${this.browserVersion()}`);
    console.log(`** OS Version: ${this.osVersion()}`);
    console.log("***********************************************");
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
  public sendSnackbarNotification(message: string, duration = 10000, silent = false, action = "Dismiss") {
    this.snackbarAppNotifications.next({ message: message, duration: duration, silent: silent, action: action });
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
    const root = document.body;
    const computedStyle = getComputedStyle(root);
    const cssThemeRolesColor: ITheme = {
      background: computedStyle.getPropertyValue('--mat-sys-background').trim(),
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
      contrast: computedStyle.getPropertyValue('--kip-contrast-color').trim(),
      contrastDim: computedStyle.getPropertyValue('--kip-contrast-dim-color').trim(),
      contrastDimmer: computedStyle.getPropertyValue('--kip-contrast-dimmer-color').trim(),
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

  public setBrightness(brightness: number, applyNightFilters = false): void {
    const appFilterWrapper = document.body;

    // Set the brightness level
    appFilterWrapper.style.setProperty('--kip-nightModeBrightness', `${brightness}`);

    // Apply sepia and hue-rotate filters if night mode is active
    const additionalFilters = applyNightFilters ? ' sepia(0.5) hue-rotate(-30deg)' : '';
    appFilterWrapper.style.setProperty('--kip-nightModeFilters', additionalFilters);
  }

  public toggleDayNightMode(): void {
    if (this.isNightMode()) {
      if (this._redNightMode()) {
        document.body.classList.toggle('night-theme', true);
        this.setBrightness(1, false);
      } else {
        this.setBrightness(this._settings.getNightModeBrightness(), true);
        document.body.classList.remove('night-theme');
        if (this._theme() === 'light-theme') {
          document.body.classList.toggle('light-theme', this._theme() === 'light-theme');
        } else {
          document.body.classList.remove('light-theme');
        }
      }

    } else {
      document.body.classList.remove('night-theme');
      if (this._theme() === 'light-theme') {
        document.body.classList.toggle('light-theme', this._theme() === 'light-theme');
      }
      this.setBrightness(1, false);
    }
    this.readThemeCssRoleVariables();
    this._cssThemeColorRoles = this.cssThemeColorRoles$.getValue();
  }

  /**
   * Helper method to get the browser version.
   */
  private getBrowserVersion(): string {
    const userAgent = navigator.userAgent;
    let browser = 'Unknown';

    if (userAgent.includes('Edg')) {
      browser = `Edge ${userAgent.match(/Edg\/(\d+)/)?.[1]}`;
    } else if (userAgent.includes('Chrome') && !userAgent.includes('Edg') && !userAgent.includes('Chromium')) {
      browser = `Chrome ${userAgent.match(/Chrome\/(\d+)/)?.[1]}`;
    } else if (userAgent.includes('Chromium')) {
      browser = `Chromium ${userAgent.match(/Chromium\/(\d+)/)?.[1]}`;
    } else if (userAgent.includes('Firefox')) {
      browser = `Firefox ${userAgent.match(/Firefox\/(\d+)/)?.[1]}`;
    } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome') && !userAgent.includes('Chromium')) {
      browser = `Safari ${userAgent.match(/Version\/(\d+)/)?.[1]}`;
    } else if (userAgent.includes('Opera') || userAgent.includes('OPR')) {
      browser = `Opera ${userAgent.match(/(Opera|OPR)\/(\d+)/)?.[2]}`;
    }

    return browser;
  }

  /**
   * Helper method to get the OS version.
   */
  private getOSVersion(): string {
    const platform = navigator.platform;
    const userAgent = navigator.userAgent;

    if (platform.startsWith('Mac')) {
      return 'macOS';
    } else if (platform.startsWith('Win')) {
      return 'Windows';
    } else if (/Linux/.test(platform)) {
      // Check for Raspberry Pi identifiers in the userAgent or platform
      if (
        userAgent.includes('ARM') ||
        userAgent.includes('aarch64') ||
        userAgent.includes('Raspberry') ||
        platform.includes('armv7l') ||
        platform.includes('armv8l')
      ) {
        return 'Raspberry Pi';
      }
      return 'Linux';
    } else {
      return 'Unknown OS';
    }
  }
}
