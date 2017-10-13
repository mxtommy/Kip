

export const DemoConfig = {
  "signalKUrl": "http://demo.signalk.org/signalk",
  "themeName": "default-light",
  "widgets": [
    {
      "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
      "type": "WidgetNumeric",
      "config": {
        "signalKPath": "vessels.self.navigation.speedThroughWater",
        "signalKSource": "default",
        "label": "STW",
        "unitGroup": "speed",
        "unitName": "knots",
        "numDecimal": 2,
        "numInt": 2
      }
    },
    {
      "uuid": "b0337e3c-e8d0-4f7a-9d7a-2695cb0d78ef",
      "type": "WidgetHistorical",
      "config": {
        "dataSetUUID": "4151ef08-2ea3-4a8f-8022-d86888b1808b",
        "label": "Depth",
        "unitGroup": "distance",
        "unitName": "feet",
        "numDecimal": 2,
        "invertData": true,
        "displayMinMax": true,
        "animateGraph": false,
        "suggestedMin": -50,
        "suggestedMax": null,
        "includeZero": true
      }
    },
    {
      "uuid": "eeb5bcde-35b1-4869-bc3e-28831107f516",
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
      "uuid": "a114ce95-36d8-4684-92f9-4bead5f2824e",
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
      "uuid": "7ec428c5-4eee-4f3b-9386-08b5041adb71",
      "type": "WidgetGaugeComponent",
      "config": {
        "gaugeType": "linear",
        "signalKPath": "vessels.self.environment.wind.speedApparent",
        "signalKSource": "default",
        "label": "AWS",
        "unitGroup": "speed",
        "unitName": "knots",
        "barGraph": true,
        "radialSize": "full",
        "minValue": 0,
        "maxValue": 30
      }
    },
    {
      "uuid": "aefb0505-6d0f-472d-82f0-43b7be8b5d2a",
      "type": "WidgetNumeric",
      "config": {
        "signalKPath": "vessels.self.navigation.trip.log",
        "signalKSource": "default",
        "label": "Trip",
        "unitGroup": "distance",
        "unitName": "nm",
        "numDecimal": 2,
        "numInt": 2
      }
    },
    {
      "uuid": "c0fdd088-5821-4572-90ef-3bd36fe5027a",
      "type": "WidgetGaugeComponent",
      "config": {
        "gaugeType": "linear",
        "signalKPath": "vessels.self.environment.current.setTrue",
        "signalKSource": "default",
        "label": "Current Vector (Set & Drift)",
        "unitGroup": "speed",
        "unitName": "knots",
        "barGraph": true,
        "radialSize": "full",
        "minValue": 0,
        "maxValue": 10
      }
    },
    {
      "uuid": "e2c54168-5ee9-4cb8-a525-b3d02a0d9e90",
      "type": "WidgetBlank",
      "config": null
    },
    {
      "uuid": "7ede38a3-8404-483c-b77c-54990c5d117e",
      "type": "WidgetHistorical",
      "config": {
        "dataSetUUID": "4151ef08-2ea3-4a8f-8022-d86888b1808b",
        "label": "Depth",
        "unitGroup": "speed",
        "unitName": "knots",
        "numDecimal": 2,
        "invertData": true,
        "displayMinMax": true,
        "animateGraph": false,
        "suggestedMin": -50,
        "suggestedMax": null,
        "includeZero": true
      }
    },
    {
      "uuid": "f46ffe23-268b-4bba-93be-0dd26048f3e5",
      "type": "WidgetNumeric",
      "config": {
        "signalKPath": "vessels.self.electrical.batteries.1.current",
        "signalKSource": "default",
        "label": "Current",
        "unitGroup": "electrity",
        "unitName": "amps",
        "numDecimal": 2,
        "numInt": 2
      }
    },
    {
      "uuid": "42463b3e-0510-44d8-b3a0-a189c106b54b",
      "type": "WidgetGaugeComponent",
      "config": {
        "gaugeType": "radial",
        "signalKPath": "vessels.self.electrical.batteries.1.voltage",
        "signalKSource": "default",
        "label": "Battery Voltage",
        "unitGroup": "electrity",
        "unitName": "volts",
        "barGraph": true,
        "radialSize": "three-quarter",
        "minValue": 10,
        "maxValue": 18
      }
    }
  ],
  "unlockStatus": false,
  "dataSets": [
    {
      "uuid": "4151ef08-2ea3-4a8f-8022-d86888b1808b",
      "path": "vessels.self.environment.depth.belowKeel",
      "signalKSource": "default",
      "updateTimer": 5,
      "dataPoints": 10
    }
  ],
  "splitSets": [
    {
      "uuid": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "42c49f81-6fbe-4ad6-9e93-9e01016f8800",
          "type": "splitSet",
          "size": 27.101
        },
        {
          "uuid": "a114ce95-36d8-4684-92f9-4bead5f2824e",
          "type": "widget",
          "size": 41.581
        },
        {
          "uuid": "8aaa37d2-2fff-4630-aaf8-a5367ecda68b",
          "type": "splitSet",
          "size": 31.318
        }
      ]
    },
    {
      "uuid": "8aaa37d2-2fff-4630-aaf8-a5367ecda68b",
      "parentUUID": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "b0337e3c-e8d0-4f7a-9d7a-2695cb0d78ef",
          "type": "widget",
          "size": 50
        },
        {
          "uuid": "eeb5bcde-35b1-4869-bc3e-28831107f516",
          "type": "widget",
          "size": 50
        }
      ]
    },
    {
      "uuid": "42c49f81-6fbe-4ad6-9e93-9e01016f8800",
      "parentUUID": "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
      "direction": "vertical",
      "splitAreas": [
        {
          "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
          "type": "widget",
          "size": 25
        },
        {
          "uuid": "aefb0505-6d0f-472d-82f0-43b7be8b5d2a",
          "type": "widget",
          "size": 25
        },
        {
          "uuid": "44b8017f-5877-411a-8c21-00d379311883",
          "type": "splitSet",
          "size": 50
        }
      ]
    },
    {
      "uuid": "44b8017f-5877-411a-8c21-00d379311883",
      "parentUUID": "42c49f81-6fbe-4ad6-9e93-9e01016f8800",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "7ec428c5-4eee-4f3b-9386-08b5041adb71",
          "type": "widget",
          "size": 50
        },
        {
          "uuid": "c0fdd088-5821-4572-90ef-3bd36fe5027a",
          "type": "widget",
          "size": 50
        }
      ]
    },
    {
      "uuid": "640ad069-c300-4dee-8b10-61c7db465781",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "7ede38a3-8404-483c-b77c-54990c5d117e",
          "type": "widget",
          "size": 100
        }
      ]
    },
    {
      "uuid": "7866142d-e3ab-4b9f-910c-188ca8bf9e6c",
      "direction": "horizontal",
      "splitAreas": [
        {
          "uuid": "f46ffe23-268b-4bba-93be-0dd26048f3e5",
          "type": "widget",
          "size": 50
        },
        {
          "uuid": "42463b3e-0510-44d8-b3a0-a189c106b54b",
          "type": "widget",
          "size": 50
        }
      ]
    }
  ],
  "rootSplits": [
    "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx",
    "640ad069-c300-4dee-8b10-61c7db465781",
    "7866142d-e3ab-4b9f-910c-188ca8bf9e6c"
  ]
}