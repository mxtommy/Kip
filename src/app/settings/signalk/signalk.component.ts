import { MatIconModule } from '@angular/material/icon';
import { ViewChild, ElementRef, Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { IConnectionConfig } from "../../core/interfaces/app-settings.interfaces";
import { SignalKConnectionService, IEndpointStatus } from '../../core/services/signalk-connection.service';
import { IDeltaUpdate, DataService } from '../../core/services/data.service';
import { SignalKDeltaService, IStreamStatus } from '../../core/services/signalk-delta.service';
import { AuthenticationService, IAuthorizationToken } from '../../core/services/authentication.service';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { ModalUserCredentialComponent } from '../../core/components/modal-user-credential/modal-user-credential.component';
import { HttpErrorResponse } from '@angular/common/http';
import { compare } from 'compare-versions';
import { MatCheckbox } from '@angular/material/checkbox';
import { NgIf, SlicePipe } from '@angular/common';
import { MatDivider } from '@angular/material/divider';
import { MatButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import ChartStreaming from '@robloche/chartjs-plugin-streaming';



@Component({
    selector: 'settings-signalk',
    templateUrl: './signalk.component.html',
    styleUrls: ['./signalk.component.scss'],
    standalone: true,
    imports: [
        FormsModule,
        MatFormField,
        MatLabel,
        MatInput,
        MatError,
        MatCheckbox,
        MatSlideToggle,
        MatTooltip,
        MatButton,
        MatDivider,
        SlicePipe,
        MatIconModule
    ],
})

export class SettingsSignalkComponent implements OnInit, OnDestroy {

  @ViewChild('lineGraph', {static: true}) lineGraph: ElementRef<HTMLCanvasElement>;

  connectionConfig: IConnectionConfig;

  authTokenSub: Subscription;
  authToken: IAuthorizationToken;
  isLoggedInSub: Subscription;
  isLoggedIn: boolean;
  public proxyEnabled: boolean = false;

  endpointServiceStatus: IEndpointStatus;
  skEndpointServiceStatusSub: Subscription;
  streamStatus: IStreamStatus;
  skStreamStatusSub: Subscription;


  signalkDeltaUpdatesStatsSubscription: Subscription;

  lastSecondsUpdate: number; //number of updates from server in last second
  updatesSeconds: number[]  = [];

  _chart: Chart = null;
  textColor; // store the color of text for the graph...

  // dynamics theme support
  themeNameSub: Subscription = null;

  constructor(
    public dialog: MatDialog,
    private appSettingsService: AppSettingsService,
    private appService: AppService,
    private DataService: DataService,
    private signalKConnectionService: SignalKConnectionService,
    private signalkRequestsService: SignalkRequestsService,
    private deltaService: SignalKDeltaService,
    public auth: AuthenticationService)
  {
    // Chart.register(ChartStreaming);
  }

  ngOnInit() {
    // init current value. IsLoggedInSub BehaviorSubject will send last value and component will trigger last notifications even if old
    if (this.auth.isLoggedIn$) {
      this.isLoggedIn = true;
    } else {
      this.isLoggedIn = false;
    }

    // get Signal K connection configuration
    this.connectionConfig = this.appSettingsService.getConnectionConfig();

    // get token status
    this.authTokenSub = this.auth.authToken$.subscribe((token: IAuthorizationToken) => {
      if (token) {
        this.authToken = token;
      } else {
        this.authToken = null;
      }
    });

    // get logged in status
    this.isLoggedInSub = this.auth.isLoggedIn$.subscribe(isLoggedIn => {
      this.isLoggedIn = isLoggedIn;
    });

    // get for Signal K connection status
    this.skEndpointServiceStatusSub = this.signalKConnectionService.getServiceEndpointStatusAsO().subscribe((status: IEndpointStatus) => {
          this.endpointServiceStatus = status;
    });

    // get Delta Service status
    this.skStreamStatusSub = this.deltaService.getDataStreamStatusAsO().subscribe((status: IStreamStatus): void => {
      this.streamStatus = status;
    });

    this.textColor = window.getComputedStyle(this.lineGraph.nativeElement).color;
    this._chart?.destroy();
    this.startChart();

    // Get WebSocket Delta update per seconds stats
    this.signalkDeltaUpdatesStatsSubscription = this.DataService.getSignalkDeltaUpdateStatistics().subscribe((update: IDeltaUpdate) => {
      this._chart.data.datasets[0].data.push({x: update.timestamp, y: update.value});
      if (this._chart.data.datasets[0].data.length > 60) {
        this._chart.data.datasets[0].data.shift();
      }
      this._chart?.update("none");
    });
  }

  public openUserCredentialModal(errorMsg: string) {
    let dialogRef = this.dialog.open(ModalUserCredentialComponent, {
      data: {
        user: this.connectionConfig.loginName,
        password: this.connectionConfig.loginPassword,
        error: errorMsg
      }
    });

    dialogRef.afterClosed().subscribe(data => {
      if (!data) {return} //clicked cancel
      this.connectionConfig.loginName = data.user;
      this.connectionConfig.loginPassword = data.password;
      this.connectToServer();
    });
  }

  public connectToServer() {
    if (this.connectionConfig.useSharedConfig && (!this.connectionConfig.loginName || !this.connectionConfig.loginPassword)) {
      this.openUserCredentialModal("Credentials required");
      return;
    }

    if ((this.connectionConfig.signalKUrl !== this.appSettingsService.signalkUrl.url) || (this.connectionConfig.proxyEnabled !== this.appSettingsService.proxyEnabled )) {
      this.appSettingsService.setConnectionConfig(this.connectionConfig);

      if (this.connectionConfig.useSharedConfig) {
        this.serverLogin(this.connectionConfig.signalKUrl);
      } else if ( this.authToken) {
        this.auth.deleteToken();
        location.reload();
      } else {
        location.reload();
      }

    } else {
      this.appSettingsService.setConnectionConfig(this.connectionConfig);
      // Same URL - no need to resetSignalK(). Just login, new token reset will reload WebSockets
      // and HTTP_INTERCEPTOR will intercept the new token automatically on all HTTP calls (except for WebSocket).
      if ((this.authToken && this.authToken.isDeviceAccessToken) && this.connectionConfig.useSharedConfig) {
        this.serverLogin(this.connectionConfig.signalKUrl);
      } else if ((this.authToken && !this.authToken.isDeviceAccessToken) && !this.connectionConfig.useSharedConfig) {
        this.deleteToken();
        location.reload();
      } else if (this.connectionConfig.useSharedConfig) {
        this.serverLogin(this.connectionConfig.signalKUrl);
      } else {
        location.reload();
      }
    }
  }

  private serverLogin(newUrl?: string) {
      this.auth.login({ usr: this.connectionConfig.loginName, pwd: this.connectionConfig.loginPassword, newUrl })
      .then( _ => {
        location.reload();
      })
      .catch((error: HttpErrorResponse) => {
        if (error.status == 401) {
          this.openUserCredentialModal("Sign in failed: Incorrect user/password. Enter valid credentials");
          console.log("[Setting-SignalK Component] Sign in failed: " + error.error.message);
        } else if (error.status == 404) {
          this.appService.sendSnackbarNotification("Sign in failed: Login API not found", 5000, false);
          console.log("[Setting-SignalK Component] Sign in failed: " + error.error.message);
        } else if (error.status == 0) {
          this.appService.sendSnackbarNotification("Sign in failed: Cannot reach server at Signal K URL", 5000, false);
          console.log("[Setting-SignalK Component] Sign in failed: Cannot reach server at Signal K URL:" + error.message);
        } else {
          this.appService.sendSnackbarNotification("Unknown authentication failure: " + JSON.stringify(error), 5000, false);
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
    this._chart = new Chart(this.lineGraph.nativeElement.getContext('2d'),{
      type: 'line',
      data: {
          datasets: [
            {
              data: [],
              fill: true,
              borderColor: this.textColor
            },
          ]
      },
      options: {
        maintainAspectRatio: false,
        animation: false,
        parsing: false,
        scales: {
          x: {
            type: "time",
            time: {
              unit: "minute",
              minUnit: "second",
              round: "second",
              displayFormats: {
                hour: `k:mm\''`,
                minute: `mm\''`,
                second: `mm ss"`,
                millisecond: "SSS"
              }
            },
            position: 'bottom',
            ticks: {
              display: false,
              major: {
                enabled: true
              },
              autoSkip: false
            },
            title: {
              text: "1 Minute",
              display: true
            },
            grid: {
              display: false
            }
          },
          y: {
            beginAtZero: true,
            type: 'linear',
            position: 'right',
            title: {
              text: "Delta / Sec",
              display: true
            }
          }
        },
        plugins:{
          legend: {
            display: false,
            labels: {
              color: this.textColor,
            }
          },
          // streaming: {
          //   duration: 60000,
          //   delay: 1000,
          //   frameRate: 15,
          //  }
        }
      }
    });
  }

  public useSharedConfigToggleClick(e) {
    if(e.checked) {
      let version = this.signalKConnectionService.serverVersion$.getValue();
      if (!compare(version, '1.46.2', ">=")) {
        this.appService.sendSnackbarNotification("Configuration sharing requires Signal K version 1.46.2 or better",0);
        this.connectionConfig.useSharedConfig = false;
        return;
      }
      this.openUserCredentialModal(null);
    }
  };

  ngOnDestroy() {
    this.skEndpointServiceStatusSub.unsubscribe();
    this.skStreamStatusSub.unsubscribe();
    this.authTokenSub.unsubscribe();
    this.isLoggedInSub.unsubscribe();
    this.signalkDeltaUpdatesStatsSubscription.unsubscribe();
    this._chart?.destroy();
  }
}
