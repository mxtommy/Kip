

export const DemoConfig = {
  "configVersion": 1,
  "signalKUrl": "http://demo.signalk.org",
  "themeName": "default-light",
  "widgets": [
    {
      "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
      "type": "WidgetNumeric",
      "config": {
        "widgetLabel": "Depth Feet",
        "paths": {
          "numericPath": {
            "description": "Numeric Data",
            "path": "self.environment.depth.belowTransducer",
            "source": "default",
            "pathType": "number"
          }
        },
        "units": {
          "numericPath": "feet"
        },
        "selfPaths": true,
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
            "pathType": "number"
          },
          "trueWindAngle": {
            "description": "True Wind Angle",
            "path": "self.environment.wind.angleTrueWater",
            "source": "default",
            "pathType": "number"
          },
          "trueWindSpeed": {
            "description": "True Wind Speed",
            "path": "self.environment.wind.speedTrue",
            "source": "default",
            "pathType": "number"
          },
          "appWindAngle": {
            "description": "Apparent Wind Angle",
            "path": "self.environment.wind.angleApparent",
            "source": "default",
            "pathType": "number"
          },
          "appWindSpeed": {
            "description": "Apparent Wind Speed",
            "path": "self.environment.wind.speedApparent",
            "source": "default",
            "pathType": "number"
          }
        },
        "units": {
          "trueWindSpeed": "knots",
          "appWindSpeed": "knots"
        },
        "selfPaths": true,
        "windSectorEnable": true,
        "windSectorWindowSeconds": 10,
        "laylineEnable": true,
        "laylineAngle": 35
      }
    },
    {
      "uuid": "912b86e4-e068-49e9-9f75-a2292d772578",
      "type": "WidgetGaugeComponent",
      "config": {
        "widgetLabel": "Speed over ground",
        "paths": {
          "gaugePath": {
            "description": "Numeric Data",
            "path": "self.navigation.speedOverGround",
            "source": "default",
            "pathType": "number"
          }
        },
        "units": {
          "gaugePath": "knots"
        },
        "selfPaths": true,
        "gaugeType": "radial",
        "barGraph": false,
        "radialSize": "full",
        "minValue": 0,
        "maxValue": 10,
        "rotateFace": false,
        "backgroundColor": "turned",
        "frameColor": "tiltedBlack"
      }
    },
    {
      "uuid": "85525ebc-c40c-41e6-8379-05d573a331e1",
      "type": "WidgetGaugeComponent",
      "config": {
        "widgetLabel": "Apparent Wind Speed",
        "paths": {
          "gaugePath": {
            "description": "Numeric Data",
            "path": "self.environment.wind.speedApparent",
            "source": "default",
            "pathType": "number"
          }
        },
        "units": {
          "gaugePath": "knots"
        },
        "selfPaths": true,
        "gaugeType": "linear",
        "barGraph": true,
        "radialSize": "full",
        "minValue": 0,
        "maxValue": 30,
        "rotateFace": false,
        "backgroundColor": "stainless",
        "frameColor": "chrome"
      }
    },
    {
      "uuid": "a49a59c6-b83d-40e0-b759-9d153da69105",
      "type": "WidgetNumeric",
      "config": {
        "widgetLabel": "Speed (water)",
        "paths": {
          "numericPath": {
            "description": "Numeric Data",
            "path": "self.navigation.speedThroughWater",
            "source": "default",
            "pathType": "number"
          }
        },
        "units": {
          "numericPath": "knots"
        },
        "selfPaths": true,
        "numDecimal": 1,
        "numInt": 1
      }
    },
    {
      "uuid": "62fa8155-10fd-49cb-a495-cee6e9491b8a",
      "type": "WidgetNumeric",
      "config": {
        "widgetLabel": "VMG",
        "paths": {
          "numericPath": {
            "description": "Numeric Data",
            "path": "self.performance.velocityMadeGood",
            "source": "default",
            "pathType": "number"
          }
        },
        "units": {
          "numericPath": "knots"
        },
        "selfPaths": true,
        "numDecimal": 1,
        "numInt": 1
      }
    },
    {
      "uuid": "42de0119-481c-4466-8b50-1407533ac2aa",
      "type": "WidgetHistorical",
      "config": {
        "widgetLabel": "WindSpeed True",
        "units": {
          "dataset": "knots"
        },
        "dataSetUUID": "afbe4e41-26f5-404f-a55d-9f7b9b76fbd1",
        "invertData": false,
        "displayMinMax": false,
        "includeZero": true,
        "minValue": null,
        "maxValue": null
      }
    }
  ],
  "unlockStatus": false,
  "dataSets": [
    {
      "uuid": "afbe4e41-26f5-404f-a55d-9f7b9b76fbd1",
      "path": "self.environment.wind.speedTrue",
      "signalKSource": "default",
      "updateTimer": 1,
      "dataPoints": 15
    }
  ],
  "splitSets": [
    {
      "uuid": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "d107e54d-2db5-4abf-aba7-b96ce19f5abd",
          "type": "splitSet",
          "size": 27.406021225904265
        },
        {
          "uuid": "9249373f-7aa4-4673-8004-3e4e900e0b3d",
          "type": "splitSet",
          "size": 45.296959997548555
        },
        {
          "uuid": "d5be7f74-28c0-484c-a0cd-e623eb5db837",
          "type": "splitSet",
          "size": 27.297018776547173
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
          "size": 77.30434782608697
        },
        {
          "uuid": "85525ebc-c40c-41e6-8379-05d573a331e1",
          "type": "widget",
          "size": 22.69565217391304
        }
      ]
    },
    {
      "uuid": "d107e54d-2db5-4abf-aba7-b96ce19f5abd",
      "parentUUID": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
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
    }
  ],
  "rootSplits": [
    "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
  ]
}