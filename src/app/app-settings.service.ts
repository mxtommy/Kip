import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Router } from '@angular/router';

import { IDataSet } from './data-set.service';
import { ISplitSet } from './layout-splits.service';
import { IWidget } from './widget-manager.service';
import { IUnitDefaults } from './units.service';

import { BlankConfig } from './blank-config.const';
import { DemoConfig } from './demo-config.const';
import { initialDefaultUnits } from './defaultUnits.const'
import { DefaultNotificationConfig } from './blank-Notification-config.const';
import { isNumber } from 'util';

const defaultSignalKUrl: SignalKUrl = { url: 'http://demo.signalk.org/signalk', new: true };
const defaultTheme = 'default-light';
const configVersion = 4; // used to invalidate old configs to avoir errors loading it.


export interface AppSettings {
  configVersion: number;
  signalKUrl: string;
  signalKToken: string;
  themeName: string;
  widgets: Array<IWidget>;
  unlockStatus: boolean;
  dataSets: IDataSet[];
  splitSets: ISplitSet[];
  rootSplits: string[];
  unitDefaults: IUnitDefaults;
  notificationConfig?: INotificationConfig;
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

export interface SignalKUrl {
  url: string;
  new: boolean;
}

export interface SignalKToken {
  token: string;
  new: boolean;
}
@Injectable()
export class AppSettingsService {
  signalKUrl: BehaviorSubject<SignalKUrl> = new BehaviorSubject<SignalKUrl>(defaultSignalKUrl); // this should be overwritten right away when loading settings, but you need to give something...
  signalKToken: BehaviorSubject<SignalKToken> = new BehaviorSubject<SignalKToken>(null);
  unlockStatus: BehaviorSubject<boolean> = new BehaviorSubject<boolean>(false);
  unitDefaults: BehaviorSubject<IUnitDefaults> = new BehaviorSubject<IUnitDefaults>({});
  kipKNotificationConfig: BehaviorSubject<INotificationConfig> = new BehaviorSubject<INotificationConfig>(null);
  themeName: BehaviorSubject<string> = new BehaviorSubject<string>(defaultTheme);

  widgets: Array<IWidget>;
  splitSets: ISplitSet[] = [];
  rootSplits: string[] = [];
  dataSets: IDataSet[] = [];
  root

  constructor(
    private router: Router) {

    let storageObject: AppSettings
    if (localStorage.getItem('signalKData') == null) {
      storageObject = this.getDefaultConfig();
    }
    storageObject = JSON.parse(localStorage.getItem('signalKData'));
    if (!isNumber(storageObject.configVersion) || (storageObject.configVersion != configVersion)) {
      console.error("Invalid config version, loading default");
      storageObject = this.getDefaultConfig();
    }

    this.loadSettings(storageObject);
  }


  loadSettings(storageObject: AppSettings) {
    let skUrl: SignalKUrl = {url: storageObject.signalKUrl, new: false};
    let skToken: SignalKToken = {token: storageObject.signalKToken, new: false};

    this.signalKUrl.next(skUrl);
    this.signalKToken.next(skToken);
    this.themeName.next(storageObject['themeName']);
    this.widgets = storageObject.widgets;
    this.unlockStatus.next(storageObject['unlockStatus']);
    this.dataSets = storageObject.dataSets;
    this.splitSets = storageObject.splitSets;
    this.rootSplits = storageObject.rootSplits;
    if ('unitDefaults' in storageObject) {
      this.unitDefaults.next(storageObject.unitDefaults);
    } else {
      this.unitDefaults.next(initialDefaultUnits);
    }
    this.kipKNotificationConfig.next(storageObject.notificationConfig);
  }

  //UnitDefaults
  getDefaultUnitsAsO() {
    return this.unitDefaults.asObservable();
  }
  getDefaultUnits() {
    return this.unitDefaults.getValue();
  }
  setDefaultUnits(newDefaults: IUnitDefaults) {
    this.unitDefaults.next(newDefaults);
    this.saveToLocalStorage();
  }

  // SignalKURL
  getSignalKURLAsO() {
    return this.signalKUrl.asObservable();
  }
  getSignalKURL() {
    return this.signalKUrl.getValue();
  }
  setSignalKURL(value: SignalKUrl) {
    this.signalKUrl.next(value);
    this.saveToLocalStorage();
  }

  // SignalKToken
  getSignalKTokenAsO() {
    return this.signalKToken.asObservable();
  }
  getSignalKToken() {
    return this.signalKToken.getValue();
  }
  setSignalKToken(value: SignalKToken) {
    this.signalKToken.next(value);
    this.saveToLocalStorage();
  }

  // UnlockStatus
  getUnlockStatusAsO() {
    return this.unlockStatus.asObservable();
  }
  setUnlockStatus(value) {
    this.unlockStatus.next(value);
    this.saveToLocalStorage();
  }

  // Themes
  getThemeNameAsO() {
    return this.themeName.asObservable();
  }
  setThemName(newName: string) {
    this.themeName.next(newName);
    this.saveToLocalStorage();
  }

  // Widgets
  getWidgets() {
    return this.widgets;
  }
  saveWidgets(widgets: Array<IWidget>) {
    this.widgets = widgets;
    this.saveToLocalStorage();
  }

   // Layout SplitSets
  getSplitSets() {
    return this.splitSets;
  }
  getRootSplits() {
    return this.rootSplits;
  }
  saveSplitSets(splitSets) {
    this.splitSets = splitSets;
    this.saveToLocalStorage();
  }
  saveRootUUIDs(rootUUIDs) {
    this.rootSplits = rootUUIDs;
    this.saveToLocalStorage();
  }

  // DataSets
  saveDataSets(dataSets) {
    this.dataSets = dataSets;
    this.saveToLocalStorage();
  }
  getDataSets() {
    return this.dataSets;
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
    this.saveToLocalStorage();
  }

  getDefaultNotification(): INotificationConfig {
    let config = DefaultNotificationConfig;
    localStorage.setItem('notificationConfig', JSON.stringify(config));
    return config;
  }

  // saving.
  private buildStorageObject() {
    let storageObject: AppSettings = {
      configVersion: configVersion,
      signalKUrl: this.signalKUrl.getValue().url,
      signalKToken: this.signalKToken.getValue().token,
      themeName: this.themeName.getValue(),
      widgets: this.widgets,
      unlockStatus: this.unlockStatus.getValue(),
      dataSets: this.dataSets,
      splitSets: this.splitSets,
      rootSplits: this.rootSplits,
      unitDefaults: this.unitDefaults.getValue(),
      notificationConfig: this.kipKNotificationConfig.getValue(),
    }
    return storageObject;
  }

  getAppConfig() {
    return this.buildStorageObject();
  }

  saveToLocalStorage() {
    console.log("Saving Config to LocalStorage");
    localStorage.setItem('signalKData', JSON.stringify(this.buildStorageObject()));
  }

  resetSettings() {
    localStorage.removeItem("signalKData");
    this.reloadApp();
  }

  replaceConfig(newConfig: string) {
    localStorage.setItem('signalKData', newConfig);
    this.reloadApp();
  }

  loadDemoConfig() {
    this.replaceConfig(JSON.stringify(DemoConfig));
  }

  reloadApp() {
    this.router.navigate(['/']);
    setTimeout(()=>{ location.reload() }, 200);
  }

  getDefaultConfig(): AppSettings {
    let config: AppSettings = BlankConfig;
    config.notificationConfig = DefaultNotificationConfig;
    config.signalKUrl = window.location.origin;
    config['configVersion'] = configVersion;
    localStorage.setItem('signalKData', JSON.stringify(config));
    return config;
  }

}
