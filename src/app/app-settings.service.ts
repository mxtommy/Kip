import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Router } from '@angular/router';

import { IDataSet } from './data-set.service';
import { ISplitSet } from './layout-splits.service';
import { IWidget } from './widget-manager.service';
import { IUnitDefaults } from './units.service';

import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig, IWidgetConfig, ILayoutConfig, IZonesConfig, INotificationConfig, IZone, ISignalKUrl } from "./app-settings.interfaces";
import { DefaultAppConfig, DefaultConectionConfig, DefaultWidgetConfig, DefaultLayoutConfig, DefaultThemeConfig, DefaultZonesConfig } from './config.blank.const';
import { DefaultUnitsConfig } from './config.blank.units.const'
import { DefaultNotificationConfig } from './config.blank.notification.const';
import { DemoAppConfig, DemoConnectionConfig, DemoWidgetConfig, DemoLayoutConfig, DemoThemeConfig, DemoZonesConfig } from './config.demo.const';

import { StorageService } from './storage.service';

const defaultTheme = 'modern-dark';
const configVersion = 9; // used to invalidate old configs. connectionConfig and appConfig use this same version.

@Injectable({
  providedIn: 'root'
})
export class AppSettingsService {
  private unlockStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private unitDefaults: BehaviorSubject<IUnitDefaults> = new BehaviorSubject<IUnitDefaults>({});
  private themeName: BehaviorSubject<string> = new BehaviorSubject<string>(defaultTheme);
  private kipKNotificationConfig: BehaviorSubject<INotificationConfig> = new BehaviorSubject<INotificationConfig>(DefaultNotificationConfig);

  private useDeviceToken: boolean = false;
  private loginName: string;
  private loginPassword: string;
  public useSharedConfig: boolean;
  private sharedConfigName: string;
  private activeConfig: IConfig = {app: null, widget: null, layout: null, theme: null, zones: null};

  private kipUUID: string;
  public signalkUrl: ISignalKUrl;
  widgets: Array<IWidget>;
  splitSets: ISplitSet[] = [];
  rootSplits: string[] = [];
  dataSets: IDataSet[] = [];
  zones: BehaviorSubject<Array<IZone>> = new BehaviorSubject<Array<IZone>>([]);
  root

  constructor(
    private router: Router,
    private storage: StorageService,
    )
  {
    console.log("[AppSettings Service] Service startup..");
    this.storage.activeConfigVersion = configVersion;

    if (!window.localStorage) {
      // REQUIRED BY APP - localStorage support
      console.error("[AppSettings Service] LocalStorage NOT SUPPORTED by browser\nThis is a requirement to run Kip. See browser documentation to enable this feature.");

    } else {
      this.loadConnectionConfig();

      let serverConfig: IConfig;

      if (this.storage.initConfig === null && this.useSharedConfig && this.loginName !== null && this.loginPassword !== null && this.signalkUrl.url !== null ) {
        this.resetSettings();
      } else {
        serverConfig = this.storage.initConfig;
      }

      if (serverConfig) {
        console.log("[AppSettings Service] Remote configuration storage enabled");
        this.activeConfig = this.validateAppConfig(serverConfig);
        this.pushSettings();
      } else {
        console.log("[AppSettings Service] LocalStorage enabled");

        let localStorageConfig: IConfig = {app: null, widget: null, layout: null, theme: null, zones: null};
        localStorageConfig.app = this.loadConfigFromLocalStorage("appConfig");
        localStorageConfig.widget = this.loadConfigFromLocalStorage("widgetConfig");
        localStorageConfig.layout = this.loadConfigFromLocalStorage("layoutConfig");
        localStorageConfig.theme = this.loadConfigFromLocalStorage("themeConfig");
        localStorageConfig.zones = this.loadConfigFromLocalStorage("zonesConfig");

        this.activeConfig = this.validateAppConfig(localStorageConfig);
        this.pushSettings();
      }
    }
  }

  private loadConnectionConfig(): void {
    let config :IConnectionConfig = this.loadConfigFromLocalStorage("connectionConfig");

    if ((typeof config.configVersion !== 'number') || (config.configVersion !== configVersion)) {
      //TODO: create modal dialog to handle old server config: Upgrade, replace, get default...
      console.error("[AppSettings Service] Invalid onnectionConfig version. Resetting and loading configuration default");
      this.resetConnection();
    } else {
      this.signalkUrl = {url: config.signalKUrl, new: false};
      this.useDeviceToken = config.useDeviceToken;
      this.loginName = config.loginName;
      this.loginPassword = config.loginPassword;
      this.useSharedConfig = config.useSharedConfig;
      this.sharedConfigName = config.sharedConfigName;
      this.kipUUID = config.kipUUID;
    }
  }

  public resetConnection() {
    localStorage.setItem("connectionConfig", JSON.stringify(this.getDefaultConnectionConfig()));
    this.reloadApp();
  }

  private validateAppConfig(config: IConfig): IConfig {
    if ((typeof config.app.configVersion !== 'number') || (config.app.configVersion !== configVersion)) {
      if (this.useSharedConfig) {
        //TODO: create modal dialog to handle old server config: Upgrade, replace, get default...
        console.error("[AppSettings Service] Invalid Server config version. Resetting and loading configuration default");
      } else {
        console.error("[AppSettings Service] Invalid localStorage config version. Replacing with Defaults");
        // we don't remove connectionConfig. It only hold: url, use, pwd, kipUUID, etc. Those
        // values can and should stay local and persist over time
        localStorage.removeItem("appConfig");
        localStorage.removeItem("widgetConfig");
        localStorage.removeItem("layoutConfig");
        localStorage.removeItem("themeConfig");
        localStorage.removeItem("zonesConfig");
      }

      this.resetSettings();
    }
    return config;
  }

  private loadConfigFromLocalStorage(type: string) {
    let config = JSON.parse(localStorage.getItem(type));

    if (config === null) {
      console.log(`[AppSettings Service] Error loading ${type} config. Force loading ${type} defaults`);
      switch (type) {
        case "appConfig":
          config = this.getDefaultAppConfig();
          break;

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
          config = this.getDefaultZonesConfig();
          break;
      }
    }

    if(type === 'connectionConfig') {
      if (config.configVersion !== configVersion) {
        console.log(`[AppSettings Service] Invalide ${type} version. Force loading defaults`);

        switch (type) {
          case "connectionConfig":
            config = this.getDefaultConnectionConfig();
            break;
        }
      }
    }

    return config;
  }

  private pushSettings(): void {
    this.themeName.next(this.activeConfig.theme.themeName);
    this.dataSets = this.activeConfig.app.dataSets;
    this.unitDefaults.next(this.activeConfig.app.unitDefaults);
    this.kipKNotificationConfig.next(this.activeConfig.app.notificationConfig);
    this.widgets = this.activeConfig.widget.widgets;
    this.zones.next(this.activeConfig.zones.zones);
    this.splitSets = this.activeConfig.layout.splitSets;
    this.rootSplits = this.activeConfig.layout.rootSplits;
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
    if (this.useSharedConfig) {
      this.storage.patchConfig('Array<IUnitDefaults>', newDefaults);

    } else {
      this.saveAppConfigToLocalStorage();
    }
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
    this.signalkUrl.url = value.signalKUrl;
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
      if (this.useSharedConfig) {
        let theme: IThemeConfig = {
          themeName: newTheme
        }
        this.storage.patchConfig('IThemeConfig', theme)
      } else {
        this.saveThemeConfigToLocalStorage();
      }

    }
  }
  public getThemeName(): string {
    return this.themeName.getValue();;
  }

  // Widgets
  public getWidgets() {
    return this.widgets;
  }
  public saveWidgets(widgets: Array<IWidget>) {
    this.widgets = widgets;
    if (this.useSharedConfig) {
      let widgetConfig: IWidgetConfig = {
        widgets: this.widgets,
        };

      this.storage.patchConfig('IWidgetConfig', widgetConfig);
    }
    else {
      this.saveWidgetConfigToLocalStorage();
    }
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
    if (this.useSharedConfig) {
      let layoutConfig: ILayoutConfig = {
        splitSets: this.splitSets,
        rootSplits: this.rootSplits,
        };

      this.storage.patchConfig('ILayoutConfig', layoutConfig);
    } else {
      this.saveLayoutConfigToLocalStorage();
    }
  }
  public saveRootUUIDs(rootUUIDs) {
    this.rootSplits = rootUUIDs;
    if (this.useSharedConfig) {
      let layoutConfig: ILayoutConfig = {
        splitSets: this.splitSets,
        rootSplits: this.rootSplits,
        };

      this.storage.patchConfig('ILayoutConfig', layoutConfig);
    } else {
      this.saveLayoutConfigToLocalStorage();
    }
  }

  // DataSets
  public saveDataSets(dataSets: Array<IDataSet>) {
    this.dataSets = dataSets;
    if (this.useSharedConfig) {
      this.storage.patchConfig('Array<IDataSet>', dataSets);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }
  public getDataSets() {
    return this.dataSets;
  }

  // Zones
  public saveZones(zones: Array<IZone>) {
    this.zones.next(zones);
    if (this.useSharedConfig) {
      this.storage.patchConfig('Array<IZone>', zones);
    } else {
      this.saveZonesConfigToLocalStorage();
    }
  }
  public getZonesAsO() {
    return this.zones.asObservable();
  }
  public getZones() {
    return this.zones.getValue();
  }

  // Notification Service Setting
  public getNotificationServiceConfigAsO(): Observable<INotificationConfig> {
    return this.kipKNotificationConfig.asObservable();
  }
  public getNotificationConfig(): INotificationConfig {
    return this.kipKNotificationConfig.getValue();
  }
  public setNotificationConfig(notificationConfig: INotificationConfig) {
    this.kipKNotificationConfig.next(notificationConfig);
    if (this.useSharedConfig) {
      this.storage.patchConfig('INotificationConfig', notificationConfig);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }

  //Config manipulation: RAW and SignalK server - used by Settings Config Component
  public resetSettings() {

    let newDefaultConfig: IConfig = {app: null, widget: null, layout: null, theme: null, zones: null};
    newDefaultConfig.app = this.getDefaultAppConfig();
    newDefaultConfig.widget = this.getDefaultWidgetConfig();
    newDefaultConfig.layout = this.getDefaultLayoutConfig();
    newDefaultConfig.theme = this.getDefaultThemeConfig();
    newDefaultConfig.zones = this.getDefaultZonesConfig();

      if (this.useSharedConfig) {
        this.storage.setConfig('user', this.sharedConfigName, newDefaultConfig)
        .then( _ => {
          console.log("[AppSettings Service] Replaced server config name: " + this.sharedConfigName + ", with default configuration values");
          this.reloadApp();
        })
        .catch(error => {
          console.error("[AppSettings Service] Error replacing server config name: " + this.sharedConfigName);
        });
      } else {

        this.reloadApp();
      }
  }

  /**
   * Updates keys of localStorage config and reloads apps if required to apply new config. IMPORTANT NOTE: Kip does not apply config unless app is reloaded
   * @param configType String of either appConfig, widgetConfig, layoutConfig or themeConfig.
   * @param newConfig Object containing config. Of type IAppConfig, IWidgetConfig, ILayoutConfig or IThemeConfig
   * @param reloadApp Optional Boolean. If True, the app will reload, else does nothing. Defaults to False.
   */
  public replaceConfig(configType: string, newConfig: IAppConfig | IConnectionConfig | IWidgetConfig | ILayoutConfig | IThemeConfig | IZonesConfig, reloadApp?: boolean) {
    let jsonConfig = JSON.stringify(newConfig);
    localStorage.setItem(configType, jsonConfig);
    if (reloadApp) {
      this.reloadApp();
    }
  }

  public loadDemoConfig() {
    localStorage.clear();
    this.replaceConfig("appConfig", DemoAppConfig);
    this.replaceConfig("connectionConfig", DemoConnectionConfig);
    this.replaceConfig("widgetConfig", DemoWidgetConfig);
    this.replaceConfig("layoutConfig", DemoLayoutConfig);
    this.replaceConfig("themeConfig", DemoThemeConfig, true);
  }

  public reloadApp() {
    location.replace("/");
  }
  //// Storage Objects
  // builds config data oject from running data
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
      configVersion: configVersion,
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

  // Calls build methodes and saves to LocalStorage
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

  // Creates config from defaults and saves to LocalStorage
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
