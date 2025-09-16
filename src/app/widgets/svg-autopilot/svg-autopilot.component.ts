import { Component, ElementRef, input, viewChild, effect, computed, untracked, signal, NgZone, inject, OnDestroy, ChangeDetectionStrategy } from '@angular/core';
import { animateRotation, animateRudderWidth } from '../../core/utils/svg-animate.util';
import { TApMode } from '../../core/interfaces/signalk-autopilot-interfaces';


@Component({
  selector: 'app-svg-autopilot',
  templateUrl: './svg-autopilot.component.svg',
  styleUrl: './svg-autopilot.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: []
})
export class SvgAutopilotComponent implements OnDestroy {
  private readonly rotatingDial = viewChild.required<ElementRef<SVGGElement>>('rotatingDial');
  private readonly awaIndicator = viewChild.required<ElementRef<SVGGElement>>('awaIndicator');
  private readonly rudderStarboardRect = viewChild.required<ElementRef<SVGRectElement>>('rudderStarboardRect');
  private readonly rudderPortRect = viewChild.required<ElementRef<SVGRectElement>>('rudderPortRect');

  protected readonly apMode = input<TApMode>('off-line');
  protected readonly targetPilotHeadingTrue = input.required<boolean>();
  protected readonly autopilotTarget = input.required<number>();
  protected readonly courseXte = input.required<number>();
  protected readonly compassHeading = input.required<number>();
  protected readonly headingDirectionTrue = input.required<boolean>();
  protected readonly appWindAngle = input.required<number>();
  protected readonly rudderAngle = input.required<number>();

  protected compassAngle = signal<number>(0);
  protected awaAngle = signal<number>(0);
  private prevCompassAngle = 0;
  private prevAwaAngle = 0;

  private lastRudderSigned = Number.NaN;
  protected oldRudderPrtAngle = 0;
  protected newRudderPrtAngle = 0;
  protected oldRudderStbAngle = 0;
  protected newRudderStbAngle = 0;

  protected apModeValue = signal<string>('');
  protected apModeValueAnnotation = signal<string>('');
  protected apModeValueDirection = signal<string>('');

  protected lockedMode = computed(() => {
    const mode = this.apMode();
    if (mode === "auto" || mode === "compass") return `Heading Hold`;
    if (mode === "gps") return "GPS Hold";
    if (mode === "route" || mode === "nav") return `Track`;
    if (mode === "wind") return "Wind Hold";
    if (mode === "true wind") return "Wind True Hold";
    if (mode === "standby") return "Standby";
    return "Off-line";
  });
  protected lockedHdg = computed<number | null>(() => {
    const target = this.autopilotTarget();
    if (!Number.isFinite(target as number)) return null;
    return this.roundDeg(target as number);
  });
  protected lockedHdgAnnotation = computed(() => {
    const state = this.apMode();
    if (["route", "auto", "gps", "nav"].includes(state)) {
      return this.targetPilotHeadingTrue() ? 'True' : 'Mag';
    }
    if (["wind", "true wind"].includes(state)) {
      const hdg = this.lockedHdg() ?? null;
      if (hdg === null) return '';
      return hdg > 0 ? 'Stbd' : 'Port';
    }
    return '';
  });
  protected hdgDirectionTrue = computed(() => {
    return this.headingDirectionTrue() ? 'T' : 'M';
  });
  private animationFrames = new WeakMap<Element, number>();
  private readonly ANIMATION_DURATION = 1000; // unified animation duration (ms)
  private readonly DEG_TO_PX = 16.66666667; // 30° maps to 500px, so 1° = 500/30 = 16.6667px
  private readonly ROT_CENTER: [number, number] = [500, 560.061];
  private readonly ngZone = inject(NgZone);
  // Integer degree rounding (changes <1° are ignored elsewhere)
  private roundDeg(v: number): number { return Math.round(v); }

  constructor() {
    effect(() => {
      const heading = this.compassHeading();
      if (!Number.isFinite(heading as number)) return;
      const next = this.roundDeg(heading);
      untracked(() => {
        const prev = this.prevCompassAngle;
        if (prev === next) return;
        this.prevCompassAngle = next;
        this.compassAngle.set(next);
        const dial = this.rotatingDial()?.nativeElement;
        if (!dial) return;
        animateRotation(dial, -prev, -next, this.ANIMATION_DURATION, undefined, this.animationFrames, this.ROT_CENTER, this.ngZone);
      });
    });

    effect(() => {
      const aWA = this.appWindAngle();
      if (!Number.isFinite(aWA as number)) return;
      const nextRaw = this.roundDeg(aWA);
      const next = (nextRaw + 360) % 360;
      untracked(() => {
        const prev = this.prevAwaAngle;
        if (prev === next) return;
        this.prevAwaAngle = next;
        this.awaAngle.set(next);
        const awaEl = this.awaIndicator()?.nativeElement;
        if (!awaEl) return;
        animateRotation(awaEl, prev, next, this.ANIMATION_DURATION, undefined, this.animationFrames, this.ROT_CENTER, this.ngZone);
      });
    });

    effect(() => {
      const rudderAngle = this.rudderAngle();
      if (!Number.isFinite(rudderAngle as number)) return;
      untracked(() => {
        this.updateRudderAngle(-rudderAngle);
      });
    });

    effect(() => {
      const state = this.apMode();
      const awaRaw = this.appWindAngle();
      const awa = Number.isFinite(awaRaw as number) ? this.roundDeg(awaRaw) : 0;
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
            if (xteValue > 185) {
              xte = (xteValue / 1852).toFixed(1);
              xteAnnotation = ' nm';
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
    if (!Number.isFinite(newAngle)) return;
    const rounded = this.roundDeg(newAngle);
    if (this.lastRudderSigned === rounded) return;
    this.lastRudderSigned = rounded;
    const maxAngle = 30;
    const capped = Math.min(Math.abs(rounded), maxAngle) * this.DEG_TO_PX;

    if (rounded <= 0) {
      animateRudderWidth(
        this.rudderStarboardRect().nativeElement,
        this.oldRudderStbAngle,
        capped,
        this.ANIMATION_DURATION,
        undefined,
        this.animationFrames,
        this.ngZone
      );
      animateRudderWidth(
        this.rudderPortRect().nativeElement,
        this.oldRudderPrtAngle,
        0,
        this.ANIMATION_DURATION,
        undefined,
        this.animationFrames,
        this.ngZone
      );
      this.oldRudderStbAngle = capped;
      this.oldRudderPrtAngle = 0;
    } else {
      animateRudderWidth(
        this.rudderPortRect().nativeElement,
        this.oldRudderPrtAngle,
        capped,
        this.ANIMATION_DURATION,
        undefined,
        this.animationFrames,
        this.ngZone
      );
      animateRudderWidth(
        this.rudderStarboardRect().nativeElement,
        this.oldRudderStbAngle,
        0,
        this.ANIMATION_DURATION,
        undefined,
        this.animationFrames,
        this.ngZone
      );
      this.oldRudderPrtAngle = capped;
      this.oldRudderStbAngle = 0;
    }
  }

  ngOnDestroy(): void {
    // Cancel rotation frames
    const rotatingEls: (ElementRef<SVGGElement> | undefined)[] = [this.rotatingDial(), this.awaIndicator(), this.rudderPortRect(), this.rudderStarboardRect()];
    for (const ref of rotatingEls) {
      const el = ref?.nativeElement;
      if (!el) continue;
      const id = this.animationFrames.get(el);
      if (id) cancelAnimationFrame(id);
      this.animationFrames.delete(el);
    }
  }
}
