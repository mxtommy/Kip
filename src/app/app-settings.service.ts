import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { IDataSet } from './data-set.service';
import { ISplitSet } from './layout-splits.service';
import { IWidget } from './widget-manager.service';
import { IUnitDefaults } from './units.service';

import { DefaultAppConfig, DefaultConectionConfig, DefaultWidgetConfig, DefaultLayoutConfig, DefaultThemeConfig } from './config.blank.const';
import { DefaultUnitsConfig } from './config.blank.units.const'
import { DefaultNotificationConfig } from './config.blank.notification.const';
import { DemoAppConfig, DemoConnectionConfig, DemoWidgetConfig, DemoLayoutConfig, DemoThemeConfig } from './config.demo.const';
import { isNumber } from 'util';

const defaultSignalKUrl: SignalKUrl = { url: 'http://demo.signalk.org/signalk', new: true };
const defaultTheme = 'modern-dark';
const configVersion = 8; // used to invalidate old configs.

export interface IAppConfig {
  configVersion: number;
  signalKToken: string;
  kipUUID: string;
  dataSets: IDataSet[];
  unitDefaults: IUnitDefaults;
  notificationConfig: INotificationConfig;
}

export interface IConnectionConfig {
  signalKUrl: string;
  useDeviceToken: boolean;
  loginName: string;
  loginPassword: string;
}

export interface IThemeConfig {
  themeName: string;
}

export interface IWidgetConfig {
  widgets: Array<IWidget>;
}

export interface ILayoutConfig {
  splitSets: ISplitSet[];
  rootSplits: string[];
}

export interface INotificationConfig {
  disableNotifications: boolean;
  menuGrouping: boolean;
  security: {
    disableSecurity: boolean;
  },
  devices: {
    disableDevices: boolean;
    showNormalState: boolean;
  },
  sound: {
    disableSound: boolean;
    muteNormal: boolean;
    muteWarning: boolean;
    muteAlert: boolean;
    muteAlarm: boolean;
    muteEmergency: boolean;
  },
}

export enum ZoneState {
  normal = 0,
  warning = 1,
  alarm = 2,
}
export interface IZone {
  uuid: string;
  path: string;
  unit: string;
  upper: number;
  lower: number;
  state: ZoneState;
}
export interface IZonesConfig {
  zones: Array<IZone>;
}

export interface SignalKUrl {
  url: string;
  new: boolean;
}

export interface SignalKToken {
  token: string;
  timeToLive?: number; // not yet implemented by sk but part of the specs
  isExpired: boolean;
  isNew: boolean;
  isSessionToken: boolean;
}


@Injectable()
export class AppSettingsService {
  signalKUrl: BehaviorSubject<SignalKUrl> = new BehaviorSubject<SignalKUrl>(defaultSignalKUrl); // this should be overwritten right away when loading settings, but you need to give something...
  unlockStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  unitDefaults: BehaviorSubject<IUnitDefaults> = new BehaviorSubject<IUnitDefaults>({});
  themeName: BehaviorSubject<string> = new BehaviorSubject<string>(defaultTheme);
  
  useDeviceToken: boolean = true;
  loginName: string;
  loginPassword: string;

  signalKToken: BehaviorSubject<SignalKToken>;
  kipKNotificationConfig: BehaviorSubject<INotificationConfig>;
  kipUUID: string;

  widgets: Array<IWidget>;
  splitSets: ISplitSet[] = [];
  rootSplits: string[] = [];
  dataSets: IDataSet[] = [];
  zones: BehaviorSubject<Array<IZone>> = new BehaviorSubject<Array<IZone>>([]);
  root

  constructor(private router: Router) {
    let appConfig: IAppConfig;
    let connectionConfig: IConnectionConfig;
    let widgetConfig: IWidgetConfig;
    let layoutConfig: ILayoutConfig;
    let themeConfig: IThemeConfig;
    let zonesConfig: IZonesConfig;

    if (window.localStorage) {
      // localStorage supported

      appConfig = JSON.parse(localStorage.getItem("appConfig"));

      if (appConfig == null) {
        console.log("Error loading App config, resetting and loading all default.");
        localStorage.clear();
        appConfig = this.getDefaultAppConfig();
        connectionConfig = this.getDefaultConnectionConfig();
        widgetConfig = this.getDefaultWidgetConfig();
        layoutConfig = this.getDefaultLayoutConfig();
        themeConfig = this.getDefaultThemeConfig();
        zonesConfig = { zones: [] };
      }

      if (!isNumber(appConfig.configVersion) || (appConfig.configVersion != configVersion)) {
        console.error("Invalid config version, resetting and loading all default.");
        localStorage.clear();
        appConfig = this.getDefaultAppConfig();
        connectionConfig = this.getDefaultConnectionConfig();
        widgetConfig = this.getDefaultWidgetConfig();
        layoutConfig = this.getDefaultLayoutConfig();
        themeConfig = this.getDefaultThemeConfig();
        zonesConfig = { zones: [] };
      } else {
        connectionConfig = this.loadLocalStorageConfig("connectionConfig")
        widgetConfig = this.loadLocalStorageConfig("widgetConfig");
        layoutConfig = this.loadLocalStorageConfig("layoutConfig");
        themeConfig = this.loadLocalStorageConfig("themeConfig");
        zonesConfig = this.loadLocalStorageConfig("zonesConfig");
      }

      this.pushSettings(appConfig, connectionConfig, widgetConfig, layoutConfig, themeConfig, zonesConfig);
    } else {
      console.log("***** LocalStorage NOT SUPPORTED by browser *****\nThis is required by Kip without user authentication configuration enabled...");
    }
  }

  loadLocalStorageConfig(type: string) {
    // we don't support AppConfig here. It needs a version check and full config invalidation.
    let config;
    config = JSON.parse(localStorage.getItem(type));

    if (config == null) {
      console.log("Error loading " + type +  " config. Force loading " + type + " defaults.");
      switch (type) {
        case "connectionConfig":
          config = this.getDefaultConnectionConfig();
          break;

        case "widgetConfig":
          config = this.getDefaultWidgetConfig();
          break;

        case "layoutConfig":
          config = this.getDefaultLayoutConfig();
          break;

        case "themeConfig":
          config = this.getDefaultThemeConfig();
          break;

        case "zonesConfig":
          config = { zones: [] };
          break;
      }
    }
    return config;
  }

  private pushSettings(appConfig: IAppConfig, connectionConfig: IConnectionConfig, widgetConfig: IWidgetConfig, layoutConfig: ILayoutConfig, themeConfig: IThemeConfig, zonesConfig: IZonesConfig) {
    this.themeName.next(themeConfig['themeName']);

    let skUrl: SignalKUrl = {url: connectionConfig.signalKUrl, new: false};
    let skToken: SignalKToken;
    if (!connectionConfig.useDeviceToken) {
      skToken = {token: null, isNew: false, isSessionToken: false, isExpired: false};
    } else {
      skToken = {token: appConfig.signalKToken, isNew: false, isSessionToken: false, isExpired: false};
    }
    this.signalKUrl.next(skUrl);
    this.useDeviceToken = connectionConfig.useDeviceToken;
    this.loginName = connectionConfig.loginName;
    this.loginPassword = connectionConfig.loginPassword;
    this.dataSets = appConfig.dataSets;
    this.unitDefaults.next(appConfig.unitDefaults);
    this.kipKNotificationConfig = new BehaviorSubject<INotificationConfig>(appConfig.notificationConfig);
    this.kipUUID = appConfig.kipUUID;
    this.widgets = widgetConfig.widgets;
    this.zones.next(zonesConfig.zones);
    this.splitSets = layoutConfig.splitSets;
    this.rootSplits = layoutConfig.rootSplits;
    this.signalKToken = new BehaviorSubject<SignalKToken>(skToken);
  }

  //UnitDefaults
  public getDefaultUnitsAsO() {
    return this.unitDefaults.asObservable();
  }
  public getDefaultUnits() {
    return this.unitDefaults.getValue();
  }
  public setDefaultUnits(newDefaults: IUnitDefaults) {
    this.unitDefaults.next(newDefaults);
    this.saveAppConfigToLocalStorage();
  }

  // App config - use by Settings Config Component
  public getAppConfig(): IAppConfig {
    return this.buildAppStorageObject();
  }

  public getConnectionConfig(): IConnectionConfig {
    return this.buildConnectionStorageObject();
  }

  public setConnectionConfig(value: IConnectionConfig) {
    this.loginName = value.loginName;
    this.loginPassword = value.loginPassword;
    this.useDeviceToken = value.useDeviceToken;
    this.saveConnectionConfigToLocalStorage();
  }

  public getWidgetConfig(): IWidgetConfig {
    return this.buildWidgetStorageObject();
  }

  public getLayoutConfig(): ILayoutConfig {
    return this.buildLayoutStorageObject();
  }

  public getThemeConfig(): IThemeConfig {
    return this.buildThemeStorageObject();
  }
  public getZonesConfig(): IZonesConfig {
    return this.buildZonesStorageObject()
  }

  public getKipUUID() {
    return this.kipUUID;
  }

  // SignalKURL
  public getSignalKURLAsO() {
    return this.signalKUrl.asObservable();
  }
  public getSignalKURL() {
    return this.signalKUrl.getValue();
  }
  public setSignalKURL(value: SignalKUrl) {
    this.signalKUrl.next(value);
  }

  // SignalKToken
  public getSignalKTokenAsO() {
    return this.signalKToken.asObservable();
  }
  public getSignalKToken(): SignalKToken {
    return this.signalKToken.getValue();
  }
  public setSignalKToken(token: SignalKToken) {
    let oldToken = this.getSignalKToken();

    if (token.isSessionToken) {
      if (!oldToken.isSessionToken) {
        this.saveAppConfigToLocalStorage();
      }
      this.signalKToken.next(token);

    } else {
      this.signalKToken.next(token);
      this.saveAppConfigToLocalStorage();
    }
  }

  // UnlockStatus
  public getUnlockStatusAsO() {
    return this.unlockStatus.asObservable();
  }
  public setUnlockStatus(value) {
    this.unlockStatus.next(value);
  }

  // Themes
  public getThemeNameAsO() {
    return this.themeName.asObservable();
  }
  public setThemName(newTheme: string) {
    this.themeName.next(newTheme);
    if (newTheme != "nightMode") { // don't save NightMode, only temporary
      this.saveThemeConfigToLocalStorage();
    }
  }
  public getThemeName(): string {
    let config: IThemeConfig = JSON.parse(localStorage.getItem('themeConfig'));;
    return config.themeName;
  }

  // Widgets
  public getWidgets() {
    return this.widgets;
  }
  public saveWidgets(widgets: Array<IWidget>) {
    this.widgets = widgets;
    this.saveWidgetConfigToLocalStorage();
  }

  // Layout SplitSets
  public getSplitSets() {
    return this.splitSets;
  }
  public getRootSplits() {
    return this.rootSplits;
  }
  public saveSplitSets(splitSets) {
    this.splitSets = splitSets;
    this.saveLayoutConfigToLocalStorage();
  }
  public saveRootUUIDs(rootUUIDs) {
    this.rootSplits = rootUUIDs;
    this.saveLayoutConfigToLocalStorage();
  }

  // DataSets
  public saveDataSets(dataSets) {
    this.dataSets = dataSets;
    this.saveAppConfigToLocalStorage();
  }
  public getDataSets() {
    return this.dataSets;
  }

  // Zones
  public saveZones(zones: Array<IZone>) {
    this.zones.next(zones);
    this.saveZonesConfigToLocalStorage();
  }
  public getZonesAsO() {
    return this.zones.asObservable();
  }
  public getZones() {
    return this.zones.getValue();
  }

  // Notification Service Setting
  public getNotificationConfigService() {
    return this.kipKNotificationConfig.asObservable();
  }
  public getNotificationConfig(): INotificationConfig {
    return this.kipKNotificationConfig.getValue();
  }
  public setNotificationConfig(notificationConfig: INotificationConfig) {
    this.kipKNotificationConfig.next(notificationConfig);
    this.saveAppConfigToLocalStorage();
  }

  //Config manipulation: RAW and SignalK server - used by Settings Config Component
  public resetSettings() {
    localStorage.clear();
    this.reloadApp();
  }

  /**
   * Updates keys of localStorage config and reloads apps if required to apply new config. IMPORTANT NOTE: Kip does not apply config unless app is reloaded
   * @param configType String of either appConfig, widgetConfig, layoutConfig or themeConfig.
   * @param newConfig Object containing config. Of type IAppConfig, IWidgetConfig, ILayoutConfig or IThemeConfig
   * @param reloadApp Optional Boolean. If True reloads the app, else does nothing. Defaults to False.
   */
  public replaceConfig(configType: string, newConfig: string, reloadApp?: boolean) {
    localStorage.setItem(configType, newConfig);
    if (reloadApp) {
      this.reloadApp();
    }
  }

  public loadDemoConfig() {
    localStorage.clear();
    this.replaceConfig("appConfig", JSON.stringify(DemoAppConfig));
    this.replaceConfig("connectionConfig", JSON.stringify(DemoConnectionConfig));
    this.replaceConfig("widgetConfig", JSON.stringify(DemoWidgetConfig));
    this.replaceConfig("layoutConfig", JSON.stringify(DemoLayoutConfig));
    this.replaceConfig("themeConfig", JSON.stringify(DemoThemeConfig), true);
  }

  public reloadApp() {
    this.router.navigate(['/']);
    setTimeout(()=>{ location.reload() }, 200);
  }
  //// Storage Objects
  // building from running data
  private buildAppStorageObject() {
    let deviceToken = null;

    if (this.useDeviceToken) { // We only save the token if it's a device token. User token are session specific and expire.
      deviceToken = this.signalKToken.getValue().token;
    }

    let storageObject: IAppConfig = {
      configVersion: configVersion,
      kipUUID: this.kipUUID,
      signalKToken: deviceToken,
      dataSets: this.dataSets,
      unitDefaults: this.unitDefaults.getValue(),
      notificationConfig: this.kipKNotificationConfig.getValue(),
    }
    return storageObject;
  }

  private buildConnectionStorageObject() {
    let storageObject: IConnectionConfig = {
      signalKUrl: this.signalKUrl.getValue().url,
      useDeviceToken: this.useDeviceToken,
      loginName: this.loginName,
      loginPassword: this.loginPassword,
    }
    return storageObject;
  }

  private buildWidgetStorageObject() {
    let storageObject: IWidgetConfig = {
      widgets: this.widgets,
      }
    return storageObject;
  }

  private buildLayoutStorageObject() {
    let storageObject: ILayoutConfig = {
      splitSets: this.splitSets,
      rootSplits: this.rootSplits,
      }
    return storageObject;
  }

  private buildThemeStorageObject() {
    let storageObject: IThemeConfig = {
      themeName: this.themeName.getValue()
      }
    return storageObject;
  }

  private buildZonesStorageObject() {
    let storageObject: IZonesConfig = {
      zones: this.zones.getValue()
      }
    return storageObject;
  }

  //Saving to Storage
  private saveAppConfigToLocalStorage() {
    console.log("[AppSettings Service] Saving Application config to LocalStorage");
    localStorage.setItem('appConfig', JSON.stringify(this.buildAppStorageObject()));
  }

  private saveConnectionConfigToLocalStorage() {
    console.log("[AppSettings Service] Saving Connection config to LocalStorage");
    localStorage.setItem('connectionConfig', JSON.stringify(this.buildConnectionStorageObject()));
  }

  private saveWidgetConfigToLocalStorage() {
    console.log("[AppSettings Service] Saving Widgets config to LocalStorage");
    localStorage.setItem('widgetConfig', JSON.stringify(this.buildWidgetStorageObject()));
  }

  private saveLayoutConfigToLocalStorage() {
    console.log("[AppSettings Service] Saving Layouts config to LocalStorage");
    localStorage.setItem('layoutConfig', JSON.stringify(this.buildLayoutStorageObject()));
  }

  private saveThemeConfigToLocalStorage() {
    console.log("S[AppSettings Service] aving Theme config to LocalStorage");
    localStorage.setItem('themeConfig', JSON.stringify(this.buildThemeStorageObject()));
  }

  private saveZonesConfigToLocalStorage() {
    console.log("[AppSettings Service] Saving Zones config to LocalStorage");
    localStorage.setItem('zonesConfig', JSON.stringify(this.buildZonesStorageObject()));
  }

  // Private Defaults Loading functions
  private getDefaultAppConfig(): IAppConfig {
    let config: IAppConfig = DefaultAppConfig;
    config.notificationConfig = DefaultNotificationConfig;
    config.unitDefaults = DefaultUnitsConfig;
    config['configVersion'] = configVersion;
    config.kipUUID = this.newUuid();
    localStorage.setItem('appConfig', JSON.stringify(config));
    return config;
  }

  private getDefaultConnectionConfig(): IConnectionConfig {
    let config: IConnectionConfig = DefaultConectionConfig;
    config.signalKUrl = window.location.origin;
    localStorage.setItem('connectionConfig', JSON.stringify(config));
    return config;
  }

  private getDefaultWidgetConfig(): IWidgetConfig {
    let config: IWidgetConfig = DefaultWidgetConfig;
    localStorage.setItem("widgetConfig", JSON.stringify(config));
    return config;
  }

  private getDefaultLayoutConfig(): ILayoutConfig {
    let config: ILayoutConfig = DefaultLayoutConfig;
    localStorage.setItem("layoutConfig", JSON.stringify(config));
    return config;
  }

  private getDefaultThemeConfig(): IThemeConfig {
    let config: IThemeConfig = DefaultThemeConfig;
    localStorage.setItem("themeConfig", JSON.stringify(config));
    return config;
  }


  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }

}
