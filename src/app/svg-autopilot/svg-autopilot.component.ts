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
  @ViewChild('appWindAnimate') appWindAnimate: ElementRef;

  @Input('compassHeading') compassHeading: number;
  @Input('appWindAngle') appWindAngle: number;

  constructor() { }

  // compass
  oldCompassRotate: number = 0;
  newCompassRotate: number = 0;
  headingValue: string ="0";

  // Apparent wind
  oldAppWindAngle: string = "0";
  newAppWindAngle: string = "0";
  oldAppWindRotateAngle: string = "0";
  newAppWindRotateAngle: string = "0";
  appWindHeading: number = 0;

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
        this.newAppWindAngle = changes.appWindAngle.currentValue.toFixed(0);

        if (this.appWindAnimate) { // only update if on dom...
          this.appWindAnimate.nativeElement.beginElement();
        }
      }
    }
  }

// value = this.options.value +
          // ((((value - this.options.value) % 360) + 540) % 360) - 180;


  addHeading(h1: number, h2: number) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }

}
