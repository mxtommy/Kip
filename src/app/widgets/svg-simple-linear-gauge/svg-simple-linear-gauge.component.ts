import { ElementRef, Component, input, viewChild, computed, signal, untracked, effect } from '@angular/core';
import { IDataHighlight } from '../../core/interfaces/widgets-interface';
@Component({
    selector: 'svg-simple-linear-gauge',
    templateUrl: './svg-simple-linear-gauge.component.svg',
    styleUrl: './svg-simple-linear-gauge.component.scss',
})
export class SvgSimpleLinearGaugeComponent {
  protected readonly gaugeBarAnimate = viewChild<ElementRef>('gaugeBarAnimate');
  protected readonly displayName = input.required<string>();
  protected readonly displayNameColor = input.required<string>();
  protected readonly dataValue = input.required<number>();
  protected readonly dataValueLabel = input.required<string>();
  protected readonly unitLabel = input.required<string>();
  protected readonly barColor = input.required<string>();
  protected readonly barColorGradient = input.required<string>();
  protected readonly barColorBackground = input.required<string>();
  protected readonly gaugeMinValue = input.required<number>();
  protected readonly gaugeMaxValue = input.required<number>();
  protected readonly highlights = input.required<IDataHighlight[]>();
  protected readonly scaleSliceValue = computed(() => {
    const scaleRange =  this.gaugeMaxValue() - this.gaugeMinValue();
    return scaleRange !== 0 ? 195 / scaleRange : 0;
  });
  protected readonly newGaugeValue = signal<number | null>(null);
  protected readonly oldGaugeValue = signal<number | null>(null);

  constructor() {
    effect(() => {
      // Only run if required inputs are available
      const min = this.gaugeMinValue();
      let value = this.dataValue();

      if (value === null) {
        // Set initial values if not already set
        value = min;
      }

      untracked(() => {
        this.oldGaugeValue.set(this.newGaugeValue() !== null ? this.newGaugeValue() : min);
        this.newGaugeValue.set(this.dataValue() !== null ? (value - min) * this.scaleSliceValue() : min);
      });

      if (this.gaugeBarAnimate()?.nativeElement) {
        requestAnimationFrame(() => {
          const gaugeBarAnimate = this.gaugeBarAnimate();
          if (gaugeBarAnimate?.nativeElement) {
            gaugeBarAnimate.nativeElement.beginElement();
          }
        });
      }
    });
  }
}
