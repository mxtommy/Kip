import { Component } from '@angular/core';
import { SettingsUnitsComponent } from '../units/units.component';
import { SettingsNotificationsComponent } from '../notifications/notifications.component';
import { SettingsSignalkComponent } from '../signalk/signalk.component';
import { SettingsDisplayComponent } from '../display/display.component';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { PageHeaderComponent } from '../../core/components/page-header/page-header.component';


@Component({
    selector: 'settings',
    templateUrl: './settings.component.html',
    styleUrls: ['./settings.component.scss'],
    standalone: true,
    imports: [
      MatTabGroup,
      MatTab,
      SettingsSignalkComponent,
      SettingsNotificationsComponent,
      SettingsUnitsComponent,
      SettingsDisplayComponent,
      SettingsNotificationsComponent,
      PageHeaderComponent
  ]
})
export class AppSettingsComponent {
  protected readonly pageTitle: string = "Settings";
  constructor() { }
}
