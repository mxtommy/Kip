import { Component, Input, ViewChild, ElementRef, SimpleChanges, AfterViewInit } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { NgIf } from '@angular/common';

interface ISVGRotationObject {
  oldDegreeIndicator: string,
  newDegreeIndicator: string,
  animationElement: ElementRef
}

@Component({
    selector: 'app-svg-autopilot',
    templateUrl: './svg-autopilot.component.html',
    styleUrl: './svg-autopilot.component.scss',
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
    ],
    standalone: true,
    imports: [NgIf]
})

export class SvgAutopilotComponent implements AfterViewInit {
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
  @Input('apTargetAppWindAngle') apTargetAppWindAngle: number;
  @Input('isApConnected') isApConnected: boolean;

  // compass
  compassFaceplate: ISVGRotationObject;
  headingValue: string ="--";

  // Apparent wind
  appWind: ISVGRotationObject;

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

  constructor() {
    this.compassFaceplate =  {
      oldDegreeIndicator: '0',
      newDegreeIndicator: '0',
      animationElement: undefined
    };

    this.appWind =  {
      oldDegreeIndicator: '0',
      newDegreeIndicator: '0',
      animationElement: undefined
    };
  }

  ngAfterViewInit(): void {
    this.compassFaceplate.animationElement = this.compassAnimate;
    this.appWind.animationElement = this.appWindAnimate;
  }

  ngOnChanges(changes: SimpleChanges) {

    //heading
    if (changes.compassHeading) {
      if (! changes.compassHeading.firstChange) {
        this.compassFaceplate.oldDegreeIndicator = this.compassFaceplate.newDegreeIndicator;
        this.headingValue = this.compassFaceplate.newDegreeIndicator = changes.compassHeading.currentValue.toFixed(0);
        this.smoothCircularRotation(this.compassFaceplate);
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
        this.appWind.oldDegreeIndicator = this.appWind.newDegreeIndicator;
        this.appWind.newDegreeIndicator = changes.appWindAngle.currentValue.toFixed(0);
        this.smoothCircularRotation(this.appWind);
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

  private smoothCircularRotation(rotationElement: ISVGRotationObject): void {
    const oldAngle = Number(rotationElement.oldDegreeIndicator)
    const newAngle = Number(rotationElement.newDegreeIndicator);
    const diff = oldAngle - newAngle;
    // only update if on DOM and value rounded changed
    if (rotationElement.animationElement && (diff != 0)) {
      // Special cases to smooth out passing between 359 to/from 0
      // if more than half the circle, it could need to go over the 359 to 0 without doing full full circle
      if ( Math.abs(diff) > 180 ) {
        // In what direction are we moving?
        if (Math.sign(diff) == 1) {
          if (oldAngle == 359) {
            // special cases
            rotationElement.oldDegreeIndicator = "0";
            rotationElement.animationElement.nativeElement.beginElement();
          } else {
            rotationElement.newDegreeIndicator = "359";
            rotationElement.animationElement.nativeElement.beginElement();
            rotationElement.oldDegreeIndicator = "0";
            rotationElement.newDegreeIndicator = newAngle.toFixed(0);
            rotationElement.animationElement.nativeElement.beginElement();
          }
        } else {
          if (oldAngle == 0) {
            // special cases
            rotationElement.oldDegreeIndicator = "359";
            rotationElement.animationElement.nativeElement.beginElement();
          } else {
            rotationElement.newDegreeIndicator = "0";
            rotationElement.animationElement.nativeElement.beginElement();
            rotationElement.oldDegreeIndicator = "359";
            rotationElement.newDegreeIndicator = newAngle.toFixed(0);
            rotationElement.animationElement.nativeElement.beginElement();
          }
        }
      } else {
        rotationElement.animationElement.nativeElement.beginElement();
      }
    }
  }

}
