import { cloneDeep } from 'lodash-es';
import { Component, DoCheck, OnInit, input, output } from '@angular/core';
import type { IDynamicControl } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';

interface IDimensions {
  height: number,
  width: number
}

@Component({
    selector: 'app-svg-boolean-button',
    templateUrl: './svg-boolean-button.component.svg',
    standalone: true
})
export class SvgBooleanButtonComponent implements OnInit, DoCheck {
  readonly data = input<IDynamicControl>(null, { alias: "controlData" });
  readonly theme = input<ITheme>(null);
  readonly dimensions = input.required<IDimensions>();
  readonly toggleClick = output<IDynamicControl>();

  private toggleOff: string = "0 35 180 35";
  private toggleOn: string = "0 0 180 35";
  private oldTheme: ITheme = null;

  private timeoutHandler = null;
  private pressed: boolean = false;
  private isSwiping: boolean = false;
  private pointerStartX: number = 0;
  private pointerStartY: number = 0;

  public viewBox: string = this.toggleOff;
  public labelColorEnabled = null;
  public labelColorDisabled = null;
  public valueColor = null;
  private ctrlColor: string = '';

  constructor() { }

  ngOnInit(): void {
  }

  ngDoCheck(): void {
    this.viewBox = this.pressed ? this.toggleOn : this.toggleOff;
    const data = this.data();
    if(data.color != this.ctrlColor) {
      this.ctrlColor = data.color;
      this.getColors(data.color);
    }

    const theme = this.theme();
    if (this.oldTheme != theme) {
      this.oldTheme = theme
      this.getColors(this.data().color);
    }
  }

  public handleClickDown(event: PointerEvent): void {
    this.isSwiping = false;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;

    // Wait 250ms before emitting the state
    this.timeoutHandler = setTimeout(() => {
      if (!this.isSwiping) {
        // Momentary mode
        this.pressed = true;

        const state: IDynamicControl = cloneDeep(this.data());
        state.value = this.pressed;

        // Start emitting the state every 100ms
        this.toggleClick.emit(state);
        this.timeoutHandler = setInterval(() => {
          this.toggleClick.emit(state);
        }, 100);
      }
    }, 200);
  }

  public handlePointerMove(event: PointerEvent): void {
    const deltaX = Math.abs(event.clientX - this.pointerStartX);
    const deltaY = Math.abs(event.clientY - this.pointerStartY);

    // Mark as swiping if movement exceeds a threshold
    if (deltaX > 30 || deltaY > 30) {
      this.isSwiping = true;

      // Cancel the timeout if swiping is detected
      if (this.timeoutHandler) {
        clearTimeout(this.timeoutHandler);
        this.timeoutHandler = null;
      }
    }
  }

  public handleClickUp(): void {
    if (this.isSwiping) {
      // Ignore pointerup if it was a swipe
      this.isSwiping = false;
      return;
    }

    this.pressed = false;

    // Clear the interval if it was set
    if (this.timeoutHandler) {
      clearInterval(this.timeoutHandler);
      this.timeoutHandler = null;
    }
  }

  private getColors(color: string): void {
    switch (color) {
      case "contrast":
        this.labelColorEnabled = 'black';
        this.labelColorDisabled = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
      case "blue":
        this.labelColorEnabled = this.theme().contrast;
        this.labelColorDisabled = this.theme().blueDim;
        this.valueColor = this.theme().blue;
        break;
      case "green":
        this.labelColorEnabled = this.theme().contrast;
        this.labelColorDisabled = this.theme().greenDim;
        this.valueColor = this.theme().green;
        break;
      case "pink":
        this.labelColorEnabled = this.theme().contrast;
        this.labelColorDisabled = this.theme().pinkDim;
        this.valueColor = this.theme().pink;
        break;
      case "orange":
        this.labelColorEnabled = this.theme().contrast;
        this.labelColorDisabled = this.theme().orangeDim;
        this.valueColor = this.theme().orange;
        break;
      case "purple":
        this.labelColorEnabled = this.theme().contrast;
        this.labelColorDisabled = this.theme().purpleDim;
        this.valueColor = this.theme().purple;
        break;
      case "grey":
        this.labelColorEnabled = this.theme().contrast;
        this.labelColorDisabled = this.theme().greyDim;
        this.valueColor = this.theme().grey;
        break;
      case "yellow":
        this.labelColorEnabled = this.theme().contrast;
        this.labelColorDisabled = this.theme().yellowDim;
        this.valueColor = this.theme().yellow;
        break;
      default:
        this.labelColorEnabled = 'black';
        this.labelColorDisabled = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
    }
  }
}
