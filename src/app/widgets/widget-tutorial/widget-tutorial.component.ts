import { Component, Input } from '@angular/core';
import { IWidgetSvcConfig } from '../../widgets-interface';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-tutorial',
  templateUrl: './widget-tutorial.component.html'
})
export class WidgetTutorialComponent extends BaseWidgetComponent {
  @Input() unlockStatus: boolean;

  defaultConfig: IWidgetSvcConfig = {};
  constructor() {
    super();
   }

}
