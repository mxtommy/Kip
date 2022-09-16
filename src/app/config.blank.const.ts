import { IAppConfig, IConnectionConfig, IWidgetConfig, ILayoutConfig, IThemeConfig } from "./app-settings.service";

export const DefaultAppConfig: IAppConfig = {
  "configVersion": 8,
  "signalKToken": null,
  "kipUUID": newUuid(),
  "dataSets": [],
  "unitDefaults": null,
  "notificationConfig": null,
}

export const DefaultConectionConfig: IConnectionConfig = {
  "signalKUrl": "", // get's overwritten with host at getDefaultConnectionConfig()
  "useDeviceToken": true,
  "loginName": null,
  "loginPassword": null,
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


function newUuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
  });
}
