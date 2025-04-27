import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { IDatasetServiceDatasetConfig } from './data-set.service';
import { IWidget } from '../interfaces/widgets-interface';
import { IUnitDefaults } from './units.service';
import { UUID } from '../utils/uuid';

import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig, INotificationConfig, ISignalKUrl } from "../interfaces/app-settings.interfaces";
import { DefaultAppConfig, DefaultConnectionConfig as DefaultConnectionConfig, DefaultThemeConfig } from '../../../default-config/config.blank.const';
import { DefaultUnitsConfig } from '../../../default-config/config.blank.units.const'
import { DefaultNotificationConfig } from '../../../default-config/config.blank.notification.const';
import { DemoAppConfig, DemoConnectionConfig, DemoThemeConfig, DemoDashboardsConfig } from '../../../default-config/config.demo.const';

import { StorageService } from './storage.service';
import { Dashboard } from './dashboard.service';

const defaultTheme = '';
const configFileVersion: number = 11; // used to change the Signal K configuration storage file name (ie. 9.0.0.json) that contains the configuration definitions. Applies only to remote storage.
const configVersion: number = 11; // used to invalidate old configs defined as a property in the configuration object. connectionConfig and appConfig use this same version.

@Injectable({
  providedIn: 'root'
})
export class AppSettingsService {
  private storage = inject(StorageService);

  private unitDefaults: BehaviorSubject<IUnitDefaults> = new BehaviorSubject<IUnitDefaults>({});
  private themeName: BehaviorSubject<string> = new BehaviorSubject<string>(defaultTheme);
  private kipKNotificationConfig: BehaviorSubject<INotificationConfig> = new BehaviorSubject<INotificationConfig>(DefaultNotificationConfig);
  private autoNightMode: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private redNightMode: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private nightModeBrightness: BehaviorSubject<number> = new BehaviorSubject<number>(1);

  public proxyEnabled: boolean = false;
  public signalKSubscribeAll: boolean = false;
  private useDeviceToken: boolean = false;
  private loginName: string;
  private loginPassword: string;
  public useSharedConfig: boolean;
  private sharedConfigName: string;
  private activeConfig: IConfig = {app: null, theme: null, dashboards: null};

  private kipUUID: string;
  public signalkUrl: ISignalKUrl;
  private widgets: Array<IWidget>;
  private _dashboards: Dashboard[] = [];
  private dataSets: IDatasetServiceDatasetConfig[] = [];
  public configUpgrade = signal<boolean>(false);

  constructor() {
    console.log("[AppSettings Service] Service startup...");
    this.storage.activeConfigFileVersion = configFileVersion;

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
        this.checkConfigUpgradeRequired(false);
        this.activeConfig = serverConfig;
        this.pushSettings();
      } else {
        console.log("[AppSettings Service] LocalStorage enabled");
        let localStorageConfig: IConfig = {app: null, theme: null, dashboards: null};
        localStorageConfig.app = this.loadConfigFromLocalStorage("appConfig");
        if (localStorageConfig.app.configVersion !== configVersion) {
          this.checkConfigUpgradeRequired(true);
        }
        localStorageConfig.dashboards = this.loadConfigFromLocalStorage("dashboardsConfig");
        localStorageConfig.theme = this.loadConfigFromLocalStorage("themeConfig");
        this.activeConfig = localStorageConfig;
        this.pushSettings();
      }
    }
  }

  private loadConnectionConfig(): void {
    const config :IConnectionConfig = this.loadConfigFromLocalStorage("connectionConfig");

    switch (config.configVersion) {
      case 11:
        break;
      default:
        console.error(`[AppSettings Service] Invalid connectionConfig version ${config.configVersion}. Resetting and loading connection configuration default`);
        this.resetConnection();
        break;
    }

    this.signalkUrl = {url: config.signalKUrl, new: false};
    this.proxyEnabled = config.proxyEnabled;
    this.signalKSubscribeAll = config.signalKSubscribeAll;
    this.useDeviceToken = config.useDeviceToken;
    this.loginName = config.loginName;
    this.loginPassword = config.loginPassword;
    this.useSharedConfig = config.useSharedConfig;
    this.sharedConfigName = config.sharedConfigName;
    this.kipUUID = config.kipUUID;
  }

  public resetConnection() {
    localStorage.setItem("connectionConfig", JSON.stringify(this.getDefaultConnectionConfig()));
    this.reloadApp();
  }

  private checkConfigUpgradeRequired(isLocalStorageConfig: boolean): void {
    if (isLocalStorageConfig) {
      this.configUpgrade.set(true); // Set the upgrade flag to true
    } else {
      this.storage.listConfigs(9).then(async (rootConfigs) => {
        for (const rootConfig of rootConfigs) {
          try {
            // Fetch the full configuration for each rootConfig
            const fullConfig = await this.storage.getConfig(rootConfig.scope, rootConfig.name, 9);

            // Check if the version is 10
            if (fullConfig.app?.configVersion === 10) {
              this.configUpgrade.set(true); // Set the upgrade flag to true
              console.log(`[AppSettings Service] Configuration upgrade required for version 10.`);
              break; // Exit the loop once a version 10 config is found
            }
          } catch (error) {
            console.error(`[AppSettings Service] Error fetching configuration for ${rootConfig.name}:`, error);
          }
        }
      })
      .catch((error) => {
        console.error("[AppSettings Service] Error fetching configuration data:", error);
      });
    }
  }

  /**
   * Get configuration from local browser storage rather then in
   * memory running config.
   *
   * @param {string} type Possible choices are: appConfig, dashboardsConfig, themeConfig, connectionConfig or older v2 if they are present widgetConfig, layoutConfig, themeConfig, zonesConfig, connectionConfig.
   * @return {*}
   * @memberof AppSettingsService
   */
  public loadConfigFromLocalStorage(type: string) {
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

        case "dashboardsConfig":
          config = this.getDefaultDashboardsConfig();
          break;

        case "themeConfig":
          config = this.getDefaultThemeConfig();
          break;

        default:
          console.error(`[AppSettings Service] Invalid ${type} default config requested`);
          break;
      }
    }

    if(type === 'connectionConfig') {
      if (config.configVersion !== configVersion) {
        console.log(`[AppSettings Service] Invalid ${type} version. Force loading defaults`);

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

    if (this.activeConfig.app.autoNightMode === undefined) {
      this.setAutoNightMode(false);
    } else {
      this.autoNightMode.next(this.activeConfig.app.autoNightMode);
    }

    if (this.activeConfig.app.redNightMode === undefined) {
      this.setRedNightMode(false);
    } else {
      this.redNightMode.next(this.activeConfig.app.redNightMode);
    }

    if (this.activeConfig.app.nightModeBrightness === undefined) {
      this.setNightModeBrightness(0.2);
    } else {
      this.nightModeBrightness.next(this.activeConfig.app.nightModeBrightness);
    }

    this.activeConfig.dashboards === undefined ? this._dashboards = [] : this._dashboards = this.activeConfig.dashboards;
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
    this.proxyEnabled = value.proxyEnabled;
    this.signalKSubscribeAll = value.signalKSubscribeAll;
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

  public getDashboardConfig(): Dashboard[] {
    return this.buildDashboardStorageObject();
  }

  public getThemeConfig(): IThemeConfig {
    return this.buildThemeStorageObject();
  }

  public get KipUUID(): string {
    return this.kipUUID;
  }

  // Themes
  public getThemeNameAsO() {
    return this.themeName.asObservable();
  }

  public setThemeName(newTheme: string) {
    this.themeName.next(newTheme);
    if (this.useSharedConfig) {
      let theme: IThemeConfig = {
        themeName: newTheme
      }
      this.storage.patchConfig('IThemeConfig', theme)
    } else {
      this.saveThemeConfigToLocalStorage();
    }
  }

  public getThemeName(): string {
    return this.themeName.getValue();;
  }

  // Auto night mode
  public getAutoNightModeAsO() {
    return this.autoNightMode.asObservable();
  }

  public setAutoNightMode(enabled: boolean) {
    this.autoNightMode.next(enabled);
    const appConf = this.buildAppStorageObject();

    if (this.useSharedConfig) {
      this.storage.patchConfig('IAppConfig', appConf);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }

  public getAutoNightMode(): boolean {
    return this.autoNightMode.getValue();
  }

  // Red night mode
  public getRedNightModeAsO() {
    return this.redNightMode.asObservable();
  }

  public getRedNightMode(): boolean {
    return this.redNightMode.getValue();
  }

  public setRedNightMode(enabled: boolean) {
    this.redNightMode.next(enabled);
    const appConf = this.buildAppStorageObject();

    if (this.useSharedConfig) {
      this.storage.patchConfig('IAppConfig', appConf);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }


  public getNightModeBrightness(): number {
    return this.nightModeBrightness.getValue();
  }

  public setNightModeBrightness(brightness: number): void {
    this.nightModeBrightness.next(brightness);
    const appConf = this.buildAppStorageObject();

    if (this.useSharedConfig) {
      this.storage.patchConfig('IAppConfig', appConf);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }

  // Widgets
  public getWidgets() {
    return this.widgets;
  }

  public saveDashboards(dashboards: Dashboard[]) {
    if (this.useSharedConfig) {
      this.storage.patchConfig('Dashboards', dashboards);
    } else {
      this.saveLDashboardsConfigToLocalStorage(dashboards);
    }
    this._dashboards = dashboards;
  }

  // DataSets
  public saveDataSets(dataSets: Array<IDatasetServiceDatasetConfig>) {
    this.dataSets = dataSets;
    if (this.useSharedConfig) {
      this.storage.patchConfig('Array<IDatasetDef>', dataSets);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }
  public getDataSets() {
    return this.dataSets;
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

    let newDefaultConfig: IConfig = {app: null, theme: null, dashboards: null};
    newDefaultConfig.app = this.getDefaultAppConfig();
    newDefaultConfig.theme = this.getDefaultThemeConfig();
    newDefaultConfig.dashboards = this.getDefaultDashboardsConfig();

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
   * Updates keys of localStorage config and reloads apps if required to apply new config.
   *
   * IMPORTANT NOTE: Kip does not apply config unless app is reloaded
   *
   * @param configType String of either connectionConfig, appConfig, widgetConfig, dashboardConfig or themeConfig.
   * @param newConfig Object containing config. Of type IAppConfig, IWidgetConfig, Dashboard[] or IThemeConfig
   * @param reloadApp Optional Boolean. If True, the app will reload, else does nothing. Defaults to False.
   */
  public replaceConfig(configType: string, newConfig: IAppConfig | IConnectionConfig | IThemeConfig | Dashboard[], reloadApp?: boolean) {
    let jsonConfig = JSON.stringify(newConfig);
    localStorage.setItem(configType, jsonConfig);
    if (reloadApp) {
      this.reloadApp();
    }
  }

  public loadDemoConfig() {
    if (this.useSharedConfig) {
      let demoConfig: IConfig = {
        app: DemoAppConfig,
        dashboards: DemoDashboardsConfig,
        theme: DemoThemeConfig
      };
      console.log("[AppSettings Service] Loading Demo configuration settings as remote config: " + this.useSharedConfig + " and reloading app.");
      this.storage.setConfig('user', this.sharedConfigName, demoConfig);
      this.reloadApp();
    } else {
      console.log("[AppSettings Service] Loading Demo configuration settings to LocalStorage");
      this.replaceConfig("appConfig", DemoAppConfig);
      this.replaceConfig("dashboardsConfig", DemoDashboardsConfig);
      this.replaceConfig("themeConfig", DemoThemeConfig, true);
    }
  }

  public reloadApp() {
    console.log("[AppSettings Service] Reload app");
    location.replace("./");
  }

  // builds config data oject from running data
  private buildAppStorageObject() {

    let storageObject: IAppConfig = {
      configVersion: configVersion,
      autoNightMode: this.autoNightMode.getValue(),
      redNightMode: this.redNightMode.getValue(),
      nightModeBrightness: this.nightModeBrightness.getValue(),
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
      proxyEnabled: this.proxyEnabled,
      signalKSubscribeAll: this.signalKSubscribeAll,
      useDeviceToken: this.useDeviceToken,
      loginName: this.loginName,
      loginPassword: this.loginPassword,
      useSharedConfig: this.useSharedConfig,
      sharedConfigName: this.sharedConfigName
    }
    return storageObject;
  }

  private buildDashboardStorageObject() {
    return this._dashboards;
  }

  private buildThemeStorageObject() {
    let storageObject: IThemeConfig = {
      themeName: this.themeName.getValue()
      }
    return storageObject;
  }

  // Calls build methods and saves to LocalStorage
  private saveAppConfigToLocalStorage() {
    console.log("[AppSettings Service] Saving Application config to LocalStorage");
    localStorage.setItem('appConfig', JSON.stringify(this.buildAppStorageObject()));
  }

  private saveConnectionConfigToLocalStorage() {
    console.log("[AppSettings Service] Saving Connection config to LocalStorage");
    localStorage.setItem('connectionConfig', JSON.stringify(this.buildConnectionStorageObject()));
  }

  private saveLDashboardsConfigToLocalStorage(dashboards: Dashboard[]) {
    console.log("[AppSettings Service] Saving Dashboard config to LocalStorage");
    localStorage.setItem('dashboardsConfig', JSON.stringify(dashboards));
  }

  private  saveThemeConfigToLocalStorage() {
    console.log("[AppSettings Service] Saving Theme config to LocalStorage");
    localStorage.setItem('themeConfig', JSON.stringify(this.buildThemeStorageObject()));
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
    let config: IConnectionConfig = DefaultConnectionConfig;
    config.kipUUID = UUID.create();
    config.signalKUrl = window.location.origin;
    localStorage.setItem('connectionConfig', JSON.stringify(config));
    return config;
  }

  private getDefaultDashboardsConfig(): Dashboard[] {
    let config = [];
    localStorage.setItem("dashboardsConfig", JSON.stringify(config));
    return config;
  }

  private getDefaultThemeConfig(): IThemeConfig {
    let config: IThemeConfig = DefaultThemeConfig;
    localStorage.setItem("themeConfig", JSON.stringify(config));
    return config;
  }
}
