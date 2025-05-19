import { Component, ElementRef, input, viewChild, effect, computed, untracked } from '@angular/core';
import { animateRotation } from '../../core/utils/svg-animate.util';


interface ISVGRotationObject {
  oldValue: number;
  newValue: number;
}

@Component({
  selector: 'app-svg-autopilot-v2',
  templateUrl: './svg-autopilot-v2.component.svg',
  styleUrl: './svg-autopilot-v2.component.scss',
  standalone: true,
  imports: []
})
export class SvgAutopilotV2Component {
  private readonly rotatingDial = viewChild.required<ElementRef<SVGGElement>>('rotatingDial');
  private readonly awaIndicator = viewChild.required<ElementRef<SVGGElement>>('awaIndicator');

  protected readonly compassHeading = input.required<number>();
  protected readonly appWindAngle = input.required<number>();
  protected readonly rudderAngle = input.required<number>();
  protected readonly apState = input<string>('standby');
  protected readonly apTargetAppWindAngle = input.required<number>();
  protected readonly apTargetHeadingMagnetic= input.required<number>();

  protected compass : ISVGRotationObject = { oldValue: 0, newValue: 0 };
  protected awa : ISVGRotationObject = { oldValue: 0, newValue: 0 };

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

  private animationFrameIds = new WeakMap<SVGGElement, number>();
  private readonly ANIMATION_DURATION = 1000;

  constructor() {
    effect(() => {
      if (this.compassHeading() === null || this.compassHeading() === undefined) return;
      const compassHeading = parseFloat(this.compassHeading().toFixed(0));

      untracked(() => {
        this.compass.oldValue = this.compass.newValue;
        this.compass.newValue = compassHeading;
        if (this.rotatingDial()?.nativeElement) {
          animateRotation(this.rotatingDial().nativeElement, -this.compass.oldValue, -this.compass.newValue, 500, undefined, this.animationFrameIds, [500, 560.061]);
        }
      });
    });

    effect(() => {
      if (this.appWindAngle() === null || this.appWindAngle() === undefined) return;
      const aWA = parseFloat(this.appWindAngle().toFixed(0));

      untracked(() => {
        this.awa.oldValue = this.awa.newValue;
        this.awa.newValue = aWA;
        if (this.awaIndicator()?.nativeElement) {
          animateRotation(this.awaIndicator().nativeElement, this.awa.oldValue, this.awa.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds,[500, 560.061]);
        }
      });
    });
  }
}
