import { Component, inject, input, ChangeDetectionStrategy } from '@angular/core';
import { MatButton } from '@angular/material/button';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ITheme } from '../../core/services/app-service';
import { RouterLink } from '@angular/router';

@Component({
    selector: 'widget-tutorial',
    templateUrl: './widget-tutorial.component.html',
    styleUrls: ['./widget-tutorial.component.scss'],
    imports: [ MatButton, RouterLink ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class WidgetTutorialComponent  {
  public id = input.required<string>();
  public type = input.required<string>();
  public theme = input.required<ITheme|null>();

  public static readonly DEFAULT_CONFIG: IWidgetSvcConfig = {
    filterSelfPaths: true
  };

  protected dashboard = inject(DashboardService);
  protected settings = inject(AppSettingsService);

  public loadDemoConfig() {
    this.settings.loadDemoConfig();
  }
}
