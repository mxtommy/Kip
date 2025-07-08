/* eslint-disable @typescript-eslint/no-explicit-any */
export interface v10IConnectionConfig {
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
export interface v10IConfig {
  app: v10IAppConfig;
  widget: v10IWidgetConfig;
  layout: v10ILayoutConfig;
  theme: v10IThemeConfig;
}

export interface v10IAppConfig {
  configVersion: number;
  autoNightMode: boolean;
  unitDefaults: v10IUnitDefaults;
  notificationConfig: v10INotificationConfig;
}

export interface v10IThemeConfig {
  themeName: string;
}

export interface v10IWidgetConfig {
  widgets: v10IWidget[];
}

export interface v10ILayoutConfig {
  splitSets: v10ISplitSet[];
  rootSplits: string[];
}

export interface v10INotificationConfig {
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

/**
 * This interface defines possible Widget properties.
 *
 * @export
 * @interface IWidget
 */
export interface v10IWidget {
  /** The Widget's unique identifier */
  uuid: string;
   /** The Widget's type. Value are defined in widget-list.service */
  type: string;
   /** The Widget's configuration Object */
  config: object;
}

export type v10IUnitDefaults = Record<string, string>;

interface v10ISplitArea {
  uuid: string; // uuid of widget of splitset, depending on type.
  type: string; //(widget|splitSet)
  size: any;
}

export interface v10ISplitSet {
  uuid: string;
  parentUUID?: string;
  direction: any;
  splitAreas: v10ISplitArea[];
}
