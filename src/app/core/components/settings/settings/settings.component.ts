import { Component } from '@angular/core';
import { SettingsUnitsComponent } from '../units/units.component';
import { SettingsNotificationsComponent } from '../notifications/notifications.component';
import { SettingsSignalkComponent } from '../signalk/signalk.component';
import { SettingsDisplayComponent } from '../display/display.component';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { PageHeaderComponent } from '../../../components/page-header/page-header.component';
import { SettingsConfigComponent } from '../configuration/config.component';


@Component({
    selector: 'settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss'],
    imports: [
      MatTabGroup,
      MatTab,
      SettingsSignalkComponent,
      SettingsNotificationsComponent,
      SettingsUnitsComponent,
      SettingsDisplayComponent,
      SettingsNotificationsComponent,
      SettingsConfigComponent,
      PageHeaderComponent
  ]
})
export class AppSettingsComponent {
  protected readonly pageTitle: string = "Settings";
  constructor() { }
}
