class GaugeMock {
  public value = 0;

  constructor(public options: Record<string, unknown> = {}) {}

  public update(options: Record<string, unknown> = {}): this {
    this.options = { ...this.options, ...options };
    return this;
  }

  public draw(): this {
    return this;
  }

  public destroy(): void {}
}

export class LinearGauge extends GaugeMock {}

export class RadialGauge extends GaugeMock {}

export class LinearGaugeOptions {}

export class RadialGaugeOptions {}

export const DomObserver = {
  parse: (value: string): string => value,
};

export default {
  DomObserver,
  LinearGauge,
  LinearGaugeOptions,
  RadialGauge,
  RadialGaugeOptions,
};
