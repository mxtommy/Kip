import { Component, ViewChild, SimpleChanges, AfterViewInit, ElementRef, input } from '@angular/core';
import { NgIf } from '@angular/common';

const angle = ([a,b],[c,d],[e,f]) => (Math.atan2(f-d,e-c)-Math.atan2(b-d,a-c)+3*Math.PI)%(2*Math.PI)-Math.PI;

interface ISVGRotationObject {
  oldDegreeIndicator: string,
  newDegreeIndicator: string,
  animationElement: ElementRef<SVGAnimateTransformElement>
}

@Component({
    selector: 'app-svg-wind',
    templateUrl: './svg-wind.component.svg',
    styleUrl: './svg-wind.component.scss',
    standalone: true,
    imports: [NgIf]
})
export class SvgWindComponent implements AfterViewInit {
  @ViewChild('compassAnimate', { static: true, read: ElementRef }) compassAnimate!: ElementRef<SVGAnimateTransformElement>;
  @ViewChild('appWindAnimate', { static: true, read: ElementRef }) appWindAnimate!: ElementRef<SVGAnimateTransformElement>;
  @ViewChild('trueWindAnimate', { static: true, read: ElementRef }) trueWindAnimate!: ElementRef<SVGAnimateTransformElement>;
  @ViewChild('appWindValueAnimate', { static: true, read: ElementRef }) appWindValueAnimate!: ElementRef<SVGAnimateTransformElement>;
  @ViewChild('trueWindValueAnimate', { static: true, read: ElementRef }) trueWindValueAnimate!: ElementRef<SVGAnimateTransformElement>;
  @ViewChild('waypointAnimate', { static: true, read: ElementRef }) waypointAnimate!: ElementRef<SVGAnimateTransformElement>;
  @ViewChild('courseOverGroundAnimate', { static: true, read: ElementRef }) courseOverGroundAnimate!: ElementRef<SVGAnimateTransformElement>;

  readonly compassHeading = input<number>(undefined);
  readonly courseOverGroundAngle = input<number>(undefined);
  readonly courseOverGroundEnable = input<boolean>(undefined);
  readonly trueWindAngle = input<number>(undefined);
  readonly trueWindSpeed = input<number>(undefined);
  readonly appWindAngle = input<number>(undefined);
  readonly appWindSpeed = input<number>(undefined);
  readonly laylineAngle = input<number>(undefined);
  readonly closeHauledLineEnable = input<boolean>(undefined);
  readonly sailSetupEnable = input<boolean>(undefined);
  readonly windSectorEnable = input<boolean>(undefined);
  readonly waypointAngle = input<number>(undefined);
  readonly waypointEnable = input<boolean>(undefined);
  readonly trueWindMinHistoric = input<number>(undefined);
  readonly trueWindMidHistoric = input<number>(undefined);
  readonly trueWindMaxHistoric = input<number>(undefined);

  // Compass faceplate
  compassFaceplate: ISVGRotationObject;
  headingValue: string ="--";

  //Appwind
  appWind: ISVGRotationObject;
  appWindValue: ISVGRotationObject;
  appWindSpeedDisplay: string = "--";

  //truewind
  trueWind: ISVGRotationObject;
  trueWindValue: ISVGRotationObject;
  trueWindSpeedDisplay: string = "--";
  trueWindHeading: number = 0;

  //waypoint
  waypoint: ISVGRotationObject;
  waypointActive: boolean = false;

  // Course Over Ground
  courseOverGround: ISVGRotationObject;
  courseOverGroundActive: boolean = false;

  //laylines - Close-Hauled lines
  closeHauledLinePortPath: string = "M 231,231 231,90";
  closeHauledLineStbdPath: string = "M 231,231 231,90";

  //WindSectors
  portWindSectorPath: string = "none";
  stbdWindSectorPath: string = "none";

  constructor() {
    this.appWind =  {
      oldDegreeIndicator: '0',
      newDegreeIndicator: '0',
      animationElement: undefined
    };

    this.appWindValue = {
      oldDegreeIndicator: '0',
      newDegreeIndicator: '0',
      animationElement: undefined
    };

    this.trueWind = {
      oldDegreeIndicator: '0',
      newDegreeIndicator: '0',
      animationElement: undefined
    };

    this.trueWindValue = {
      oldDegreeIndicator: '0',
      newDegreeIndicator: '0',
      animationElement: undefined
    };

    this.compassFaceplate = {
      oldDegreeIndicator: '0',
      newDegreeIndicator: '0',
      animationElement: undefined
    };

    this.waypoint =  {
      oldDegreeIndicator: '0',
      newDegreeIndicator: '0',
      animationElement: undefined
    };

    this.courseOverGround =  {
      oldDegreeIndicator: '0',
      newDegreeIndicator: '0',
      animationElement: undefined
    };
  }

  ngAfterViewInit(): void {
    this.compassFaceplate.animationElement = this.compassAnimate;
    this.appWind.animationElement = this.appWindAnimate;
    this.appWindValue.animationElement = this.appWindValueAnimate;
    this.trueWind.animationElement = this.trueWindAnimate;
    this.trueWindValue.animationElement = this.trueWindValueAnimate;
    this.waypoint.animationElement = this.waypointAnimate;
    this.courseOverGround.animationElement = this.courseOverGroundAnimate;
  }

  ngOnChanges(changes: SimpleChanges) {

    //heading
    if (changes.compassHeading) {
      if (! changes.compassHeading.firstChange) {
        if (changes.compassHeading.currentValue === null) {return}
        this.compassFaceplate.oldDegreeIndicator = this.compassFaceplate.newDegreeIndicator;

        this.compassFaceplate.newDegreeIndicator = changes.compassHeading.currentValue.toFixed(0);
        this.headingValue = this.compassFaceplate.newDegreeIndicator;

        // rotates with heading change
        this.smoothCircularRotation(this.compassFaceplate);
        this.updateClauseHauledLines();
        this.updateWindSectors(); // they need to update to new heading too
      }
    }

    // CourseOverGroundAngle
    if (changes.courseOverGroundAngle) {
      if (this.courseOverGroundEnable() == false) {
        this.courseOverGroundActive = false;
        return
      }

      if (!changes.courseOverGroundAngle.firstChange) {
        if (changes.courseOverGroundAngle.currentValue === null) {
          this.courseOverGroundActive = false;
        } else {
          this.courseOverGroundActive = true;
          this.courseOverGround.oldDegreeIndicator = this.courseOverGround.newDegreeIndicator;
          this.courseOverGround.newDegreeIndicator = changes.courseOverGroundAngle.currentValue.toFixed(0);
          this.smoothCircularRotation(this.courseOverGround);
        }
      }
    }

    // WaypointAngle
    if (changes.waypointAngle) {
      if (this.waypointEnable() == false) {
        this.waypointActive = false;
        return
      }

      if (! changes.waypointAngle.firstChange) {
        if (changes.waypointAngle.currentValue === null) {
          this.waypointActive = false;
        } else {
          this.waypointActive = true;
          this.waypoint.oldDegreeIndicator = this.waypoint.newDegreeIndicator;
          this.waypoint.newDegreeIndicator = changes.waypointAngle.currentValue.toFixed(0);
          this.smoothCircularRotation(this.waypoint);
        }
      }
    }

    //appWindAngle
    if (changes.appWindAngle) {
      if (! changes.appWindAngle.firstChange) {
        if (changes.appWindAngle.currentValue === null) {return}
        this.appWind.oldDegreeIndicator = this.appWind.newDegreeIndicator;
        this.appWindValue.oldDegreeIndicator = this.appWindValue.newDegreeIndicator;

        this.appWind.newDegreeIndicator = changes.appWindAngle.currentValue.toFixed(0);

        let valueRotationOffset = Number(changes.appWindAngle.currentValue) * -1;
        this.appWindValue.newDegreeIndicator = valueRotationOffset.toFixed(0);

        this.smoothCircularRotation(this.appWind, this.appWindValue);
      }
    }

    //trueWindAngle
    if (changes.trueWindAngle) {
      if (! changes.trueWindAngle.firstChange) {
        if (changes.trueWindAngle.currentValue === null) {return}
        this.trueWind.oldDegreeIndicator = this.trueWind.newDegreeIndicator;
        this.trueWindValue.oldDegreeIndicator = this.trueWindValue.newDegreeIndicator;

        this.trueWindHeading = changes.trueWindAngle.currentValue;
        this.trueWind.newDegreeIndicator = this.addHeading(this.trueWindHeading, (Number(this.compassFaceplate.newDegreeIndicator) * -1)).toFixed(0); //compass rotate is negative as we actually have to rotate counter clockwise

        let valueRotationOffset = Number(this.trueWind.newDegreeIndicator) * -1;
        this.trueWindValue.newDegreeIndicator = valueRotationOffset.toFixed(0);

        this.smoothCircularRotation(this.trueWind, this.trueWindValue);
        this.updateClauseHauledLines();
      }
    }

    //appWindSpeed
    if (changes.appWindSpeed) {
      if (! changes.appWindSpeed.firstChange) {
        if (changes.appWindSpeed.currentValue === null) {return}
        this.appWindSpeedDisplay = changes.appWindSpeed.currentValue.toFixed(1);
      }
    }

    //trueWindSpeed
    if (changes.trueWindSpeed) {
      if (! changes.trueWindSpeed.firstChange) {
        if (changes.trueWindSpeed.currentValue === null) {return}
        this.trueWindSpeedDisplay = changes.trueWindSpeed.currentValue.toFixed(1);
      }
    }

    //Min/Max
    if ((changes.trueWindMinHistoric && !changes.trueWindMinHistoric.firstChange) || (changes.trueWindMaxHistoric && !changes.trueWindMaxHistoric.firstChange)) {
      if (isNaN(Number((this.trueWindMinHistoric()))) && isNaN(Number(this.trueWindMaxHistoric()))) {
        this.updateWindSectors();
      }
    }

  }

  private updateClauseHauledLines(){
    let portLaylineRotate = this.addHeading(Number(this.trueWind.newDegreeIndicator), (this.laylineAngle()*-1));
    //find xy of that rotation (160 = radius of inner circle)
    let portX = 160 * Math.sin((portLaylineRotate*Math.PI)/180) + 231; //231 is middle
    let portY = (160 * Math.cos((portLaylineRotate*Math.PI)/180)*-1) + 231; //-1 since SVG 0 is at top
    this.closeHauledLinePortPath = 'M 231,231 ' + portX +',' + portY;

    let stbdLaylineRotate = this.addHeading(Number(this.trueWind.newDegreeIndicator), (this.laylineAngle()));
    //find xy of that rotation (160 = radius of inner circle)
    let stbdX = 160 * Math.sin((stbdLaylineRotate*Math.PI)/180) + 231; //231 is middle
    let stbdY = (160 * Math.cos((stbdLaylineRotate*Math.PI)/180)*-1) + 231; //-1 since SVG 0 is at top
    this.closeHauledLineStbdPath = 'M 231,231 ' + stbdX +',' + stbdY;
  }

  private updateWindSectors() {
    let portMin = this.addHeading(this.addHeading(this.trueWindMinHistoric(), (Number(this.compassFaceplate.newDegreeIndicator) * -1)), (this.laylineAngle()*-1));
    let portMid = this.addHeading(this.addHeading(this.trueWindMidHistoric(), (Number(this.compassFaceplate.newDegreeIndicator) * -1)), (this.laylineAngle()*-1));
    let portMax = this.addHeading(this.addHeading(this.trueWindMaxHistoric(), (Number(this.compassFaceplate.newDegreeIndicator) * -1)), (this.laylineAngle()*-1));

    //console.log(this.trueWindMinHistoric.toFixed(0) + ' ' + this.trueWindMaxHistoric.toFixed(0) + ' ' + portMin.toFixed(0) + ' ' + portMax.toFixed(0));
    let portMinX = 160 * Math.sin((portMin*Math.PI)/180) + 231; //231 is middle
    let portMinY = (160 * Math.cos((portMin*Math.PI)/180)*-1) + 231; //-1 since SVG 0 is at top
    let portMidX = 160 * Math.sin((portMid*Math.PI)/180) + 231; //231 is middle
    let portMidY = (160 * Math.cos((portMid*Math.PI)/180)*-1) + 231; //-1 since SVG 0 is at top
    let portMaxX = 160 * Math.sin((portMax*Math.PI)/180) + 231; //231 is middle
    let portMaxY = (160 * Math.cos((portMax*Math.PI)/180)*-1) + 231; //-1 since SVG 0 is at top

    //calculate angles for arc options https://stackoverflow.com/questions/21816286/svg-arc-how-to-determine-sweep-and-larg-arc-flags-given-start-end-via-point
    let portLgArcFl =   Math.abs(angle([portMinX,portMinY],[portMidX,portMidY],[portMaxX,portMaxY])) > Math.PI/2 ? 0 : 1;
    let portSweepFl =           angle([portMaxX,portMaxY],[portMinX,portMinY],[portMidX,portMidY])  > 0    ? 0 : 1;

    this.portWindSectorPath = 'M 231,231 L ' + portMinX + ',' + portMinY + ' A 160,160 0 ' + portLgArcFl + ' ' + portSweepFl + ' ' + portMaxX + ',' + portMaxY +' z';
    //////////
    let stbdMin = this.addHeading(this.addHeading(this.trueWindMinHistoric(), (Number(this.compassFaceplate.newDegreeIndicator) * -1)), (this.laylineAngle()));
    let stbdMid = this.addHeading(this.addHeading(this.trueWindMidHistoric(), (Number(this.compassFaceplate.newDegreeIndicator) * -1)), (this.laylineAngle()));
    let stbdMax = this.addHeading(this.addHeading(this.trueWindMaxHistoric(), (Number(this.compassFaceplate.newDegreeIndicator) * -1)), (this.laylineAngle()));

    let stbdMinX = 160 * Math.sin((stbdMin*Math.PI)/180) + 231; //231 is middle
    let stbdMinY = (160 * Math.cos((stbdMin*Math.PI)/180)*-1) + 231; //-1 since SVG 0 is at top
    let stbdMidX = 160 * Math.sin((stbdMid*Math.PI)/180) + 231; //231 is middle
    let stbdMidY = (160 * Math.cos((stbdMid*Math.PI)/180)*-1) + 231; //-1 since SVG 0 is at top
    let stbdMaxX = 160 * Math.sin((stbdMax*Math.PI)/180) + 231; //231 is middle
    let stbdMaxY = (160 * Math.cos((stbdMax*Math.PI)/180)*-1) + 231; //-1 since SVG 0 is at top

    let stbdLgArcFl = Math.abs(angle([stbdMinX,stbdMinY],[stbdMidX,stbdMidY],[stbdMaxX,stbdMaxY])) > Math.PI/2 ? 0 : 1;
    let stbdSweepFl = angle([stbdMaxX,stbdMaxY],[stbdMinX,stbdMinY],[stbdMidX,stbdMidY])  > 0    ? 0 : 1;

    this.stbdWindSectorPath = 'M 231,231 L ' + stbdMinX + ',' + stbdMinY + ' A 160,160 0 ' + stbdLgArcFl + ' ' + stbdSweepFl + ' ' + stbdMaxX + ',' + stbdMaxY +' z';

  }

  private addHeading(h1: number = 0, h2: number = 0) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }

  private smoothCircularRotation(rotationElement: ISVGRotationObject, countRotationElement?:ISVGRotationObject): void {
    const oldAngle = Number(rotationElement.oldDegreeIndicator)
    const newAngle = Number(rotationElement.newDegreeIndicator);
    const diff = oldAngle - newAngle;

    // only update if on DOM and value rounded changed
    if (rotationElement.animationElement && (diff != 0)) {
      // Special cases to smooth out passing between 359 to/from 0
      // if more than half the circle, it could need to go over the 359 to 0 without doing full full circle
      if ( Math.abs(diff) > 180 ) {

        if (Math.sign(diff) == 1) { // Moving clockwise
          if (oldAngle == 359) { // Going over 0
            // special cases
            rotationElement.oldDegreeIndicator = "0"; // Set to 0 and animate so we don't jump
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.oldDegreeIndicator = "0";
              countRotationElement.animationElement.nativeElement.beginElement();
            }
          } else {
            rotationElement.newDegreeIndicator = "359";
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.newDegreeIndicator = "-359";
              countRotationElement.animationElement.nativeElement.beginElement();
            }
            rotationElement.oldDegreeIndicator = "0";
            rotationElement.newDegreeIndicator = newAngle.toFixed(0);
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.oldDegreeIndicator = rotationElement.oldDegreeIndicator;
              countRotationElement.newDegreeIndicator = "0";
              countRotationElement.animationElement.nativeElement.beginElement();
            }
          }
        } else { // Moving counter clockwise
          if (oldAngle == 0) { // going over 359
            // special cases
            rotationElement.oldDegreeIndicator = "359";
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.oldDegreeIndicator = "-359";
              countRotationElement.animationElement.nativeElement.beginElement();
            }
          } else {
            rotationElement.newDegreeIndicator = "0";
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.newDegreeIndicator = "0";
              countRotationElement.animationElement.nativeElement.beginElement();
            }
            rotationElement.oldDegreeIndicator = "359";
            rotationElement.newDegreeIndicator = newAngle.toFixed(0);
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.oldDegreeIndicator = "-359";
              countRotationElement.newDegreeIndicator = (newAngle * -1).toFixed(0); // values rotate counter clockwise (negative values). else they'll do a 360
              countRotationElement.animationElement.nativeElement.beginElement();
            }
          }
        }
      } else { // not doing more then 180, normal rotation
        rotationElement.animationElement.nativeElement.beginElement();
        if (countRotationElement !== undefined) {
          countRotationElement.animationElement.nativeElement.beginElement();
        }
      }
    }
  }
}
