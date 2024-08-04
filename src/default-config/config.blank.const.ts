import { IConfig ,IAppConfig, IConnectionConfig, ILayoutConfig, IThemeConfig, IWidgetConfig, DashboardConfig } from "../app/core/interfaces/app-settings.interfaces"
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
  "splitSets": [
    {
      "uuid": "root",
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

export const DefaultDashboardsConfig: DashboardConfig = {
  "dashboards": [
  ]
}

export const DefaultThemeConfig: IThemeConfig = {
  "themeName": "modern-dark"
}

export const defaultConfig: IConfig = {
  "app": DefaultAppConfig,
  "widget": DefaultWidgetConfig,
  "layout": DefaultLayoutConfig,
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
