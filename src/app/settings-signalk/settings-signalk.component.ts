import { ViewChild, ElementRef, Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import Chart from 'chart.js/auto';
import { MatDialog } from '@angular/material/dialog';

import { AppSettingsService, IConnectionConfig, SignalKToken} from '../app-settings.service';
import { SignalKConnectionService, SignalKStatus } from '../signalk-connection.service';
import { SignalkRequestsService, skRequest } from '../signalk-requests.service';
import { NotificationsService } from '../notifications.service';
import { SignalKService } from '../signalk.service';
import { ModalUserCredentialComponent } from '../modal-user-credential/modal-user-credential.component';


@Component({
  selector: 'app-settings-signalk',
  templateUrl: './settings-signalk.component.html',
  styleUrls: ['./settings-signalk.component.css']
})
export class SettingsSignalkComponent implements OnInit {

  @ViewChild('lineGraph', {static: true, read: ElementRef}) lineGraph: ElementRef;

  connectionConfig: IConnectionConfig;
  loginRequestId: string;
  loginRequestSub: Subscription;
  connectionAuthToken: SignalKToken;

  signalKConnectionsStatus: SignalKStatus;
  signalKConnectionsStatusSub: Subscription;

  authTokenSub: Subscription;

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
    private signalkRequestsService: SignalkRequestsService) { }

  ngOnInit() {
    // get SignalK connection configuration
    this.connectionConfig = this.appSettingsService.getConnectionConfig();

    // Request service sub to monitor login request responses
    this.loginRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(request => {
        if (request.requestId == this.loginRequestId) {
          if (request.statusCode == 401){
            this.openUserCredentialModal();
            this.notificationsService.sendSnackbarNotification(request.statusCode + " - " + request.statusCodeDescription);
          } else if (request.statusCode == 200) {
            this.notificationsService.sendSnackbarNotification("User authentication successful", 2000, false);
          } else {
            this.notificationsService.sendSnackbarNotification("Unknown login request status code received", 2000, false);
          }
        }
    });

    // sub for R/W Token
    this.authTokenSub = this.appSettingsService.getSignalKTokenAsO().subscribe(token => {
      this.connectionAuthToken = token;
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


  ngOnDestroy() {
    this.loginRequestSub.unsubscribe();
    this.signalKConnectionsStatusSub.unsubscribe();
    this.authTokenSub.unsubscribe();
    // this.updatesMinutesSub.unsubscribe();
    this.updatesSecondSub.unsubscribe();
  }

  openUserCredentialModal() {

    let dialogRef = this.dialog.open(ModalUserCredentialComponent, {
      width: '50%',
      data: this.connectionConfig
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        //console.log(result);
        this.connectToServer();
      }
    });
  }

  connectToServer() {

    if (this.connectionConfig.useDeviceToken) {
      this.appSettingsService.setSignalKURL({url: this.connectionConfig.signalKUrl, new: true});
    } else {
      if (this.connectionConfig.signalKUrl != this.appSettingsService.getSignalKURL().url) {
        this.appSettingsService.setSignalKURL({url: this.connectionConfig.signalKUrl, new: true});
        this.loginRequestId = this.signalkRequestsService.requestUserLogin(this.connectionConfig.loginName, this.connectionConfig.loginPassword);
      } else {
        this.loginRequestId = this.signalkRequestsService.requestUserLogin(this.connectionConfig.loginName, this.connectionConfig.loginPassword);
      }
    }
    this.appSettingsService.setConnectionConfig(this.connectionConfig);
  }

  requestDeviceAccessToken() {
    this.signalkRequestsService.requestDeviceAccessToken();
  }

  deleteToken() {
    this.appSettingsService.setSignalKToken({token: null, isNew: false, isSessionToken: false, isExpired: false});
  }


  startChart() {
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
  subscribeTheme() {
    this.themeNameSub = this.appSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
      setTimeout(() => {   // need a delay so browser getComputedStyles has time to complete theme application.
        this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;
        this.startChart()
      }, 100);
    })
  }

  unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
    }
  }


}
