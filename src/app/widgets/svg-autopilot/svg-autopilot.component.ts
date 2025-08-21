import { Component, ElementRef, input, viewChild, effect, computed, untracked, signal, OnDestroy, NgZone, inject } from '@angular/core';
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
export class SvgAutopilotComponent implements OnDestroy {
  private readonly rotatingDial = viewChild.required<ElementRef<SVGGElement>>('rotatingDial');
  private readonly awaIndicator = viewChild.required<ElementRef<SVGGElement>>('awaIndicator');
  private readonly rudderStarboardRect = viewChild.required<ElementRef<SVGRectElement>>('rudderStarboardRect');
  private readonly rudderPortRect = viewChild.required<ElementRef<SVGRectElement>>('rudderPortRect');

  protected readonly apMode = input<string>('off-line');
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
    const mode = this.apMode();
      if (mode === "auto" || mode === "compass") return `Heading Hold`;
      if (mode === "gps") return "GPS Hold";
      if (mode === "route" || mode === "nav") return `Track`;
      if (mode === "wind") return "Wind Hold";
      if (mode === "wind true") return "Wind True Hold";
      if (mode === "standby") return "Standby";
      return "Off-line";
  });
  protected lockedHdg = computed(() => {
    const lockedHdg = parseFloat(this.targetPilotHeading().toFixed(0));
    const lockedAWA = parseFloat(this.targetWindAngleHeading().toFixed(0));
     switch (this.apMode()) {
      case "auto": return lockedHdg;
      case "route": return lockedHdg;
      case "wind": return lockedAWA;
      default: return "--";
    }
  });
  protected lockedHdgAnnotation = computed(() => {
    const state = this.apMode();
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
  private readonly ngZone = inject(NgZone);

  constructor() {
    effect(() => {
      if (this.compassHeading() === null || this.compassHeading() === undefined) return;
      const compassHeading = parseFloat(this.compassHeading().toFixed(0));

      untracked(() => {
        this.compass.oldValue = this.compass.newValue;
        this.compass.newValue = compassHeading;
        if (this.rotatingDial()?.nativeElement) {
          animateRotation(this.rotatingDial().nativeElement, -this.compass.oldValue, -this.compass.newValue, 500, undefined, this.animationFrameIds, [500, 560.061], this.ngZone);
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
          animateRotation(this.awaIndicator().nativeElement, this.awa.oldValue, this.awa.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds,[500, 560.061], this.ngZone);
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
      const state = this.apMode();
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
        this.rudderAnimationFrames,
        this.ngZone
      );
      animateRudderWidth(
        this.rudderPortRect().nativeElement,
        this.oldRudderPrtAngle,
        0,
        500,
        undefined,
        this.rudderAnimationFrames,
        this.ngZone
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
        this.rudderAnimationFrames,
        this.ngZone
      );
      animateRudderWidth(
        this.rudderStarboardRect().nativeElement,
        this.oldRudderStbAngle,
        0,
        500,
        undefined,
        this.rudderAnimationFrames,
        this.ngZone
      );
      this.oldRudderPrtAngle = capped;
      this.oldRudderStbAngle = 0;
    }
  }
  ngOnDestroy(): void {
    // Cancel rotation frame ids
    const gEls: (ElementRef<SVGGElement> | undefined)[] = [this.rotatingDial(), this.awaIndicator()];
    for (const ref of gEls) {
      const el = ref?.nativeElement; if (!el) continue;
      const id = this.animationFrameIds.get(el); if (id) cancelAnimationFrame(id);
      this.animationFrameIds.delete(el);
    }
    // Cancel rudder width frame ids
    const rEls: (ElementRef<SVGRectElement> | undefined)[] = [this.rudderStarboardRect(), this.rudderPortRect()];
    for (const ref of rEls) {
      const el = ref?.nativeElement; if (!el) continue;
      const id = this.rudderAnimationFrames.get(el); if (id) cancelAnimationFrame(id);
      this.rudderAnimationFrames.delete(el);
    }
  }
}
