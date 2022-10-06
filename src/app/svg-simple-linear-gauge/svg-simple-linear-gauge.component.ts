import { ViewChild, ElementRef, Input, Component, SimpleChanges, OnChanges } from '@angular/core';

@Component({
  selector: 'svg-simple-linear-gauge',
  templateUrl: './svg-simple-linear-gauge.component.html',
  styleUrls: ['./svg-simple-linear-gauge.component.scss']
})
export class SvgSimpleLinearGaugeComponent implements OnChanges {
  @ViewChild('gaugeBarAnimate', {static: true}) gaugeBarAnimate: ElementRef;
  @Input('displayName') displayName: string;
  @Input('dataValue') dataValue: number;
  @Input('unitLabel') unitLabel: string;
  @Input('barColor') barColor: string;
  @Input('barColorGradient') barColorGradient: string;
  @Input('barColorBackground') barColorBackground: string;
  @Input('gaugeValue') gaugeValue: number;
  @Input('gaugeMinValue') gaugeMinValue: number;
  @Input('gaugeMaxValue') gaugeMaxValue: number;

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
