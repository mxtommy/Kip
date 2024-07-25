import { Component, OnInit } from '@angular/core';
import { SettingsConfigComponent } from '../config/config.component';
import { SettingsDatasetsComponent } from '../datasets/datasets.component';
import { SettingsUnitsComponent } from '../units/units.component';
import { SettingsNotificationsComponent } from '../notifications/notifications.component';
import { SettingsSignalkComponent } from '../signalk/signalk.component';
import { SettingsDisplayComponent } from '../display/display.component';
import { MatTabGroup, MatTab } from '@angular/material/tabs';
import { SettingsResetComponent } from "../reset/reset.component";


@Component({
    selector: 'settings-tabs',
    templateUrl: './tabs.component.html',
    styleUrls: ['./tabs.component.scss'],
    standalone: true,
    imports: [
    MatTabGroup,
    MatTab,
    SettingsSignalkComponent,
    SettingsNotificationsComponent,
    SettingsUnitsComponent,
    SettingsDatasetsComponent,
    SettingsConfigComponent,
    SettingsDisplayComponent,
    SettingsNotificationsComponent,
    SettingsResetComponent
]
})
export class SettingsTabsComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }
}
