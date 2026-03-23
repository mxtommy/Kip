import { Component, Input, NgModule } from '@angular/core';

export class LinearGaugeOptions {}

export class RadialGaugeOptions {}

@Component({
  selector: 'linear-gauge',
  template: '<canvas></canvas>',
})
export class LinearGauge {
  @Input() public options?: unknown;
  @Input() public value?: unknown;
}

@Component({
  selector: 'radial-gauge',
  template: '<canvas></canvas>',
})
export class RadialGauge {
  @Input() public options?: unknown;
  @Input() public value?: unknown;
}

@NgModule({
  imports: [LinearGauge, RadialGauge],
  exports: [LinearGauge, RadialGauge],
})
export class GaugesModule {}
