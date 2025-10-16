import { Component, DoCheck, input, output } from '@angular/core';
import type { IDynamicControl } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';

export interface IDimensions {
  height: number,
  width: number
}

@Component({
    selector: 'app-svg-boolean-switch',
    templateUrl: './svg-boolean-switch.component.svg'
})
export class SvgBooleanSwitchComponent implements DoCheck {
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly data = input<IDynamicControl>(null, { alias: "controlData" });
  readonly theme = input<ITheme>(null);
  readonly dimensions = input.required<IDimensions>();
  readonly toggleClick = output<IDynamicControl>();

  private toggleOff = "0 35 180 35";
  private toggleOn = "0 0 180 35";
  private ctrlState: boolean = null;
  private oldTheme: ITheme = null;
  private isSwiping = false;
  private pointerStartX = 0;
  private pointerStartY = 0;

  public viewBox: string = this.toggleOff;
  public labelColor = null;
  public valueColor = null;
  private ctrlColor = '';

  constructor() { }

  ngDoCheck(): void {
    const data = this.data();
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
      this.oldTheme = theme
      this.getColors(data.color);
    }
  }

  public onPointerDown(event: PointerEvent): void {
    this.isSwiping = false;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;
  }

  public onPointerMove(event: PointerEvent): void {
    const deltaX = Math.abs(event.clientX - this.pointerStartX);
    const deltaY = Math.abs(event.clientY - this.pointerStartY);

    // Mark as swiping if movement exceeds a threshold
    if (deltaX > 30 || deltaY > 30) {
      this.isSwiping = true;
    }
  }

  public onPointerUp(event: PointerEvent, state: boolean): void {
    if (this.isSwiping) {
      // Ignore pointerup if it was a swipe
      this.isSwiping = false;
      return;
    }

    // Handle the toggle action for a tap
    this.toggle(state);
  }

  public toggle(state: boolean): void {
    const data = this.data();
    data.value = state;
    this.toggleClick.emit(data);
  }

  private getColors(color: string): void {
    switch (color) {
      case "contrast":
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
      case "blue":
        this.labelColor = this.theme().blueDim;
        this.valueColor = this.theme().blue;
        break;
      case "green":
        this.labelColor = this.theme().greenDim;
        this.valueColor = this.theme().green;
        break;
      case "pink":
        this.labelColor = this.theme().pinkDim;
        this.valueColor = this.theme().pink;
        break;
      case "orange":
        this.labelColor = this.theme().orangeDim;
        this.valueColor = this.theme().orange;
        break;
      case "purple":
        this.labelColor = this.theme().purpleDim;
        this.valueColor = this.theme().purple;
        break;
      case "grey":
        this.labelColor = this.theme().greyDim;
        this.valueColor = this.theme().grey;
        break;
      case "yellow":
        this.labelColor = this.theme().yellowDim;
        this.valueColor = this.theme().yellow;
        break;
      default:
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
    }
  }
}
