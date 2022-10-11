import { AuththeticationService } from './../auththetication.service';
import { ViewChild, ElementRef, Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import Chart from 'chart.js/auto';
import { MatDialog } from '@angular/material/dialog';

import { AppSettingsService, SignalKToken} from '../app-settings.service';
import { IConnectionConfig } from "../app-init.interfaces";
import { SignalKConnectionService, SignalKStatus } from '../signalk-connection.service';
import { SignalkRequestsService } from '../signalk-requests.service';
import { NotificationsService } from '../notifications.service';
import { SignalKService } from '../signalk.service';
import { ModalUserCredentialComponent } from '../modal-user-credential/modal-user-credential.component';
import { HttpErrorResponse } from '@angular/common/http';
import { NG_VALIDATORS } from '@angular/forms';


@Component({
  selector: 'app-settings-signalk',
  templateUrl: './settings-signalk.component.html',
  styleUrls: ['./settings-signalk.component.css'],
})

export class SettingsSignalkComponent implements OnInit {

  @ViewChild('lineGraph', {static: true, read: ElementRef}) lineGraph: ElementRef;

  connectionConfig: IConnectionConfig;

  authToken$: Subscription;
  authToken: string;
  isLoggedIn$: Subscription;
  isLoggedIn: boolean;

  signalKConnectionsStatus: SignalKStatus;
  signalKConnectionsStatusSub: Subscription;

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
    public auth: AuththeticationService)
  { }

  ngOnInit() {
    // get SignalK connection configuration
    this.connectionConfig = this.appSettingsService.getConnectionConfig();

    // Token Sub
    this.authToken$ = this.auth.authToken$.subscribe(authToken => {
      if (authToken) {
        let token = authToken;
        this.authToken = token.token;
      } else this.authToken = null;
    });

    // Login Sub
    this.isLoggedIn$ = this.auth.isLoggedIn$.subscribe(isLoggedIn => {
      this.isLoggedIn = isLoggedIn;
      if (isLoggedIn) {
        this.notificationsService.sendSnackbarNotification("User authentication successful", 2000, false);
      }
    });

    // sub for signalk connection status
    this.signalKConnectionsStatusSub = this.signalKConnectionService.getSignalKConnectionsStatus().subscribe(status => {
      this.signalKConnectionsStatus = status;
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

    if (this.connectionConfig.signalKUrl != this.appSettingsService.getSignalKURL().url) {
      this.appSettingsService.setSignalKURL({url: this.connectionConfig.signalKUrl, new: true});
      if (this.connectionConfig.useSharedConfig) {
        this.serverLogin(this.connectionConfig.signalKUrl);
      }

    } else {
      this.appSettingsService.setSignalKURL({url: this.connectionConfig.signalKUrl, new: false});
      if (this.connectionConfig.useSharedConfig) {
        this.serverLogin();
      }

    }

    this.appSettingsService.setConnectionConfig(this.connectionConfig);
  }

  private serverLogin(newUrl?: string) {
    this.auth
      .login(this.connectionConfig.loginName, this.connectionConfig.loginPassword, newUrl)
      .subscribe(
        loginResponse => {
        //TODO: route to appropriate page
        //this.router.navigate(['/page', 0]);

      },
      error => {
        let errResponse:HttpErrorResponse = error;
        if (errResponse.status == 401) {
          this.notificationsService.sendSnackbarNotification("User authentication failed", 2000, false);
          console.log("[Login Component] Login failure: " + errResponse.statusText);
        } else if (errResponse.status == 404) {
          this.notificationsService.sendSnackbarNotification("User authentication failed. Cannot reach login API", 2000, false);
          console.log("[Login Component] Login failure: " + errResponse.message);
        } else if (errResponse.status == 0) {
          this.notificationsService.sendSnackbarNotification("User authentication failed. Cannot reach server", 2000, false);
          console.log("[Login Component] " + errResponse.message);
        } else {
          this.notificationsService.sendSnackbarNotification("Unknown authentication failure: " + JSON.stringify(error), 2000, false);
          console.log("[Login Component] Unknown login error response: " + JSON.stringify(error));
        }
      }
    );
  }

  public requestDeviceAccessToken() {
    this.signalkRequestsService.requestDeviceAccessToken();
  }

  public deleteToken() {
    this.appSettingsService.setSignalKToken({token: null, isNew: false, isSessionToken: false, isExpired: false});
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
    this.signalKConnectionsStatusSub.unsubscribe();
    this.authToken$.unsubscribe();
    this.isLoggedIn$.unsubscribe();
    // this.updatesMinutesSub.unsubscribe();
    this.updatesSecondSub.unsubscribe();
  }
}
