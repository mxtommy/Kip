import { Component, ElementRef, AfterViewInit, OnDestroy, input, viewChild, effect, computed } from '@angular/core';

interface ISVGRotationObject {
  oldDegreeIndicator: number;
  newDegreeIndicator: number;
  animationElement: ElementRef | null;
}

@Component({
  selector: 'app-svg-autopilot',
  templateUrl: './svg-autopilot.component.svg',
  styleUrl: './svg-autopilot.component.scss',
  standalone: true,
  imports: []
})
export class SvgAutopilotComponent implements AfterViewInit, OnDestroy {
  private  readonly compassAnimate = viewChild.required<ElementRef<SVGAnimateTransformElement>>('compassAnimate');
  private readonly appWindAnimate = viewChild.required<ElementRef<SVGAnimateTransformElement>>('appWindAnimate');

  protected readonly compassHeading = input.required<number>();
  protected readonly appWindAngle = input.required<number>();
  protected readonly rudderAngle = input.required<number>();
  protected readonly apState = input<string>('standby');
  protected readonly apTargetAppWindAngle = input.required<number>();
  protected readonly apTargetHeadingMagnetic= input.required<number>();

  protected compassFaceplate : ISVGRotationObject = { oldDegreeIndicator: 0, newDegreeIndicator: 0, animationElement: null };
  protected appWind: ISVGRotationObject = { oldDegreeIndicator: 0, newDegreeIndicator: 0, animationElement: null };

  protected apTWA = computed(() => {
    const apTWA = parseFloat(this.apTargetAppWindAngle().toFixed(0))
    if (apTWA == null) return;
    return apTWA;
  });
  protected lockedMode = computed(() => {
    switch (this.apState()) {
      case "auto": return "HDG";
      case "route": return "HDG";
      case "wind": return "AWA";
      default: return "";
    }
  });
  protected lockedHdg = computed(() => {
    const lockedHdgMag = parseFloat(this.apTargetHeadingMagnetic().toFixed(0));
    const lockedAWA = parseFloat(this.apTargetAppWindAngle().toFixed(0));
     switch (this.apState()) {
      case "auto": return lockedHdgMag;
      case "route": return lockedHdgMag;
      case "wind": return lockedAWA;
      default: return "--";
    }
  });

  constructor() {
    effect(() => {
     const compassHeading = this.compassHeading();
     if (compassHeading == null) return;
      this.updateRotation(this.compassFaceplate, parseFloat(compassHeading.toFixed(0)));
    });

    effect(() => {
     const aWA = this.appWindAngle();
     if (aWA == null) return;
      this.updateRotation(this.appWind, parseFloat(aWA.toFixed(0)));
    });
  }

  ngAfterViewInit(): void {
    this.compassFaceplate.animationElement = this.compassAnimate();
    this.appWind.animationElement = this.appWindAnimate();
  }

  ngOnDestroy(): void {
    this.compassFaceplate.animationElement = null;
    this.appWind.animationElement = null;
  }

  private updateRotation(rotationObject: ISVGRotationObject, newValue: number): void {
    rotationObject.oldDegreeIndicator = rotationObject.newDegreeIndicator;
    rotationObject.newDegreeIndicator = newValue;
    this.smoothCircularRotation(rotationObject);
  }

  private smoothCircularRotation(rotationElement: ISVGRotationObject): void {
    if (!rotationElement.animationElement) return;

    const oldAngle = Number(rotationElement.oldDegreeIndicator);
    const newAngle = Number(rotationElement.newDegreeIndicator);
    const diff = oldAngle - newAngle;

    if (diff === 0) return;

    if (Math.abs(diff) > 180) {
      const specialCases = [
        { condition: oldAngle === 359, oldVal: 0 },
        { condition: oldAngle === 0, oldVal: 359 }
      ];

      for (const { condition, oldVal } of specialCases) {
        if (condition) {
          rotationElement.oldDegreeIndicator = oldVal;
          rotationElement.animationElement.nativeElement.beginElement();
          return;
        }
      }

      rotationElement.newDegreeIndicator = diff > 0 ? 359 : 0;
      rotationElement.animationElement.nativeElement.beginElement();
      rotationElement.oldDegreeIndicator = diff > 0 ? 0 : 359;
      rotationElement.newDegreeIndicator = newAngle;
      rotationElement.animationElement.nativeElement.beginElement();
    } else {
      rotationElement.animationElement.nativeElement.beginElement();
    }
  }
}
