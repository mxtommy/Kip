import { Component, DoCheck, input, output } from '@angular/core';
import type { IDynamicControl } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';
import { IDimensions } from '../widget-boolean-switch/widget-boolean-switch.component';
import { createSwipeGuard } from '../../core/utils/pointer-swipe-guard.util';
import { BooleanControlLayout, getBooleanControlLayout } from '../widget-boolean-switch/boolean-control-layout.util';

@Component({
    selector: 'app-svg-boolean-switch',
  templateUrl: './svg-boolean-switch.component.svg',
})
export class SvgBooleanSwitchComponent implements DoCheck {
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly data = input<IDynamicControl | null>(null, { alias: "controlData" });
  readonly theme = input<ITheme | null>(null);
  readonly dimensions = input.required<IDimensions>();
  readonly toggleClick = output<IDynamicControl>();

  private ctrlState: boolean | null = null;
  private oldTheme: ITheme | null = null;
  private readonly swipeGuard = createSwipeGuard();

  public offColor: string | null = null;
  public labelColor: string | null = null;
  public valueColor: string | null = null;
  private ctrlColor = '';

  constructor() { }

  ngDoCheck(): void {
    const data = this.data();
    if (!data) {
      return;
    }
    if (data.value != this.ctrlState) {
      this.ctrlState = data.value;
    }
    if(data.color != this.ctrlColor) {
      this.ctrlColor = data.color;
      this.getColors(data.color);
    }

    const theme = this.theme();
    if (this.oldTheme != theme) {
      this.oldTheme = theme;
      this.getColors(data.color);
    }
  }

  public onPointerDown(event: PointerEvent): void {
    this.swipeGuard.onPointerDown(event);
  }

  public onPointerMove(event: PointerEvent): void {
    this.swipeGuard.onPointerMove(event);
  }

  public onPointerUp(event: PointerEvent, state: boolean): void {
    if (!this.swipeGuard.onPointerUp(event)) return;
    this.toggle(state);
  }

  public onPointerCancel(event: PointerEvent): void {
    this.swipeGuard.onPointerCancel(event);
  }

  public get layout(): BooleanControlLayout {
    const dimensions = this.dimensions();
    return getBooleanControlLayout('1', dimensions.width, dimensions.height);
  }

  public get isEnabled(): boolean {
    return Boolean(this.ctrlState);
  }

  public get nextState(): boolean {
    return !this.isEnabled;
  }

  public toggle(state: boolean): void {
    const data = this.data();
    if (!data) {
      return;
    }

    data.value = state;
    this.toggleClick.emit(data);
  }

  private getColors(color: string): void {
    const theme = this.theme();
    if (!theme) {
      return;
    }

    switch (color) {
      case "contrast":
        this.offColor = theme.contrastDimmer;
        this.labelColor = theme.contrastDim;
        this.valueColor = theme.contrast;
        break;
      case "blue":
        this.offColor = theme.blueDimmer;
        this.labelColor = theme.blueDim;
        this.valueColor = theme.blue;
        break;
      case "green":
        this.offColor = theme.greenDimmer;
        this.labelColor = theme.greenDim;
        this.valueColor = theme.green;
        break;
      case "pink":
        this.offColor = theme.pinkDimmer;
        this.labelColor = theme.pinkDim;
        this.valueColor = theme.pink;
        break;
      case "orange":
        this.offColor = theme.orangeDimmer;
        this.labelColor = theme.orangeDim;
        this.valueColor = theme.orange;
        break;
      case "purple":
        this.offColor = theme.purpleDimmer;
        this.labelColor = theme.purpleDim;
        this.valueColor = theme.purple;
        break;
      case "grey":
        this.offColor = theme.greyDimmer;
        this.labelColor = theme.greyDim;
        this.valueColor = theme.grey;
        break;
      case "yellow":
        this.offColor = theme.yellowDimmer;
        this.labelColor = theme.yellowDim;
        this.valueColor = theme.yellow;
        break;
      default:
        this.offColor = theme.contrastDimmer;
        this.labelColor = theme.contrastDim;
        this.valueColor = theme.contrast;
        break;
    }
  }
}
