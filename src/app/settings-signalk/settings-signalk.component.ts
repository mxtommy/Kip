import { ViewChild, ElementRef, Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import Chart from 'chart.js/auto';
import { MatDialog } from '@angular/material/dialog';

import { AppSettingsService } from '../app-settings.service';
import { IConnectionConfig } from "../app-settings.interfaces";
import { SignalKConnectionService, IEndpointStatus } from '../signalk-connection.service';
import { SignalKService } from '../signalk.service';
import { SignalKFullService, IFullDocumentStatus } from './../signalk-full.service';
import { SignalKDeltaService, IStreamStatus } from './../signalk-delta.service';
import { AuththeticationService, IAuthorizationToken } from './../auththetication.service';
import { SignalkRequestsService } from '../signalk-requests.service';
import { NotificationsService } from '../notifications.service';
import { ModalUserCredentialComponent } from '../modal-user-credential/modal-user-credential.component';
import { HttpErrorResponse } from '@angular/common/http';


@Component({
  selector: 'app-settings-signalk',
  templateUrl: './settings-signalk.component.html',
  styleUrls: ['./settings-signalk.component.css'],
})

export class SettingsSignalkComponent implements OnInit {

  @ViewChild('lineGraph', {static: true, read: ElementRef}) lineGraph: ElementRef;

  connectionConfig: IConnectionConfig;

  authTokenSub: Subscription;
  authToken: IAuthorizationToken;
  isLoggedInSub: Subscription;
  isLoggedIn: boolean;

  endpointServiceStatus: IEndpointStatus;
  skEndpointServiceStatusSub: Subscription;
  fullDocumentStatus: IFullDocumentStatus;
  skFullDocumentStatusSub: Subscription;
  streamStatus: IStreamStatus;
  skStreamStatusSub: Subscription;


  updatesSecondSub: Subscription;

  lastSecondsUpdate: number; //number of updates from server in last second
  updatesSeconds: number[]  = [];

  chartCtx;
  chart = null;
  textColor; // store the color of text for the graph...

  // dynamics theme support
  themeNameSub: Subscription = null;

  constructor(
    public dialog: MatDialog,
    private appSettingsService: AppSettingsService,
    private notificationsService: NotificationsService,
    private signalKService: SignalKService,
    private signalKConnectionService: SignalKConnectionService,
    private signalkRequestsService: SignalkRequestsService,
    private deltaService: SignalKDeltaService,
    private fullDocumentService: SignalKFullService,
    public auth: AuththeticationService)
  { }

  ngOnInit() {
    // get SignalK connection configuration
    this.connectionConfig = this.appSettingsService.getConnectionConfig();

    // Token Sub
    this.authTokenSub = this.auth.authToken$.subscribe((token: IAuthorizationToken) => {
      if (token) {
        this.authToken = token;
      } else {
        this.authToken = null;
      }
    });

    // Login Sub

    // get current value first because BehaviorSubject will send last value and component will triggger notifications
    if (this.auth.isLoggedIn$) {
      this.isLoggedIn = true;
    } else {
      this.isLoggedIn = false;
    }

    this.isLoggedInSub = this.auth.isLoggedIn$.subscribe(isLoggedIn => {
      if ((this.isLoggedIn !== isLoggedIn) && (isLoggedIn === true)) {
        this.notificationsService.sendSnackbarNotification("User authentication successful", 2000, false);
      }
      this.isLoggedIn = isLoggedIn;
    });

    // sub for signalk connection status
    this.skEndpointServiceStatusSub = this.signalKConnectionService.getServiceEndpointStatusAsO().subscribe((status: IEndpointStatus) => {
          this.endpointServiceStatus = status;
    });

    // get FullDocument Service status updates
    this.skFullDocumentStatusSub = this.fullDocumentService.getFullDocumentStatusAsO().subscribe((status: IFullDocumentStatus): void => {
      this.fullDocumentStatus = status;
    });

    // get Delta Service status updates
    this.skStreamStatusSub = this.deltaService.getDataStreamStatusAsO().subscribe((status: IStreamStatus): void => {
      this.streamStatus = status;
    });

    //get update performances
    this.updatesSecondSub = this.signalKService.getupdateStatsSecond().subscribe(newSecondsData => {
      this.lastSecondsUpdate = newSecondsData[newSecondsData.length-1];
      this.updatesSeconds = newSecondsData;
      if (this.chart !== null) {
        this.chart.config.data.datasets[0].data = newSecondsData;
        this.chart.update('none');
      }
    });

    this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;
    this.chartCtx = this.lineGraph.nativeElement.getContext('2d');
    this.startChart();
    this.subscribeTheme();
  }

  public openUserCredentialModal() {
    let dialogRef = this.dialog.open(ModalUserCredentialComponent, {
      width: '50%',
      data: this.connectionConfig
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        //console.log(result);
        //this.connectToServer();
      }
    });
  }

  public connectToServer() {
    if (this.connectionConfig.useSharedConfig && (!this.connectionConfig.loginName || !this.connectionConfig.loginPassword)) {
      this.openUserCredentialModal();
      return
    }

    let connection = {url: this.connectionConfig.signalKUrl, new: true};
    if (this.connectionConfig.signalKUrl != this.appSettingsService.signalkUrl.url) {
      this.appSettingsService.signalkUrl = connection;
      this.signalKConnectionService.resetSignalK(connection);

      if (this.connectionConfig.useSharedConfig) {
        this.serverLogin(this.connectionConfig.signalKUrl);
      } else if ( this.authToken && this.authToken.isDeviceAccessToken) {
        this.auth.deleteToken();
      }

      // login is done by skEndpointServiceStatus$ Observable's connection status

    } else {
      // Same URL - no need to resetSignalK(). Just login, new token reset will reload WebSockets
      //and HTTP_INTERCEPTOR will incert the new token automatically on ahh HTTP calls (not WebSocket).
      if ((this.authToken && this.authToken.isDeviceAccessToken) && this.connectionConfig.useSharedConfig) {
        this.serverLogin(this.connectionConfig.signalKUrl);
      } else if ((this.authToken && !this.authToken.isDeviceAccessToken) && !this.connectionConfig.useSharedConfig) {
        this.deleteToken();
      } else if (this.connectionConfig.useSharedConfig) {
        this.serverLogin(this.connectionConfig.signalKUrl);
      } else {
        this.signalKConnectionService.resetSignalK(connection);
      }
    }

    this.appSettingsService.setConnectionConfig(this.connectionConfig);
  }

  private serverLogin(newUrl?: string) {
      this.auth.login({ usr: this.connectionConfig.loginName, pwd: this.connectionConfig.loginPassword, newUrl })
      .catch((error: HttpErrorResponse) => {
        if (error.status == 401) {
          this.openUserCredentialModal();
          this.notificationsService.sendSnackbarNotification("Authentication failed. Invalide user/password", 2000, false);
          console.log("[Setting-SignalK Component] Login failure: " + error.error.message);
        } else if (error.status == 404) {
          this.notificationsService.sendSnackbarNotification("Authentication failed. Login API not found", 2000, false);
          console.log("[Setting-SignalK Component] Login failure: " + error.error.message);
        } else if (error.status == 0) {
          this.notificationsService.sendSnackbarNotification("User authentication failed. Cannot reach server at SignalK URL", 2000, false);
          console.log("[Setting-SignalK Component] User authentication failed. Cannot reach server at SignalK URL:" + error.message);
        } else {
          this.notificationsService.sendSnackbarNotification("Unknown authentication failure: " + JSON.stringify(error), 2000, false);
          console.log("[Setting-SignalK Component] Unknown login error response: " + JSON.stringify(error));
        }
      });
  }

  public requestDeviceAccessToken() {
    this.signalkRequestsService.requestDeviceAccessToken();
  }

  public deleteToken() {
    this.auth.deleteToken();
  }

  private startChart() {
    if (this.chart !== null) {
        this.chart.destroy();
    }

    this.chart = new Chart(this.chartCtx,{
      type: 'line',
      data: {
          labels: Array.from(Array(60).keys()).reverse(),
          datasets: [
            {
              label: "Updates Per Second",
              data: this.updatesSeconds,
              //fill: 'false',
              borderColor: this.textColor
            },
            // {
            //   label: "Per Minute",
            //   data: this.updatesMinutes,
            //   fill: 'false',
            //   borderColor: this.textColor
            // }
          ]
      },
      options: {

        scales: {
          y:
            {
              type: 'linear',
              position: 'left',
              beginAtZero: true,
            },
            // {
            //   type: 'linear',
            //   position: 'right',
            //     //beginAtZero: true,
            // }
        }
      }
    });
  }

  // Subscribe to theme event
  private subscribeTheme() {
    this.themeNameSub = this.appSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
      setTimeout(() => {   // need a delay so browser getComputedStyles has time to complete theme application.
        this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;
        this.startChart()
      }, 100);
    })
  }

  private unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
    }
  }

  ngOnDestroy() {
    this.skEndpointServiceStatusSub.unsubscribe();
    this.skFullDocumentStatusSub.unsubscribe();
    this.skStreamStatusSub.unsubscribe();
    this.authTokenSub.unsubscribe();
    this.isLoggedInSub.unsubscribe();
    // this.updatesMinutesSub.unsubscribe();
    this.updatesSecondSub.unsubscribe();
  }
}
