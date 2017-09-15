import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';



import { AppSettingsService } from '../app-settings.service';
import { SignalKConnectionService } from '../signalk-connection.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {

  constructor(
    private AppSettingsService: AppSettingsService) { }


  ngOnInit() {
  }

  resetSettings() {
    this.AppSettingsService.deleteSettings();
  }





}
