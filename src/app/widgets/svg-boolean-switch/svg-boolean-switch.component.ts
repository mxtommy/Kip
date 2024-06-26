import { Component, DoCheck, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { IDynamicControl } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';

export interface IDimensions {
  height: number,
  width: number
}

@Component({
    selector: 'app-svg-boolean-switch',
    templateUrl: './svg-boolean-switch.component.svg',
    standalone: true
})
export class SvgBooleanSwitchComponent implements OnInit, DoCheck {
  @Input('controlData') data: IDynamicControl = null;
  @Input('theme') theme: ITheme = null;
  @Input({ required: true }) dimensions!: IDimensions;
  @Output() toggleClick = new EventEmitter<IDynamicControl>();

  private toggleOff: string = "0 35 180 35";
  private toggleOn: string = "0 0 180 35";
  private ctrlState: boolean = null;
  private oldTheme: ITheme = null;

  public viewBox: string = this.toggleOff;
  public labelColor = null;
  public valueColor = null;

  constructor() { }

  ngOnInit(): void {
  }

  ngDoCheck(): void {
    if (this.data.value != this.ctrlState) {
      this.ctrlState = this.data.value;
      this.viewBox = this.data.value ? this.toggleOn : this.toggleOff;
    }

    if (this.oldTheme != this.theme) {
      this.oldTheme = this.theme
      this.getColors(this.data.color);
    }
  }


  public toggle(state: boolean): void {
    this.data.value = state;
    this.toggleClick.emit(this.data);
  }

  private getColors(color: string): void {
    switch (color) {
      case "white":
        this.labelColor = this.theme.white;
        this.valueColor = this.theme.white;
        break;
      case "blue":
        this.labelColor = this.theme.blue;
        this.valueColor = this.theme.blue;
        break;
      case "green":
        this.labelColor = this.theme.green;
        this.valueColor = this.theme.green;
        break;
      case "pink":
        this.labelColor = this.theme.pink;
        this.valueColor = this.theme.pink;
        break;
      case "orange":
        this.labelColor = this.theme.orange;
        this.valueColor = this.theme.orange;
        break;
      case "purple":
        this.labelColor = this.theme.purple;
        this.valueColor = this.theme.purple;
        break;
      case "grey":
        this.labelColor = this.theme.grey;
        this.valueColor = this.theme.grey;
        break;
      case "yellow":
        this.labelColor = this.theme.yellow;
        this.valueColor = this.theme.yellow;
        break;
      default:
        this.labelColor = this.theme.white;
        this.valueColor = this.theme.white;
        break;
    }
  }
}
