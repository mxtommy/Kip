import { IAppConfig, IWidgetConfig, ILayoutConfig, IThemeConfig } from "./app-settings.service";

export const DefaultAppConfig: IAppConfig = {
  "configVersion": 5,
  "signalKUrl": "", // get's overwritten with host
  "signalKToken": null,
  "unlockStatus": false,
  "dataSets": [],
  "unitDefaults": null,
  "notificationConfig": null,
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
