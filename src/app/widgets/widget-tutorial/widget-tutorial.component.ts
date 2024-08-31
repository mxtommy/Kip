import { Component, inject } from '@angular/core';
import { BaseWidgetComponent } from '../../core/components/base-widget/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { RouterLink } from '@angular/router';
import { MatButton } from '@angular/material/button';
import { NgIf } from '@angular/common';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { DashboardService } from '../../core/services/dashboard.service';

@Component({
    selector: 'widget-tutorial',
    templateUrl: './widget-tutorial.component.html',
    standalone: true,
    imports: [ WidgetHostComponent, NgIf, MatButton, RouterLink]
})
export class WidgetTutorialComponent extends BaseWidgetComponent {
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

  protected updateConfig(config: IWidgetSvcConfig): void {
  }
}
