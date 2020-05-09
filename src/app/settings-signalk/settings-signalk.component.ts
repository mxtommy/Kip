import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';

import { AppSettingsService, SignalKToken, SignalKUrl } from '../app-settings.service';
import { SignalKConnectionService, SignalKStatus } from '../signalk-connection.service';
import { SignalkRequestsService } from '../signalk-requests.service';


@Component({
  selector: 'app-settings-signalk',
  templateUrl: './settings-signalk.component.html',
  styleUrls: ['./settings-signalk.component.css']
})
export class SettingsSignalkComponent implements OnInit {

  formSignalKURL: string;
  formAuthToken: string;

  signalKConnectionsStatus: SignalKStatus;
  signalKConnectionsStatusSub: Subscription;

  authTokenSub: Subscription;

  constructor(
    private AppSettingsService: AppSettingsService,
    private SignalKConnectionService: SignalKConnectionService,
    private SignalkRequestsService: SignalkRequestsService) { }

  ngOnInit() {
    // get SignalKurl
    this.formSignalKURL = this.AppSettingsService.getSignalKURL().url;

    // sub for R/W Token
    this.authTokenSub = this.AppSettingsService.getSignalKTokenAsO().subscribe(token => {
      this.formAuthToken = token.token;
    });

    // sub for signalk connection status
    this.signalKConnectionsStatusSub = this.SignalKConnectionService.getSignalKConnectionsStatus().subscribe(status => {
      this.signalKConnectionsStatus = status;
    });
  }


  ngOnDestroy() {
    this.signalKConnectionsStatusSub.unsubscribe();
    this.authTokenSub.unsubscribe();
  }

  updateSignalKURL() {
    this.AppSettingsService.setSignalKURL({url: this.formSignalKURL, new: true});
  }

  requestAuth() {
    this.SignalkRequestsService.requestAuth();
  }

  clearAuth() {
    this.AppSettingsService.setSignalKToken({token: null, new: true});
  }

}
