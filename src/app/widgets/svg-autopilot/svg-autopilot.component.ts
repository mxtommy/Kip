import { Component, ElementRef, input, viewChild, effect, computed, untracked, signal } from '@angular/core';
import { animateRotation, animateRudderWidth } from '../../core/utils/svg-animate.util';

interface ISVGRotationObject {
  oldValue: number;
  newValue: number;
}

@Component({
  selector: 'app-svg-autopilot',
  templateUrl: './svg-autopilot.component.svg',
  styleUrl: './svg-autopilot.component.scss',
  standalone: true,
  imports: []
})
export class SvgAutopilotComponent {
  private readonly rotatingDial = viewChild.required<ElementRef<SVGGElement>>('rotatingDial');
  private readonly awaIndicator = viewChild.required<ElementRef<SVGGElement>>('awaIndicator');
  private readonly rudderStarboardRect = viewChild.required<ElementRef<SVGRectElement>>('rudderStarboardRect');
  private readonly rudderPortRect = viewChild.required<ElementRef<SVGRectElement>>('rudderPortRect');

  protected readonly apState = input<string>('standby');
  protected readonly targetPilotHeading = input.required<number>();
  protected readonly targetWindAngleHeading = input.required<number>();
  protected readonly rudderAngle = input.required<number>();
  protected readonly courseXte = input.required<number>();
  protected readonly compassHeading = input.required<number>();
  protected readonly appWindAngle = input.required<number>();
  protected readonly targetPilotHeadingTrue = input.required<boolean>();
  protected readonly headingDirectionTrue = input.required<boolean>();

  protected compass : ISVGRotationObject = { oldValue: 0, newValue: 0 };
  protected awa : ISVGRotationObject = { oldValue: 0, newValue: 0 };

  protected oldRudderPrtAngle = 0;
  protected newRudderPrtAngle = 0;
  protected oldRudderStbAngle = 0;
  protected newRudderStbAngle = 0;

  protected apModeValue = signal<string>('');
  protected apModeValueAnnotation = signal<string>('');
  protected apModeValueDirection = signal<string>('');

  protected apTWA = computed(() => {
    const apTWA = parseFloat(this.targetWindAngleHeading().toFixed(0))
    if (apTWA == null) return;
    return apTWA;
  });
  protected lockedMode = computed(() => {
    switch (this.apState()) {
      case "auto": return `Heading Hold`;
      case "route": return `Track`;
      case "wind": return "Wind Hold";
      default: return "Standby";
    }
  });
  protected lockedHdg = computed(() => {
    const lockedHdg = parseFloat(this.targetPilotHeading().toFixed(0));
    const lockedAWA = parseFloat(this.targetWindAngleHeading().toFixed(0));
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
      return this.targetPilotHeadingTrue() ? 'True' : 'Mag';
    }
    if (state === "wind") {
      if (typeof this.lockedHdg() === 'number') {
        const hdg = this.lockedHdg() as number;
        return hdg > 0 ? 'Stbd' : 'Port';
      }
    }
    return '';
  });
  protected hdgDirectionTrue = computed(() => {
    return this.headingDirectionTrue() ? 'T' : 'M';
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
        switch (state) {
          case "auto":
          case "route": {
            let xte: string;
            let xteAnnotation: string;
            let xteDirection: string;

            if (xteValue < 0) {
              xteDirection = ' Port';
            } else if (xteValue > 0) {
              xteDirection = ' Stbd';
            } else {
              xteDirection = '';
            }

            xteValue = Math.abs(xteValue);
            if (xteValue > 999) {
              xte = (xteValue / 1000).toFixed(1);
              xteAnnotation = ' km';
            } else {
              xte = xteValue.toFixed(0);
              xteAnnotation = ' m';
            }

            this.apModeValueAnnotation.set(xteAnnotation);
            this.apModeValue.set(xte);
            this.apModeValueDirection.set(xteDirection);
            break;
          }
          case "standby":
            this.apModeValueAnnotation.set('');
            this.apModeValue.set('');
            this.apModeValueDirection.set('');
            break;
          case "wind":
            this.apModeValueAnnotation.set(awa ? awa > 0 ? 'S' : 'P' : '');
            this.apModeValue.set(Math.abs(awa) + '°');
            this.apModeValueDirection.set('');
            break;
          default:
            this.apModeValueAnnotation.set('');
            this.apModeValue.set('');
            this.apModeValueDirection.set('');
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
