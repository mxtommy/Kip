import { Component, OnInit, Input, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-svg-wind',
  templateUrl: './svg-wind.component.html',
  styleUrls: ['./svg-wind.component.css']
})
export class SvgWindComponent implements OnInit {

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
  @Input('windSectorPortStart') windSectorPortStart: number;
  @Input('windSectorPortEnd') windSectorPortEnd: number;
  @Input('windSectorStbStart') windSectorStbStart: number;
  @Input('windSectorStbEnd') windSectorStbEnd: number;
  

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

  ngOnInit() {


  }
  

  ngOnChanges(changes: SimpleChanges) {

    //heading
    if (changes.compassHeading) {
      if (! changes.compassHeading.firstChange) {
        this.oldCompassRotate = this.newCompassRotate;
        this.newCompassRotate = changes.compassHeading.currentValue;// .toString();
        this.headingValue = this.newCompassRotate.toFixed(0);
        this.compassAnimate.nativeElement.beginElement();
        this.updateTrueWind();// rotates with heading change
      }
    }

    //appWindAngle
    if (changes.appWindAngle) {
      if (! changes.appWindAngle.firstChange) {
        this.oldAppWindAngle = this.newAppWindAngle;
        this.newAppWindAngle = changes.appWindAngle.currentValue; //.toString();
        
        if (this.appWindAnimate) { // only update if on dom...
          this.appWindAnimate.nativeElement.beginElement();
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

  }

  updateTrueWind(){
    this.oldTrueWindRotateAngle = this.newTrueWindRotateAngle;
    this.newTrueWindRotateAngle = this.addHeading(this.trueWindHeading, (this.newCompassRotate*-1)).toFixed(0); //compass rotae is negative as we actually have to rotate counter clockwise

    //this.laylinePortRotate = this.addHeading(Number(this.newTrueWindRotateAngle), this.laylineAngle).toFixed(0);
    if (this.trueWindAnimate) { // only update if on dom...
      this.trueWindAnimate.nativeElement.beginElement();
    }

    //calculate laylines

    let portLaylineRotate = this.addHeading(Number(this.newTrueWindRotateAngle), (this.laylineAngle*-1));
    //find xy of that roation (160 = radius of inner circle)
    let portX = 160 * Math.sin((portLaylineRotate*Math.PI)/180) + 250; //250 is middle
    let portY = (160 * Math.cos((portLaylineRotate*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top
    this.laylinePortPath = 'M 250,250 ' + portX +',' + portY;
    
    let stbdLaylineRotate = this.addHeading(Number(this.newTrueWindRotateAngle), (this.laylineAngle));
    //find xy of that roation (160 = radius of inner circle)
    let stbdX = 160 * Math.sin((stbdLaylineRotate*Math.PI)/180) + 250; //250 is middle
    let stbdY = (160 * Math.cos((stbdLaylineRotate*Math.PI)/180)*-1) + 250; //-1 since SVG 0 is at top
    this.laylineStbdPath = 'M 250,250 ' + stbdX +',' + stbdY;

  }


  addHeading(h1: number, h2: number) {
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
