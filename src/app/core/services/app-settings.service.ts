import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { cloneDeep } from "lodash-es";

import { IDatasetServiceDatasetConfig } from './data-set.service';
import { IWidget } from '../interfaces/widgets-interface';
import { IUnitDefaults } from './units.service';
import { UUID } from '../utils/uuid';

import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig, INotificationConfig, ISignalKUrl } from "../interfaces/app-settings.interfaces";
import { DefaultAppConfig, DefaultConnectionConfig as DefaultConnectionConfig, DefaultThemeConfig, DefaultDashboardsConfig } from '../../../default-config/config.blank.const';
import { DefaultUnitsConfig } from '../../../default-config/config.blank.units.const'
import { DefaultNotificationConfig } from '../../../default-config/config.blank.notification.const';
import { DemoAppConfig, DemoConnectionConfig, DemoThemeConfig, DemoDashboardsConfig } from '../../../default-config/config.demo.const';

import { StorageService } from './storage.service';
import { IAuthorizationToken } from './authentication.service';
import { Dashboard } from './dashboard.service';

const defaultTheme = 'modern-dark';
const configFileVersion: number = 11; // used to change the Signal K configuration storage file name (ie. 9.0.0.json) that contains the configuration definitions. Applies only to remote storage.
const configVersion: number = 11; // used to invalidate old configs defined as a property in the configuration object. connectionConfig and appConfig use this same version.

@Injectable({
  providedIn: 'root'
})
export class AppSettingsService {
  private unitDefaults: BehaviorSubject<IUnitDefaults> = new BehaviorSubject<IUnitDefaults>({});
  private themeName: BehaviorSubject<string> = new BehaviorSubject<string>(defaultTheme);
  private kipKNotificationConfig: BehaviorSubject<INotificationConfig> = new BehaviorSubject<INotificationConfig>(DefaultNotificationConfig);
  private autoNightMode: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private nightModeBrightness: BehaviorSubject<number> = new BehaviorSubject<number>(1);

  public proxyEnabled: boolean = false;
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

  constructor(
    private storage: StorageService
    )
  {
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
        this.activeConfig = this.validateAppConfig(serverConfig);
        this.pushSettings();
      } else {
        console.log("[AppSettings Service] LocalStorage enabled");
        let localStorageConfig: IConfig = {app: null, theme: null, dashboards: null};
        localStorageConfig.app = this.loadConfigFromLocalStorage("appConfig");
        localStorageConfig.dashboards = this.loadConfigFromLocalStorage("dashboardsConfig");
        localStorageConfig.theme = this.loadConfigFromLocalStorage("themeConfig");

        this.activeConfig = this.validateAppConfig(localStorageConfig);
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

  private validateAppConfig(config: IConfig): IConfig {
    //TODO: Clean up
    if ((typeof config.app.configVersion !== 'number') || (config.app.configVersion !== configVersion)) {
      if (config.app.configVersion === 6 || config.app.configVersion === 9) {
        // we need to upgrade config
        this.upgradeAppConfig(config);
      } else {
        // unknown version - delete and load defaults
        if (this.useSharedConfig) {
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
    }
    return config;
  }

  private upgradeAppConfig(config: any): void {
    //TODO: Clean up
    console.warn("[AppSettings Service] Configuration upgrade required");

    let upgradedAppConfig: IAppConfig = {
      configVersion: 9,
      autoNightMode: this.autoNightMode.getValue(),
      nightModeBrightness: 0.20,
      dataSets: cloneDeep(config.app.dataSets),
      notificationConfig: cloneDeep(config.app.notificationConfig),
      unitDefaults: cloneDeep(config.app.unitDefaults)
    };

    if (config.app.configVersion === 6) {
      // Update local storage connection info with old config data
      let conConf :IConnectionConfig = this.loadConfigFromLocalStorage("connectionConfig");
      conConf.signalKUrl = this.signalkUrl = config.app.signalKUrl;
      conConf.kipUUID = this.kipUUID = config.app.kipUUID;

      if (config.app.signalKToken != "" && config.app.signalKToken != undefined && config.app.signalKToken != null) {
        console.log("[AppSettings Service] Migrating Device Token to LocalStorage");
        let tokenSettings: IAuthorizationToken = {
          token: config.app.signalKToken,
          expiry: null,
          isDeviceAccessToken: true
        };
        localStorage.setItem('authorization_token', JSON.stringify(tokenSettings));
        conConf.useDeviceToken = true;
      }

      console.log("[AppSettings Service] Writing upgraded connectionConfig to LocalStorage");
      this.replaceConfig('connectionConfig', conConf);
      config.app.configVersion = 9;
    }

    // dataset and data Chart Widget changes
    if (config.app.configVersion == 9) {
      config.app.dataSets.forEach(oldDS => {
        const upgradedDS: IDatasetServiceDatasetConfig = {
          uuid: oldDS.uuid,
          path: oldDS.path,
          pathSource: oldDS.signalKSource,
          baseUnit: null,
          timeScaleFormat: 'second',
          period: oldDS.dataPoints,
          label: `${oldDS.path}, Source: ${oldDS.signalKSource}, Scale: Needs upgrade, Period: ${oldDS.dataPoints}`
        };

        upgradedAppConfig.dataSets.push(upgradedDS);
        upgradedAppConfig.dataSets.shift();
      });

      const historicalWidget: any[] = config.widget.widgets.filter(widget => widget.type === "WidgetHistorical");
      historicalWidget.forEach(widget => {
        widget.type = "WidgetDataChart";
        widget.config.datasetUUID = widget.config.dataSetUUID;
        widget.config.startScaleAtZero = widget.config.includeZero;
      });

      upgradedAppConfig.configVersion = 10;
    }

    // save upgraded app Config
    if (this.useSharedConfig) {
      // Config came from remote storage Scope User, name default. Push it back
      console.log("[AppSettings Service] Writing upgraded AppConfig to remote storage default config");
      this.storage.patchConfig('IWidgetConfig',config.widget);
      this.storage.patchConfig('IAppConfig',upgradedAppConfig);
      this.reloadApp();
    } else {
      // Config came from local storage. Save it back
      console.log("[AppSettings Service] Writing upgraded AppConfig to LocalStorage default config");
      this.replaceConfig('widgetConfig',config.widget, true);
      this.replaceConfig('appConfig', upgradedAppConfig, true);
    }
  }

/**
 * Get configuration from local browser storage rather then in
 * memory running config.
 *
 * @param {string} type Possible choices are: appConfig,  widgetConfig, layoutConfig, themeConfig, zonesConfig, connectionConfig.
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
   * @param configType String of either connectionConfig, appConfig, widgetConfig, layoutConfig or themeConfig.
   * @param newConfig Object containing config. Of type IAppConfig, IWidgetConfig, ILayoutConfig or IThemeConfig
   * @param reloadApp Optional Boolean. If True, the app will reload, else does nothing. Defaults to False.
   */
  public replaceConfig(configType: string, newConfig: IAppConfig | IConnectionConfig | IThemeConfig, reloadApp?: boolean) {
    let jsonConfig = JSON.stringify(newConfig);
    localStorage.setItem(configType, jsonConfig);
    if (reloadApp) {
      this.reloadApp();
    }
  }

  public loadDemoConfig() {
    console.log("[AppSettings Service] Loading Demo Configuration Settings as shared Config: " + this.useSharedConfig + " and reloading app.");
    if (this.useSharedConfig) {
      let demoConfig: IConfig = {
        app: DemoAppConfig,
        dashboards: DemoDashboardsConfig.dashboards,
        theme: DemoThemeConfig
      };
      this.storage.setConfig('user', this.sharedConfigName, demoConfig);
      this.reloadApp();
    } else {
      localStorage.clear();
      this.replaceConfig("appConfig", DemoAppConfig);
      this.replaceConfig("connectionConfig", DemoConnectionConfig);
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

  private saveThemeConfigToLocalStorage() {
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
    let config = DefaultDashboardsConfig.dashboards;
    localStorage.setItem("dashboardsConfig", JSON.stringify(config));
    return config;
  }

  private getDefaultThemeConfig(): IThemeConfig {
    let config: IThemeConfig = DefaultThemeConfig;
    localStorage.setItem("themeConfig", JSON.stringify(config));
    return config;
  }
}
