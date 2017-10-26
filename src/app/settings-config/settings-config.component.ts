import { Component, OnInit } from '@angular/core';

import { AppSettingsService } from '../app-settings.service';
import { DemoConfig } from '../demo-config.const';


@Component({
  selector: 'app-settings-config',
  templateUrl: './settings-config.component.html',
  styleUrls: ['./settings-config.component.css']
})
export class SettingsConfigComponent implements OnInit {

  jsonConfig: string = '';

  constructor(
    private AppSettingsService: AppSettingsService) { }


  ngOnInit() {
    this.jsonConfig = this.AppSettingsService.getConfigJson();
  }

  resetSettings() {
    this.AppSettingsService.resetSettings();
  }

  submitConfig() {
    this.AppSettingsService.replaceConfig(this.jsonConfig);
  }

  loadDemoConfig() {
    this.AppSettingsService.loadDemoConfig();
  }

}
