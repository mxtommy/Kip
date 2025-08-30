import { Dashboard } from "../app/core/services/dashboard.service"
import { IConfig, IAppConfig, IConnectionConfig, IThemeConfig } from "../app/core/interfaces/app-settings.interfaces"
import { UUID } from "../app/core/utils/uuid.util"

// Demo Mode config settings file
export const DemoAppConfig: IAppConfig = {
  "configVersion": 11,
  "autoNightMode": false,
  "redNightMode": false,
  "nightModeBrightness": 0.27,
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
    "Fuel Distance": "nm/l",
    "Energy Distance": "nm/kWh",
    "Density": 'kg/m3',
    "Time": 'Hours',
    "Angular Velocity": 'deg/min',
    "Angle": 'deg',
    "Frequency": 'Hz',
    "Ratio": 'ratio',
    "Resistance": 'ohm'
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

export const DemoDashboardsConfig: Dashboard[] = [
  {
    "id": "3e0825ee-95fd-4ad4-8802-e0507845b668",
    "name": "Sailing",
    "icon": "dashboard-sailing",
    "configuration": [
      {
        "w": 3,
        "h": 4,
        "id": "339698a7-2cff-4ab9-9b50-d8056f971471",
        "selector": "widget-numeric",
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
        "w": 5,
        "h": 10,
        "id": "a44028e0-dfee-4492-895b-2b03a60f3a69",
        "selector": "widget-wind-steer",
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
              "sailSetupEnable": false,
              "enableTimeout": false,
              "dataTimeout": 5
            }
          }
        },
        "x": 3,
        "y": 0
      },
      {
        "w": 4,
        "h": 6,
        "id": "24406c15-7738-4dc1-a206-7a4862c2931d",
        "selector": "widget-gauge-ng-radial",
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
                "compassUseNumbers": false,
                "highlightsWidth": 5,
                "scaleStart": 180
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
        "x": 8,
        "y": 0
      },
      {
        "w": 3,
        "h": 4,
        "id": "c6bcaa53-afa1-42c7-ad92-d5f7dba14734",
        "selector": "widget-numeric",
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
        "y": 4
      },
      {
        "w": 4,
        "h": 6,
        "id": "973c8804-be09-4923-bb5d-48c13b65db69",
        "selector": "widget-data-chart",
        "input": {
          "widgetProperties": {
            "type": "widget-data-chart",
            "uuid": "973c8804-be09-4923-bb5d-48c13b65db69",
            "config": {
              "displayName": "Chart Label",
              "filterSelfPaths": true,
              "convertUnitTo": "knots",
              "datasetUUID": "afbe4e41-26f5-404f-a55d-9f7b9b76fbd1",
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
        "x": 8,
        "y": 6
      },
      {
        "x": 0,
        "y": 8,
        "w": 3,
        "h": 4,
        "minW": 1,
        "minH": 1,
        "id": "5289a84d-18fd-4ee7-9724-72249af403f2",
        "selector": "widget-position",
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
        "w": 5,
        "h": 2,
        "id": "1a7a3f79-2eb4-4092-a0c3-9a61db8a8586",
        "selector": "widget-simple-linear",
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
        "x": 3,
        "y": 10
      }
    ]
  },
  {
    "id": "7c67c8c5-dc55-4e1d-9fc5-3dd95fd41bea",
    "name": "Charting",
    "icon": "dashboard-map",
    "configuration": [
      {
        "x": 0,
        "y": 0,
        "w": 8,
        "h": 12,
        "id": "488d620a-37d4-4b98-849d-304cd18003e9",
        "selector": "widget-freeboardsk",
        "input": {
          "widgetProperties": {
            "type": "widget-freeboardsk",
            "uuid": "488d620a-37d4-4b98-849d-304cd18003e9"
          }
        }
      },
      {
        "x": 8,
        "y": 0,
        "w": 2,
        "h": 3,
        "id": "26a2a150-5af8-4f1d-aaab-0cb2a406fc17",
        "selector": "widget-gauge-ng-compass",
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
        "x": 10,
        "y": 0,
        "w": 2,
        "h": 3,
        "id": "caf9ca47-fcf6-4736-a314-2b5210edaf03",
        "selector": "widget-datetime",
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
        "x": 8,
        "y": 3,
        "w": 4,
        "h": 9,
        "id": "daa21350-009e-4d99-8209-364f9b99caee",
        "selector": "widget-autopilot",
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
              "invertRudder": true,
              "headingDirectionTrue": false,
              "courseDirectionTrue": false,
              "enableTimeout": false,
              "dataTimeout": 5,
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
  "configVersion": 11,
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
