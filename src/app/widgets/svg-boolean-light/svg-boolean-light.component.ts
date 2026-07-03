import { Component, DoCheck, input, output } from '@angular/core';
import type { IDynamicControl } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';
import { IDimensions } from '../widget-boolean-switch/widget-boolean-switch.component';



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

  private toggleOff = "0 35 180 35";
  private toggleOn = "0 0 180 35";
  private ctrlState: boolean | null = null;
  private ctrlColor = '';
  private oldTheme: ITheme | null = null;

  public viewBox: string = this.toggleOff;
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
      this.viewBox = data.value ? this.toggleOn : this.toggleOff;
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
