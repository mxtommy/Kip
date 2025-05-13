import { Component, Input, ElementRef, SimpleChanges, AfterViewInit, OnDestroy, input, viewChild } from '@angular/core';
import { trigger, state, style, animate, transition } from '@angular/animations';
import { NgIf } from '@angular/common';

interface ISVGRotationObject {
  oldDegreeIndicator: string;
  newDegreeIndicator: string;
  animationElement: ElementRef | null;
}

@Component({
  selector: 'app-svg-autopilot-old',
  templateUrl: './svg-autopilot.component.html',
  styleUrl: './svg-autopilot.component.scss',
  animations: [
    trigger('fadeInOut', [
      state('connected', style({ opacity: 0 })),
      state('disconnected', style({ opacity: 1 })),
      transition('connected <=> disconnected', animate('.3s')),
    ]),
  ],
  standalone: true,
  imports: [NgIf]
})
export class SvgAutopilotComponentOld implements AfterViewInit, OnDestroy {
  readonly ApStencil = viewChild.required<ElementRef>('apStencil');
  readonly countDown = viewChild.required<ElementRef>('countDown');
  readonly compassAnimate = viewChild.required<ElementRef>('compassAnimate');
  readonly appWindAnimate = viewChild.required<ElementRef>('appWindAnimate');
  readonly rudderPrtAnimate = viewChild.required<ElementRef>('rudderPrtAnimate');
  readonly rudderStbAnimate = viewChild.required<ElementRef>('rudderStbAnimate');

  readonly compassHeading = input.required<number>();
  readonly appWindAngle = input.required<number>();
  readonly rudderAngle = input.required<number>();
  @Input() apState!: string;
  @Input() apTargetAppWindAngle!: number;
  readonly isApConnected = input.required<boolean>();

  compassFaceplate: ISVGRotationObject = { oldDegreeIndicator: '0', newDegreeIndicator: '0', animationElement: null };
  appWind: ISVGRotationObject = { oldDegreeIndicator: '0', newDegreeIndicator: '0', animationElement: null };
  headingValue: string = "--";

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

  ngAfterViewInit(): void {
    this.compassFaceplate.animationElement = this.compassAnimate();
    this.appWind.animationElement = this.appWindAnimate();
  }

  ngOnDestroy(): void {
    this.compassFaceplate.animationElement = null;
    this.appWind.animationElement = null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.compassHeading && !changes.compassHeading.firstChange) {
      this.updateRotation(this.compassFaceplate, changes.compassHeading.currentValue);
    }

    if (changes.apState && !changes.apState.firstChange) {
      this.apState = this.apState.toUpperCase();
    }

    if (changes.apTargetAppWindAngle && !changes.apTargetAppWindAngle.firstChange) {
      this.apTargetAppWindAngle = parseFloat(changes.apTargetAppWindAngle.currentValue.toFixed(0));
    }

    if (changes.appWindAngle && !changes.appWindAngle.firstChange) {
      this.updateRotation(this.appWind, changes.appWindAngle.currentValue);
    }

    if (changes.rudderAngle && !changes.rudderAngle.firstChange) {
      this.updateRudderAngle(changes.rudderAngle.currentValue);
    }
  }

  private updateRotation(rotationObject: ISVGRotationObject, newValue: number): void {
    rotationObject.oldDegreeIndicator = rotationObject.newDegreeIndicator;
    rotationObject.newDegreeIndicator = newValue.toFixed(0);
    this.smoothCircularRotation(rotationObject);
  }

  private updateRudderAngle(newAngle: number): void {
    if (newAngle <= 0) {
      this.oldRudderPrtAngle = this.newRudderPrtAngle = 0;
      this.oldRudderStbAngle = this.newRudderStbAngle;
      this.newRudderStbAngle = Math.round(newAngle * -7.16);
    } else {
      this.oldRudderStbAngle = this.newRudderStbAngle = 0;
      this.oldRudderPrtAngle = this.newRudderPrtAngle;
      this.newRudderPrtAngle = Math.round(newAngle * 7.16);
    }

    this.animateRudder();
  }

  private animateRudder(): void {
    this.rudderPrtAnimate()?.nativeElement?.beginElement();
    this.rudderStbAnimate()?.nativeElement?.beginElement();
  }

  private smoothCircularRotation(rotationElement: ISVGRotationObject): void {
    if (!rotationElement.animationElement) return;

    const oldAngle = Number(rotationElement.oldDegreeIndicator);
    const newAngle = Number(rotationElement.newDegreeIndicator);
    const diff = oldAngle - newAngle;

    if (diff === 0) return;

    if (Math.abs(diff) > 180) {
      const specialCases = [
        { condition: oldAngle === 359, oldVal: '0' },
        { condition: oldAngle === 0, oldVal: '359' }
      ];

      for (const { condition, oldVal } of specialCases) {
        if (condition) {
          rotationElement.oldDegreeIndicator = oldVal;
          rotationElement.animationElement.nativeElement.beginElement();
          return;
        }
      }

      rotationElement.newDegreeIndicator = diff > 0 ? '359' : '0';
      rotationElement.animationElement.nativeElement.beginElement();
      rotationElement.oldDegreeIndicator = diff > 0 ? '0' : '359';
      rotationElement.newDegreeIndicator = newAngle.toFixed(0);
      rotationElement.animationElement.nativeElement.beginElement();
    } else {
      rotationElement.animationElement.nativeElement.beginElement();
    }
  }
}
