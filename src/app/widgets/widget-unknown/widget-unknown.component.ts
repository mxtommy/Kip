import { Component } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';

@Component({
    selector: 'app-widget-unknown',
    templateUrl: './widget-unknown.component.html',
    styleUrls: ['./widget-unknown.component.css'],
    imports: [ WidgetHostComponent ],
    standalone: true
})
export class WidgetUnknownComponent extends BaseWidgetComponent {

  constructor() {
    super();
   }

   protected startWidget(): void {
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
  }


}
