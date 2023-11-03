import { Component, Input, ViewChild, ElementRef, SimpleChanges } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';


@Component({
  selector: 'app-svg-autopilot',
  templateUrl: './svg-autopilot.component.html',
  // uses svg-wind SCSS styles
  animations: [
    trigger('fadeInOut', [
      state('connected', style({
        opacity: 0,
      })),
      state('disconnected', style({
        opacity: 1,
      })),
      transition('connected => disconnected', [
        animate('.3s')
      ]),
      transition('disconnected => connected', [
        animate('1s')
      ]),
    ]),
  ]
})
export class SvgAutopilotComponent {
  // AP screen
  @ViewChild('apStencil', {static: true, read: ElementRef}) ApStencil: ElementRef;
  @ViewChild('countDown', {static: true, read: ElementRef}) countDown: ElementRef;

  // SVG
  @ViewChild('compassAnimate', {static: true, read: ElementRef}) compassAnimate: ElementRef;
  @ViewChild('appWindAnimate', {static: true, read: ElementRef}) appWindAnimate: ElementRef;
  @ViewChild('rudderPrtAnimate', {static: true, read: ElementRef}) rudderPrtAnimate: ElementRef;
  @ViewChild('rudderStbAnimate', {static: true, read: ElementRef}) rudderStbAnimate: ElementRef;

  @Input('compassHeading') compassHeading: number;
  @Input('appWindAngle') appWindAngle: number;
  @Input('rudderAngle') rudderAngle: number;
  @Input('apState') apState: string;
  @Input('apTargetAppWindAngle') apTargetAppWindAngle: string;
  @Input('isApConnected') isApConnected: boolean;

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

  // rudder
  oldRudderPrtAngle: number = 0;
  newRudderPrtAngle: number = 0;
  oldRudderStbAngle: number = 0;
  newRudderStbAngle: number = 0;

  activityIconVisibility: string = "hidden;";
  errorIconVisibility: string = "hidden";
  msgStencilVisibility: string = "hidden";
  msgStencilInnerHTML: string = "Empty Message Stencil";
  errorStencilVisibility: string = "hidden";
  errorStencilInnerText: string = "Empty Error Stencil";
  messageVisibility: string = "hidden";
  messageInnerText: string = "";


  ngOnChanges(changes: SimpleChanges) {

    //heading
    if (changes.compassHeading) {
      if (! changes.compassHeading.firstChange) {
        this.oldCompassRotate = this.newCompassRotate;
        this.newCompassRotate = changes.compassHeading.currentValue;
        this.headingValue = this.newCompassRotate.toFixed(0);
        this.compassAnimate.nativeElement.beginElement();
      }
    }

    //AP State
    if (changes.apState) {
      if (! changes.apState.firstChange) {
        this.apState = this.apState.toUpperCase();
      }
    }

    //AP Target Apparent Wind Angle
    if (changes.apTargetAppWindAngle) {
      if (! changes.apTargetAppWindAngle.firstChange) {
        this.apTargetAppWindAngle = changes.apTargetAppWindAngle.currentValue.toFixed(0);
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

    //rudderAngle
    if (changes.rudderAngle) {
      if (! changes.rudderAngle.firstChange) {
        if (changes.rudderAngle.currentValue <=0) {
          this.oldRudderPrtAngle = 0;
          this.newRudderPrtAngle = 0;

          this.oldRudderStbAngle = this.newRudderStbAngle
          this.newRudderStbAngle = Math.round(changes.rudderAngle.currentValue * 7.16 * -1); //pixel to angle ratio for rudder box and set positive
        } else {
          this.oldRudderStbAngle = 0;
          this.newRudderStbAngle = 0;

          this.oldRudderPrtAngle = this.newRudderPrtAngle;
          this.newRudderPrtAngle = Math.round(changes.rudderAngle.currentValue * 7.16); //pixel to angle ratio for rudder box
        }

        if (this.rudderPrtAnimate) { // only update if on dom...
          this.rudderPrtAnimate.nativeElement.beginElement();
        }
        if (this.rudderStbAnimate) { // only update if on dom...
          this.rudderStbAnimate.nativeElement.beginElement();
        }
      }
    }
  }

}
