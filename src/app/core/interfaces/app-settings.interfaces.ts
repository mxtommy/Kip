import { IDatasetServiceDatasetConfig } from '../services/dataset-stream.service';
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
  // Transient only: collected by the login dialog and passed to login() in memory.
  // Never persisted to localStorage (the session JWT is the cross-reload credential).
  loginPassword?: string;
  useSharedConfig: boolean;
  sharedConfigName: string;
  // Remote-control identity is per-device (Unit 5 / R8): a profile switch must not change whether
  // this display participates in remote control or the name it advertises.
  isRemoteControl: boolean;
  instanceName: string;
}
export interface IConfig {
  app: IAppConfig | null;
  theme: IThemeConfig | null;
  dashboards: Dashboard[];
}

export interface IAppConfig {
  configVersion: number;
  autoNightMode: boolean;
  redNightMode: boolean;
  nightModeBrightness: number;
  dataSets: IDatasetServiceDatasetConfig[];
  unitDefaults: IUnitDefaults;
  notificationConfig: INotificationConfig;
  splitShellEnabled?: boolean;
  splitShellSide?: 'left' | 'right';
  splitShellSwipeDisabled?: boolean;
  splitShellWidth?: number;
  widgetHistoryDisabled?: boolean;
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
