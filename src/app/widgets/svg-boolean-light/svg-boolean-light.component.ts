import { Component, DoCheck, EventEmitter, OnInit, Output, input } from '@angular/core';
import type { IDynamicControl } from '../../core/interfaces/widgets-interface';
import type { ITheme } from '../../core/services/app-service';

interface IDimensions {
  height: number,
  width: number
}


@Component({
    selector: 'app-svg-boolean-light',
    templateUrl: './svg-boolean-light.component.svg',
    standalone: true
})
export class SvgBooleanLightComponent implements OnInit, DoCheck {
  readonly data = input<IDynamicControl>(null, { alias: "controlData" });
  readonly theme = input<ITheme>(null);
  readonly dimensions = input.required<IDimensions>();
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
    const data = this.data();
    if (data.value != this.ctrlState) {
      this.ctrlState = data.value;
      this.viewBox = data.value ? this.toggleOn : this.toggleOff;
    }

    const theme = this.theme();
    if (this.oldTheme != theme) {
      this.oldTheme = theme
      this.getColors(data.color);
    }
  }

  public toggle(state: boolean): void {
    const data = this.data();
    data.value = state;
    this.toggleClick.emit(data);
  }

  private getColors(color: string): void {
    switch (color) {
      case "white":
        this.labelColor = this.theme().whiteDim;
        this.valueColor = this.theme().white;
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
        this.labelColor = this.theme().whiteDim;
        this.valueColor = this.theme().white;
        break;
    }
  }
}
