import { Component } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-blank',
  templateUrl: './widget-blank.component.html',
  styleUrls: ['./widget-blank.component.css']
})
export class WidgetBlankComponent extends BaseWidgetComponent {

  constructor() {
    super();

    this.defaultConfig = {
      displayName: ''
    };
  }
}
