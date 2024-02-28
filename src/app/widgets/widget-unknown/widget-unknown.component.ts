import { Component } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
    selector: 'app-widget-unknown',
    templateUrl: './widget-unknown.component.html',
    styleUrls: ['./widget-unknown.component.css'],
    standalone: true
})
export class WidgetUnknownComponent extends BaseWidgetComponent {

  constructor() {
    super();
   }

}
