export const BlankConfig = {
    "configVersion": 0,
    "signalKUrl": "", // get's overwritten with host
    "signalKToken": null,
    "themeName": "default-light",
    "disableNotifications": false,
    "widgets": [
      {
        "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
        "type": "WidgetTutorial",
        "config": null
      }
    ],
    "unlockStatus": false,
    "unitDefaults": {
      "unitless": 'unitless',
      "speed": 'kph',
      "flow": 'l/h',
      "temp": 'C',
      "length": 'm',
      "electricity": 'volts',
      "pressure": 'mmHg',
      "angularVelocity": 'deg/min',
      "frequency": 'Hz',
      "angle": 'deg',
      "ratio": 'percent'
    },
    "dataSets": [],
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
    ],
    "rootSplits": [
      "isplitsx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
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
