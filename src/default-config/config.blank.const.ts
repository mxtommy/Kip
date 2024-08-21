import { IConfig ,IAppConfig, IConnectionConfig, IThemeConfig, DashboardConfig } from "../app/core/interfaces/app-settings.interfaces"
import { DefaultNotificationConfig } from './config.blank.notification.const';
import { DefaultUnitsConfig } from "./config.blank.units.const";
import { UUID } from "../app/core/utils/uuid";

export const DefaultAppConfig: IAppConfig = {
  "configVersion": 11,
  "autoNightMode": false,
  "nightModeBrightness": 0.20,
  "dataSets": [],
  "unitDefaults": DefaultUnitsConfig,
  "notificationConfig": DefaultNotificationConfig,
}

export const DefaultDashboardsConfig: DashboardConfig = {
  "dashboards": [
  ]
}

export const DefaultThemeConfig: IThemeConfig = {
  "themeName": "modern-dark"
}

export const defaultConfig: IConfig = {
  "app": DefaultAppConfig,
  "theme": DefaultThemeConfig,
  "dashboards": DefaultDashboardsConfig.dashboards
}

export const DefaultConnectionConfig: IConnectionConfig = {
  "configVersion": 11,
  "kipUUID": UUID.create(),
  "signalKUrl": null, // get's overwritten with host at getDefaultConnectionConfig()
  "proxyEnabled": false,
  "useDeviceToken": false,
  "loginName": null,
  "loginPassword": null,
  "useSharedConfig": false,
  "sharedConfigName": "default"
}
