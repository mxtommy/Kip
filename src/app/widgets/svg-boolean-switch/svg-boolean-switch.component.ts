import { Component, DoCheck, EventEmitter, Input, OnInit, Output, SimpleChanges } from '@angular/core';
import { IChildControl, ITheme } from '../../widgets-interface';

@Component({
  selector: 'app-svg-boolean-switch',
  templateUrl: './svg-boolean-switch.component.svg'
})
export class SvgBooleanSwitchComponent implements OnInit, DoCheck {
  @Input('controlData') data: IChildControl = null;
  @Input('theme') theme: ITheme = null;
  @Output() toggleClick = new EventEmitter<IChildControl>();

  private toggleOff: string = "0 35 205 35";
  private toggleOn: string = "0 0 205 35";
  private ctrlState: boolean = null;
  private oldTheme: ITheme = null;

  public viewBox: string = this.toggleOff;
  public labelColor = null;
  public valueColor = null;

  constructor() { }

  ngOnInit(): void {
    //  this.getColors(this.data.color);
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
      case "text":
        this.labelColor = this.theme.textDark;
        this.valueColor = this.theme.text;
        break;

      case "primary":
        this.labelColor = this.theme.textPrimaryDark;
        this.valueColor = this.theme.textPrimaryLight;
        break;

      case "accent":
        this.labelColor = this.theme.textAccentDark;
        this.valueColor = this.theme.textAccentLight;
        break;

      case "warn":
        this.labelColor = this.theme.textWarnDark;
        this.valueColor = this.theme.textWarnLight;
        break;

      default:
        this.labelColor = this.theme.textDark;
        this.valueColor = this.theme.text;
        break;
    }
  }
}
