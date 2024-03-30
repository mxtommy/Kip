import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig, ILayoutConfig, IWidgetConfig, IZonesConfig } from "../app/core/interfaces/app-settings.interfaces"
import { UUID } from "../app/utils/uuid"

// Demo Mode config settings file
export const DemoAppConfig: IAppConfig = {
  "configVersion": 10,
  "autoNightMode": false,
  "dataSets": [
    {
      "uuid": "afbe4e41-26f5-404f-a55d-9f7b9b76fbd1",
      "path": "self.environment.wind.speedApparent",
      "pathSource": "default",
      "sampleTime": 1000,
      "period": 1,
      "maxDataPoints": 60,
      "smoothingPeriod": 12,
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
                "displayName": "Depth",
                "filterSelfPaths": true,
                "paths": {
                    "numericPath": {
                        "description": "Numeric Data",
                        "path": "self.environment.depth.belowTransducer",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "m",
                        "sampleTime": 500
                    }
                },
                "showMax": false,
                "showMin": false,
                "numDecimal": 1,
                "numInt": 1,
                "textColor": "accent",
                "enableTimeout": false
            }
        },
        {
            "uuid": "7298b3be-232f-48bf-9b3d-3b433131a908",
            "type": "WidgetWindComponent",
            "config": {
                "paths": {
                    "headingPath": {
                        "description": "Heading",
                        "path": "self.navigation.headingTrue",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "deg",
                        "sampleTime": 500
                    },
                    "courseOverGround": {
                        "description": "Course Over Ground",
                        "path": "self.navigation.courseOverGroundTrue",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "deg",
                        "sampleTime": 500
                    },
                    "trueWindAngle": {
                        "description": "True Wind Angle",
                        "path": "self.environment.wind.angleTrueWater",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "deg",
                        "sampleTime": 500
                    },
                    "trueWindSpeed": {
                        "description": "True Wind Speed",
                        "path": "self.environment.wind.speedTrue",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "knots",
                        "sampleTime": 500
                    },
                    "appWindAngle": {
                        "description": "Apparent Wind Angle",
                        "path": "self.environment.wind.angleApparent",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "deg",
                        "sampleTime": 500
                    },
                    "appWindSpeed": {
                        "description": "Apparent Wind Speed",
                        "path": "self.environment.wind.speedApparent",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "knots",
                        "sampleTime": 500
                    },
                    "nextWaypointBearing": {
                        "description": "Next Waypoint Bearing",
                        "path": "self.navigation.courseGreatCircle.nextPoint.bearingTrue",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "deg",
                        "sampleTime": 500
                    }
                },
                "windSectorEnable": true,
                "windSectorWindowSeconds": 5,
                "laylineEnable": true,
                "laylineAngle": 40,
                "waypointEnable": true,
                "courseOverGroundEnable": true,
                "sailSetupEnable": false,
                "enableTimeout": false,
                "dataTimeout": 5
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
                        "convertUnitTo": "knots",
                        "sampleTime": 500
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
            "type": "WidgetSimpleLinearComponent",
            "config": {
                "displayName": "House Bank",
                "filterSelfPaths": true,
                "paths": {
                    "gaugePath": {
                        "description": "Numeric Data",
                        "path": "self.electrical.batteries.1.voltage",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "V",
                        "sampleTime": 500
                    }
                },
                "minValue": 9,
                "maxValue": 15,
                "numInt": 1,
                "numDecimal": 2,
                "gaugeType": "simpleLinear",
                "gaugeUnitLabelFormat": "full",
                "barColor": "warn",
                "enableTimeout": false
            }
        },
        {
            "uuid": "a49a59c6-b83d-40e0-b759-9d153da69105",
            "type": "WidgetNumeric",
            "config": {
                "displayName": "Speed",
                "filterSelfPaths": true,
                "paths": {
                    "numericPath": {
                        "description": "Numeric Data",
                        "path": "self.navigation.speedThroughWater",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "knots",
                        "sampleTime": 500
                    }
                },
                "showMax": true,
                "showMin": true,
                "numDecimal": 1,
                "numInt": 1,
                "textColor": "text",
                "enableTimeout": false
            }
        },
        {
            "uuid": "62fa8155-10fd-49cb-a495-cee6e9491b8a",
            "type": "WidgetNumeric",
            "config": {
                "displayName": "Temp Outside",
                "filterSelfPaths": true,
                "paths": {
                    "numericPath": {
                        "description": "Numeric Data",
                        "path": "self.electrical.batteries.1.temperature",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "celsius",
                        "sampleTime": 500
                    }
                },
                "showMax": true,
                "showMin": true,
                "numDecimal": 1,
                "numInt": 1,
                "textColor": "primary",
                "enableTimeout": false
            }
        },
        {
            "uuid": "42de0119-481c-4466-8b50-1407533ac2aa",
            "type": "WidgetDataChart",
            "config": {
                "displayName": "AWS",
                "filterSelfPaths": true,
                "convertUnitTo": "knots",
                "datasetUUID": "afbe4e41-26f5-404f-a55d-9f7b9b76fbd1",
                "invertData": false,
                "datasetAverageArray": "sma",
                "showAverageData": true,
                "trackAgainstAverage": false,
                "showDatasetMinimumValueLine": false,
                "showDatasetMaximumValueLine": false,
                "showDatasetAverageValueLine": false,
                "showDatasetAngleAverageValueLine": false,
                "showLabel": true,
                "showTimeScale": true,
                "startScaleAtZero": true,
                "verticalGraph": false,
                "showYScale": true,
                "yScaleSuggestedMin": null,
                "yScaleSuggestedMax": null,
                "enableMinMaxScaleLimit": false,
                "numDecimal": 1,
                "textColor": "primary",
                "minValue": null,
                "maxValue": null
            }
        },
        {
            "uuid": "66eb9453-73a2-4f69-9fc6-ececd3f96ce6",
            "type": "WidgetFreeboardskComponent",
            "config": {}
        },
        {
            "uuid": "bd80f868-b1e2-46e9-a408-5cb8f1458a37",
            "type": "WidgetGaugeNgRadialComponent",
            "config": {
                "displayName": "COG (T)",
                "filterSelfPaths": true,
                "paths": {
                    "gaugePath": {
                        "description": "Numeric Data",
                        "path": "self.navigation.courseOverGroundTrue",
                        "source": "default",
                        "pathType": "number",
                        "isPathConfigurable": true,
                        "convertUnitTo": "deg",
                        "sampleTime": 500
                    }
                },
                "gaugeType": "ngRadial",
                "gaugeTicks": false,
                "radialSize": "baseplateCompass",
                "compassUseNumbers": false,
                "minValue": 0,
                "maxValue": 100,
                "numInt": 1,
                "numDecimal": 0,
                "barColor": "accent",
                "enableTimeout": false
            }
        },
        {
            "uuid": "956a40e8-9097-409d-b382-5c5cfc3a413b",
            "type": "WidgetAutopilotComponent",
            "config": {
                "displayName": "N2k Autopilot",
                "filterSelfPaths": true,
                "paths": {
                    "apState": {
                        "description": "Autopilot State",
                        "path": "self.steering.autopilot.state",
                        "source": "default",
                        "pathType": "string",
                        "isPathConfigurable": false,
                        "convertUnitTo": "",
                        "sampleTime": 500
                    },
                    "apTargetHeadingMag": {
                        "description": "Autopilot Target Heading Mag",
                        "path": "self.steering.autopilot.target.headingMagnetic",
                        "source": "default",
                        "pathType": "number",
                        "convertUnitTo": "deg",
                        "isPathConfigurable": true,
                        "sampleTime": 500
                    },
                    "apTargetWindAngleApp": {
                        "description": "Autopilot Target Wind Angle Apparent",
                        "path": "self.steering.autopilot.target.windAngleApparent",
                        "source": "default",
                        "pathType": "number",
                        "convertUnitTo": "deg",
                        "isPathConfigurable": true,
                        "sampleTime": 500
                    },
                    "apNotifications": {
                        "description": "Autopilot Notifications",
                        "path": "self.notifications.autopilot.*",
                        "source": "default",
                        "pathType": "string",
                        "convertUnitTo": "",
                        "isPathConfigurable": false,
                        "sampleTime": 500
                    },
                    "headingMag": {
                        "description": "Heading Magnetic",
                        "path": "self.navigation.headingMagnetic",
                        "source": "default",
                        "pathType": "number",
                        "convertUnitTo": "deg",
                        "isPathConfigurable": true,
                        "sampleTime": 500
                    },
                    "headingTrue": {
                        "description": "Heading True",
                        "path": "self.navigation.headingTrue",
                        "source": "default",
                        "pathType": "number",
                        "convertUnitTo": "deg",
                        "isPathConfigurable": true,
                        "sampleTime": 500
                    },
                    "windAngleApparent": {
                        "description": "Wind Angle Apparent",
                        "path": "self.environment.wind.angleApparent",
                        "source": "default",
                        "pathType": "number",
                        "convertUnitTo": "deg",
                        "isPathConfigurable": true,
                        "sampleTime": 500
                    },
                    "windAngleTrueWater": {
                        "description": "Wind Angle True Water",
                        "path": "self.environment.wind.angleTrueWater",
                        "source": "default",
                        "pathType": "number",
                        "convertUnitTo": "deg",
                        "isPathConfigurable": true,
                        "sampleTime": 500
                    },
                    "rudderAngle": {
                        "description": "Rudder Angle",
                        "path": "self.steering.rudderAngle",
                        "source": "default",
                        "pathType": "number",
                        "convertUnitTo": "deg",
                        "isPathConfigurable": true,
                        "sampleTime": 500
                    }
                },
                "usage": {
                    "headingMag": [
                        "wind",
                        "route",
                        "auto",
                        "standby"
                    ],
                    "headingTrue": [
                        "wind",
                        "route",
                        "auto",
                        "standby"
                    ],
                    "windAngleApparent": [
                        "wind"
                    ],
                    "windAngleTrueWater": [
                        "wind"
                    ]
                },
                "typeVal": {
                    "headingMag": "Mag",
                    "headingTrue": "True",
                    "windAngleApparent": "AWA",
                    "windAngleTrueWater": "TWA"
                },
                "barColor": "accent",
                "autoStart": false,
                "enableTimeout": false,
                "dataTimeout": 5
            }
        },
        {
            "uuid": "7ba4e2d1-2d63-41f5-b2e9-1a41886796a4",
            "type": "WidgetDateGeneric",
            "config": {
                "displayName": "Next WP Arrival",
                "filterSelfPaths": true,
                "paths": {
                    "gaugePath": {
                        "description": "String Data",
                        "path": "self.navigation.datetime",
                        "source": "default",
                        "pathType": "Date",
                        "isPathConfigurable": true,
                        "sampleTime": 500
                    }
                },
                "dateFormat": "dd/MM HH:mm",
                "dateTimezone": "America/Toronto",
                "textColor": "text",
                "enableTimeout": false
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
                  "size": 73.53760445682451
              },
              {
                  "uuid": "0dd2388a-2e59-46ba-9af2-4203a3b97016",
                  "type": "splitSet",
                  "size": 26.46239554317549
              }
          ]
      },
      {
          "uuid": "0dd2388a-2e59-46ba-9af2-4203a3b97016",
          "parentUUID": "d735c561-d413-4f7e-93d9-2c494e16184e",
          "direction": "vertical",
          "splitAreas": [
              {
                  "uuid": "400935ce-a3b0-4671-bf67-11874d10bfec",
                  "type": "splitSet",
                  "size": 32.7893175074184
              },
              {
                  "uuid": "956a40e8-9097-409d-b382-5c5cfc3a413b",
                  "type": "widget",
                  "size": 67.2106824925816
              }
          ]
      },
      {
          "uuid": "400935ce-a3b0-4671-bf67-11874d10bfec",
          "parentUUID": "0dd2388a-2e59-46ba-9af2-4203a3b97016",
          "direction": "horizontal",
          "splitAreas": [
              {
                  "uuid": "bd80f868-b1e2-46e9-a408-5cb8f1458a37",
                  "type": "widget",
                  "size": 25
              },
              {
                  "uuid": "7ba4e2d1-2d63-41f5-b2e9-1a41886796a4",
                  "type": "widget",
                  "size": 25
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
  "configVersion": 10,
  "kipUUID": UUID.create(),
  "signalKUrl": "https://demo.signalk.org",
  "proxyEnabled": false,
  "useDeviceToken": false,
  "loginName": null,
  "loginPassword": null,
  "useSharedConfig": false,
  "sharedConfigName": "default"
}
