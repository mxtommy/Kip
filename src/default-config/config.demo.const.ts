import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig, DashboardConfig } from "../app/core/interfaces/app-settings.interfaces"
import { UUID } from "../app/core/utils/uuid"

// Demo Mode config settings file
export const DemoAppConfig: IAppConfig = {
  "configVersion": 11,
  "autoNightMode": false,
  "nightModeBrightness": 0.20,
  "dataSets": [
    {
      "uuid": "afbe4e41-26f5-404f-a55d-9f7b9b76fbd1",
      "path": "self.environment.wind.speedApparent",
      "pathSource": "default",
      "period": 1,
      "baseUnit": "m/s",
      "label": "self.environment.wind.speedApparent, Source: default, Scale: minute, Period: 1",
      "timeScaleFormat": "minute"
  }
  ],
  "unitDefaults": {
    "Unitless": 'unitless',
    "Speed": 'knots',
    "Flow": 'l/h',
    "Temperature": 'celsius',
    "Length": 'm',
    "Volume": 'liter',
    "Current": 'A',
    "Potential": 'V',
    "Charge": 'C',
    "Power": 'W',
    "Energy": 'J',
    "Pressure": 'mmHg',
    "Density": 'kg/m3',
    "Time": 'Hours',
    "Angular Velocity": 'deg/min',
    "Angle": 'deg',
    "Frequency": 'Hz',
    "Ratio": 'ratio'
  },
  "notificationConfig": {
    "disableNotifications": false,
    "menuGrouping": true,
    "security": {
      "disableSecurity": true,
    },
    "devices": {
      "disableDevices": false,
      "showNormalState": false,
      "showNominalState": false,
    },
    "sound": {
      "disableSound": false,
      "muteNormal": true,
      "muteNominal": true,
      "muteWarn": true,
      "muteAlert": false,
      "muteAlarm": false,
      "muteEmergency": false,
    },
  }
}

export const DemoDashboardsConfig: DashboardConfig = {
  "dashboards": []
}

export const DemoThemeConfig: IThemeConfig = {
  "themeName": "modern-dark"
}

export const DemoConfig: IConfig = {
  "app": DemoAppConfig,
  "dashboards": DemoDashboardsConfig.dashboards,
  "theme": DemoThemeConfig,
}

export const DemoConnectionConfig: IConnectionConfig = {
  "configVersion": 11,
  "kipUUID": UUID.create(),
  "signalKUrl": "https://demo.signalk.org",
  "proxyEnabled": false,
  "useDeviceToken": false,
  "loginName": null,
  "loginPassword": null,
  "useSharedConfig": false,
  "sharedConfigName": "default"
}
