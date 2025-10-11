import { Dashboard } from "../app/core/services/dashboard.service"
import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig } from "../app/core/interfaces/app-settings.interfaces"
import { UUID } from "../app/core/utils/uuid.util"

// Demo Mode config settings file
export const DemoAppConfig: IAppConfig = {
  "configVersion": 12,
  "autoNightMode": false,
  "redNightMode": false,
  "nightModeBrightness": 0.27,
  "isRemoteControl": false,
  "instanceName": "",
  "splitShellEnabled": true,
  "splitShellSide": "left",
  "splitShellSwipeDisabled": false,
  "splitShellWidth": 0.7,
  "dataSets": [
    {
      "uuid": "339698a7-2cff-4ab9-9b50-d8056f971471",
      "path": "self.environment.depth.belowTransducer",
      "pathSource": "default",
      "baseUnit": "m",
      "timeScaleFormat": "minute",
      "period": 0.2,
      "label": "simple-chart-339698a7-2cff-4ab9-9b50-d8056f971471",
      "editable": false
    }
  ],
  "unitDefaults": {
    "Unitless": "unitless",
    "Speed": "knots",
    "Flow": "l/h",
    "Temperature": "celsius",
    "Length": "m",
    "Volume": "liter",
    "Current": "A",
    "Potential": "V",
    "Charge": "C",
    "Power": "W",
    "Energy": "J",
    "Pressure": "mmHg",
    "Fuel Distance": "nm/l",
    "Energy Distance": "nm/kWh",
    "Density": "kg/m3",
    "Time": "Hours",
    "Angular Velocity": "deg/min",
    "Angle": "deg",
    "Frequency": "Hz",
    "Ratio": "ratio",
    "Resistance": "ohm"
  },
  "notificationConfig": {
    "disableNotifications": false,
    "menuGrouping": true,
    "security": {
      "disableSecurity": true
    },
    "devices": {
      "disableDevices": false,
      "showNormalState": false,
      "showNominalState": false
    },
    "sound": {
      "disableSound": false,
      "muteNormal": true,
      "muteNominal": true,
      "muteWarn": false,
      "muteAlert": false,
      "muteAlarm": false,
      "muteEmergency": false
    }
  }
}

export const DemoDashboardsConfig: Dashboard[] = [
  {
    "id": "3e0825ee-95fd-4ad4-8802-e0507845b668",
    "name": "Sailing",
    "icon": "dashboard-sailing",
    "configuration": [
      {
        "w": 6,
        "h": 8,
        "id": "339698a7-2cff-4ab9-9b50-d8056f971471",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-numeric",
            "uuid": "339698a7-2cff-4ab9-9b50-d8056f971471",
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
                  "showPathSkUnitsFilter": true,
                  "pathSkUnitsFilter": null,
                  "sampleTime": 500
                }
              },
              "showMax": false,
              "showMin": false,
              "numDecimal": 1,
              "showMiniChart": true,
              "yScaleMin": 0,
              "yScaleMax": 100,
              "inverseYAxis": false,
              "verticalChart": false,
              "color": "blue",
              "enableTimeout": false,
              "dataTimeout": 5,
              "ignoreZones": false
            }
          }
        },
        "x": 0,
        "y": 0
      },
      {
        "w": 10,
        "h": 20,
        "id": "a44028e0-dfee-4492-895b-2b03a60f3a69",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-wind-steer",
            "uuid": "a44028e0-dfee-4492-895b-2b03a60f3a69",
            "config": {
              "filterSelfPaths": true,
              "paths": {
                "headingPath": {
                  "description": "True Heading",
                  "path": "self.navigation.headingTrue",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "pathRequired": true,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "convertUnitTo": "deg",
                  "showConvertUnitTo": false,
                  "sampleTime": 500
                },
                "appWindAngle": {
                  "description": "Apparent Wind Angle",
                  "path": "self.environment.wind.angleApparent",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "pathRequired": true,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "convertUnitTo": "deg",
                  "showConvertUnitTo": false,
                  "sampleTime": 500
                },
                "appWindSpeed": {
                  "description": "Apparent Wind Speed",
                  "path": "self.environment.wind.speedApparent",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "pathRequired": true,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "m/s",
                  "convertUnitTo": "knots",
                  "sampleTime": 500
                },
                "trueWindAngle": {
                  "description": "True Wind Angle",
                  "path": "self.environment.wind.angleTrueWater",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "convertUnitTo": "deg",
                  "showConvertUnitTo": false,
                  "sampleTime": 500
                },
                "trueWindSpeed": {
                  "description": "True Wind Speed",
                  "path": "self.environment.wind.speedTrue",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "m/s",
                  "convertUnitTo": "knots",
                  "sampleTime": 500
                },
                "courseOverGround": {
                  "description": "True Course Over Ground",
                  "path": "self.navigation.courseOverGroundTrue",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "showConvertUnitTo": false,
                  "convertUnitTo": "deg",
                  "sampleTime": 500
                },
                "nextWaypointBearing": {
                  "description": "Next Waypoint True Bearing",
                  "path": "self.navigation.courseGreatCircle.nextPoint.bearingTrue",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": false,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "convertUnitTo": "deg",
                  "showConvertUnitTo": false,
                  "sampleTime": 500
                },
                "set": {
                  "description": "True Drift Set",
                  "path": "self.environment.current.setTrue",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "convertUnitTo": "deg",
                  "showConvertUnitTo": false,
                  "sampleTime": 500
                },
                "drift": {
                  "description": "Drift Speed Impact",
                  "path": "self.environment.current.drift",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "m/s",
                  "convertUnitTo": "knots",
                  "sampleTime": 500
                }
              },
              "windSectorEnable": true,
              "windSectorWindowSeconds": 5,
              "laylineEnable": true,
              "laylineAngle": 40,
              "waypointEnable": true,
              "courseOverGroundEnable": true,
              "driftEnable": true,
              "awsEnable": true,
              "twsEnable": true,
              "twaEnable": true,
              "sailSetupEnable": false,
              "enableTimeout": false,
              "dataTimeout": 5
            }
          }
        },
        "x": 6,
        "y": 0
      },
      {
        "w": 8,
        "h": 12,
        "id": "24406c15-7738-4dc1-a206-7a4862c2931d",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-gauge-ng-radial",
            "uuid": "24406c15-7738-4dc1-a206-7a4862c2931d",
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
                  "showPathSkUnitsFilter": true,
                  "pathSkUnitsFilter": null,
                  "convertUnitTo": "knots",
                  "sampleTime": 500
                }
              },
              "displayScale": {
                "lower": 0,
                "upper": 10,
                "type": "linear"
              },
              "gauge": {
                "type": "ngRadial",
                "subType": "measuring",
                "enableTicks": true,
                "enableNeedle": true,
                "enableProgressbar": true,
                "highlightsWidth": 5,
                "scaleStart": 180,
                "barStartPosition": "left"
              },
              "numInt": 1,
              "numDecimal": 1,
              "enableTimeout": false,
              "color": "yellow",
              "dataTimeout": 5,
              "ignoreZones": false
            }
          }
        },
        "x": 16,
        "y": 0
      },
      {
        "w": 6,
        "h": 8,
        "id": "c6bcaa53-afa1-42c7-ad92-d5f7dba14734",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-numeric",
            "uuid": "c6bcaa53-afa1-42c7-ad92-d5f7dba14734",
            "config": {
              "displayName": "STW",
              "filterSelfPaths": true,
              "paths": {
                "numericPath": {
                  "description": "Numeric Data",
                  "path": "self.navigation.speedThroughWater",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "convertUnitTo": "knots",
                  "showPathSkUnitsFilter": true,
                  "pathSkUnitsFilter": null,
                  "sampleTime": 500
                }
              },
              "showMax": true,
              "showMin": true,
              "numDecimal": 1,
              "showMiniChart": false,
              "yScaleMin": 0,
              "yScaleMax": 10,
              "inverseYAxis": false,
              "verticalChart": false,
              "color": "contrast",
              "enableTimeout": false,
              "dataTimeout": 5,
              "ignoreZones": false
            }
          }
        },
        "x": 0,
        "y": 8
      },
      {
        "w": 8,
        "h": 12,
        "id": "973c8804-be09-4923-bb5d-48c13b65db69",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-data-chart",
            "uuid": "973c8804-be09-4923-bb5d-48c13b65db69",
            "config": {
              "displayName": "Chart Label",
              "filterSelfPaths": true,
              "datachartPath": "self.environment.wind.speedApparent",
              "datachartSource": "default",
              "period": 1,
              "timeScale": "minute",
              "convertUnitTo": "knots",
              "timeScaleFormat": "minute",
              "inverseYAxis": false,
              "datasetAverageArray": "sma",
              "showAverageData": true,
              "trackAgainstAverage": false,
              "showDatasetMinimumValueLine": false,
              "showDatasetMaximumValueLine": false,
              "showDatasetAverageValueLine": true,
              "showDatasetAngleAverageValueLine": false,
              "showLabel": false,
              "showTimeScale": true,
              "startScaleAtZero": false,
              "verticalChart": false,
              "showYScale": true,
              "yScaleSuggestedMin": null,
              "yScaleSuggestedMax": null,
              "enableMinMaxScaleLimit": false,
              "yScaleMin": null,
              "yScaleMax": null,
              "numDecimal": 1,
              "color": "orange",
              "invertData": false,
              "verticalGraph": false
            }
          }
        },
        "x": 16,
        "y": 12
      },
      {
        "x": 0,
        "y": 16,
        "w": 6,
        "h": 8,
        "minW": 1,
        "minH": 1,
        "id": "5289a84d-18fd-4ee7-9724-72249af403f2",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-position",
            "uuid": "5289a84d-18fd-4ee7-9724-72249af403f2",
            "config": {
              "displayName": "Position",
              "filterSelfPaths": true,
              "paths": {
                "longPath": {
                  "description": "Longitude",
                  "path": "self.navigation.position.longitude",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "convertUnitTo": "longitudeMin",
                  "showPathSkUnitsFilter": true,
                  "pathSkUnitsFilter": null,
                  "sampleTime": 500
                },
                "latPath": {
                  "description": "Latitude",
                  "path": "self.navigation.position.latitude",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": true,
                  "convertUnitTo": "latitudeMin",
                  "showPathSkUnitsFilter": true,
                  "pathSkUnitsFilter": null,
                  "sampleTime": 500
                }
              },
              "color": "grey",
              "enableTimeout": false,
              "dataTimeout": 5
            }
          }
        }
      },
      {
        "w": 10,
        "h": 4,
        "id": "1a7a3f79-2eb4-4092-a0c3-9a61db8a8586",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-simple-linear",
            "uuid": "1a7a3f79-2eb4-4092-a0c3-9a61db8a8586",
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
                  "showPathSkUnitsFilter": true,
                  "pathSkUnitsFilter": "V",
                  "convertUnitTo": "V",
                  "sampleTime": 500
                }
              },
              "displayScale": {
                "lower": 0,
                "upper": 15,
                "type": "linear"
              },
              "gauge": {
                "type": "simpleLinear",
                "unitLabelFormat": "full"
              },
              "numInt": 1,
              "numDecimal": 2,
              "ignoreZones": false,
              "color": "green",
              "enableTimeout": false,
              "dataTimeout": 5
            }
          }
        },
        "x": 6,
        "y": 20
      }
    ],
    "collapseSplitShell": true
  },
  {
    "id": "7c67c8c5-dc55-4e1d-9fc5-3dd95fd41bea",
    "name": "Charting",
    "icon": "dashboard-map",
    "configuration": [
      {
        "x": 0,
        "y": 0,
        "w": 12,
        "h": 6,
        "id": "26a2a150-5af8-4f1d-aaab-0cb2a406fc17",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-gauge-ng-compass",
            "uuid": "26a2a150-5af8-4f1d-aaab-0cb2a406fc17",
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
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "showConvertUnitTo": false,
                  "convertUnitTo": "deg",
                  "sampleTime": 500
                }
              },
              "gauge": {
                "type": "ngRadial",
                "subType": "marineCompass",
                "enableTicks": true,
                "compassUseNumbers": true,
                "showValueBox": false
              },
              "enableTimeout": false,
              "color": "purple",
              "dataTimeout": 5
            }
          }
        }
      },
      {
        "x": 12,
        "y": 0,
        "w": 12,
        "h": 6,
        "id": "caf9ca47-fcf6-4736-a314-2b5210edaf03",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-datetime",
            "uuid": "caf9ca47-fcf6-4736-a314-2b5210edaf03",
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
              "color": "contrast",
              "enableTimeout": false,
              "dataTimeout": 5
            }
          }
        }
      },
      {
        "x": 0,
        "y": 6,
        "w": 24,
        "h": 18,
        "id": "daa21350-009e-4d99-8209-364f9b99caee",
        "selector": "widget-host2",
        "input": {
          "widgetProperties": {
            "type": "widget-autopilot",
            "uuid": "daa21350-009e-4d99-8209-364f9b99caee",
            "config": {
              "filterSelfPaths": true,
              "paths": {
                "autopilotState": {
                  "description": "Autopilot State",
                  "path": "self.steering.autopilot.state",
                  "source": "default",
                  "pathType": "string",
                  "isPathConfigurable": false,
                  "showPathSkUnitsFilter": false,
                  "convertUnitTo": "",
                  "sampleTime": 500
                },
                "autopilotMode": {
                  "description": "Autopilot Mode",
                  "path": "self.steering.autopilot.mode",
                  "source": "default",
                  "pathType": "string",
                  "isPathConfigurable": false,
                  "showPathSkUnitsFilter": false,
                  "convertUnitTo": "",
                  "sampleTime": 500
                },
                "autopilotEngaged": {
                  "description": "Autopilot Engaged",
                  "path": "self.steering.autopilot.engaged",
                  "source": "default",
                  "pathType": "boolean",
                  "isPathConfigurable": false,
                  "showPathSkUnitsFilter": false,
                  "convertUnitTo": "",
                  "sampleTime": 500
                },
                "autopilotV2Target": {
                  "description": "Autopilot API v2 Target",
                  "path": "self.steering.autopilot.target",
                  "source": "default",
                  "pathType": "number",
                  "convertUnitTo": "deg",
                  "isPathConfigurable": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "sampleTime": 500
                },
                "autopilotTargetHeading": {
                  "description": "Autopilot Target Magnetic Heading",
                  "path": "self.steering.autopilot.target.headingMagnetic",
                  "source": "default",
                  "pathType": "number",
                  "convertUnitTo": "deg",
                  "isPathConfigurable": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "sampleTime": 500
                },
                "autopilotTargetWindHeading": {
                  "description": "Autopilot Target Apparent Wind Angle",
                  "path": "self.steering.autopilot.target.windAngleApparent",
                  "source": "default",
                  "pathType": "number",
                  "convertUnitTo": "deg",
                  "isPathConfigurable": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "sampleTime": 500
                },
                "rudderAngle": {
                  "description": "Rudder Angle",
                  "path": "self.steering.rudderAngle",
                  "source": "default",
                  "pathType": "number",
                  "convertUnitTo": "deg",
                  "isPathConfigurable": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "sampleTime": 500
                },
                "courseXte": {
                  "description": "Cross Track Error",
                  "path": "self.navigation.course.calcValues.crossTrackError",
                  "source": "default",
                  "pathType": "number",
                  "isPathConfigurable": false,
                  "convertUnitTo": "m",
                  "showPathSkUnitsFilter": true,
                  "pathRequired": false,
                  "pathSkUnitsFilter": "m",
                  "sampleTime": 500
                },
                "headingMag": {
                  "description": "Magnetic Heading",
                  "path": "self.navigation.headingMagnetic",
                  "source": "default",
                  "pathType": "number",
                  "convertUnitTo": "deg",
                  "isPathConfigurable": true,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "showConvertUnitTo": false,
                  "sampleTime": 500
                },
                "headingTrue": {
                  "description": "True Heading",
                  "path": "self.navigation.headingTrue",
                  "source": "default",
                  "pathType": "number",
                  "convertUnitTo": "deg",
                  "isPathConfigurable": true,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "showConvertUnitTo": false,
                  "sampleTime": 500
                },
                "windAngleApparent": {
                  "description": "Apparent Wind Angle",
                  "path": "self.environment.wind.angleApparent",
                  "source": "default",
                  "pathType": "number",
                  "convertUnitTo": "deg",
                  "isPathConfigurable": true,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "showConvertUnitTo": false,
                  "sampleTime": 500
                },
                "windAngleTrueWater": {
                  "description": "Wind Angle True Water",
                  "path": "self.environment.wind.angleTrueWater",
                  "source": "default",
                  "pathType": "number",
                  "convertUnitTo": "deg",
                  "isPathConfigurable": true,
                  "pathRequired": false,
                  "showPathSkUnitsFilter": false,
                  "pathSkUnitsFilter": "rad",
                  "showConvertUnitTo": false,
                  "sampleTime": 500
                }
              },
              "autopilot": {
                "invertRudder": true,
                "headingDirectionTrue": false,
                "courseDirectionTrue": false,
                "apiVersion": null,
                "instanceId": null,
                "pluginId": null,
                "modes": null
              },
              "enableTimeout": false,
              "dataTimeout": 5,
              "invertRudder": true,
              "headingDirectionTrue": false,
              "courseDirectionTrue": false,
              "autopilotInstance": "_default"
            }
          }
        }
      }
    ]
  }
]

export const DemoThemeConfig: IThemeConfig = {
  "themeName": ""
}

export const DemoConfig: IConfig = {
  "app": DemoAppConfig,
  "dashboards": DemoDashboardsConfig,
  "theme": DemoThemeConfig,
}

export const DemoConnectionConfig: IConnectionConfig = {
  "configVersion": 12,
  "kipUUID": UUID.create(),
  "signalKUrl": "https://demo.signalk.org",
  "proxyEnabled": false,
  "signalKSubscribeAll": false,
  "useDeviceToken": false,
  "loginName": null,
  "loginPassword": null,
  "useSharedConfig": false,
  "sharedConfigName": "default"
}
