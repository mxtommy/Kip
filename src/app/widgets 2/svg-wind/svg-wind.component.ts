import { Component, Input, ViewChild, ElementRef, SimpleChanges } from '@angular/core';

const angle = ([a,b],[c,d],[e,f]) => (Math.atan2(f-d,e-c)-Math.atan2(b-d,a-c)+3*Math.PI)%(2*Math.PI)-Math.PI;

@Component({
  selector: 'app-svg-wind',
  templateUrl: './svg-wind.component.html',
  styleUrls: ['./svg-wind.component.css']
})
export class SvgWindComponent {

  @ViewChild('compassAnimate') compassAnimate: ElementRef;
  @ViewChild('appWindAnimate') appWindAnimate: ElementRef;
  @ViewChild('trueWindAnimate') trueWindAnimate: ElementRef;
  //@ViewChild('laylinePortAnimate') laylinePortAnimate: ElementRef;
  //@ViewChild('laylineStbAnimate') laylineStbAnimate: ElementRef;


  @Input('compassHeading') compassHeading: number;
  @Input('trueWindAngle') trueWindAngle: number;
  @Input('trueWindSpeed') trueWindSpeed: number;
  @Input('appWindAngle') appWindAngle: number;
  @Input('appWindSpeed') appWindSpeed: number;
  @Input('laylineAngle') laylineAngle : number;
  @Input('laylineEnable') laylineEnable: boolean;
  @Input('windSectorEnable') windSectorEnable: boolean;
  @Input('trueWindMinHistoric') trueWindMinHistoric: number;
  @Input('trueWindMidHistoric') trueWindMidHistoric: number;
  @Input('trueWindMaxHistoric') trueWindMaxHistoric: number;



  constructor() { }

  oldCompassRotate: number = 0;
  newCompassRotate: number = 0;
  headingValue: string ="0";

  //Appwind
  oldAppWindAngle: string = "0";
  newAppWindAngle: string = "0";
  appWindSpeedDisplay: string = "";

  //truewind
  oldTrueWindRotateAngle: string = "0";
  newTrueWindRotateAngle: string = "0";
  trueWindHeading: number = 0;
  trueWindSpeedDisplay: string = "";

  //laylines
  laylinePortPath: string = "M 250,250 250,90";
  laylineStbdPath: string = "M 250,250 250,90";

  //WindSectors
  portWindSectorPath: string = "none";
  stbdWindSectorPath: string = "none";


  ngOnChanges(changes: SimpleChanges) {

    //heading
    if (changes.compassHeading) {
      if (! changes.compassHeading.firstChange) {
        this.oldCompassRotate = this.newCompassRotate;
        this.newCompassRotate = changes.compassHeading.currentValue;// .toString();
        this.headingValue = this.newCompassRotate.toFixed(0);
        this.compassAnimate.nativeElement.beginElement();
        this.updateTrueWind();// rotates with heading change
        this.updateWindSectors();// they need to update to new heading too
      }
    }

    //appWindAngle
    if (changes.appWindAngle) {
      if (! changes.appWindAngle.firstChange) {
        this.oldAppWindAngle = this.newAppWindAngle;
        this.newAppWindAngle = changes.appWindAngle.currentValue.toFixed(0);

        let oldAngle = Number(this.oldAppWindAngle)
        let newAngle = Number(this.newAppWindAngle);
        let diff = oldAngle - newAngle;

        // only update if on DOM and value rounded changed
        if (this.appWindAnimate && (diff != 0)) {
          // Special cases to smooth out passing between 359 to/from 0
          // if more than half the circle, it could need to go over the 359 / 0 values
          if ( Math.abs(diff) > 180 ) {
            // In what direction are we moving?
            if (Math.sign(diff) == 1) {
              if (oldAngle == 359) {
                // special cases
                this.oldAppWindAngle = "0";
                this.appWindAnimate.nativeElement.beginElement();
              } else {
                this.newAppWindAngle = "359";
                this.appWindAnimate.nativeElement.beginElement();
                this.oldAppWindAngle = "0";
                this.newAppWindAngle = changes.appWindAngle.currentValue.toFixed(0);
                this.appWindAnimate.nativeElement.beginElement();
              }
            } else {
              if (oldAngle == 0) {
                // special cases
                this.oldAppWindAngle = "359";
                this.appWindAnimate.nativeElement.beginElement();
              } else {
                this.newAppWindAngle = "0";
                this.appWindAnimate.nativeElement.beginElement();
                this.oldAppWindAngle = "359";
                this.newAppWindAngle = changes.appWindAngle.currentValue.toFixed(0);
                this.appWindAnimate.nativeElement.beginElement();
              }
            }
          } else {
            this.appWindAnimate.nativeElement.beginElement();
          }
        }
      }
    }
    //appWindSpeed
    if (changes.appWindSpeed) {
      if (! changes.appWindSpeed.firstChange) {
        this.appWindSpeedDisplay = changes.appWindSpeed.currentValue.toFixed(1);
      }
    }

    //trueWindAngle
    if (changes.trueWindAngle) {
      if (! changes.trueWindAngle.firstChange) {
        this.trueWindHeading = changes.trueWindAngle.currentValue;
        this.updateTrueWind();
      }
    }

    //trueWindSpeed
    if (changes.trueWindSpeed) {
      if (! changes.trueWindSpeed.firstChange) {
        this.trueWindSpeedDisplay = changes.trueWindSpeed.currentValue.toFixed(1);
      }
    }

    //Min/Max
    if (changes.trueWindMinHistoric || changes.trueWindMaxHistoric) {
      if (isNaN(Number((this.trueWindMinHistoric))) && isNaN(Number(this.trueWindMaxHistoric))) {
        this.updateWindSectors();
      }
    }

  }

  updateTrueWind(){
    this.oldTrueWindRotateAngle = this.newTrueWindRotateAngle;
    this.newTrueWindRotateAngle = this.addHeading(this.trueWindHeading, (this.newCompassRotate*-1)).toFixed(0); //compass rotate is negative as we actually have to rotate counter clockwise


    let oldAngle = Number(this.oldTrueWindRotateAngle)
    let newAngle = Number(this.newTrueWindRotateAngle);
    let diff = oldAngle - newAngle;

    // only update if on DOM and value rounded changed
    if (this.trueWindAnimate && (diff != 0)) {
      // Special cases to smooth out passing between 359 to/from 0
      // if more than half the circle, it could need to go over the 359 / 0 values
      if ( Math.abs(diff) > 180 ) {
        // In what direction are we moving?
        if (Math.sign(diff) == 1) {
          if (oldAngle == 359) {
            // special cases
            this.oldTrueWindRotateAngle = "0";
            this.trueWindAnimate.nativeElement.beginElement();
          } else {
            this.newTrueWindRotateAngle = "359";
            this.trueWindAnimate.nativeElement.beginElement();
            this.oldTrueWindRotateAngle = "0";
            this.newTrueWindRotateAngle = this.addHeading(this.trueWindHeading, (this.newCompassRotate*-1)).toFixed(0);
            this.trueWindAnimate.nativeElement.beginElement();
          }
        } else {
          if (oldAngle == 0) {
            // special cases
            this.oldTrueWindRotateAngle = "359";
            this.trueWindAnimate.nativeElement.beginElement();
          } else {
            this.newTrueWindRotateAngle = "0";
            this.trueWindAnimate.nativeElement.beginElement();
            this.oldTrueWindRotateAngle = "359";
            this.newTrueWindRotateAngle = this.addHeading(this.trueWindHeading, (this.newCompassRotate*-1)).toFixed(0);
            this.trueWindAnimate.nativeElement.beginElement();
          }
        }
      } else {
        this.trueWindAnimate.nativeElement.beginElement();
      }
    }

    //calculate laylines

    let portLaylineRotate = this.addHeading(Number(this.newTrueWindRotateAngle), (this.laylineAngle*-1));
    //find xy of that rotation (160 = radius of inner circle)
    let portX = 160 * Math.sin((portLaylineRotate*Math.PI)/180) + 250; //250 is middle
    let portY = (160 * Math.cos((portLaylineRotate*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top
    this.laylinePortPath = 'M 250,250 ' + portX +',' + portY;

    let stbdLaylineRotate = this.addHeading(Number(this.newTrueWindRotateAngle), (this.laylineAngle));
    //find xy of that rotation (160 = radius of inner circle)
    let stbdX = 160 * Math.sin((stbdLaylineRotate*Math.PI)/180) + 250; //250 is middle
    let stbdY = (160 * Math.cos((stbdLaylineRotate*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top
    this.laylineStbdPath = 'M 250,250 ' + stbdX +',' + stbdY;

  }


  updateWindSectors() {
    let portMin = this.addHeading(this.addHeading(this.trueWindMinHistoric, (this.newCompassRotate*-1)), (this.laylineAngle*-1));
    let portMid = this.addHeading(this.addHeading(this.trueWindMidHistoric, (this.newCompassRotate*-1)), (this.laylineAngle*-1));
    let portMax = this.addHeading(this.addHeading(this.trueWindMaxHistoric, (this.newCompassRotate*-1)), (this.laylineAngle*-1));

    //console.log(this.trueWindMinHistoric.toFixed(0) + ' ' + this.trueWindMaxHistoric.toFixed(0) + ' ' + portMin.toFixed(0) + ' ' + portMax.toFixed(0));
    let portMinX = 160 * Math.sin((portMin*Math.PI)/180) + 250; //250 is middle
    let portMinY = (160 * Math.cos((portMin*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top
    let portMidX = 160 * Math.sin((portMid*Math.PI)/180) + 250; //250 is middle
    let portMidY = (160 * Math.cos((portMid*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top
    let portMaxX = 160 * Math.sin((portMax*Math.PI)/180) + 250; //250 is middle
    let portMaxY = (160 * Math.cos((portMax*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top

    //calculate angles for arc options https://stackoverflow.com/questions/21816286/svg-arc-how-to-determine-sweep-and-larg-arc-flags-given-start-end-via-point
    let portLgArcFl =   Math.abs(angle([portMinX,portMinY],[portMidX,portMidY],[portMaxX,portMaxY])) > Math.PI/2 ? 0 : 1;
    let portSweepFl =           angle([portMaxX,portMaxY],[portMinX,portMinY],[portMidX,portMidY])  > 0    ? 0 : 1;

    this.portWindSectorPath = 'M 250,250 L ' + portMinX + ',' + portMinY + ' A 160,160 0 ' + portLgArcFl + ' ' + portSweepFl + ' ' + portMaxX + ',' + portMaxY +' z';
    //////////
    let stbdMin = this.addHeading(this.addHeading(this.trueWindMinHistoric, (this.newCompassRotate*-1)), (this.laylineAngle));
    let stbdMid = this.addHeading(this.addHeading(this.trueWindMidHistoric, (this.newCompassRotate*-1)), (this.laylineAngle));
    let stbdMax = this.addHeading(this.addHeading(this.trueWindMaxHistoric, (this.newCompassRotate*-1)), (this.laylineAngle));

    let stbdMinX = 160 * Math.sin((stbdMin*Math.PI)/180) + 250; //250 is middle
    let stbdMinY = (160 * Math.cos((stbdMin*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top
    let stbdMidX = 160 * Math.sin((stbdMid*Math.PI)/180) + 250; //250 is middle
    let stbdMidY = (160 * Math.cos((stbdMid*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top
    let stbdMaxX = 160 * Math.sin((stbdMax*Math.PI)/180) + 250; //250 is middle
    let stbdMaxY = (160 * Math.cos((stbdMax*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top

    let stbdLgArcFl =   Math.abs(angle([stbdMinX,stbdMinY],[stbdMidX,stbdMidY],[stbdMaxX,stbdMaxY])) > Math.PI/2 ? 0 : 1;
    let stbdSweepFl =           angle([stbdMaxX,stbdMaxY],[stbdMinX,stbdMinY],[stbdMidX,stbdMidY])  > 0    ? 0 : 1;

    this.stbdWindSectorPath = 'M 250,250 L ' + stbdMinX + ',' + stbdMinY + ' A 160,160 0 ' + stbdLgArcFl + ' ' + stbdSweepFl + ' ' + stbdMaxX + ',' + stbdMaxY +' z';

  }




  addHeading(h1: number = 0, h2: number = 0) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }


}






/*
<animateTransform #compassAnimate attributeName="transform"
type="rotate"
[attr.from]="'-'+oldCompassRotate+' 250 250'"
[attr.to]="'-'+newCompassRotate+' 250 250'"
begin="indefinite"
dur="0.5s"
additive="replace"
fill="freeze"
/>

*/
