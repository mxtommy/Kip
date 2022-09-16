import { ViewChild, ElementRef, Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import Chart from 'chart.js/auto';

import { AppSettingsService, IConnectionConfig, SignalKToken} from '../app-settings.service';
import { SignalKConnectionService, SignalKStatus } from '../signalk-connection.service';
import { SignalkRequestsService } from '../signalk-requests.service';
import { SignalKService } from '../signalk.service';



@Component({
  selector: 'app-settings-signalk',
  templateUrl: './settings-signalk.component.html',
  styleUrls: ['./settings-signalk.component.css']
})
export class SettingsSignalkComponent implements OnInit {

  @ViewChild('lineGraph', {static: true, read: ElementRef}) lineGraph: ElementRef;

  connectionConfig: IConnectionConfig;
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
    private AppSettingsService: AppSettingsService,
    private SignalKService: SignalKService,
    private SignalKConnectionService: SignalKConnectionService,
    private SignalkRequestsService: SignalkRequestsService) { }

  ngOnInit() {
    // get SignalK connection configuration
    this.connectionConfig = this.AppSettingsService.getConnectionConfig();

    // sub for R/W Token
    this.authTokenSub = this.AppSettingsService.getSignalKTokenAsO().subscribe(token => {
      this.connectionAuthToken = token;
    });

    // sub for signalk connection status
    this.signalKConnectionsStatusSub = this.SignalKConnectionService.getSignalKConnectionsStatus().subscribe(status => {
      this.signalKConnectionsStatus = status;
    });

    //get update performances
    this.updatesSecondSub = this.SignalKService.getupdateStatsSecond().subscribe(newSecondsData => {
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
    this.signalKConnectionsStatusSub.unsubscribe();
    this.authTokenSub.unsubscribe();
    // this.updatesMinutesSub.unsubscribe();
    this.updatesSecondSub.unsubscribe();
  }

  conectToServer() {
    if (this.connectionConfig.useDeviceToken) {
      this.AppSettingsService.setSignalKURL({url: this.connectionConfig.signalKUrl, new: true});
    } else {
      if (this.connectionConfig.signalKUrl != this.AppSettingsService.getSignalKURL().url) {
        this.AppSettingsService.setSignalKURL({url: this.connectionConfig.signalKUrl, new: true});
        this.SignalkRequestsService.requestUserLogin(this.connectionConfig.loginName, this.connectionConfig.loginPassword);
      } else {
        this.SignalkRequestsService.requestUserLogin(this.connectionConfig.loginName, this.connectionConfig.loginPassword);
      }
    }
    this.AppSettingsService.setConnectionConfig(this.connectionConfig);
  }

  requestDeviceAccessToken() {
    this.SignalkRequestsService.requestDeviceAccessToken();
  }

  deleteToken() {
    this.AppSettingsService.setSignalKToken({token: null, isNew: false, isSessionToken: false, isExpired: false});
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
    this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
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
