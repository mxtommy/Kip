import { ElementRef, Component, SimpleChanges, OnChanges, input, viewChild } from '@angular/core';

@Component({
    selector: 'svg-simple-linear-gauge',
    templateUrl: './svg-simple-linear-gauge.component.svg',
    styleUrl: './svg-simple-linear-gauge.component.scss',
    standalone: true
})
export class SvgSimpleLinearGaugeComponent implements OnChanges {
  readonly gaugeBarAnimate = viewChild<ElementRef>('gaugeBarAnimate');
  readonly displayName = input.required<string>();
  readonly displayNameColor = input.required<string>();
  readonly dataValue = input.required<string>();
  readonly unitLabel = input.required<string>();
  readonly barColor = input.required<string>();
  readonly barColorGradient = input.required<string>();
  readonly barColorBackground = input.required<string>();
  readonly gaugeValue = input.required<string>();
  readonly gaugeMinValue = input.required<number>();
  readonly gaugeMaxValue = input.required<number>();

  newGaugeValue = 1;
  oldGaugeValue = 1;

  constructor() { }

  ngOnChanges(changes: SimpleChanges) {
    // Gauge bar value
    if (changes.gaugeValue) {
      if (! changes.gaugeValue.firstChange) {
        // scale value to svg gauge pixel length (195), proportional to gauge min/max set values
        const scaleRange = this.gaugeMaxValue() - this.gaugeMinValue();
        const scaleSliceValue = scaleRange !== 0 ? 195 / scaleRange : 0;

        this.oldGaugeValue = this.newGaugeValue;
        this.newGaugeValue = (changes.gaugeValue.currentValue - this.gaugeMinValue()) * scaleSliceValue;

        if (this.gaugeBarAnimate()?.nativeElement) {
          requestAnimationFrame(() => {
            const gaugeBarAnimate = this.gaugeBarAnimate();
            if (gaugeBarAnimate?.nativeElement) {
              gaugeBarAnimate.nativeElement.beginElement();
            }
          });
        }
      }
    }
  }
}
