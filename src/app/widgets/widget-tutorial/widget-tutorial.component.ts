import { Component, inject, OnDestroy } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { MatButton } from '@angular/material/button';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { DashboardService } from '../../core/services/dashboard.service';

@Component({
    selector: 'widget-tutorial',
    templateUrl: './widget-tutorial.component.html',
    styleUrls: ['./widget-tutorial.component.scss'],
    imports: [ WidgetHostComponent, MatButton]
})
export class WidgetTutorialComponent extends BaseWidgetComponent implements OnDestroy {
  protected dashboard = inject(DashboardService);
  protected settings = inject(AppSettingsService);

  constructor() {
    super();
   }

   public loadDemoConfig() {
    this.settings.loadDemoConfig();
  }

  protected startWidget(): void {
  }

  protected updateConfig(): void {
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
  }
}
