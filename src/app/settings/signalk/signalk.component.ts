import { ElementRef, Component, OnInit, OnDestroy, AfterViewInit, viewChild, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { AppService } from '../../core/services/app-service';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { IConnectionConfig } from "../../core/interfaces/app-settings.interfaces";
import { SignalKConnectionService, IEndpointStatus } from '../../core/services/signalk-connection.service';
import { IDeltaUpdate, DataService } from '../../core/services/data.service';
import { SignalKDeltaService, IStreamStatus } from '../../core/services/signalk-delta.service';
import { AuthenticationService, IAuthorizationToken } from '../../core/services/authentication.service';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { ConnectionStateMachine } from '../../core/services/connection-state-machine.service';
import { ModalUserCredentialComponent } from '../../core/components/modal-user-credential/modal-user-credential.component';
import { HttpErrorResponse } from '@angular/common/http';
import { compare } from 'compare-versions';
import { MatCheckbox } from '@angular/material/checkbox';
import { SlicePipe } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';



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
        SlicePipe
    ],
})

export class SettingsSignalkComponent implements OnInit, AfterViewInit, OnDestroy {
  dialog = inject(MatDialog);
  private appSettingsService = inject(AppSettingsService);
  protected appService = inject(AppService);
  private DataService = inject(DataService);
  private signalKConnectionService = inject(SignalKConnectionService);
  private signalkRequestsService = inject(SignalkRequestsService);
  private deltaService = inject(SignalKDeltaService);
  private connectionStateMachine = inject(ConnectionStateMachine);
  auth = inject(AuthenticationService);


  readonly lineGraph = viewChild<ElementRef<HTMLCanvasElement>>('lineGraph');

  connectionConfig: IConnectionConfig;
  isConnecting = false; // Loading state for connect button

  authTokenSub: Subscription;
  authToken: IAuthorizationToken;
  isLoggedInSub: Subscription;
  isLoggedIn: boolean;
  public proxyEnabled = false;

  endpointServiceStatus: IEndpointStatus;
  skEndpointServiceStatusSub: Subscription;
  streamStatus: IStreamStatus;
  skStreamStatusSub: Subscription;


  signalkDeltaUpdatesStatsSubscription: Subscription;

  lastSecondsUpdate: number; //number of updates from server in last second
  updatesSeconds: number[]  = [];

  _chart: Chart = null;
  textColor; // store the color of text for the graph...

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
  }

   ngAfterViewInit(): void {
    this.textColor = window.getComputedStyle(this.lineGraph().nativeElement).color;
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
    const dialogRef = this.dialog.open(ModalUserCredentialComponent, {
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

  public async connectToServer() {
    if (this.connectionConfig.useSharedConfig && (!this.connectionConfig.loginName || !this.connectionConfig.loginPassword)) {
      this.openUserCredentialModal("Credentials required");
      return;
    }

    // Start loading state
    this.isConnecting = true;

    try {
      console.log('[Settings-SignalK] Validating Signal K server before connecting...');

      // Step 1: Validate the URL before proceeding
      await this.signalKConnectionService.validateSignalKUrl(this.connectionConfig.signalKUrl);

      console.log('[Settings-SignalK] Validation successful - proceeding with connection');

      // Step 2: Save the new configuration to localStorage
      this.appSettingsService.setConnectionConfig(this.connectionConfig);

      // Step 3: Properly close WebSocket and HTTP connections
      this.connectionStateMachine.shutdown('Configuration changed - restarting app');

      // Step 4: Clean up authentication token if switching from shared to individual config
      if (this.authToken && !this.connectionConfig.useSharedConfig && !this.authToken.isDeviceAccessToken) {
        this.auth.deleteToken();
      }

      // Step 5: Reload immediately - APP_INITIALIZER will handle connection and authentication with new URL
      location.reload();

    } catch (error) {
      // Validation failed - show error and stay on current page
      this.isConnecting = false;
      const errorMessage = error.message || 'Unknown validation error';
      console.error('[Settings-SignalK] Server validation failed:', errorMessage);
      this.appService.sendSnackbarNotification(`Connection failed: ${errorMessage}`, 8000, false);
    }
  }

  private serverLogin(newUrl?: string) {
      this.auth.login({ usr: this.connectionConfig.loginName, pwd: this.connectionConfig.loginPassword, newUrl })
      .then( () => {
        // Authentication successful - reload to start with new config
        location.reload();
      })
      .catch((error: HttpErrorResponse) => {
        // Authentication failed - but we still need to reload since config was already saved
        // The retry mechanism will handle connection issues after reload
        console.log(`[Setting-SignalK Component] Authentication failed but reloading anyway: ${error.message}`);
        location.reload();
      });
  }

  public requestDeviceAccessToken() {
    this.signalkRequestsService.requestDeviceAccessToken();
  }

  public deleteToken() {
    this.auth.deleteToken();
  }

  private startChart() {
    this._chart = new Chart(this.lineGraph().nativeElement.getContext('2d'),{
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
                // eslint-disable-next-line no-useless-escape
                hour: `k:mm\''`,
                // eslint-disable-next-line no-useless-escape
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
      const version = this.signalKConnectionService.serverVersion$.getValue();
      if (!compare(version, '1.46.2', ">=")) {
        this.appService.sendSnackbarNotification("Configuration sharing requires Signal K version 1.46.2 or better",0);
        this.connectionConfig.useSharedConfig = false;
        return;
      }
      this.openUserCredentialModal(null);
    }
  };

  ngOnDestroy() {
    this.isConnecting = false; // Reset loading state
    this.skEndpointServiceStatusSub.unsubscribe();
    this.skStreamStatusSub.unsubscribe();
    this.authTokenSub.unsubscribe();
    this.isLoggedInSub.unsubscribe();
    this.signalkDeltaUpdatesStatsSubscription.unsubscribe();
    this._chart?.destroy();
  }
}
