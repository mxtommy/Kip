import { cloneDeep } from 'lodash-es';
import { Component, DoCheck, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IDynamicControl } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';

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
      case "white":
        this.labelColorEnabled = 'black';
        this.labelColorDisabled = this.theme.whiteDim;
        this.valueColor = this.theme.white;
        break;
      case "blue":
        this.labelColorEnabled = this.theme.white;
        this.labelColorDisabled = this.theme.blueDim;
        this.valueColor = this.theme.blue;
        break;
      case "green":
        this.labelColorEnabled = this.theme.white;
        this.labelColorDisabled = this.theme.greenDim;
        this.valueColor = this.theme.green;
        break;
      case "pink":
        this.labelColorEnabled = this.theme.white;
        this.labelColorDisabled = this.theme.pinkDim;
        this.valueColor = this.theme.pink;
        break;
      case "orange":
        this.labelColorEnabled = this.theme.white;
        this.labelColorDisabled = this.theme.orangeDim;
        this.valueColor = this.theme.orange;
        break;
      case "purple":
        this.labelColorEnabled = this.theme.white;
        this.labelColorDisabled = this.theme.purpleDim;
        this.valueColor = this.theme.purple;
        break;
      case "grey":
        this.labelColorEnabled = this.theme.white;
        this.labelColorDisabled = this.theme.greyDim;
        this.valueColor = this.theme.grey;
        break;
      case "yellow":
        this.labelColorEnabled = this.theme.white;
        this.labelColorDisabled = this.theme.yellowDim;
        this.valueColor = this.theme.yellow;
        break;
      default:
        this.labelColorEnabled = 'black';
        this.labelColorDisabled = this.theme.whiteDim;
        this.valueColor = this.theme.white;
        break;
    }
  }
}
