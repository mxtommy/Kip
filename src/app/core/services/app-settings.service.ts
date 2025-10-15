import { Injectable, inject, signal } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

import { IDatasetServiceDatasetConfig } from './data-set.service';
import { IWidget } from '../interfaces/widgets-interface';
import { IUnitDefaults } from './units.service';
import { UUID } from '../utils/uuid.util';

import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig, INotificationConfig, ISignalKUrl } from "../interfaces/app-settings.interfaces";
import { DefaultAppConfig, DefaultConnectionConfig as DefaultConnectionConfig, DefaultThemeConfig } from '../../../default-config/config.blank.const';
import { DefaultUnitsConfig } from '../../../default-config/config.blank.units.const'
import { DefaultNotificationConfig } from '../../../default-config/config.blank.notification.const';
import { DemoAppConfig, DemoThemeConfig, DemoDashboardsConfig } from '../../../default-config/config.demo.const';

import { StorageService } from './storage.service';
import { Dashboard } from './dashboard.service';

const defaultTheme = '';
const configFileVersion = 11; // used to change the Signal K configuration storage file name (ie. 9.0.0.json) that contains the configuration definitions. Applies only to remote storage. Local storage has no file concept.
const latestConfigVersion = 12; // used to set the configVersion property in the app config. This is used to manage config upgrades.
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
  private isRemoteControl: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private instanceName: BehaviorSubject<string> = new BehaviorSubject<string>('');
  private splitShellEnabled: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private splitShellSide: BehaviorSubject<'left' | 'right'> = new BehaviorSubject<'left' | 'right'>('left');
  private splitShellSwipeDisabled: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  private splitShellWidth: BehaviorSubject<number> = new BehaviorSubject<number>(0.5);

  public proxyEnabled = false;
  public signalKSubscribeAll = false;
  private useDeviceToken = false;
  private loginName: string;
  private loginPassword: string;
  public useSharedConfig: boolean;
  private sharedConfigName: string;
  private activeConfig: IConfig = {app: null, theme: null, dashboards: null};

  private kipUUID: string;
  public signalkUrl: ISignalKUrl;
  private widgets: IWidget[];
  private _dashboards: Dashboard[] = [];
  private dataSets: IDatasetServiceDatasetConfig[] = [];
  public configUpgrade = signal<boolean>(false);
  private configVersion = undefined; // store actual config version from config version property in config
  constructor() {
    console.log("[AppSettings Service] Service startup...");
    this.storage.activeConfigFileVersion = configFileVersion;

    if (!window.localStorage) {
      // REQUIRED BY APP - localStorage support
      console.error("[AppSettings Service] LocalStorage NOT SUPPORTED by browser\nThis is a requirement to run Kip. See browser documentation to enable this feature.");

    } else {
      this.loadConnectionConfig();
      this.startup();
    }
  }

  private async startup(): Promise<void> {
    if (this.useSharedConfig) {
      // Remote storage flow
      const hasCreds = !!this.loginName && !!this.loginPassword && !!this.signalkUrl?.url;
      if (this.storage.initConfig === null && hasCreds) {
        try {
          const fileUpgradeRequired = await this.checkConfigFileVersionUpgradeRequired();
          if (fileUpgradeRequired) {
            this.configUpgrade.set(true);
          } else {
            this.resetSettings(); // triggers reload when done
          }
        } catch (err) {
          console.error("[AppSettings Service] Startup check failed:", err);
        }
        return;
      }

      console.log("[AppSettings Service] Remote configuration storage enabled");
      this.configVersion = this.storage.initConfig?.app?.configVersion;
      this.checkConfigUpgradeRequired(false, this.storage.initConfig?.app?.configVersion);
      this.activeConfig = this.storage.initConfig;
      this.pushSettings();
    } else {
      console.log("[AppSettings Service] LocalStorage enabled");
      const localStorageConfig: IConfig = { app: null, theme: null, dashboards: null };
      localStorageConfig.app = this.loadConfigFromLocalStorage("appConfig");
      this.configVersion = localStorageConfig.app?.configVersion;
      this.checkConfigUpgradeRequired(true, localStorageConfig.app?.configVersion);
      localStorageConfig.dashboards = this.loadConfigFromLocalStorage("dashboardsConfig");
      localStorageConfig.theme = this.loadConfigFromLocalStorage("themeConfig");
      this.activeConfig = localStorageConfig;
      this.pushSettings();
    }
  }

  private loadConnectionConfig(): void {
    const config :IConnectionConfig = this.loadConfigFromLocalStorage("connectionConfig");

    switch (config.configVersion) {
      case 11:
        break;
      case 12:
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

  private async checkConfigFileVersionUpgradeRequired(): Promise<boolean> {
    const rootConfigs = await this.storage.listConfigs(9);
    try {
      let configFileUpgradeRequired = false;
      for (const rootConfig of rootConfigs) {
        // Fetch the full configuration for each rootConfig
        const fullConfig = await this.storage.getConfig(rootConfig.scope, rootConfig.name, 9);
        try {
          // Check if the version is 10
          if (fullConfig.app?.configVersion === 10) {
            configFileUpgradeRequired = true; // Set the upgrade flag to true
            console.log(`[AppSettings Service] Configuration upgrade required for version 10.`);
            break; // Exit the loop once a version 10 config is found
          }
        }
        catch (error) {
          console.error(`[AppSettings Service] Error fetching configuration for ${rootConfig.name}:`, error);
          break;
        }
      }
      return configFileUpgradeRequired;
    }
    catch (error) {
      console.error("[AppSettings Service] Error fetching configuration data:", error);
      return false;
    }
  }

  private checkConfigUpgradeRequired(isLocalStorageConfig: boolean, storageVersion?: number): void {
    if (storageVersion !== latestConfigVersion) {
      this.configUpgrade.set(true);
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
      if (config.configVersion !== latestConfigVersion) {
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

    if (this.activeConfig.dashboards === undefined) {
      this._dashboards = [];
    } else {
      this._dashboards = this.activeConfig.dashboards;
    }

    if (this.activeConfig.app.isRemoteControl === undefined) {
      this.setIsRemoteControl(false);
    } else {
      this.isRemoteControl.next(this.activeConfig.app.isRemoteControl);
    }

    if (this.activeConfig.app.instanceName === undefined) {
      this.setInstanceName('');
    } else {
      this.instanceName.next(this.activeConfig.app.instanceName);
    }

    if (this.activeConfig.app.splitShellEnabled === undefined) {
      this.setSplitShellEnabled(false);
    } else {
      this.splitShellEnabled.next(this.activeConfig.app.splitShellEnabled);
    }

    if (this.activeConfig.app.splitShellSide === undefined) {
      this.setSplitShellSide('left');
    } else {
      this.splitShellSide.next(this.activeConfig.app.splitShellSide);
    }

    if (this.activeConfig.app.splitShellSwipeDisabled === undefined) {
      this.setSplitShellSwipeDisabled(false);
    } else {
      this.splitShellSwipeDisabled.next(this.activeConfig.app.splitShellSwipeDisabled);
    }

    if (this.activeConfig.app.splitShellWidth === undefined) {
      this.setSplitShellWidth(0.5); // default ratio
    } else {
      this.splitShellWidth.next(this.activeConfig.app.splitShellWidth);
    }
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

  // Configuration version
  public getConfigVersion(): number | undefined {
    return this.activeConfig.app?.configVersion ?? undefined;
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
      const theme: IThemeConfig = {
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

  // isRemoteControl mode
  public getIsRemoteControlAsO() {
    return this.isRemoteControl.asObservable();
  }

  public getIsRemoteControl(): boolean {
    return this.isRemoteControl.getValue();
  }

  public setIsRemoteControl(enabled: boolean) {
    this.isRemoteControl.next(enabled);
    const appConf = this.buildAppStorageObject();

    if (this.useSharedConfig) {
      this.storage.patchConfig('IAppConfig', appConf);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }

  // Remote Control Instance Name
  public getInstanceNameAsO() {
    return this.instanceName.asObservable();
  }

  public getInstanceName(): string {
    return this.instanceName.getValue();
  }

  public setInstanceName(name: string) {
    this.instanceName.next(name);
    const appConf = this.buildAppStorageObject();

    if (this.useSharedConfig) {
      this.storage.patchConfig('IAppConfig', appConf);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }

  // --- split Shell Settings API ---
  public getSplitShellEnabledAsO() {
    return this.splitShellEnabled.asObservable();
  }
  public getSplitShellEnabled(): boolean {
    return this.splitShellEnabled.getValue();
  }
  public setSplitShellEnabled(enabled: boolean): void {
    this.splitShellEnabled.next(enabled);
    const appConf = this.buildAppStorageObject();

    if (this.useSharedConfig) {
      this.storage.patchConfig('IAppConfig', appConf);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }

  public getSplitShellSideAsO() {
    return this.splitShellSide.asObservable();
  }
  public getSplitShellSide(): 'left' | 'right' {
    return this.splitShellSide.getValue();
  }
  public setSplitShellSide(side: 'left' | 'right'): void {
    this.splitShellSide.next(side);
    const appConf = this.buildAppStorageObject();

    if (this.useSharedConfig) {
      this.storage.patchConfig('IAppConfig', appConf);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }

  public getSplitShellSwipeDisabledAsO() {
    return this.splitShellSwipeDisabled.asObservable();
  }
  public getSplitShellSwipeDisabled(): boolean {
    return this.splitShellSwipeDisabled.getValue();
  }
  public setSplitShellSwipeDisabled(enabled: boolean): void {
    this.splitShellSwipeDisabled.next(enabled);
    const appConf = this.buildAppStorageObject();

    if (this.useSharedConfig) {
      this.storage.patchConfig('IAppConfig', appConf);
    } else {
      this.saveAppConfigToLocalStorage();
    }
  }

  public getSplitShellWidthAsO() {
    return this.splitShellWidth.asObservable();
  }
  public getSplitShellWidth(): number {
    return this.splitShellWidth.getValue();
  }
  public setSplitShellWidth(width: number): void {
    // interpret input as ratio (0-1), clamp to sensible bounds
    const ratio = Math.min(0.9, Math.max(0.1, width));
    this.splitShellWidth.next(ratio);
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
      if (this.storage.storageServiceReady$.getValue()) {
        this.storage.patchConfig('Dashboards', dashboards);
      }
    } else {
      this.saveLDashboardsConfigToLocalStorage(dashboards);
    }
    this._dashboards = dashboards;
  }

  // DataSets
  public saveDataSets(dataSets: IDatasetServiceDatasetConfig[]) {
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

    const newDefaultConfig: IConfig = {app: null, theme: null, dashboards: null};
    newDefaultConfig.app = this.getDefaultAppConfig();
    newDefaultConfig.theme = this.getDefaultThemeConfig();
    newDefaultConfig.dashboards = this.getDefaultDashboardsConfig();

      if (this.useSharedConfig) {
        if (this.storage.storageServiceReady$.getValue()) {
          this.storage.setConfig('user', this.sharedConfigName, newDefaultConfig)
            .then(() => {
              console.log("[AppSettings Service] Replaced server config name: " + this.sharedConfigName + ", with default configuration values");
              this.reloadApp();
            })
            .catch(error => {
              console.error("[AppSettings Service] Error replacing server config name: " + this.sharedConfigName + ", with default configuration values", error);
            });
        }
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
    const jsonConfig = JSON.stringify(newConfig);
    localStorage.setItem(configType, jsonConfig);
    if (reloadApp) {
      this.reloadApp();
    }
  }

  public loadDemoConfig() {
    if (this.useSharedConfig) {
      const demoConfig: IConfig = {
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
    // Prevent hard navigation in unit tests (breaks Karma)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).__KIP_TEST__) {
      return; // no-op
    }
    location.replace("./");
  }

  // builds config data oject from running data
  private buildAppStorageObject() {

    const storageObject: IAppConfig = {
      configVersion: this.configVersion,
      autoNightMode: this.autoNightMode.getValue(),
      redNightMode: this.redNightMode.getValue(),
      nightModeBrightness: this.nightModeBrightness.getValue(),
      isRemoteControl: this.isRemoteControl.getValue(),
      instanceName: this.instanceName.getValue(),
      dataSets: this.dataSets,
      unitDefaults: this.unitDefaults.getValue(),
      notificationConfig: this.kipKNotificationConfig.getValue(),
      splitShellEnabled: this.splitShellEnabled.getValue(),
      splitShellSide: this.splitShellSide.getValue() ?? 'right',
      splitShellWidth: this.splitShellWidth.getValue() ?? 0.5,
      splitShellSwipeDisabled: this.splitShellSwipeDisabled.getValue()
    }
    return storageObject;
  }

  private buildConnectionStorageObject() {
    const storageObject: IConnectionConfig = {
      configVersion: this.configVersion,
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
    const storageObject: IThemeConfig = {
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
    const config: IAppConfig = DefaultAppConfig;
    config.notificationConfig = DefaultNotificationConfig;
    config.unitDefaults = DefaultUnitsConfig;
    config['configVersion'] = latestConfigVersion;
    localStorage.setItem('appConfig', JSON.stringify(config));
    return config;
  }

  private getDefaultConnectionConfig(): IConnectionConfig {
    const config: IConnectionConfig = DefaultConnectionConfig;
    config.kipUUID = UUID.create();
    config.signalKUrl = window.location.origin;
    localStorage.setItem('connectionConfig', JSON.stringify(config));
    return config;
  }

  private getDefaultDashboardsConfig(): Dashboard[] {
    const config = [];
    localStorage.setItem("dashboardsConfig", JSON.stringify(config));
    return config;
  }

  private getDefaultThemeConfig(): IThemeConfig {
    const config: IThemeConfig = DefaultThemeConfig;
    localStorage.setItem("themeConfig", JSON.stringify(config));
    return config;
  }
}
