import { Component, ElementRef, effect, input, untracked, viewChild } from '@angular/core';

@Component({
  selector: 'app-svg-rudder',
  templateUrl: './svg-rudder.component.html',
  styleUrl: './svg-rudder.component.scss',
  standalone: true,
  imports: []
})
export class SvgRudderComponent {
  private readonly rudderPrtAnimate = viewChild.required<ElementRef<SVGAnimateTransformElement>>('rudderPrtAnimate');
  private readonly rudderStbAnimate = viewChild.required<ElementRef<SVGAnimateTransformElement>>('rudderStbAnimate');

  readonly rudderAngle = input.required<number>();

  protected oldRudderPrtAngle: number = 0;
  protected newRudderPrtAngle: number = 0;
  protected oldRudderStbAngle: number = 0;
  protected newRudderStbAngle: number = 0;

  constructor() {
    effect(() => {
      const rudderAngle = this.rudderAngle();
      if (rudderAngle == null) return;
      untracked(() => {
        this.updateRudderAngle(rudderAngle);
      });
    });

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
    this.rudderPrtAnimate().nativeElement.beginElement();
    this.rudderStbAnimate().nativeElement.beginElement();
  }
}
