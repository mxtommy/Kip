import { IConfig ,IAppConfig, IConnectionConfig, ILayoutConfig, IThemeConfig, IWidgetConfig } from "../app/core/interfaces/app-settings.interfaces"
import { DefaultNotificationConfig } from './config.blank.notification.const';
import { DefaultUnitsConfig } from "./config.blank.units.const";
import { UUID } from "../app/core/utils/uuid";

export const DefaultAppConfig: IAppConfig = {
  "configVersion": 10,
  "autoNightMode": false,
  "dataSets": [],
  "unitDefaults": DefaultUnitsConfig,
  "notificationConfig": DefaultNotificationConfig,
}

export const DefaultWidgetConfig: IWidgetConfig = {
  "widgets": [
    {
      "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
      "type": "WidgetTutorial",
      "config": null
    }
  ]
}

export const DefaultLayoutConfig: ILayoutConfig = {
  "rootSplits": [
    "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
  ],
  "splitSets": [
    {
      "uuid": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
          "type": "widget",
          "size": 100
        }
      ]
    }
  ]
}

export const DefaultThemeConfig: IThemeConfig = {
  "themeName": "modern-dark"
}

export const defaultConfig: IConfig = {
  "app": DefaultAppConfig,
  "widget": DefaultWidgetConfig,
  "layout": DefaultLayoutConfig,
  "theme": DefaultThemeConfig
}

export const DefaultConnectionConfig: IConnectionConfig = {
  "configVersion": 10,
  "kipUUID": UUID.create(),
  "signalKUrl": null, // get's overwritten with host at getDefaultConnectionConfig()
  "proxyEnabled": false,
  "useDeviceToken": false,
  "loginName": null,
  "loginPassword": null,
  "useSharedConfig": false,
  "sharedConfigName": "default"
}
