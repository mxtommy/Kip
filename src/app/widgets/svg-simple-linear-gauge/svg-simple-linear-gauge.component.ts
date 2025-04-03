import { ViewChild, ElementRef, Component, SimpleChanges, OnChanges, OnDestroy, input } from '@angular/core';

@Component({
    selector: 'svg-simple-linear-gauge',
    templateUrl: './svg-simple-linear-gauge.component.svg',
    styleUrl: './svg-simple-linear-gauge.component.scss',
    standalone: true
})
export class SvgSimpleLinearGaugeComponent implements OnChanges, OnDestroy {
  @ViewChild('gaugeBarAnimate', {static: false}) gaugeBarAnimate: ElementRef;
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

  newGaugeValue: number = 1;
  oldGaugeValue: number = 1;

  constructor() { }

  ngOnChanges(changes: SimpleChanges) {
    // Gauge bar value
    if (changes.gaugeValue) {
      if (! changes.gaugeValue.firstChange) {
        // scale value to svg gauge pixel length (195), proportional to gauge min/max set values
        let scaleRange = this.gaugeMaxValue() - this.gaugeMinValue();
        let scaleSliceValue = scaleRange !== 0 ? 195 / scaleRange : 0;

        this.oldGaugeValue = this.newGaugeValue;
        this.newGaugeValue = (changes.gaugeValue.currentValue - this.gaugeMinValue()) * scaleSliceValue;

        if (this.gaugeBarAnimate?.nativeElement) {
          requestAnimationFrame(() => {
            if (this.gaugeBarAnimate?.nativeElement) {
              this.gaugeBarAnimate.nativeElement.beginElement();
            }
          });
        }
      }
    }
  }

  ngOnDestroy() {
    this.gaugeBarAnimate = null as any;
  }
}
