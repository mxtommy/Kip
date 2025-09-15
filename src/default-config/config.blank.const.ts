import { IConfig ,IAppConfig, IConnectionConfig, IThemeConfig } from "../app/core/interfaces/app-settings.interfaces"
import { DefaultNotificationConfig } from './config.blank.notification.const';
import { DefaultUnitsConfig } from "./config.blank.units.const";
import { UUID } from "../app/core/utils/uuid.util";

export const DefaultAppConfig: IAppConfig = {
  "configVersion": 11,
  "autoNightMode": true,
  "redNightMode": false,
  "nightModeBrightness": 0.27,
  "isRemoteControl": false,
  "instanceName": "",
  "dataSets": [],
  "unitDefaults": DefaultUnitsConfig,
  "notificationConfig": DefaultNotificationConfig,
  "splitShellEnabled": true,
  "splitShellSide": "left",
  "splitShellWidth": 0.3
}

export const DefaultThemeConfig: IThemeConfig = {
  "themeName": ""
}

export const defaultConfig: IConfig = {
  "app": DefaultAppConfig,
  "theme": DefaultThemeConfig,
  "dashboards": []
}

export const DefaultConnectionConfig: IConnectionConfig = {
  "configVersion": 11,
  "kipUUID": UUID.create(),
  "signalKUrl": null, // get's overwritten with host at getDefaultConnectionConfig()
  "proxyEnabled": false,
  "signalKSubscribeAll": false,
  "useDeviceToken": false,
  "loginName": null,
  "loginPassword": null,
  "useSharedConfig": false,
  "sharedConfigName": "default"
}
