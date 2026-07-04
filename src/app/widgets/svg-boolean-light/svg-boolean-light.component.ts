import { Component, DoCheck, input, output } from '@angular/core';
import type { IDynamicControl } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';
import { IDimensions } from '../widget-boolean-switch/widget-boolean-switch.component';
import { BooleanControlLayout, getBooleanControlLayout } from '../widget-boolean-switch/boolean-control-layout.util';



@Component({
  selector: 'app-svg-boolean-light',
  templateUrl: './svg-boolean-light.component.svg'
})
export class SvgBooleanLightComponent implements DoCheck {
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly data = input<IDynamicControl | null>(null, { alias: "controlData" });
  readonly theme = input<ITheme | null>(null);
  readonly dimensions = input.required<IDimensions>();
  readonly toggleClick = output<IDynamicControl>();

  private ctrlState: boolean | null = null;
  private ctrlColor = '';
  private oldTheme: ITheme | null = null;

  public labelColor: string | null = null;
  public valueColor: string | null = null;

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

  public toggle(state: boolean): void {
    const data = this.data();
    if (!data) {
      return;
    }

    data.value = state;
    this.toggleClick.emit(data);
  }

  public get layout(): BooleanControlLayout {
    const dimensions = this.dimensions();
    return getBooleanControlLayout('3', dimensions.width, dimensions.height);
  }

  public get isEnabled(): boolean {
    return Boolean(this.ctrlState);
  }

  private getColors(color: string): void {
    const theme = this.theme();
    if (!theme) {
      return;
    }

    switch (color) {
      case "contrast":
        this.labelColor = theme.contrastDim;
        this.valueColor = theme.contrast;
        break;
      case "blue":
        this.labelColor = theme.blueDim;
        this.valueColor = theme.blue;
        break;
      case "green":
        this.labelColor = theme.greenDim;
        this.valueColor = theme.green;
        break;
      case "pink":
        this.labelColor = theme.pinkDim;
        this.valueColor = theme.pink;
        break;
      case "orange":
        this.labelColor = theme.orangeDim;
        this.valueColor = theme.orange;
        break;
      case "purple":
        this.labelColor = theme.purpleDim;
        this.valueColor = theme.purple;
        break;
      case "grey":
        this.labelColor = theme.greyDim;
        this.valueColor = theme.grey;
        break;
      case "yellow":
        this.labelColor = theme.yellowDim;
        this.valueColor = theme.yellow;
        break;
      default:
        this.labelColor = theme.contrastDim;
        this.valueColor = theme.contrast;
        break;
    }
  }
}
