import { StorageService } from './storage.service';
import { AppInitService } from './app-init.service';
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { IDataSet } from './data-set.service';
import { ISplitSet } from './layout-splits.service';
import { IWidget } from './widget-manager.service';
import { IUnitDefaults } from './units.service';

import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig, IWidgetConfig, ILayoutConfig, IZonesConfig, INotificationConfig, IZone } from "./app-settings.interfaces";
import { DefaultAppConfig, DefaultConectionConfig, DefaultWidgetConfig, DefaultLayoutConfig, DefaultThemeConfig, DefaultZonesConfig } from './config.blank.const';
import { DefaultUnitsConfig } from './config.blank.units.const'
import { DefaultNotificationConfig } from './config.blank.notification.const';
import { DemoAppConfig, DemoConnectionConfig, DemoWidgetConfig, DemoLayoutConfig, DemoThemeConfig, DemoZonesConfig } from './config.demo.const';

const defaultTheme = 'modern-dark';
const configVersion = 9; // used to invalidate old configs.
const connectionConfigVersion = configVersion; // used to invalidate old configs.

export interface SignalKUrl {
  url: string;
  new: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class AppSettingsService {
  public unlockStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  public unitDefaults: BehaviorSubject<IUnitDefaults> = new BehaviorSubject<IUnitDefaults>({});
  public themeName: BehaviorSubject<string> = new BehaviorSubject<string>(defaultTheme);
  public kipKNotificationConfig: BehaviorSubject<INotificationConfig>;

  private useDeviceToken: boolean = false;
  private loginName: string;
  private loginPassword: string;
  public useSharedConfig: boolean;
  private sharedConfigName: string;

  private kipUUID: string;
  public signalkUrl: SignalKUrl;
  widgets: Array<IWidget>;
  splitSets: ISplitSet[] = [];
  rootSplits: string[] = [];
  dataSets: IDataSet[] = [];
  zones: BehaviorSubject<Array<IZone>> = new BehaviorSubject<Array<IZone>>([]);
  root

  constructor(
    private router: Router,
    private storageService: StorageService,
    private appInitService: AppInitService
    )
  {
    this.storageService.activeConfigVersion = configVersion;
    let serverConfig: IConfig = this.appInitService.serverConfig;
    let appConfig: IAppConfig;
    let connectionConfig: IConnectionConfig;
    let widgetConfig: IWidgetConfig;
    let layoutConfig: ILayoutConfig;
    let themeConfig: IThemeConfig;
    let zonesConfig: IZonesConfig;

    if (window.localStorage) {
      // localStorage supported
      connectionConfig = JSON.parse(localStorage.getItem("connectionConfig"));

      if (connectionConfig === null) {
        console.log("[AppSettings Service] No connectionConfig present in local storage. Loading default.");
        connectionConfig = this.getDefaultConnectionConfig();
      }

      if (serverConfig) {
        console.log("[AppSettings Service] Loading remote server config");
        appConfig = serverConfig.app;
      } else {
        console.log("[AppSettings Service] Loading LocalStorage config");
        appConfig = JSON.parse(localStorage.getItem("appConfig"));
      }

      if (appConfig === null) {
        console.log("[AppSettings Service] Empty or incorrect App config. Resetting and loading defaults");
        localStorage.clear();
        appConfig = this.getDefaultAppConfig();
        connectionConfig = this.getDefaultConnectionConfig();
        widgetConfig = this.getDefaultWidgetConfig();
        layoutConfig = this.getDefaultLayoutConfig();
        themeConfig = this.getDefaultThemeConfig();
        zonesConfig = this.getDefaultZonesConfig();
      }

      if ((typeof appConfig.configVersion !== 'number') || (appConfig.configVersion != configVersion)) {
        console.error("[AppSettings Service] Invalid config version, resetting and loading all default.");
        // we don't remove connectionConfig. It only hold: url, use, pwd, kipUUID, etc. Those
        // values can and should stay local and persist over time
        localStorage.removeItem("appConfig");
        localStorage.removeItem("widgetConfig");
        localStorage.removeItem("layoutConfig");
        localStorage.removeItem("themeConfig");
        localStorage.removeItem("zonesConfig");
        // get defaults
        appConfig = this.getDefaultAppConfig();
        connectionConfig = this.getDefaultConnectionConfig();
        widgetConfig = this.getDefaultWidgetConfig();
        layoutConfig = this.getDefaultLayoutConfig();
        themeConfig = this.getDefaultThemeConfig();
        zonesConfig = this.getDefaultZonesConfig();
      } else {
        if (serverConfig) {
          //TODO: Make use of Config parent object everywhere
          widgetConfig = serverConfig.widget;
          layoutConfig = serverConfig.layout;
          themeConfig = serverConfig.theme;
          zonesConfig = serverConfig.zones;
        } else {
          widgetConfig = this.loadConfigFromLocalStorage("widgetConfig");
          layoutConfig = this.loadConfigFromLocalStorage("layoutConfig");
          themeConfig = this.loadConfigFromLocalStorage("themeConfig");
          zonesConfig = this.loadConfigFromLocalStorage("zonesConfig");
        }
      }

      this.pushSettings(appConfig, connectionConfig, widgetConfig, layoutConfig, themeConfig, zonesConfig);

    } else {
      console.error("[AppSettings Service] LocalStorage NOT SUPPORTED by browser\nThis is a requirement to run Kip. See browser documentation to enable this feature.");
    }

    function test() {
      let connectionConfig: IConnectionConfig;
      return connectionConfig;
    }
  }

  private loadConfigFromLocalStorage(type: string) {
    // we don't support AppConfig here. It needs a version check and full config invalidation.
    let config;
    config = JSON.parse(localStorage.getItem(type));

    if (config == null) {
      console.log("[AppSettings Service] Error loading " + type +  " config. Force loading " + type + " defaults.");
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

  private pushSettings(appConfig: IAppConfig, connectionConfig: IConnectionConfig, widgetConfig: IWidgetConfig, layoutConfig: ILayoutConfig, themeConfig: IThemeConfig, zonesConfig: IZonesConfig): void {
    this.themeName.next(themeConfig['themeName']);

    this.signalkUrl = {url: connectionConfig.signalKUrl, new: false};
    this.useDeviceToken = connectionConfig.useDeviceToken;
    this.loginName = connectionConfig.loginName;
    this.loginPassword = connectionConfig.loginPassword;
    this.useSharedConfig = connectionConfig.useSharedConfig;
    this.sharedConfigName = connectionConfig.sharedConfigName;
    this.dataSets = appConfig.dataSets;
    this.unitDefaults.next(appConfig.unitDefaults);
    this.kipKNotificationConfig = new BehaviorSubject<INotificationConfig>(appConfig.notificationConfig);
    this.kipUUID = connectionConfig.kipUUID;
    this.widgets = widgetConfig.widgets;
    this.zones.next(zonesConfig.zones);
    this.splitSets = layoutConfig.splitSets;
    this.rootSplits = layoutConfig.rootSplits;
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
    this.useSharedConfig = value.useSharedConfig;
    if (!value.useSharedConfig) {
      this.useDeviceToken = true;
    } else this.useDeviceToken = false;
    this.saveConnectionConfigToLocalStorage();
  }

  public setUseDeviceToken(useDeviceToken: boolean) {
    this.useDeviceToken = useDeviceToken;
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

  public get KipUUID(): string {
    return this.kipUUID;
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
    localStorage.removeItem("appConfig");
    localStorage.removeItem("widgetConfig");
    localStorage.removeItem("layoutConfig");
    localStorage.removeItem("themeConfig");
    localStorage.removeItem("zonesConfig");
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

    let storageObject: IAppConfig = {
      configVersion: configVersion,
      dataSets: this.dataSets,
      unitDefaults: this.unitDefaults.getValue(),
      notificationConfig: this.kipKNotificationConfig.getValue(),
    }
    return storageObject;
  }

  private buildConnectionStorageObject() {
    let storageObject: IConnectionConfig = {
      connectionConfigVersion: configVersion,
      kipUUID: this.kipUUID,
      signalKUrl: this.signalkUrl.url,
      useDeviceToken: this.useDeviceToken,
      loginName: this.loginName,
      loginPassword: this.loginPassword,
      useSharedConfig: this.useSharedConfig,
      sharedConfigName: this.sharedConfigName
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
    console.log("[AppSettings Service] Saving Theme config to LocalStorage");
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
    localStorage.setItem('appConfig', JSON.stringify(config));
    return config;
  }

  private getDefaultConnectionConfig(): IConnectionConfig {
    let config: IConnectionConfig = DefaultConectionConfig;
    config.kipUUID = this.newUuid();
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

  private getDefaultZonesConfig(): IZonesConfig {
    let config: IZonesConfig = DefaultZonesConfig;
    localStorage.setItem("zonesConfig", JSON.stringify(config));
    return config;
  }

  private newUuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
        return v.toString(16);
    });
  }

}
