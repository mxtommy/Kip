import { cloneDeep } from 'lodash-es';
import { Component, DoCheck, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IDynamicControl, ITheme } from '../../core/interfaces/widgets-interface';

interface IDimensions {
  height: number,
  width: number
}

@Component({
  selector: 'app-svg-boolean-button',
  templateUrl: './svg-boolean-button.component.svg'
})
export class SvgBooleanButtonComponent implements OnInit, DoCheck {
  @Input('controlData') data: IDynamicControl = null;
  @Input('theme') theme: ITheme = null;
  @Input() dimensions!: IDimensions;
  @Output() toggleClick = new EventEmitter<IDynamicControl>();

  private toggleOff: string = "0 35 180 35";
  private toggleOn: string = "0 0 180 35";
  private oldTheme: ITheme = null;

  private timeoutHandler = null;
  private pressed: boolean = false;

  public viewBox: string = this.toggleOff;
  public labelColorEnabled = null;
  public labelColorDisabled = null;
  public valueColor = null;

  constructor() { }

  ngOnInit(): void {
  }

  ngDoCheck(): void {
    this.viewBox = this.pressed ? this.toggleOn : this.toggleOff;

    if (this.oldTheme != this.theme) {
      this.oldTheme = this.theme
      this.getColors(this.data.color);
    }
  }

  public handleClickDown() {
      // momentary mode
      this.pressed = true;
      const state: IDynamicControl = cloneDeep(this.data);
      state.value = this.pressed;

      // send it once to start
      this.toggleClick.emit(state);

      //send it again every 100ms
      this.timeoutHandler = setInterval(() => {
        this.toggleClick.emit(state);
      }, 100);
  }

  public handleClickUp() {
    this.pressed = false;
    if (this.timeoutHandler) {
      clearInterval(this.timeoutHandler);
    }
  }

  private getColors(color: string): void {
    switch (color) {
      case "text":
        this.labelColorEnabled = "black";
        this.labelColorDisabled = this.theme.text;
        this.valueColor = this.theme.text;
        break;

      case "primary":
        this.labelColorEnabled = this.theme.text;
        this.labelColorDisabled = this.theme.textPrimaryLight;
        this.valueColor = this.theme.textPrimaryLight;
        break;

      case "accent":
        this.labelColorEnabled = this.theme.text;
        this.labelColorDisabled = this.theme.textAccentLight;
        this.valueColor = this.theme.textAccentLight;
        break;

      case "warn":
        this.labelColorEnabled = this.theme.text;
        this.labelColorDisabled = this.theme.textWarnLight;
        this.valueColor = this.theme.textWarnLight;
        break;

      default:
        break;
    }
  }
}
