import { ViewChild, ElementRef, Input, Component, SimpleChanges, OnChanges } from '@angular/core';

@Component({
    selector: 'svg-simple-linear-gauge',
    templateUrl: './svg-simple-linear-gauge.component.svg',
    standalone: true
})
export class SvgSimpleLinearGaugeComponent implements OnChanges {
  @ViewChild('gaugeBarAnimate', {static: true}) gaugeBarAnimate: ElementRef;
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
    // Data Value
    if (changes.dataValue) {
      if (! changes.dataValue.firstChange) {
        this.dataValue = changes.dataValue.currentValue;
      }
    }

    // Gauge bar value
    if (changes.gaugeValue) {
      if (! changes.gaugeValue.firstChange) {
        // scale value to svg gauge pixel length (195), proportional to gauge min/max set values
        let scaleRange = this.gaugeMaxValue - this.gaugeMinValue;
        let scaleSliceValue = 195 / scaleRange;

        this.oldGaugeValue = this.newGaugeValue;
        this.newGaugeValue = (changes.gaugeValue.currentValue - this.gaugeMinValue) * scaleSliceValue;

        this.gaugeBarAnimate.nativeElement.beginElement();
      }
    }
  }
}
