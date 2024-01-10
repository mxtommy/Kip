import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { Subscription, interval } from 'rxjs';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';


@Component({
  selector: 'app-widget-wind',
  templateUrl: './widget-wind.component.html'
})
export class WidgetWindComponent extends BaseWidgetComponent implements OnInit, OnDestroy  {
  currentHeading: number = 0;
  courseOverGroundAngle: number = 0;
  appWindAngle: number = 0;
  appWindSpeed: number = 0;
  trueWindAngle: number = 0;
  trueWindSpeed: number = 0;
  waypointAngle: number = 0;
  trueWindHistoric: {
    timestamp: number;
    heading: number;
  }[] = [];
  trueWindMinHistoric: number;
  trueWindMidHistoric: number;
  trueWindMaxHistoric: number;

  windSectorObservableSub: Subscription = null;

  constructor(private zones: NgZone) {
    super();

    this.defaultConfig = {
      filterSelfPaths: true,
      paths: {
        "headingPath": {
          description: "Heading",
          path: 'self.navigation.headingTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "deg",
          sampleTime: 500,
          unitGroup: 'Angle'
        },
        "courseOverGround": {
          description: "Course Over Ground",
          path: 'self.navigation.courseOverGroundTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "deg",
          sampleTime: 500,
          unitGroup: 'Angle'
        },
        "trueWindAngle": {
          description: "True Wind Angle",
          path: 'self.environment.wind.angleTrueWater',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "deg",
          sampleTime: 500,
          unitGroup: 'Angle'
        },
        "trueWindSpeed": {
          description: "True Wind Speed",
          path: 'self.environment.wind.speedTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "knots",
          sampleTime: 500,
          unitGroup: 'Speed'
        },
        "appWindAngle": {
          description: "Apparent Wind Angle",
          path: 'self.environment.wind.angleApparent',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "deg",
          sampleTime: 500,
          unitGroup: 'Angle'
        },
        "appWindSpeed": {
          description: "Apparent Wind Speed",
          path: 'self.environment.wind.speedApparent',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "knots",
          sampleTime: 500,
          unitGroup: 'Speed'
        },
        "nextWaypointBearing": {
          description: "Next Waypoint Bearing",
          path: 'self.navigation.courseGreatCircle.nextPoint.bearingTrue',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "deg",
          sampleTime: 500,
          unitGroup: 'Angle'
        },
      },
      windSectorEnable: true,
      windSectorWindowSeconds: 5,
      laylineEnable: true,
      laylineAngle: 40,
      waypointEnable: true,
      courseOverGroundEnable: true,
      sailSetupEnable: false,
      enableTimeout: false,
      dataTimeout: 5
    };
   }

  ngOnInit(): void {
    this.validateConfig();
    this.observeDataStream('headingPath', newValue => {
      if (newValue.value == null) { // act upon data timeout of null
        newValue.value = 0
      }
      this.currentHeading = newValue.value;
    });

    this.observeDataStream('courseOverGround', newValue => {
      if (newValue.value == null) { // act upon data timeout of null
        newValue.value = 0
      }
      this.courseOverGroundAngle = newValue.value;
    });

    this.observeDataStream('nextWaypointBearing', newValue => {
      if (newValue.value < 0) {// stb
        this.waypointAngle = 360 + newValue.value; // adding a negative number subtracts it...
      } else {
        this.waypointAngle = newValue.value;
      }
    }
  );

    this.observeDataStream('appWindAngle', newValue => {
        if (newValue.value == null) { // act upon data timeout of null
          newValue.value = 0
        }
        if (newValue.value < 0) {// stb
          this.appWindAngle = 360 + newValue.value; // adding a negative number subtracts it...
        } else {
          this.appWindAngle = newValue.value;
        }
      }
    );

    this.observeDataStream('appWindSpeed', newValue => {
      if (newValue.value == null) { // act upon data timeout of null
        newValue.value = 0
      }
      this.appWindSpeed = newValue.value;
    });

    this.observeDataStream('trueWindSpeed', newValue => {
      if (newValue.value == null) { // act upon data timeout of null
        newValue.value = 0
      }
      this.trueWindSpeed = newValue.value;
    });

    this.observeDataStream('trueWindAngle', newValue => {
      if (newValue.value == null) { // act upon data timeout of null
        newValue.value = 0
      }
        // Depending on path, this number can either be the magnetic compass heading, true compass heading, or heading relative to boat heading (-180 to 180deg)... Ugh...
          // 0-180+ for stb
          // -0 to -180 for port
          // need in 0-360
        if (this.widgetProperties.config.paths['trueWindAngle'].path.match('angleTrueWater')||
        this.widgetProperties.config.paths['trueWindAngle'].path.match('angleTrueGround')) {
          //-180 to 180
          this.trueWindAngle = this.addHeading(this.currentHeading, newValue.value);
        } else if (this.widgetProperties.config.paths['trueWindAngle'].path.match('direction')) {
          //0-360
          this.trueWindAngle = newValue.value;
        } else {
          // some other path... assume it's the angle
          this.trueWindAngle = newValue.value;
        }

        //add to historical for wind sectors
        if (this.widgetProperties.config.windSectorEnable) {
          this.addHistoricalTrue(this.trueWindAngle);
        }
      }
    );

    this.startWindSectors();
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.stopWindSectors();
  }

  startWindSectors() {
    this.zones.runOutsideAngular(() => {
      this.windSectorObservableSub = interval(500).subscribe(x => {
        this.historicalCleanup();
      });
    });
  }

  addHistoricalTrue (windHeading: number) {
    this.trueWindHistoric.push({
      timestamp: Date.now(),
      heading: windHeading
    });
    let arr = this.arcForAngles(this.trueWindHistoric.map(d => d.heading));
    this.trueWindMinHistoric = arr[0];
    this.trueWindMaxHistoric = arr[1];
    this.trueWindMidHistoric = arr[2];
  }

  arcForAngles (data) {
    return data.slice(1).reduce((acc, theValue) => {
      let value = theValue
      while (value < acc[0] - 180) {
        value += 360
      }
      while (value > acc[1] + 180) {
        value -= 360
      }
      acc[0] = Math.min(acc[0], value)
      acc[1] = Math.max(acc[1], value)
      acc[2] = ((acc[1]-acc[0])/2)+acc[0];
      return acc
    }, [data[0], data[0]])
  }

  historicalCleanup() {
    let n = Date.now()-(this.widgetProperties.config.windSectorWindowSeconds*1000);
    for (var i = this.trueWindHistoric.length - 1; i >= 0; --i) {
      if (this.trueWindHistoric[i].timestamp < n) {
        this.trueWindHistoric.splice(i,1);
      }
    }
  }

  stopWindSectors() {
    if (this.windSectorObservableSub !== null) {
      this.windSectorObservableSub.unsubscribe();
      this.windSectorObservableSub = null;
    }

  }

  addHeading(h1: number, h2: number) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }
}
