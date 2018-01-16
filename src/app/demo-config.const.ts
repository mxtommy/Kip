

export const DemoConfig = {
  "signalKUrl": "http://demo.signalk.org",
  "themeName": "default-light",
  "widgets": [
    {
      "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
      "type": "WidgetNumeric",
      "config": {
        "signalKPath": "vessels.self.environment.wind.speedTrue",
        "signalKSource": "default",
        "label": "True Wind",
        "unitGroup": "speed",
        "unitName": "knots",
        "numDecimal": 2,
        "numInt": 2
      }
    },
    {
      "uuid": "a3d595eb-f1a0-45a2-9faa-7af31757f129",
      "type": "WidgetWindComponent",
      "config": {
        "headingPath": "vessels.self.navigation.headingTrue",
        "headingSource": "default",
        "trueWindAnglePath": "vessels.self.environment.wind.angleTrueWater",
        "trueWindAngleSource": "default",
        "trueWindSpeedPath": "vessels.self.environment.wind.speedTrue",
        "trueWindSpeedSource": "default",
        "appWindAnglePath": "vessels.self.environment.wind.angleApparent",
        "appWindAngleSource": "default",
        "appWindSpeedPath": "vessels.self.environment.wind.speedApparent",
        "appWindSpeedSource": "default",
        "unitName": "knots"
      }
    },
    {
      "uuid": "e595897d-a78a-46c1-ba93-d4c6741983a4",
      "type": "WidgetNumeric",
      "config": {
        "signalKPath": "vessels.self.environment.depth.belowKeel",
        "signalKSource": "default",
        "label": "Depth below keel",
        "unitGroup": "distance",
        "unitName": "feet",
        "numDecimal": 2,
        "numInt": 2
      }
    },
    {
      "uuid": "4d953a0b-a7be-4bdf-84fd-d6d244056378",
      "type": "WidgetNumeric",
      "config": {
        "signalKPath": "vessels.self.environment.wind.speedApparent",
        "signalKSource": "default",
        "label": "App Wind",
        "unitGroup": "speed",
        "unitName": "knots",
        "numDecimal": 2,
        "numInt": 2
      }
    },
    {
      "uuid": "7955f86d-1ba6-4a2f-8c3e-a1f5da895768",
      "type": "WidgetNumeric",
      "config": {
        "signalKPath": "vessels.self.navigation.speedThroughWater",
        "signalKSource": "default",
        "label": "Speed (Water)",
        "unitGroup": "speed",
        "unitName": "knots",
        "numDecimal": 2,
        "numInt": 2
      }
    },
    {
      "uuid": "d1068028-ea14-4db3-8a8d-8bbfea0fbfd3",
      "type": "WidgetHistorical",
      "config": {
        "dataSetUUID": "a5e77585-7e7b-4dbc-860e-0a53da687794",
        "label": "Depth",
        "unitGroup": "distance",
        "unitName": "m",
        "numDecimal": 2,
        "invertData": true,
        "displayMinMax": false,
        "animateGraph": false,
        "suggestedMin": -50,
        "suggestedMax": null,
        "includeZero": true
      }
    },
    {
      "uuid": "1bdb821f-4b0d-4232-bccb-6ea8eebf04cf",
      "type": "WidgetHistorical",
      "config": {
        "dataSetUUID": "63f7f37a-099c-48db-92aa-01e7ba2dc65d",
        "label": "Wind-True",
        "unitGroup": "speed",
        "unitName": "knots",
        "numDecimal": 2,
        "invertData": false,
        "displayMinMax": true,
        "animateGraph": false,
        "suggestedMin": null,
        "suggestedMax": 20,
        "includeZero": true
      }
    },
    {
      "uuid": "bb0da568-cb87-49f6-8359-48ff7b7cfa18",
      "type": "WidgetGaugeComponent",
      "config": {
        "gaugeType": "radial",
        "signalKPath": "vessels.self.electrical.batteries.1.voltage",
        "signalKSource": "default",
        "label": "Battery Voltage",
        "unitGroup": "electrity",
        "unitName": "volts",
        "barGraph": false,
        "radialSize": "three-quarter",
        "minValue": 8,
        "maxValue": 18
      }
    },
    {
      "uuid": "a626a0ac-dcef-4e80-a3db-b121fe144854",
      "type": "WidgetGaugeComponent",
      "config": {
        "gaugeType": "linear",
        "signalKPath": "vessels.self.electrical.batteries.1.temperature",
        "signalKSource": "default",
        "label": "Battery Temp",
        "unitGroup": "temp",
        "unitName": "C",
        "barGraph": true,
        "radialSize": "full",
        "minValue": 0,
        "maxValue": 100
      }
    },
    {
      "uuid": "9b4420a5-5527-4be3-85fe-b8a6bff563f6",
      "type": "WidgetGaugeComponent",
      "config": {
        "gaugeType": "radial",
        "signalKPath": "vessels.self.environment.wind.speedApparent",
        "signalKSource": "default",
        "label": "App Wind",
        "unitGroup": "speed",
        "unitName": "knots",
        "barGraph": true,
        "radialSize": "full",
        "minValue": 0,
        "maxValue": 30
      }
    },
    {
      "uuid": "03e53522-77e0-4b09-8e1d-19959053a8fb",
      "type": "WidgetGaugeComponent",
      "config": {
        "gaugeType": "linear",
        "signalKPath": "vessels.self.environment.water.temperature",
        "signalKSource": "default",
        "label": "Water temperature",
        "unitGroup": "temp",
        "unitName": "C",
        "barGraph": false,
        "radialSize": "full",
        "minValue": 0,
        "maxValue": 30
      }
    },
    {
      "uuid": "3c84892b-60bb-47c1-8b42-8beef6260972",
      "type": "WidgetGaugeComponent",
      "config": {
        "gaugeType": "linear",
        "signalKPath": "vessels.self.navigation.gnss.satellites",
        "signalKSource": "default",
        "label": "GPS Satellites",
        "unitGroup": "discreet",
        "unitName": "no unit",
        "barGraph": true,
        "radialSize": "full",
        "minValue": 0,
        "maxValue": 20
      }
    },
    {
      "uuid": "0e6067e7-e819-4a75-853c-d16dbfec5e05",
      "type": "WidgetGaugeComponent",
      "config": {
        "gaugeType": "radial",
        "signalKPath": "vessels.self.environment.wind.speedTrue",
        "signalKSource": "default",
        "label": "True Wind",
        "unitGroup": "speed",
        "unitName": "knots",
        "barGraph": true,
        "radialSize": "full",
        "minValue": 0,
        "maxValue": 30
      }
    },
    {
      "uuid": "072502e7-5512-4c69-8b5e-118a1290bc27",
      "type": "WidgetHistorical",
      "config": {
        "dataSetUUID": "dd9f511f-d94f-4f40-a20e-c08d2cd4690e",
        "label": "True Wind",
        "unitGroup": "speed",
        "unitName": "knots",
        "numDecimal": 2,
        "invertData": false,
        "displayMinMax": true,
        "animateGraph": false,
        "suggestedMin": null,
        "suggestedMax": 30,
        "includeZero": true
      }
    }
  ],
  "unlockStatus": false,
  "dataSets": [
    {
      "uuid": "a5e77585-7e7b-4dbc-860e-0a53da687794",
      "path": "vessels.self.environment.depth.belowKeel",
      "signalKSource": "default",
      "updateTimer": 1,
      "dataPoints": 20
    },
    {
      "uuid": "63f7f37a-099c-48db-92aa-01e7ba2dc65d",
      "path": "vessels.self.environment.wind.speedTrue",
      "signalKSource": "default",
      "updateTimer": 5,
      "dataPoints": 30
    },
    {
      "uuid": "dd9f511f-d94f-4f40-a20e-c08d2cd4690e",
      "path": "vessels.self.environment.wind.speedApparent",
      "signalKSource": "default",
      "updateTimer": 10,
      "dataPoints": 60
    }
  ],
  "splitSets": [
    {
      "uuid": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "a68fff4a-15f2-4d62-8083-835e7ac74cf0",
          "type": "splitSet",
          "size": 24.166
        },
        {
          "uuid": "a3d595eb-f1a0-45a2-9faa-7af31757f129",
          "type": "widget",
          "size": 48.177
        },
        {
          "uuid": "be832489-4796-4f69-9025-11937c1e2bc4",
          "type": "splitSet",
          "size": 27.656
        }
      ]
    },
    {
      "uuid": "a68fff4a-15f2-4d62-8083-835e7ac74cf0",
      "parentUUID": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
          "type": "widget",
          "size": 25
        },
        {
          "uuid": "4d953a0b-a7be-4bdf-84fd-d6d244056378",
          "type": "widget",
          "size": 25
        },
        {
          "uuid": "e595897d-a78a-46c1-ba93-d4c6741983a4",
          "type": "widget",
          "size": 25
        },
        {
          "uuid": "7955f86d-1ba6-4a2f-8c3e-a1f5da895768",
          "type": "widget",
          "size": 25
        }
      ]
    },
    {
      "uuid": "be832489-4796-4f69-9025-11937c1e2bc4",
      "parentUUID": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "d1068028-ea14-4db3-8a8d-8bbfea0fbfd3",
          "type": "widget",
          "size": 50
        },
        {
          "uuid": "1bdb821f-4b0d-4232-bccb-6ea8eebf04cf",
          "type": "widget",
          "size": 50
        }
      ]
    },
    {
      "uuid": "ebe306cc-9da9-4531-89ed-2252a0251dbe",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "bb0da568-cb87-49f6-8359-48ff7b7cfa18",
          "type": "widget",
          "size": 50
        },
        {
          "uuid": "0663e4c3-51b3-4a92-beb2-009d9e5ee047",
          "type": "splitSet",
          "size": 50
        }
      ]
    },
    {
      "uuid": "0663e4c3-51b3-4a92-beb2-009d9e5ee047",
      "parentUUID": "ebe306cc-9da9-4531-89ed-2252a0251dbe",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "57311752-f510-497f-af83-476020d9116f",
          "type": "splitSet",
          "size": 50
        },
        {
          "uuid": "a12ab428-9d8f-4550-8b33-33b921570dcf",
          "type": "splitSet",
          "size": 50
        }
      ]
    },
    {
      "uuid": "57311752-f510-497f-af83-476020d9116f",
      "parentUUID": "0663e4c3-51b3-4a92-beb2-009d9e5ee047",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "a626a0ac-dcef-4e80-a3db-b121fe144854",
          "type": "widget",
          "size": 21.055
        },
        {
          "uuid": "a11f9ba9-9cda-40d4-a85e-949f3cb0794f",
          "type": "splitSet",
          "size": 78.945
        }
      ]
    },
    {
      "uuid": "a11f9ba9-9cda-40d4-a85e-949f3cb0794f",
      "parentUUID": "57311752-f510-497f-af83-476020d9116f",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "03e53522-77e0-4b09-8e1d-19959053a8fb",
          "type": "widget",
          "size": 50.441
        },
        {
          "uuid": "3c84892b-60bb-47c1-8b42-8beef6260972",
          "type": "widget",
          "size": 49.559
        }
      ]
    },
    {
      "uuid": "a12ab428-9d8f-4550-8b33-33b921570dcf",
      "parentUUID": "0663e4c3-51b3-4a92-beb2-009d9e5ee047",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "9b4420a5-5527-4be3-85fe-b8a6bff563f6",
          "type": "widget",
          "size": 50
        },
        {
          "uuid": "0e6067e7-e819-4a75-853c-d16dbfec5e05",
          "type": "widget",
          "size": 50
        }
      ]
    },
    {
      "uuid": "d538dd07-679b-413e-9910-8b6508942059",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "072502e7-5512-4c69-8b5e-118a1290bc27",
          "type": "widget",
          "size": 100
        }
      ]
    }
  ],
  "rootSplits": [
    "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    "ebe306cc-9da9-4531-89ed-2252a0251dbe",
    "d538dd07-679b-413e-9910-8b6508942059"
  ],
  "derivations": [
    {
      "name": "True Wind",
      "updateAny": false,
      "paths": [
        {
          "path": "vessels.self.navigation.headingTrue",
          "source": "default"
        },
        {
          "path": "vessels.self.navigation.speedThroughWater",
          "source": "default"
        },
        {
          "path": "vessels.self.environment.wind.speedApparent",
          "source": "default"
        },
        {
          "path": "vessels.self.environment.wind.angleApparent",
          "source": "default"
        }
      ]
    },
    {
      "name": "Dew Point",
      "updateAny": false,
      "paths": [
        {
          "path": "vessels.self.environment.outside.temperature",
          "source": "default"
        },
        {
          "path": "vessels.self.environment.outside.humidity",
          "source": "default"
        }
      ]
    }
  ]
}