import { IDatasetServiceDatasetConfig } from '../services/data-set.service';
import { ISplitSet } from '../services/layout-splits.service';
import { IWidget } from './widgets-interface';
import { IUnitDefaults } from '../services/units.service';

export interface IConnectionConfig {
  configVersion: number;
  kipUUID: string;
  signalKUrl: string;
  proxyEnabled: boolean;
  useDeviceToken: boolean;
  loginName: string;
  loginPassword: string;
  useSharedConfig: boolean;
  sharedConfigName: string;
}
export interface IConfig {
  app: IAppConfig;
  widget: IWidgetConfig;
  layout: ILayoutConfig;
  theme: IThemeConfig;
}

export interface IAppConfig {
  configVersion: number;
  autoNightMode: boolean;
  dataSets: IDatasetServiceDatasetConfig[];
  unitDefaults: IUnitDefaults;
  notificationConfig: INotificationConfig;
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
