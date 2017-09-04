import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';



import { AppSettingsService } from '../app-settings.service';
import { SignalKService } from '../signalk.service';


@Component({
  selector: 'app-settings',
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css']
})
export class SettingsComponent implements OnInit {

  formSignalKURL: string;

  endpointAPIStatusSub: Subscription;
  endpointAPIStatus: boolean;

  endpointAPIStatusMessageSub: Subscription;
  endpointAPIStatusMessage: string;

  constructor(
    private AppSettingsService: AppSettingsService, 
    private SignalKService: SignalKService) { }

  ngOnInit() {
    // get SignalKurl Status
    this.formSignalKURL = this.AppSettingsService.getSignalKURL();

    // sub for signalk status stuff
    this.endpointAPIStatusSub = this.SignalKService.getEndpointAPIStatus().subscribe(
      status => {
        this.endpointAPIStatus = status;
      }
    );
    this.endpointAPIStatusMessageSub = this.SignalKService.getEndpointAPIStatusMessage().subscribe(
      message => {
        this.endpointAPIStatusMessage = message;
      }
    );

  }


  ngOnDestroy() {
    this.endpointAPIStatusSub.unsubscribe();
    this.endpointAPIStatusMessageSub.unsubscribe();
  }

  updateSignalKURL() {
    this.AppSettingsService.setSignalKURL(this.formSignalKURL);
  }


}
