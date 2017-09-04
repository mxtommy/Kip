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

  endpointAPIStatus: boolean;
  endpointAPIStatusMessage: string;
  endpointWSStatus: boolean;
  endpointWSMessage: string;

  endpointAPIStatusSub: Subscription;
  endpointAPIStatusMessageSub: Subscription;
  endpointWSStatusSub: Subscription;
  endpointWSMessageSub: Subscription;

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
    this.endpointWSStatusSub = this.SignalKService.getEndpointWSStatus().subscribe(
      status => {
        this.endpointWSStatus = status;
      }
    );
    this.endpointWSMessageSub = this.SignalKService.getEndpointWSMessage().subscribe(
      message => {
        this.endpointWSMessage = message;
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
