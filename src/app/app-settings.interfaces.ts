import { IDataSet } from './data-set.service';
import { ISplitSet } from './layout-splits.service';
import { IWidget } from './widget-manager.service';
import { IUnitDefaults } from './units.service';

export interface IConfig {
  app: IAppConfig;
  widget: IWidgetConfig;
  layout: ILayoutConfig;
  theme: IThemeConfig;
  zones: IZonesConfig;
  connection: IConnectionConfig;
}

export interface IAppConfig {
  configVersion: number;
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
  useSharedConfig: boolean;
  sharedConfigName: string;
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

export interface IZonesConfig {
  zones: Array<IZone>;
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

export interface IZone {
  uuid: string;
  path: string;
  unit: string;
  upper: number;
  lower: number;
  state: ZoneState;
}

export enum ZoneState {
  normal = 0,
  warning = 1,
  alarm = 2,
}
