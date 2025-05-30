import { Component, ElementRef, input, viewChild, effect, computed, untracked, signal } from '@angular/core';
import { animateRotation, animateRudderWidth } from '../../core/utils/svg-animate.util';

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
  private readonly rudderStarboardRect = viewChild.required<ElementRef<SVGRectElement>>('rudderStarboardRect');
  private readonly rudderPortRect = viewChild.required<ElementRef<SVGRectElement>>('rudderPortRect');

  protected readonly compassHeading = input.required<number>();
  protected readonly headingDirectionTrue = input.required<boolean>();
  protected readonly appWindAngle = input.required<number>();
  protected readonly rudderAngle = input.required<number>();
  protected readonly apState = input<string>('standby');
  protected readonly apTargetAppWindAngle = input.required<number>();
  protected readonly courseTargetHeading = input.required<number>();
  protected readonly courseXte = input.required<number>();
  protected readonly courseDirectionTrue = input.required<boolean>();

  protected compass : ISVGRotationObject = { oldValue: 0, newValue: 0 };
  protected awa : ISVGRotationObject = { oldValue: 0, newValue: 0 };

  protected oldRudderPrtAngle: number = 0;
  protected newRudderPrtAngle: number = 0;
  protected oldRudderStbAngle: number = 0;
  protected newRudderStbAngle: number = 0;

  protected apModeValue = signal<string>('');
  protected apModeValueAnnotation = signal<string>('');

  protected apTWA = computed(() => {
    const apTWA = parseFloat(this.apTargetAppWindAngle().toFixed(0))
    if (apTWA == null) return;
    return apTWA;
  });
  protected lockedMode = computed(() => {
    switch (this.apState()) {
      case "auto": return `Locked BRG`;
      case "route": return `Locked HDG`;
      case "wind": return "Locked AWA";
      default: return "Standby";
    }
  });
  protected lockedHdg = computed(() => {
    const lockedHdg = parseFloat(this.courseTargetHeading().toFixed(0));
    const lockedAWA = parseFloat(this.apTargetAppWindAngle().toFixed(0));
     switch (this.apState()) {
      case "auto": return lockedHdg;
      case "route": return lockedHdg;
      case "wind": return lockedAWA;
      default: return "--";
    }
  });
  protected lockedHdgAnnotation = computed(() => {
    const state = this.apState();
    if (state === "route" || state === "auto") {
      return this.courseDirectionTrue() ? 'T' : 'M';
    }
    return '';
  });
  protected hdgDirectionTrue = computed(() => {
    return this.headingDirectionTrue() ? 'True' : 'Mag';
  });
  private animationFrameIds = new WeakMap<SVGGElement, number>();
  private rudderAnimationFrames = new WeakMap<SVGRectElement, number>();
  private readonly ANIMATION_DURATION = 1000;
  private readonly DEG_TO_PX = 16.66666667; // 30° maps to 500px, so 1° = 500/30 = 16.6667px

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
      const aWA = parseFloat(this.appWindAngle().toFixed(0));
      const awa360 = (aWA + 360) % 360;
      untracked(() => {
        this.awa.oldValue = this.awa.newValue;
        this.awa.newValue = awa360;
        if (this.awaIndicator()?.nativeElement) {
          animateRotation(this.awaIndicator().nativeElement, this.awa.oldValue, this.awa.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds,[500, 560.061]);
        }
      });
    });

    effect(() => {
      const rudderAngle = this.rudderAngle();
      if (rudderAngle == null) return;
      untracked(() => {
        this.updateRudderAngle(-rudderAngle);
      });
    });

    effect(() => {
      const state = this.apState();
      const awa = parseFloat(this.appWindAngle().toFixed(0));
      let xteValue = this.courseXte();

      untracked(() => {
        let xte: string;
        let xteAnnotation: string;

        if (Math.abs(xteValue) > 99) {
          xte = (xteValue / 1000).toFixed(1);
          xteAnnotation = ' km';
        } else {
          xte = xteValue.toFixed(1);
          xteAnnotation = ' m';
        }

        switch (state) {
          case "auto":
          case "route":
            this.apModeValueAnnotation.set(xteAnnotation);
            this.apModeValue.set(xte);
            break;
          case "standby":
            this.apModeValueAnnotation.set('');
            this.apModeValue.set('');
            break;
          case "wind":
            this.apModeValueAnnotation.set(awa ? awa > 0 ? 'S' : 'P' : '');
            this.apModeValue.set(Math.abs(awa) + '°');
            break;
          default:
            this.apModeValueAnnotation.set('');
            this.apModeValue.set('');
            break;
        }
      });
    });
  }

  private updateRudderAngle(newAngle: number): void {
    const maxAngle = 30;
    const capped = Math.min(Math.abs(newAngle), maxAngle) * this.DEG_TO_PX;

    if (newAngle <= 0) {
      animateRudderWidth(
        this.rudderStarboardRect().nativeElement,
        this.oldRudderStbAngle,
        capped,
        500,
        undefined,
        this.rudderAnimationFrames
      );
      animateRudderWidth(
        this.rudderPortRect().nativeElement,
        this.oldRudderPrtAngle,
        0,
        500,
        undefined,
        this.rudderAnimationFrames
      );
      this.oldRudderStbAngle = capped;
      this.oldRudderPrtAngle = 0;
    } else {
      animateRudderWidth(
        this.rudderPortRect().nativeElement,
        this.oldRudderPrtAngle,
        capped,
        500,
        undefined,
        this.rudderAnimationFrames
      );
      animateRudderWidth(
        this.rudderStarboardRect().nativeElement,
        this.oldRudderStbAngle,
        0,
        500,
        undefined,
        this.rudderAnimationFrames
      );
      this.oldRudderPrtAngle = capped;
      this.oldRudderStbAngle = 0;
    }
  }
}
