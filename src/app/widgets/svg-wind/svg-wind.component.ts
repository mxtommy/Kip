import { Component, AfterViewInit, ElementRef, input, viewChild, signal, effect, computed } from '@angular/core';

const angle = ([a,b],[c,d],[e,f]) => (Math.atan2(f-d,e-c)-Math.atan2(b-d,a-c)+3*Math.PI)%(2*Math.PI)-Math.PI;

interface ISVGRotationObject {
  oldDegreeIndicator: number,
  newDegreeIndicator: number,
  animationElement: ElementRef<SVGAnimateTransformElement>
}

@Component({
    selector: 'app-svg-wind',
    templateUrl: './svg-wind.component.svg',
    styleUrl: './svg-wind.component.scss',
    standalone: true,
    imports: []
})
export class SvgWindComponent implements AfterViewInit {
  readonly compassAnimate = viewChild.required('compassAnimate', { read: ElementRef<SVGAnimateTransformElement> });
  readonly appWindAnimate = viewChild.required('appWindAnimate', { read: ElementRef<SVGAnimateTransformElement> });
  readonly trueWindAnimate = viewChild.required('trueWindAnimate', { read: ElementRef<SVGAnimateTransformElement> });
  readonly waypointAnimate = viewChild.required('waypointAnimate', { read: ElementRef<SVGAnimateTransformElement> });
  readonly driftAnimate = viewChild.required('driftAnimate', { read: ElementRef<SVGAnimateTransformElement> });
  readonly courseOverGroundAnimate = viewChild.required('courseOverGroundAnimate', { read: ElementRef<SVGAnimateTransformElement> });

  readonly compassHeading = input.required<number>();
  readonly courseOverGroundAngle = input<number>(undefined);
  readonly courseOverGroundEnabled = input.required<boolean>();
  readonly trueWindAngle = input.required<number>();
  readonly twsEnabled = input.required<boolean>();
  readonly trueWindSpeed = input.required<number>();
  readonly appWindAngle = input.required<number>();
  readonly awsEnabled = input.required<boolean>();
  readonly appWindSpeed = input.required<number>();
  readonly laylineAngle = input<number>(undefined);
  readonly closeHauledLineEnabled = input.required<boolean>();
  readonly sailSetupEnabled = input.required<boolean>();
  readonly windSectorEnabled = input.required<boolean>();
  readonly driftEnabled = input.required<boolean>();
  readonly driftSet = input<number>(undefined);
  readonly driftFlow = input<number>(undefined);
  readonly waypointAngle = input<number>(undefined);
  readonly waypointEnabled = input.required<boolean>();
  readonly trueWindMinHistoric = input<number>(undefined);
  readonly trueWindMidHistoric = input<number>(undefined);
  readonly trueWindMaxHistoric = input<number>(undefined);

  protected compassFaceplate: ISVGRotationObject = {
    oldDegreeIndicator: 0,
    newDegreeIndicator: 0,
    animationElement: undefined
  };
  protected headingValue: string ="--";

  protected appWind: ISVGRotationObject = {
    oldDegreeIndicator: 0,
    newDegreeIndicator: 0,
    animationElement: undefined
  };
  protected appWindSpeedDisplay = computed(() => {
    const appWindSpeed = this.appWindSpeed();
    if (appWindSpeed == null) return "--";
    return appWindSpeed.toFixed(1);
  });
  protected trueWind: ISVGRotationObject = {
    oldDegreeIndicator: 0,
    newDegreeIndicator: 0,
    animationElement: undefined
  };
  protected trueWindSpeedDisplay = computed(() => {
    const trueWindSpeed = this.trueWindSpeed();
    if (trueWindSpeed == null) return "--";
    return trueWindSpeed.toFixed(1);
  });
  private trueWindHeading: number = 0;
  protected waypoint: ISVGRotationObject = {
    oldDegreeIndicator: 0,
    newDegreeIndicator: 0,
    animationElement: undefined
  };
  protected waypointActive = signal<boolean>(false);
  protected courseOverGround: ISVGRotationObject =  {
    oldDegreeIndicator: 0,
    newDegreeIndicator: 0,
    animationElement: undefined
  };
  protected set: ISVGRotationObject = {
    oldDegreeIndicator: 0,
    newDegreeIndicator: 0,
    animationElement: undefined
  };
  protected flow = computed(() => {
    const flow = this.driftFlow();
    if (flow == null) return "--";
    return flow.toFixed(1);
  });

  readonly CENTER = 500;
  readonly RADIUS = 350;
  //laylines - Close-Hauled lines
  protected closeHauledLinePortPath: string = "M 500,500 500,500";
  protected closeHauledLineStbdPath: string = "M 500,500 500,500";
  //WindSectors
  protected portWindSectorPath: string = "M 500,500 V 150";
  protected stbdWindSectorPath: string = "M 500,500 V 150";

  constructor() {
    effect(() => {
      this.waypointEnabled() ? this.waypointActive.set(true) : this.waypointActive.set(false);
    });

    effect(() => {
      const heading = this.compassHeading();
      if (heading == null) return;

      this.compassFaceplate.oldDegreeIndicator = this.compassFaceplate.newDegreeIndicator;
      this.compassFaceplate.newDegreeIndicator = heading;
      this.headingValue = heading.toFixed(0);
      this.smoothCircularRotation(this.compassFaceplate);
      this.updateClauseHauledLines();
      this.updateWindSectors();
    });

    effect(() => {
      const cogAngle = this.courseOverGroundAngle();
      if (cogAngle == null) return;

      this.courseOverGround.oldDegreeIndicator = this.courseOverGround.newDegreeIndicator;
      this.courseOverGround.newDegreeIndicator =  cogAngle - this.compassFaceplate.newDegreeIndicator;
      this.smoothCircularRotation(this.courseOverGround);
    });

    effect(() => {
      const wptAngle = this.waypointAngle();
      if (!wptAngle) {
        this.waypointActive.set(false);
        return;
      }
      this.waypointEnabled() ? this.waypointActive.set(true) : this.waypointActive.set(false);
      this.waypoint.oldDegreeIndicator = this.waypoint.newDegreeIndicator;
      this.waypoint.newDegreeIndicator = wptAngle;
      this.smoothCircularRotation(this.waypoint);
    });

    effect(() => {
      const appWindAngle = this.appWindAngle();
      if (appWindAngle == null) return;

      this.appWind.oldDegreeIndicator = this.appWind.newDegreeIndicator;
      this.appWind.newDegreeIndicator = appWindAngle;
      this.smoothCircularRotation(this.appWind);
    });

    effect(() => {
      const trueWindAngle = this.trueWindAngle();
      if (trueWindAngle == null) return;

      this.trueWind.oldDegreeIndicator = this.trueWind.newDegreeIndicator;
      this.trueWindHeading = trueWindAngle;
      this.trueWind.newDegreeIndicator = this.addHeading(this.trueWindHeading, (this.compassFaceplate.newDegreeIndicator * -1)); //compass rotate is negative as we actually have to rotate counter clockwise
      this.smoothCircularRotation(this.trueWind);
      this.updateClauseHauledLines();
    });

    effect(() => {
      const driftSet = this.driftSet();
      if (driftSet == null) return;

      this.set.oldDegreeIndicator = this.set.newDegreeIndicator;
      this.set.newDegreeIndicator =  driftSet;
      this.smoothCircularRotation(this.set);
    });
  }

  ngAfterViewInit(): void {
    this.compassFaceplate.animationElement = this.compassAnimate();
    this.appWind.animationElement = this.appWindAnimate();
    this.trueWind.animationElement = this.trueWindAnimate();
    this.waypoint.animationElement = this.waypointAnimate();
    this.courseOverGround.animationElement = this.courseOverGroundAnimate();
    this.set.animationElement = this.driftAnimate();
  }

  private updateClauseHauledLines() {
    if (!this.closeHauledLineEnabled()) return;
    const calculateXY = (angle: number) => {
      const radian = (angle * Math.PI) / 180;
      const x = Math.floor(this.RADIUS * Math.sin(radian) + this.CENTER);
      const y = Math.floor((this.RADIUS * Math.cos(radian) * -1) + this.CENTER); // -1 since SVG 0 is at top
      return { x, y };
    };

    const portLaylineRotate = this.addHeading(Number(this.trueWind.newDegreeIndicator), this.laylineAngle() * -1);
    const { x: portX, y: portY } = calculateXY(portLaylineRotate);
    this.closeHauledLinePortPath = `M ${this.CENTER},${this.CENTER} L ${portX},${portY}`;

    const stbdLaylineRotate = this.addHeading(Number(this.trueWind.newDegreeIndicator), this.laylineAngle());
    const { x: stbdX, y: stbdY } = calculateXY(stbdLaylineRotate);
    this.closeHauledLineStbdPath = `M ${this.CENTER},${this.CENTER} L ${stbdX},${stbdY}`;
  }

  private updateWindSectors() {
    if (!this.windSectorEnabled()) return;
    if (!this.trueWindMinHistoric()) return;
    if (!this.trueWindMidHistoric()) return;
    if (!this.trueWindMaxHistoric()) return;
    const calculateSectorPath = (min: number, mid: number, max: number, isPort: boolean) => {
      const minAngle = this.addHeading(this.addHeading(min, Number(this.compassFaceplate.newDegreeIndicator) * -1), this.laylineAngle() * (isPort ? -1 : 1));
      const midAngle = this.addHeading(this.addHeading(mid, Number(this.compassFaceplate.newDegreeIndicator) * -1), this.laylineAngle() * (isPort ? -1 : 1));
      const maxAngle = this.addHeading(this.addHeading(max, Number(this.compassFaceplate.newDegreeIndicator) * -1), this.laylineAngle() * (isPort ? -1 : 1));

      const minX = this.RADIUS * Math.sin((minAngle * Math.PI) / 180) + this.CENTER;
      const minY = (this.RADIUS * Math.cos((minAngle * Math.PI) / 180) * -1) + this.CENTER;
      const midX = this.RADIUS * Math.sin((midAngle * Math.PI) / 180) + this.CENTER;
      const midY = (this.RADIUS * Math.cos((midAngle * Math.PI) / 180) * -1) + this.CENTER;
      const maxX = this.RADIUS * Math.sin((maxAngle * Math.PI) / 180) + this.CENTER;
      const maxY = (this.RADIUS * Math.cos((maxAngle * Math.PI) / 180) * -1) + this.CENTER;

      const largeArcFlag = Math.abs(angle([minX, minY], [midX, midY], [maxX, maxY])) > Math.PI / 2 ? 0 : 1;
      const sweepFlag = angle([maxX, maxY], [minX, minY], [midX, midY]) > 0 ? 0 : 1;

      return `M ${this.CENTER},${this.CENTER} L ${minX},${minY} A ${this.RADIUS},${this.RADIUS} 0 ${largeArcFlag} ${sweepFlag} ${maxX},${maxY} z`;
    };

    this.portWindSectorPath = calculateSectorPath(
      this.trueWindMinHistoric(),
      this.trueWindMidHistoric(),
      this.trueWindMaxHistoric(),
      true
    );

    this.stbdWindSectorPath = calculateSectorPath(
      this.trueWindMinHistoric(),
      this.trueWindMidHistoric(),
      this.trueWindMaxHistoric(),
      false
    );
  }

  private addHeading(h1: number = 0, h2: number = 0) {
    let h3 = h1 + h2;
    while (h3 > 359) { h3 = h3 - 359; }
    while (h3 < 0) { h3 = h3 + 359; }
    return h3;
  }

  private smoothCircularRotation(rotationElement: ISVGRotationObject, countRotationElement?:ISVGRotationObject): void {
    const oldAngle = Number(rotationElement.oldDegreeIndicator);
    const newAngle = Number(rotationElement.newDegreeIndicator);
    const diff = oldAngle - newAngle;

    // only update if on DOM and value rounded changed
    if (rotationElement.animationElement && (diff != 0)) {
      // Special cases to smooth out passing between 359 to/from 0
      // if more than half the circle, it could need to go over the 359 to 0 without doing full full circle
      if ( Math.abs(diff) > 180 ) {

        if (Math.sign(diff) == 1) { // Moving clockwise
          if (oldAngle == 359) { // Going over 0
            // special cases
            rotationElement.oldDegreeIndicator = 0; // Set to 0 and animate so we don't jump
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.oldDegreeIndicator = 0;
              countRotationElement.animationElement.nativeElement.beginElement();
            }
          } else {
            rotationElement.newDegreeIndicator = 359;
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.newDegreeIndicator = -359;
              countRotationElement.animationElement.nativeElement.beginElement();
            }
            rotationElement.oldDegreeIndicator = 0;
            rotationElement.newDegreeIndicator = newAngle;
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.oldDegreeIndicator = rotationElement.oldDegreeIndicator;
              countRotationElement.newDegreeIndicator = 0;
              countRotationElement.animationElement.nativeElement.beginElement();
            }
          }
        } else { // Moving counter clockwise
          if (oldAngle == 0) { // going over 359
            // special cases
            rotationElement.oldDegreeIndicator = 359;
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.oldDegreeIndicator = -359;
              countRotationElement.animationElement.nativeElement.beginElement();
            }
          } else {
            rotationElement.newDegreeIndicator = 0;
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.newDegreeIndicator = 0;
              countRotationElement.animationElement.nativeElement.beginElement();
            }
            rotationElement.oldDegreeIndicator = 359;
            rotationElement.newDegreeIndicator = newAngle;
            rotationElement.animationElement.nativeElement.beginElement();
            if (countRotationElement !== undefined) {
              countRotationElement.oldDegreeIndicator = -359;
              countRotationElement.newDegreeIndicator = (newAngle * -1); // values rotate counter clockwise (negative values). else they'll do a 360
              countRotationElement.animationElement.nativeElement.beginElement();
            }
          }
        }
      } else { // not doing more then 180, normal rotation
        rotationElement.animationElement.nativeElement.beginElement();
        if (countRotationElement !== undefined) {
          countRotationElement.animationElement.nativeElement.beginElement();
        }
      }
    }
  }
}
