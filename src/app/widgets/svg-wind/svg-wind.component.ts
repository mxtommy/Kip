import { Component, ElementRef, input, viewChild, signal, effect, computed, untracked } from '@angular/core';
import { animateRotation } from '../../core/utils/svg-animate.util';

const angle = ([a,b],[c,d],[e,f]) => (Math.atan2(f-d,e-c)-Math.atan2(b-d,a-c)+3*Math.PI)%(2*Math.PI)-Math.PI;

interface ISVGRotationObject {
  oldValue: number,
  newValue: number,
}

@Component({
    selector: 'app-svg-wind',
    templateUrl: './svg-wind.component.svg',
    styleUrl: './svg-wind.component.scss',
    imports: []
})
export class SvgWindComponent {
  protected readonly rotatingDial = viewChild.required<ElementRef<SVGGElement>>('rotatingDial');
  protected readonly awaIndicator = viewChild.required<ElementRef<SVGGElement>>('awaIndicator');
  protected readonly twaIndicator = viewChild.required<ElementRef<SVGGElement>>('twaIndicator');
  protected readonly wptIndicator = viewChild.required<ElementRef<SVGGElement>>('wptIndicator');
  protected readonly setIndicator = viewChild.required<ElementRef<SVGGElement>>('setIndicator');
  protected readonly cogIndicator = viewChild.required<ElementRef<SVGGElement>>('cogIndicator');

  protected readonly compassHeading = input.required<number>();
  protected readonly courseOverGroundAngle = input<number>(undefined);
  protected readonly courseOverGroundEnabled = input.required<boolean>();
  protected readonly trueWindAngle = input.required<number>();
  protected readonly twsEnabled = input.required<boolean>();
  protected readonly trueWindSpeed = input.required<number>();
  protected readonly trueWindSpeedUnit = input.required<string>();
  protected readonly appWindAngle = input.required<number>();
  protected readonly awsEnabled = input.required<boolean>();
  protected readonly appWindSpeed = input.required<number>();
  protected readonly appWindSpeedUnit = input.required<string>();
  protected readonly laylineAngle = input<number>(undefined);
  protected readonly closeHauledLineEnabled = input.required<boolean>();
  protected readonly sailSetupEnabled = input.required<boolean>();
  protected readonly windSectorEnabled = input.required<boolean>();
  protected readonly driftEnabled = input.required<boolean>();
  protected readonly driftSet = input<number>(undefined);
  protected readonly driftFlow = input<number>(undefined);
  protected readonly waypointAngle = input<number>(undefined);
  protected readonly waypointEnabled = input.required<boolean>();
  protected readonly trueWindMinHistoric = input<number>(undefined);
  protected readonly trueWindMidHistoric = input<number>(undefined);
  protected readonly trueWindMaxHistoric = input<number>(undefined);

  protected compass: ISVGRotationObject = { oldValue: 0, newValue: 0 };
  protected twa: ISVGRotationObject = { oldValue: 0, newValue: 0 };
  protected awa: ISVGRotationObject = { oldValue: 0, newValue: 0 };
  protected wpt: ISVGRotationObject = { oldValue: 0, newValue: 0 };
  protected cog: ISVGRotationObject = { oldValue: 0, newValue: 0 };
  protected set: ISVGRotationObject = { oldValue: 0, newValue: 0 };

  protected headingValue ="--";
  protected appWindSpeedDisplay = computed(() => {
    const appWindSpeed = this.appWindSpeed();
    if (appWindSpeed == null) return "--";
    return appWindSpeed.toFixed(1);
  });
  protected trueWindSpeedDisplay = computed(() => {
    const trueWindSpeed = this.trueWindSpeed();
    if (trueWindSpeed == null) return "--";
    return trueWindSpeed.toFixed(1);
  });
  private trueWindHeading = 0;
  protected waypointActive = signal<boolean>(false);
  protected flow = computed(() => {
    const flow = this.driftFlow();
    if (flow == null) return "--";
    return flow.toFixed(1);
  });

  //laylines - Close-Hauled lines
  private portLaylinePrev = 0;
  private stbdLaylinePrev = 0;
  private portLaylineAnimId: number | null = null;
  private stbdLaylineAnimId: number | null = null;
  protected closeHauledLinePortPath = "M 500,500 500,500";
  protected closeHauledLineStbdPath = "M 500,500 500,500";
  //WindSectors
  private portSectorPrev = { min: 0, mid: 0, max: 0 };
  private stbdSectorPrev = { min: 0, mid: 0, max: 0 };
  private portSectorAnimId: number | null = null;
  private stbdSectorAnimId: number | null = null;
  protected portWindSectorPath = "";
  protected stbdWindSectorPath = "";
  // Rotation Animation
  private animationFrameIds = new WeakMap<SVGGElement, number>();

  private readonly CENTER = 500;
  private readonly RADIUS = 350;
  private readonly ANIMATION_DURATION = 1000;

  constructor() {
    effect(() => {
      const waypoint = this.waypointEnabled();

      untracked(() => {
        this.waypointActive.set(waypoint);
      });
    });

    effect(() => {
      const heading = parseFloat(this.compassHeading().toFixed(0));
      if (heading === null) return;

      untracked(() => {
        this.compass.oldValue = this.compass.newValue;
        this.compass.newValue = heading;
        this.headingValue = heading.toString();
        if (this.rotatingDial()?.nativeElement) {
          animateRotation(this.rotatingDial().nativeElement, -this.compass.oldValue, -this.compass.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds);
          this.updateCloseHauledLines();
          this.updateWindSectors();
        }
      });
    });

    effect(() => {
      const cogAngle = parseFloat(this.courseOverGroundAngle().toFixed(0));
      if (cogAngle == null) return;

      untracked(() => {
        this.cog.oldValue = this.cog.newValue;
        this.cog.newValue =  cogAngle - this.compass.newValue;
        if (this.cogIndicator()?.nativeElement) {
          animateRotation(this.cogIndicator().nativeElement, this.cog.oldValue, this.cog.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds);
        }
      });
    });

    effect(() => {
      const wptAngle = this.waypointAngle();

      untracked(() => {
        if (!wptAngle) {
            this.waypointActive.set(false);
          return;
        }

        if (this.waypointEnabled()) {
          this.waypointActive.set(true);
        } else {
          this.waypointActive.set(false);
        }
        this.wpt.oldValue = this.wpt.newValue;
        this.wpt.newValue = wptAngle;
        if (this.wptIndicator()?.nativeElement) {
          animateRotation(this.wptIndicator().nativeElement, this.wpt.oldValue, this.wpt.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds);
        }
      });
    });

    effect(() => {
      const appWindAngle = parseFloat(this.appWindAngle().toFixed(0));
      if (appWindAngle == null) return;

      untracked(() => {
        this.awa.oldValue = this.awa.newValue;
        this.awa.newValue = appWindAngle;
        if (this.awaIndicator()?.nativeElement) {
          animateRotation(this.awaIndicator().nativeElement, this.awa.oldValue, this.awa.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds);
        }
      });
    });

    effect(() => {
      const trueWindAngle = parseFloat(this.trueWindAngle().toFixed(0));
      if (trueWindAngle == null) return;

      untracked(() => {
        this.twa.oldValue = this.twa.newValue;
        this.trueWindHeading = trueWindAngle;
        this.twa.newValue = this.addHeading(this.trueWindHeading, (this.compass.newValue * -1));
         if (this.twaIndicator()?.nativeElement) {
          animateRotation(this.twaIndicator().nativeElement, this.twa.oldValue, this.twa.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds);
          this.updateCloseHauledLines();
        }
      });
    });

    effect(() => {
      const driftSet = parseFloat(this.driftSet().toFixed(0));
      if (driftSet == null) return;

      untracked(() => {
        this.set.oldValue = this.set.newValue;
        this.set.newValue =  driftSet;
        if (this.setIndicator()?.nativeElement) {
          animateRotation(this.setIndicator().nativeElement, this.set.oldValue, this.set.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds);
        }
      });
    });
  }

  private updateCloseHauledLines(): void {
    if (!this.closeHauledLineEnabled()) return;

    // Animate Port Layline
    const portLaylineRotate = this.addHeading(Number(this.awa.newValue), this.laylineAngle() * -1);
    this.animateLayline(this.portLaylinePrev, portLaylineRotate, true);
    this.portLaylinePrev = portLaylineRotate;

    // Animate Starboard Layline
    const stbdLaylineRotate = this.addHeading(Number(this.awa.newValue), this.laylineAngle());
    this.animateLayline(this.stbdLaylinePrev, stbdLaylineRotate, false);
    this.stbdLaylinePrev = stbdLaylineRotate;
  }

  private animateLayline(from: number, to: number, isPort: boolean) {
    // Cancel any previous animation for this layline
    if (isPort && this.portLaylineAnimId) cancelAnimationFrame(this.portLaylineAnimId);
    if (!isPort && this.stbdLaylineAnimId) cancelAnimationFrame(this.stbdLaylineAnimId);

    const duration = this.ANIMATION_DURATION;
    const start = performance.now();
    const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = ease(progress);
      // Interpolate angle
      let delta = to - from;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const currentAngle = (from + delta * eased + 360) % 360;

      // Calculate endpoint
      const radian = (currentAngle * Math.PI) / 180;
      const x = Math.floor(this.RADIUS * Math.sin(radian) + this.CENTER);
      const y = Math.floor((this.RADIUS * Math.cos(radian) * -1) + this.CENTER);

      if (isPort) {
        this.closeHauledLinePortPath = `M ${this.CENTER},${this.CENTER} L ${x},${y}`;
      } else {
        this.closeHauledLineStbdPath = `M ${this.CENTER},${this.CENTER} L ${x},${y}`;
      }

      if (progress < 1) {
        const id = requestAnimationFrame(animate);
        if (isPort) this.portLaylineAnimId = id;
        else this.stbdLaylineAnimId = id;
      } else {
        if (isPort) this.portLaylineAnimId = null;
        else this.stbdLaylineAnimId = null;
      }
    };

    const id = requestAnimationFrame(animate);
    if (isPort) this.portLaylineAnimId = id;
    else this.stbdLaylineAnimId = id;
  }

  private windSectorsInitialized = false;

  private updateWindSectors() {
    if (
      !this.windSectorEnabled() ||
      this.trueWindMinHistoric() == null ||
      this.trueWindMidHistoric() == null ||
      this.trueWindMaxHistoric() == null
    ) {
      return;
    }

    const portNew = {
      min: this.trueWindMinHistoric(),
      mid: this.trueWindMidHistoric(),
      max: this.trueWindMaxHistoric()
    };
    const stbdNew = {
      min: this.trueWindMinHistoric(),
      mid: this.trueWindMidHistoric(),
      max: this.trueWindMaxHistoric()
    };

    if (!this.windSectorsInitialized) {
      this.portSectorPrev = portNew;
      this.stbdSectorPrev = stbdNew;
      this.windSectorsInitialized = true;
      // Draw in place, no animation
      this.animateWindSector(portNew, portNew, true);
      this.animateWindSector(stbdNew, stbdNew, false);
      return;
    }

    // Animate as usual
    this.animateWindSector(this.portSectorPrev, portNew, true);
    this.animateWindSector(this.stbdSectorPrev, stbdNew, false);

    this.portSectorPrev = portNew;
    this.stbdSectorPrev = stbdNew;
  }

  private animateWindSector(from: { min: number, mid: number, max: number }, to: { min: number, mid: number, max: number }, isPort: boolean) {
    if (isPort && this.portSectorAnimId) cancelAnimationFrame(this.portSectorAnimId);
    if (!isPort && this.stbdSectorAnimId) cancelAnimationFrame(this.stbdSectorAnimId);

    const duration = this.ANIMATION_DURATION;
    const start = performance.now();
    const ease = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = ease(progress);

      // Interpolate each angle
      const lerp = (a: number, b: number) => a + (b - a) * eased;
      const min = lerp(from.min, to.min);
      const mid = lerp(from.mid, to.mid);
      const max = lerp(from.max, to.max);

      // Calculate path
      const minAngle = this.addHeading(this.addHeading(min, Number(this.compass.newValue) * -1), this.laylineAngle() * (isPort ? -1 : 1));
      const midAngle = this.addHeading(this.addHeading(mid, Number(this.compass.newValue) * -1), this.laylineAngle() * (isPort ? -1 : 1));
      const maxAngle = this.addHeading(this.addHeading(max, Number(this.compass.newValue) * -1), this.laylineAngle() * (isPort ? -1 : 1));

      const minX = this.RADIUS * Math.sin((minAngle * Math.PI) / 180) + this.CENTER;
      const minY = (this.RADIUS * Math.cos((minAngle * Math.PI) / 180) * -1) + this.CENTER;
      const midX = this.RADIUS * Math.sin((midAngle * Math.PI) / 180) + this.CENTER;
      const midY = (this.RADIUS * Math.cos((midAngle * Math.PI) / 180) * -1) + this.CENTER;
      const maxX = this.RADIUS * Math.sin((maxAngle * Math.PI) / 180) + this.CENTER;
      const maxY = (this.RADIUS * Math.cos((maxAngle * Math.PI) / 180) * -1) + this.CENTER;

      const largeArcFlag = Math.abs(angle([minX, minY], [midX, midY], [maxX, maxY])) > Math.PI / 2 ? 0 : 1;
      const sweepFlag = angle([maxX, maxY], [minX, minY], [midX, midY]) > 0 ? 0 : 1;

      const path = `M ${this.CENTER},${this.CENTER} L ${minX},${minY} A ${this.RADIUS},${this.RADIUS} 0 ${largeArcFlag} ${sweepFlag} ${maxX},${maxY} z`;

      if (isPort) {
        this.portWindSectorPath = path;
      } else {
        this.stbdWindSectorPath = path;
      }

      if (progress < 1) {
        const id = requestAnimationFrame(animate);
        if (isPort) this.portSectorAnimId = id;
        else this.stbdSectorAnimId = id;
      } else {
        if (isPort) this.portSectorAnimId = null;
        else this.stbdSectorAnimId = null;
      }
    };

    const id = requestAnimationFrame(animate);
    if (isPort) this.portSectorAnimId = id;
    else this.stbdSectorAnimId = id;
  }

  private addHeading(h1 = 0, h2 = 0) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }
}
