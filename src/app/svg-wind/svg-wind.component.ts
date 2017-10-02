import { Component, OnInit, Input, ViewChild, ElementRef, OnChanges, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-svg-wind',
  templateUrl: './svg-wind.component.html',
  styleUrls: ['./svg-wind.component.css']
})
export class SvgWindComponent implements OnInit {

  @ViewChild('compassAnimate') compassAnimate: ElementRef;
  @ViewChild('appWindAnimate') appWindAnimate: ElementRef;
  

  @Input('compassHeading') compassHeading: number;
  @Input('trueWindAngle') trueWindAngle: number;
  @Input('trueWindSpeed') trueWindSpeed: number;
  @Input('appWindAngle') appWindAngle: number;
  @Input('appWindSpeed') appWindSpeed: number;
  @Input('laylinePortAngle') laylinePortAngle : number;
  @Input('laylineStbAngle') laylineStbAngle: number;
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
      }
    }

    //appWindAngle
    if (changes.appWindAngle) {
      if (! changes.appWindAngle.firstChange) {
        this.oldAppWindAngle = this.newAppWindAngle;
        this.newAppWindAngle = changes.appWindAngle.currentValue; //.toString();
        this.headingValue = this.newCompassRotate.toFixed(0);
        
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
