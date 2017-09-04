import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';



import { AppSettingsService } from '../app-settings.service';



@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {

  formSignalKURL: string;

  constructor(private AppSettingsService: AppSettingsService) { }

  ngOnInit() {
    // get SignalKurl Status
    this.formSignalKURL = this.AppSettingsService.getSignalKURL();
    
  }


  updateSignalKURL() {
    this.AppSettingsService.setSignalKURL(this.formSignalKURL);
  }


}
