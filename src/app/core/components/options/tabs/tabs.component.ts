import { Component } from '@angular/core';
import { SettingsUnitsComponent } from '../units/units.component';
import { SettingsNotificationsComponent } from '../notifications/notifications.component';
import { SettingsSignalkComponent } from '../signalk/signalk.component';
import { SettingsDisplayComponent } from '../display/display.component';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { PageHeaderComponent } from '../../page-header/page-header.component';
import { SettingsConfigComponent } from '../configuration/config.component';
import { SettingsDatasetsComponent } from '../../datasets/datasets.component';


@Component({
    selector: 'tabs',
    templateUrl: './tabs.component.html',
    styleUrls: ['./tabs.component.scss'],
    imports: [
      MatTabGroup,
      MatTab,
      SettingsSignalkComponent,
      SettingsNotificationsComponent,
      SettingsUnitsComponent,
      SettingsDisplayComponent,
      SettingsNotificationsComponent,
      SettingsConfigComponent,
      PageHeaderComponent,
      SettingsDatasetsComponent
  ]
})
export class TabsComponent {
  protected readonly pageTitle: string = "Settings";
  constructor() { }
}
