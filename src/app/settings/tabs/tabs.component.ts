import { Component, OnInit } from '@angular/core';
import { SettingsConfigComponent } from '../config/config.component';
import { SettingsDatasetsComponent } from '../datasets/datasets.component';
import { SettingsZonesComponent } from '../zones/zones.component';
import { SettingsUnitsComponent } from '../units/units.component';
import { SettingsGeneralComponent } from '../general/general.component';
import { SettingsSignalkComponent } from '../signalk/signalk.component';
import { MatTabGroup, MatTab } from '@angular/material/tabs';


@Component({
    selector: 'settings-tabs',
    templateUrl: './tabs.component.html',
    standalone: true,
    imports: [MatTabGroup, MatTab, SettingsSignalkComponent, SettingsGeneralComponent, SettingsUnitsComponent, SettingsZonesComponent, SettingsDatasetsComponent, SettingsConfigComponent]
})
export class SettingsTabsComponent implements OnInit {

  constructor() { }

  ngOnInit() {
  }
}
