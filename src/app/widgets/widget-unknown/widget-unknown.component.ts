import { Component, OnDestroy } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
//TODO: Do we still need this widget ???
@Component({
    selector: 'app-widget-unknown',
    templateUrl: './widget-unknown.component.html',
    styleUrls: ['./widget-unknown.component.css'],
    imports: [ WidgetHostComponent ],
    standalone: true
})
export class WidgetUnknownComponent extends BaseWidgetComponent implements OnDestroy {

  constructor() {
    super();
   }

  protected startWidget(): void {
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
  }
}
