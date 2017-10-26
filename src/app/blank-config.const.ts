export const BlankConfig = {
    "signalKUrl": "http://demo.signalk.org/signalk",
    "themeName": "default-light",
    "widgets": [
      {
        "uuid": "widgetno-1xxx-4xxx-yxxx-xxxxxxxxxxxx",
        "type": "WidgetTutorial",
        "config": null
      }
    ],
    "unlockStatus": false,
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