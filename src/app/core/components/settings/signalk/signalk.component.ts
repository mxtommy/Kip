import { ElementRef, Component, OnInit, OnDestroy, AfterViewInit, viewChild, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppService } from '../../../services/app-service';
import { AppSettingsService } from '../../../services/app-settings.service';
import { IConnectionConfig } from "../../../interfaces/app-settings.interfaces";
import { SignalKConnectionService, IEndpointStatus } from '../../../services/signalk-connection.service';
import { IDeltaUpdate, DataService } from '../../../services/data.service';
import { SignalKDeltaService, IStreamStatus } from '../../../services/signalk-delta.service';
import { AuthenticationService, IAuthorizationToken } from '../../../services/authentication.service';
import { ConnectionStateMachine } from '../../../services/connection-state-machine.service';
import { ModalUserCredentialComponent } from '../../../components/modal-user-credential/modal-user-credential.component';
import { compare } from 'compare-versions';
import { MatCheckbox } from '@angular/material/checkbox';
import { MatButton } from '@angular/material/button';
import { MatTooltip } from '@angular/material/tooltip';
import { MatSlideToggle, MatSlideToggleChange } from '@angular/material/slide-toggle';
import { MatInput } from '@angular/material/input';
import { MatFormField, MatLabel, MatError } from '@angular/material/form-field';
import { FormsModule } from '@angular/forms';
import { MatDialog } from '@angular/material/dialog';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { CanvasService } from '../../../services/canvas.service';



/**
 * Signal K settings component for managing server connection configuration.
 * Handles URL validation, authentication, connection establishment, and
 * real-time monitoring of connection status and data stream statistics.
 */
@Component({
  selector: 'settings-signalk',
  templateUrl: './signalk.component.html',
  styleUrls: ['./signalk.component.scss'],
  imports: [
    FormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatCheckbox,
    MatSlideToggle,
    MatTooltip,
    MatButton
  ]
})

export class SettingsSignalkComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly dialog = inject(MatDialog);
  private readonly appSettingsService = inject(AppSettingsService);
  protected readonly app = inject(AppService);
  private readonly DataService = inject(DataService);
  private readonly signalKConnectionService = inject(SignalKConnectionService);
  private readonly deltaService = inject(SignalKDeltaService);
  private readonly connectionStateMachine = inject(ConnectionStateMachine);
  protected readonly auth = inject(AuthenticationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly canvasService = inject(CanvasService);


  protected readonly activityGraph = viewChild<ElementRef<HTMLCanvasElement>>('activityGraph');

  public connectionConfig: IConnectionConfig;
  public isConnecting = false; // Loading state for connect button

  public authToken: IAuthorizationToken;

  public endpointServiceStatus: IEndpointStatus;
  public streamStatus: IStreamStatus;


  private _chart: Chart = null;
  private textColor: string; // Store the computed text color for chart styling

  ngOnInit() {
    // get Signal K connection configuration
    this.connectionConfig = this.appSettingsService.getConnectionConfig();

    // get authentication token status
    this.auth.authToken$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((token: IAuthorizationToken) => {
      if (token) {
        this.authToken = token;
      } else {
        this.authToken = null;
      }
    });

    // get Signal K connection status
    this.signalKConnectionService.getServiceEndpointStatusAsO().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((status: IEndpointStatus) => {
      this.endpointServiceStatus = status;
    });

    // get Delta Service WebSocket stream status
    this.deltaService.getDataStreamStatusAsO().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((status: IStreamStatus): void => {
      this.streamStatus = status;
    });
  }

  ngAfterViewInit(): void {
    this.textColor = window.getComputedStyle(this.activityGraph().nativeElement).color;
    this._chart?.destroy();
    this.startChart();

    // Get real-time WebSocket Delta update statistics for chart
    this.DataService.getSignalkDeltaUpdateStatistics().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((update: IDeltaUpdate) => {
      this._chart.data.datasets[0].data.push({ x: update.timestamp, y: update.value });
      if (this._chart.data.datasets[0].data.length > 10) {
        this._chart.data.datasets[0].data.shift();
      }
      this._chart?.update("none");
    });
  }

  /**
   * Opens the user credential modal dialog for authentication.
   * @param errorMsg Optional error message to display in the modal
   */
  public openUserCredentialModal(errorMsg: string) {
    const dialogRef = this.dialog.open(ModalUserCredentialComponent, {
      data: {
        user: this.connectionConfig.loginName,
        password: this.connectionConfig.loginPassword,
        error: errorMsg
      }
    });

    dialogRef.afterClosed().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(data => {
      if (!data) { return } // User clicked cancel
      this.connectionConfig.loginName = data.user;
      this.connectionConfig.loginPassword = data.password;
      this.connectToServer();
    });
  }

  /**
   * Validates the Signal K server URL and establishes connection.
   * Handles the complete connection workflow including validation,
   * configuration saving, connection cleanup, and app reload.
   */
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
      // Skip during unit tests to avoid breaking Karma connection
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(window as any).__KIP_TEST__) {
        location.reload();
      }

    } catch (error: unknown) {
      // Validation failed - show error and stay on current page
      this.isConnecting = false;
      const errorMessage = (error as Error)?.message || 'Unknown validation error';
      console.error('[Settings-SignalK] Server validation failed:', errorMessage);
      this.app.sendSnackbarNotification(`Connection failed: ${errorMessage}`, 8000, false);
    }
  }

  /**
   * Initializes the Chart.js line chart for displaying WebSocket delta statistics.
   * Creates a time-series chart showing data update frequency over time.
   */
  private startChart() {
    this._chart = new Chart(this.activityGraph().nativeElement.getContext('2d'), {
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
            display: true,
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
            },
            grid: {
              display: true
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
        plugins: {
          legend: {
            display: false,
            labels: {
              color: this.textColor,
            }
          }
        }
      }
    });
  }

  /**
   * Handles the shared configuration toggle change event.
   * Validates Signal K server version compatibility and opens credential modal.
   */
  public useSharedConfigToggleClick(e: MatSlideToggleChange): void {
    if (e.checked) {
      const version: string = this.signalKConnectionService.serverVersion$.getValue();
      if (!compare(version, '1.46.2', ">=")) {
        this.app.sendSnackbarNotification("Configuration sharing requires Signal K version 1.46.2 or better", 0);
        this.connectionConfig.useSharedConfig = false;
        return;
      }
      this.openUserCredentialModal(null);
    }
  };

  ngOnDestroy() {
    this._chart?.destroy();
    const canvas = this.activityGraph?.()?.nativeElement as HTMLCanvasElement | undefined;
    this.canvasService.releaseCanvas(canvas, { clear: true, removeFromDom: true });
  }
}
