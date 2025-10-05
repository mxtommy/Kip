import { Component, ElementRef, input, viewChild, signal, effect, untracked, ChangeDetectionStrategy, OnDestroy, NgZone, inject } from '@angular/core';
import { animateRotation, animateAngleTransition, animateSectorTransition, SectorAngles } from '../../core/utils/svg-animate.util';
import { DecimalPipe } from '@angular/common';

const angle = ([a, b], [c, d], [e, f]) => (Math.atan2(f - d, e - c) - Math.atan2(b - d, a - c) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;

interface ISVGRotationObject {
  oldValue: number,
  newValue: number,
}

@Component({
  selector: 'svg-windsteer',
  templateUrl: './svg-windsteer.component.svg',
  styleUrl: './svg-windsteer.component.scss',
  imports: [DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SvgWindsteerComponent implements OnDestroy {
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
  protected readonly twaEnabled = input.required<boolean>();
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

  protected headingValue = "--";
  private trueWindHeading = 0;
  protected waypointActive = signal<boolean>(false);

  //laylines - Close-Hauled lines
  private portLaylinePrev = 0;
  private stbdLaylinePrev = 0;
  private portLaylineAnimId: number | null = null;
  private stbdLaylineAnimId: number | null = null;
  protected closeHauledLinePortPath = signal<string>("M 500,500 500,500");
  protected closeHauledLineStbdPath = signal<string>("M 500,500 500,500");
  //WindSectors
  private portSectorPrev = { min: 0, mid: 0, max: 0 };
  private stbdSectorPrev = { min: 0, mid: 0, max: 0 };
  private portSectorAnimId: number | null = null;
  private stbdSectorAnimId: number | null = null;
  protected portWindSectorPath = signal<string>("");
  protected stbdWindSectorPath = signal<string>("");
  // Rotation Animation
  private animationFrameIds = new WeakMap<SVGGElement, number>();

  private readonly CENTER = 500;
  private readonly RADIUS = 350;
  private readonly ANIMATION_DURATION = 900;
  private readonly EPS_ANGLE = 1.0; // degrees, gate tiny animations

  private readonly ngZone = inject(NgZone);

  constructor() {
    effect(() => {
      const waypoint = this.waypointEnabled();

      untracked(() => {
        this.waypointActive.set(waypoint);
      });
    });

    effect(() => {
      const raw = this.compassHeading();
      const heading = Number.isFinite(raw) ? Math.round(raw as number) : null;
      if (heading == null) return;

      untracked(() => {
        this.compass.oldValue = this.compass.newValue;
        this.compass.newValue = heading;
        this.headingValue = heading.toString();
        if (this.rotatingDial()?.nativeElement) {
          animateRotation(this.rotatingDial().nativeElement, -this.compass.oldValue, -this.compass.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds, undefined, this.ngZone);
          // Heading affects dial-local geometry for laylines and sectors; refresh without animation
          this.updateCloseHauledLines(false);
          this.updateWindSectors(false);
        }
      });
    });

    effect(() => {
      const raw = this.courseOverGroundAngle();
      const cogAngle = Number.isFinite(raw as number) ? Math.round(raw as number) : null;
      if (cogAngle == null) return;

      untracked(() => {
        this.cog.oldValue = this.cog.newValue;
        this.cog.newValue = cogAngle - this.compass.newValue;
        if (this.cogIndicator()?.nativeElement) {
          animateRotation(this.cogIndicator().nativeElement, this.cog.oldValue, this.cog.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds, undefined, this.ngZone);
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
          animateRotation(this.wptIndicator().nativeElement, this.wpt.oldValue, this.wpt.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds, undefined, this.ngZone);
        }
      });
    });

    effect(() => {
      const raw = this.appWindAngle();
      const appWindAngle = Number.isFinite(raw as number) ? Math.round(raw as number) : null;
      if (appWindAngle == null) return;

      untracked(() => {
        this.awa.oldValue = this.awa.newValue;
        this.awa.newValue = appWindAngle;
        if (this.awaIndicator()?.nativeElement) {
          animateRotation(this.awaIndicator().nativeElement, this.awa.oldValue, this.awa.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds, undefined, this.ngZone);
        }
        // Laylines align to apparent wind; recompute on AWA
        this.updateCloseHauledLines();
      });
    });

    effect(() => {
      const raw = this.trueWindAngle();
      const trueWindAngle = Number.isFinite(raw as number) ? Math.round(raw as number) : null;
      if (trueWindAngle == null) return;

      untracked(() => {
        this.twa.oldValue = this.twa.newValue;
        this.trueWindHeading = trueWindAngle;
        this.twa.newValue = this.addHeading(this.trueWindHeading, (this.compass.newValue * -1));
        if (this.twaIndicator()?.nativeElement) {
          animateRotation(this.twaIndicator().nativeElement, this.twa.oldValue, this.twa.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds, undefined, this.ngZone);
        }
      });
    });

    // Recompute laylines when laylineAngle changes
    effect(() => {
      // read to establish dependency
      void this.laylineAngle();
      if (!this.closeHauledLineEnabled()) return;
      untracked(() => this.updateCloseHauledLines());
    });

  // Recompute laylines when AWA changes (already handled in AWA effect) and when laylineAngle changes (below)

    effect(() => {
      const raw = this.driftSet();
      const driftSet = Number.isFinite(raw as number) ? Math.round(raw as number) : null;
      if (driftSet == null) return;

      untracked(() => {
        this.set.oldValue = this.set.newValue;
        this.set.newValue = driftSet;
        if (this.setIndicator()?.nativeElement) {
          animateRotation(this.setIndicator().nativeElement, this.set.oldValue, this.set.newValue, this.ANIMATION_DURATION, undefined, this.animationFrameIds, undefined, this.ngZone);
        }
      });
    });

    // Ensure wind sectors update on min/mid/max or layline changes, and clear when disabled
    effect(() => {
      const enabled = this.windSectorEnabled();
      // establish dependencies without unused vars warnings
      void this.trueWindMinHistoric();
      void this.trueWindMidHistoric();
      void this.trueWindMaxHistoric();
      void this.laylineAngle();

      untracked(() => {
        if (!enabled) {
          // stop any ongoing sector animations and hide paths
          if (this.portSectorAnimId) cancelAnimationFrame(this.portSectorAnimId);
          if (this.stbdSectorAnimId) cancelAnimationFrame(this.stbdSectorAnimId);
          this.portSectorAnimId = null;
          this.stbdSectorAnimId = null;
          this.portWindSectorPath.set('none');
          this.stbdWindSectorPath.set('none');
          return;
        }
        this.updateWindSectors(true);
      });
    });
  }

  private updateCloseHauledLines(animate = true): void {
    if (!this.closeHauledLineEnabled()) return;

    // Dial-local angle must include heading so that dial rotation (-heading) yields boat-relative result
    const heading = Number(this.compass.newValue) || 0;
  const boatBase = Number(this.awa.newValue) || 0;
  const lay = Number(this.laylineAngle()) || 0;
  const portLaylineRotate = this.addHeading(heading, this.addHeading(boatBase, lay * -1));
    this.animateLayline(this.portLaylinePrev, portLaylineRotate, true, animate);
    this.portLaylinePrev = portLaylineRotate;

    // Animate Starboard Layline
  const stbdLaylineRotate = this.addHeading(heading, this.addHeading(boatBase, lay));
    this.animateLayline(this.stbdLaylinePrev, stbdLaylineRotate, false, animate);
    this.stbdLaylinePrev = stbdLaylineRotate;
  }

  private animateLayline(from: number, to: number, isPort: boolean, withAnim = true) {
    // Cancel any previous animation for this layline
    if (isPort && this.portLaylineAnimId) cancelAnimationFrame(this.portLaylineAnimId);
    if (!isPort && this.stbdLaylineAnimId) cancelAnimationFrame(this.stbdLaylineAnimId);

    // Gate tiny animations
    if (this.angleDelta(from, to) < this.EPS_ANGLE) {
      this.drawLayline(to, isPort);
      if (isPort) this.portLaylineAnimId = null; else this.stbdLaylineAnimId = null;
      return;
    }

  if (!withAnim) {
      this.drawLayline(to, isPort);
      if (isPort) this.portLaylineAnimId = null; else this.stbdLaylineAnimId = null;
      return;
    }

    const id = animateAngleTransition(
      from,
      to,
      this.ANIMATION_DURATION,
      angle => this.drawLayline(angle, isPort),
      () => { if (isPort) this.portLaylineAnimId = null; else this.stbdLaylineAnimId = null; },
      this.ngZone
    );
    if (isPort) this.portLaylineAnimId = id; else this.stbdLaylineAnimId = id;
  }

  private drawLayline(angleDeg: number, isPort: boolean) {
    const radian = (angleDeg * Math.PI) / 180;
    const x = Math.floor(this.RADIUS * Math.sin(radian) + this.CENTER);
    const y = Math.floor((this.RADIUS * Math.cos(radian) * -1) + this.CENTER);
    if (isPort) {
      this.closeHauledLinePortPath.set(`M ${this.CENTER},${this.CENTER} L ${x},${y}`);
    } else {
      this.closeHauledLineStbdPath.set(`M ${this.CENTER},${this.CENTER} L ${x},${y}`);
    }
  }

  private windSectorsInitialized = false;

  private updateWindSectors(animate = true) {
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
      this.windSectorsInitialized = true;
      if (animate) {
        this.animateWindSector(portNew, portNew, true);
        this.animateWindSector(stbdNew, stbdNew, false);
      } else {
        this.portWindSectorPath.set(this.computeSectorPath(portNew, true));
        this.stbdWindSectorPath.set(this.computeSectorPath(stbdNew, false));
      }
      this.portSectorPrev = portNew;
      this.stbdSectorPrev = stbdNew;
      return;
    }

    if (animate) {
      // Gate tiny sector animations
      const smallMove =
        this.angleDelta(this.portSectorPrev.min, portNew.min) < this.EPS_ANGLE &&
        this.angleDelta(this.portSectorPrev.mid, portNew.mid) < this.EPS_ANGLE &&
        this.angleDelta(this.portSectorPrev.max, portNew.max) < this.EPS_ANGLE;
      if (smallMove) {
        this.portWindSectorPath.set(this.computeSectorPath(portNew, true));
        this.stbdWindSectorPath.set(this.computeSectorPath(stbdNew, false));
      } else {
        this.animateWindSector(this.portSectorPrev, portNew, true);
        this.animateWindSector(this.stbdSectorPrev, stbdNew, false);
      }
    } else {
      // No animation requested (e.g., heading-only updates)
      this.portWindSectorPath.set(this.computeSectorPath(portNew, true));
      this.stbdWindSectorPath.set(this.computeSectorPath(stbdNew, false));
    }

    this.portSectorPrev = portNew;
    this.stbdSectorPrev = stbdNew;
  }

  private animateWindSector(from: { min: number, mid: number, max: number }, to: { min: number, mid: number, max: number }, isPort: boolean) {
    if (isPort && this.portSectorAnimId) cancelAnimationFrame(this.portSectorAnimId);
    if (!isPort && this.stbdSectorAnimId) cancelAnimationFrame(this.stbdSectorAnimId);

    const smallMove =
      this.angleDelta(from.min, to.min) < this.EPS_ANGLE &&
      this.angleDelta(from.mid, to.mid) < this.EPS_ANGLE &&
      this.angleDelta(from.max, to.max) < this.EPS_ANGLE;
    if (smallMove) {
      const path = this.computeSectorPath(to, isPort);

      if (isPort) this.portWindSectorPath.set(path);
      else this.stbdWindSectorPath.set(path);

      if (isPort) this.portSectorAnimId = null;
      else this.stbdSectorAnimId = null;

      return;
    }

    const id = animateSectorTransition(
      from as SectorAngles,
      to as SectorAngles,
      this.ANIMATION_DURATION,
      (current) => {
        const path = this.computeSectorPath(current, isPort);
        if (isPort) this.portWindSectorPath.set(path); else this.stbdWindSectorPath.set(path);
      },
      () => { if (isPort) this.portSectorAnimId = null; else this.stbdSectorAnimId = null; },
      this.ngZone
    );
    if (isPort) this.portSectorAnimId = id; else this.stbdSectorAnimId = id;
  }

  private addHeading(h1 = 0, h2 = 0) {
    let h3 = (h1 + h2) % 360;
    if (h3 < 0) h3 += 360;
    return h3;
  }

  ngOnDestroy(): void {
    // Cancel layline animations
    if (this.portLaylineAnimId) cancelAnimationFrame(this.portLaylineAnimId);
    if (this.stbdLaylineAnimId) cancelAnimationFrame(this.stbdLaylineAnimId);
    this.portLaylineAnimId = null;
    this.stbdLaylineAnimId = null;

    // Cancel wind sector animations
    if (this.portSectorAnimId) cancelAnimationFrame(this.portSectorAnimId);
    if (this.stbdSectorAnimId) cancelAnimationFrame(this.stbdSectorAnimId);
    this.portSectorAnimId = null;
    this.stbdSectorAnimId = null;

    // Cancel any animateRotation frames tracked in WeakMap for known elements
    const els: (ElementRef<SVGGElement> | undefined)[] = [
      this.rotatingDial(),
      this.awaIndicator(),
      this.twaIndicator(),
      this.wptIndicator(),
      this.setIndicator(),
      this.cogIndicator(),
    ];
    for (const ref of els) {
      const el = ref?.nativeElement;
      if (!el) continue;
      const id = this.animationFrameIds.get(el);
      if (id) cancelAnimationFrame(id);
      this.animationFrameIds.delete(el);
    }
  }

  private angleDelta(from: number, to: number): number {
    const d = ((to - from + 540) % 360) - 180;
    return Math.abs(d);
  }

  private computeSectorPath(state: { min: number, mid: number, max: number }, isPort: boolean): string {
  const lay = Number(this.laylineAngle()) || 0;
    const offset = lay * (isPort ? -1 : 1);
    const heading = Number(this.compass.newValue) || 0;
    // Dial-local = heading + boat-relative (AWA min/mid/max + lay offset)
    const minAngle = this.addHeading(heading, this.addHeading(state.min, offset));
    const midAngle = this.addHeading(heading, this.addHeading(state.mid, offset));
    const maxAngle = this.addHeading(heading, this.addHeading(state.max, offset));

    const minX = this.RADIUS * Math.sin((minAngle * Math.PI) / 180) + this.CENTER;
    const minY = (this.RADIUS * Math.cos((minAngle * Math.PI) / 180) * -1) + this.CENTER;
    const midX = this.RADIUS * Math.sin((midAngle * Math.PI) / 180) + this.CENTER;
    const midY = (this.RADIUS * Math.cos((midAngle * Math.PI) / 180) * -1) + this.CENTER;
    const maxX = this.RADIUS * Math.sin((maxAngle * Math.PI) / 180) + this.CENTER;
    const maxY = (this.RADIUS * Math.cos((maxAngle * Math.PI) / 180) * -1) + this.CENTER;

    const largeArcFlag = Math.abs(angle([minX, minY], [midX, midY], [maxX, maxY])) > Math.PI / 2 ? 0 : 1;
    const sweepFlag = angle([maxX, maxY], [minX, minY], [midX, midY]) > 0 ? 0 : 1;

    return `M ${this.CENTER},${this.CENTER} L ${minX},${minY} A ${this.RADIUS},${this.RADIUS} 0 ${largeArcFlag} ${sweepFlag} ${maxX},${maxY} z`;
  }
}
