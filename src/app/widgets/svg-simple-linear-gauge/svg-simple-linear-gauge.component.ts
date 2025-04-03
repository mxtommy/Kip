import { ViewChild, ElementRef, Input, Component, SimpleChanges, OnChanges, OnDestroy } from '@angular/core';

@Component({
    selector: 'svg-simple-linear-gauge',
    templateUrl: './svg-simple-linear-gauge.component.svg',
    styleUrl: './svg-simple-linear-gauge.component.scss',
    standalone: true
})
export class SvgSimpleLinearGaugeComponent implements OnChanges, OnDestroy {
  @ViewChild('gaugeBarAnimate', {static: false}) gaugeBarAnimate: ElementRef;
  @Input({ required: true }) displayName!: string;
  @Input({ required: true }) displayNameColor!: string;
  @Input({ required: true }) dataValue!: string;
  @Input({ required: true }) unitLabel!: string;
  @Input({ required: true }) barColor!: string;
  @Input({ required: true }) barColorGradient!: string;
  @Input({ required: true }) barColorBackground!: string;
  @Input({ required: true }) gaugeValue!: string;
  @Input({ required: true }) gaugeMinValue!: number;
  @Input({ required: true }) gaugeMaxValue!: number;

  newGaugeValue: number = 1;
  oldGaugeValue: number = 1;

  constructor() { }

  ngOnChanges(changes: SimpleChanges) {
    // Gauge bar value
    if (changes.gaugeValue) {
      if (! changes.gaugeValue.firstChange) {
        // scale value to svg gauge pixel length (195), proportional to gauge min/max set values
        let scaleRange = this.gaugeMaxValue - this.gaugeMinValue;
        let scaleSliceValue = scaleRange !== 0 ? 195 / scaleRange : 0;

        this.oldGaugeValue = this.newGaugeValue;
        this.newGaugeValue = (changes.gaugeValue.currentValue - this.gaugeMinValue) * scaleSliceValue;

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
