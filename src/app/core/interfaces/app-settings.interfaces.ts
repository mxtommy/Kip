import { IDatasetServiceDatasetConfig } from '../services/data-set.service';
import { IWidget } from './widgets-interface';
import { IUnitDefaults } from '../services/units.service';
import { Dashboard } from './../services/dashboard.service';

export interface IConnectionConfig {
  configVersion: number;
  kipUUID: string;
  signalKUrl: string;
  proxyEnabled: boolean;
  signalKSubscribeAll: boolean;
  useDeviceToken: boolean;
  loginName: string;
  loginPassword: string;
  useSharedConfig: boolean;
  sharedConfigName: string;
}
export interface IConfig {
  app: IAppConfig;
  theme: IThemeConfig;
  dashboards: Dashboard[];
}

export interface IAppConfig {
  configVersion: number;
  autoNightMode: boolean;
  nightModeBrightness: number;
  dataSets: IDatasetServiceDatasetConfig[];
  unitDefaults: IUnitDefaults;
  notificationConfig: INotificationConfig;
}

export interface IThemeConfig {
  themeName: string;
}

export interface DashboardConfig {
  dashboards: Dashboard[];
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
    showNominalState: boolean;
  },
  sound: {
    disableSound: boolean;
    muteNormal: boolean;
    muteNominal: boolean;
    muteWarn: boolean;
    muteAlert: boolean;
    muteAlarm: boolean;
    muteEmergency: boolean;
  },
}

export interface ISignalKUrl {
  url: string;
  new: boolean;
}
