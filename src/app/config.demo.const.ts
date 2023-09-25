import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig, ILayoutConfig, IWidgetConfig, IZonesConfig } from "./app-settings.interfaces"

// Demo Mode config settings file
export const DemoAppConfig: IAppConfig = {
  "configVersion": 9,
  "dataSets": [
    {
      "uuid": "afbe4e41-26f5-404f-a55d-9f7b9b76fbd1",
      "path": "self.environment.wind.speedTrue",
      "signalKSource": "default",
      "updateTimer": 1,
      "dataPoints": 15
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
    },
    "sound": {
      "disableSound": false,
      "muteNormal": false,
      "muteWarning": false,
      "muteAlert": false,
      "muteAlarm": false,
      "muteEmergency": false,
    },
  }
}

export const DemoWidgetConfig: IWidgetConfig = {
  "widgets": [
    {
      "uuid": "7298b3be-232f-48bf-9b3d-3b445131a908",
      "type": "WidgetNumeric",
      "config": {
        "paths": {
          "numericPath": {
            "description": "Numeric Data",
            "path": "self.environment.depth.belowTransducer",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "m"
          }
        },
        "displayName": "Depth",
        "filterSelfPaths": true,
        "showMin": false,
        "showMax": false,
        "numDecimal": 1,
        "numInt": 1
      }
    },
    {
      "uuid": "7298b3be-232f-48bf-9b3d-3b433131a908",
      "type": "WidgetWindComponent",
      "config": {
        "paths": {
          "headingPath": {
            "description": "Heading",
            "path": "self.navigation.courseOverGroundTrue",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "deg"
          },
          "trueWindAngle": {
            "description": "True Wind Angle",
            "path": "self.environment.wind.angleTrueWater",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "deg"
          },
          "trueWindSpeed": {
            "description": "True Wind Speed",
            "path": "self.environment.wind.speedTrue",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "knots"
          },
          "appWindAngle": {
            "description": "Apparent Wind Angle",
            "path": "self.environment.wind.angleApparent",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "deg"
          },
          "appWindSpeed": {
            "description": "Apparent Wind Speed",
            "path": "self.environment.wind.speedApparent",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "knots"
          }
        },
        "filterSelfPaths": true,
        "windSectorEnable": true,
        "windSectorWindowSeconds": 10,
        "laylineEnable": true,
        "laylineAngle": 35
      }
    },
    {
      "uuid": "912b86e4-e068-49e9-9f75-a2292d772578",
      "type": "WidgetGaugeNgRadialComponent",
      "config": {
        "displayName": "SOG",
        "filterSelfPaths": true,
        "paths": {
          "gaugePath": {
            "description": "Numeric Data",
            "path": "self.navigation.speedOverGround",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "knots"
          }
        },
        "gaugeType": "ngRadial",
        "gaugeTicks": false,
        "radialSize": "measuring",
        "minValue": 0,
        "maxValue": 10,
        "numInt": 1,
        "numDecimal": 1,
        "barColor": "accent"
      }
    },
    {
      "uuid": "85525ebc-c40c-41e6-8379-05d573a331e1",
      "type": "WidgetGaugeNgLinearComponent",
      "config": {
        "displayName": "Apparent Wind Speed",
        "filterSelfPaths": true,
        "paths": {
          "gaugePath": {
            "description": "Numeric Data",
            "path": "self.environment.wind.speedApparent",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "knots"
          }
        },
        "gaugeType": "ngLinearHorizontal",
        "gaugeTicks": true,
        "minValue": 0,
        "maxValue": 30,
        "numInt": 1,
        "numDecimal": 1,
        "barColor": "accent"
      }
    },
    {
      "uuid": "a49a59c6-b83d-40e0-b759-9d153da69105",
      "type": "WidgetNumeric",
      "config": {
        "paths": {
          "numericPath": {
            "description": "Numeric Data",
            "path": "self.navigation.speedThroughWater",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "knots"
          }
        },
        "displayName": "Speed",
        "filterSelfPaths": true,
        "showMin": true,
        "showMax": true,
        "numDecimal": 1,
        "numInt": 1
      }
    },
    {
      "uuid": "62fa8155-10fd-49cb-a495-cee6e9491b8a",
      "type": "WidgetNumeric",
      "config": {
        "paths": {
          "numericPath": {
            "description": "Numeric Data",
            "path": "self.performance.velocityMadeGood",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "knots"
          }
        },
        "displayName": "VMG",
        "filterSelfPaths": true,
        "showMin": true,
        "showMax": true,
        "numDecimal": 1,
        "numInt": 1
      }
    },
    {
      "uuid": "42de0119-481c-4466-8b50-1407533ac2aa",
      "type": "WidgetHistorical",
      "config": {
        "convertUnitTo": "knots",
        "displayName": "WindSpeed True",
        "filterSelfPaths": true,
        "dataSetUUID": "afbe4e41-26f5-404f-a55d-9f7b9b76fbd1",
        "invertData": false,
        "displayMinMax": false,
        "includeZero": true,
        "minValue": null,
        "maxValue": null,
        "verticalGraph": false
      }
    },
    {
      "uuid": "66eb9453-73a2-4f69-9fc6-ececd3f96ce6",
      "type": "WidgetGaugeNgRadialComponent",
      "config": {
        "displayName": "COG (True)",
        "filterSelfPaths": true,
        "paths": {
          "gaugePath": {
            "description": "Numeric Data",
            "path": "self.navigation.courseOverGroundTrue",
            "source": "default",
            "pathType": "number",
            "isPathConfigurable": true,
            "convertUnitTo": "deg"
          }
        },
        "gaugeType": "ngRadial",
        "gaugeTicks": false,
        "radialSize": "baseplateCompass",
        "minValue": 0,
        "maxValue": 360,
        "numInt": 1,
        "numDecimal": 0,
        "barColor": "accent"
      }
    }
  ]
}

export const DemoLayoutConfig: ILayoutConfig = {
  "splitSets": [
    {
      "uuid": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "d107e54d-2db5-4abf-aba7-b96ce19f5abd",
          "type": "splitSet",
          "size": 30.079353380503136
        },
        {
          "uuid": "9249373f-7aa4-4673-8004-3e4e900e0b3d",
          "type": "splitSet",
          "size": 38.1436713836478
        },
        {
          "uuid": "d5be7f74-28c0-484c-a0cd-e623eb5db837",
          "type": "splitSet",
          "size": 31.776975235849058
        }
      ]
    },
    {
      "uuid": "9249373f-7aa4-4673-8004-3e4e900e0b3d",
      "parentUUID": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "7298b3be-232f-48bf-9b3d-3b433131a908",
          "type": "widget",
          "size": 71.69133771929825
        },
        {
          "uuid": "85525ebc-c40c-41e6-8379-05d573a331e1",
          "type": "widget",
          "size": 28.308662280701753
        }
      ]
    },
    {
      "uuid": "d107e54d-2db5-4abf-aba7-b96ce19f5abd",
      "parentUUID": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "7298b3be-232f-48bf-9b3d-3b445131a908",
          "type": "widget",
          "size": 33.13526570048309
        },
        {
          "uuid": "a49a59c6-b83d-40e0-b759-9d153da69105",
          "type": "widget",
          "size": 33.432367149758456
        },
        {
          "uuid": "62fa8155-10fd-49cb-a495-cee6e9491b8a",
          "type": "widget",
          "size": 33.432367149758456
        }
      ]
    },
    {
      "uuid": "d5be7f74-28c0-484c-a0cd-e623eb5db837",
      "parentUUID": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "912b86e4-e068-49e9-9f75-a2292d772578",
          "type": "widget",
          "size": 25
        },
        {
          "uuid": "42de0119-481c-4466-8b50-1407533ac2aa",
          "type": "widget",
          "size": 25
        }
      ]
    },
    {
      "uuid": "d735c561-d413-4f7e-93d9-2c494e16184e",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "66eb9453-73a2-4f69-9fc6-ececd3f96ce6",
          "type": "widget",
          "size": 100
        }
      ]
    }
  ],
  "rootSplits": [
    "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    "d735c561-d413-4f7e-93d9-2c494e16184e"
  ]
}

export const DemoThemeConfig: IThemeConfig = {
  "themeName": "modern-dark"
}

export const DemoZonesConfig: IZonesConfig = {
  "zones": [],
}

export const DemoConfig: IConfig = {
  "app": DemoAppConfig,
  "widget": DemoWidgetConfig,
  "layout": DemoLayoutConfig,
  "theme": DemoThemeConfig,
  "zones": DemoZonesConfig,
}

export const DemoConnectionConfig: IConnectionConfig = {
  "configVersion": 9,
  "kipUUID": newUuid(),
  "signalKUrl": "https://demo.signalk.org",
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
