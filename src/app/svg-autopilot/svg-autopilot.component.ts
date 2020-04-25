import { Component, OnInit, Input, ViewChild, ElementRef, SimpleChanges } from '@angular/core';
import { isNumeric } from 'rxjs/util/isNumeric';
import { isNumber } from 'util';

@Component({
  selector: 'app-svg-autopilot',
  templateUrl: './svg-autopilot.component.html'
  // uses svg-wind SCSS styles
})
export class SvgAutopilotComponent implements OnInit {
  @ViewChild('compassAnimate') compassAnimate: ElementRef;
  @ViewChild('trueWindAnimate') trueWindAnimate: ElementRef;

  @Input('compassHeading') compassHeading: number;
  @Input('trueWindAngle') trueWindAngle: number;

  constructor() { }

  // compass
  oldCompassRotate: number = 0;
  newCompassRotate: number = 0;
  headingValue: string ="0";

  // true wind
  oldTrueWindRotateAngle: string = "0";
  newTrueWindRotateAngle: string = "0";
  trueWindHeading: number = 0;

  ngOnInit() {
  }

  ngOnChanges(changes: SimpleChanges) {

    //heading
    if (changes.compassHeading) {
      if (! changes.compassHeading.firstChange) {
        this.oldCompassRotate = this.newCompassRotate;
        this.newCompassRotate = changes.compassHeading.currentValue;// .toString();
        this.headingValue = this.newCompassRotate.toFixed(0);
        if (this.oldCompassRotate != this.newCompassRotate) {
          this.compassAnimate.nativeElement.beginElement();
        }
        this.updateTrueWind();// rotates with heading change
      }
    }

    //trueWindAngle
    if (changes.trueWindAngle) {
      if (! changes.trueWindAngle.firstChange) {
        this.trueWindHeading = changes.trueWindAngle.currentValue;
        this.updateTrueWind();
      }
    }
  }

  updateTrueWind(){
    this.oldTrueWindRotateAngle = this.newTrueWindRotateAngle;
    this.newTrueWindRotateAngle = this.addHeading(this.trueWindHeading, (this.newCompassRotate*-1)).toFixed(0); //compass rotate is negative as we actually have to rotate counter clockwise

    if (this.trueWindAnimate) { // only update if on dom...
      if (this.oldTrueWindRotateAngle != this.newTrueWindRotateAngle) {
        this.trueWindAnimate.nativeElement.beginElement();
      }
    }
  }


  addHeading(h1: number, h2: number) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }

}
