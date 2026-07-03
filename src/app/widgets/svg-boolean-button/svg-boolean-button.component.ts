import { cloneDeep } from 'lodash-es';
import { Component, DoCheck, OnDestroy, input, output } from '@angular/core';
import type { IDynamicControl } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';
import { IDimensions } from '../widget-boolean-switch/widget-boolean-switch.component';

@Component({
  selector: 'app-svg-boolean-button',
  templateUrl: './svg-boolean-button.component.svg',
  standalone: true,
})
export class SvgBooleanButtonComponent implements DoCheck, OnDestroy {
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly data = input<IDynamicControl | null>(null, { alias: "controlData" });
  readonly theme = input<ITheme | null>(null);
  readonly dimensions = input.required<IDimensions>();
  readonly toggleClick = output<IDynamicControl>();

  private toggleOff = "0 35 180 35";
  private toggleOn = "0 0 180 35";
  private oldTheme: ITheme | null = null;

  private holdTimeoutId: ReturnType<typeof setTimeout> | null = null; // delay before starting momentary emit
  private emitIntervalId: ReturnType<typeof setInterval> | null = null; // repeating emit while pressed
  private pressed = false;
  private isSwiping = false;
  private pointerStartX = 0;
  private pointerStartY = 0;

  public viewBox: string = this.toggleOff;
  public labelColorEnabled: string | null = null;
  public labelColorDisabled: string | null = null;
  public valueColor: string | null = null;
  private ctrlColor = '';

  ngDoCheck(): void {
    this.viewBox = this.pressed ? this.toggleOn : this.toggleOff;
    const data = this.data();
    if (!data) {
      return;
    }
    if (data.color != this.ctrlColor) {
      this.ctrlColor = data.color;
      this.getColors(data.color);
    }

    const theme = this.theme();
    if (this.oldTheme != theme) {
      this.oldTheme = theme;
      this.getColors(data.color);
    }
  }

  public handleClickDown(event: PointerEvent): void {
    const currentData = this.data();
    if (!currentData) {
      return;
    }

    this.isSwiping = false;
    this.pointerStartX = event.clientX;
    this.pointerStartY = event.clientY;

    // Wait 250ms before emitting the state
    this.clearTimers();
    this.holdTimeoutId = setTimeout(() => {
      if (!this.isSwiping) {
        // Momentary mode
        this.pressed = true;

        const state: IDynamicControl = cloneDeep(currentData);
        state.value = this.pressed;

        // Start emitting the state every 100ms
        this.toggleClick.emit(state);
        this.emitIntervalId = setInterval(() => {
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
      if (this.holdTimeoutId) {
        clearTimeout(this.holdTimeoutId);
        this.holdTimeoutId = null;
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
    if (this.emitIntervalId) {
      clearInterval(this.emitIntervalId);
      this.emitIntervalId = null;
    }
    if (this.holdTimeoutId) {
      clearTimeout(this.holdTimeoutId);
      this.holdTimeoutId = null;
    }
  }

  private getColors(color: string): void {
    const theme = this.theme();
    if (!theme) {
      return;
    }

    switch (color) {
      case "contrast":
        this.labelColorEnabled = 'black';
        this.labelColorDisabled = theme.contrastDim;
        this.valueColor = theme.contrast;
        break;
      case "blue":
        this.labelColorEnabled = theme.contrast;
        this.labelColorDisabled = theme.blueDim;
        this.valueColor = theme.blue;
        break;
      case "green":
        this.labelColorEnabled = theme.contrast;
        this.labelColorDisabled = theme.greenDim;
        this.valueColor = theme.green;
        break;
      case "pink":
        this.labelColorEnabled = theme.contrast;
        this.labelColorDisabled = theme.pinkDim;
        this.valueColor = theme.pink;
        break;
      case "orange":
        this.labelColorEnabled = theme.contrast;
        this.labelColorDisabled = theme.orangeDim;
        this.valueColor = theme.orange;
        break;
      case "purple":
        this.labelColorEnabled = theme.contrast;
        this.labelColorDisabled = theme.purpleDim;
        this.valueColor = theme.purple;
        break;
      case "grey":
        this.labelColorEnabled = theme.contrast;
        this.labelColorDisabled = theme.greyDim;
        this.valueColor = theme.grey;
        break;
      case "yellow":
        this.labelColorEnabled = theme.contrast;
        this.labelColorDisabled = theme.yellowDim;
        this.valueColor = theme.yellow;
        break;
      default:
        this.labelColorEnabled = 'black';
        this.labelColorDisabled = theme.contrastDim;
        this.valueColor = theme.contrast;
        break;
    }
  }

  private clearTimers(): void {
    if (this.holdTimeoutId) {
      clearTimeout(this.holdTimeoutId);
      this.holdTimeoutId = null;
    }
    if (this.emitIntervalId) {
      clearInterval(this.emitIntervalId);
      this.emitIntervalId = null;
    }
  }

  ngOnDestroy(): void {
    this.clearTimers();
  }
}
