import { IConfig ,IAppConfig, IConnectionConfig, ILayoutConfig, IThemeConfig, IWidgetConfig, IZonesConfig } from "./app-settings.interfaces"
import { DefaultNotificationConfig } from './config.blank.notification.const';
import { DefaultUnitsConfig } from "./config.blank.units.const";

export const DefaultAppConfig: IAppConfig = {
  "configVersion": 9,
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

export const DefaultZonesConfig: IZonesConfig = {
  "zones": [],
}

export const defaultConfig: IConfig = {
  "app": DefaultAppConfig,
  "widget": DefaultWidgetConfig,
  "layout": DefaultLayoutConfig,
  "theme": DefaultThemeConfig,
  "zones": DefaultZonesConfig,
}

export const DefaultConectionConfig: IConnectionConfig = {
  "configVersion": 9,
  "kipUUID": newUuid(),
  "signalKUrl": null, // get's overwritten with host at getDefaultConnectionConfig()
  "useDeviceToken": false,
  "loginName": null,
  "loginPassword": null,
  "useSharedConfig": false,
  "sharedConfigName": "default"
}

function newUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
  });
}
