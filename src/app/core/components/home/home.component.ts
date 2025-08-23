import { AsyncPipe } from '@angular/common';
import { AfterViewInit, Component, DestroyRef, ElementRef, inject, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { TileLargeIconComponent } from '../tile-large-icon/tile-large-icon.component';
import { MatDividerModule } from "@angular/material/divider";
import { Chart } from 'chart.js';
import { DataService, IDeltaUpdate } from '../../services/data.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { IStreamStatus, SignalKDeltaService } from '../../services/signalk-delta.service';
import { IEndpointStatus, SignalKConnectionService } from '../../services/signalk-connection.service';
import { AppService } from '../../services/app-service';

@Component({
  selector: 'home',
  imports: [ AsyncPipe, MatIconModule, MatButtonModule, TileLargeIconComponent, MatDividerModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements AfterViewInit {
  private readonly _router = inject(Router);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _connection = inject(SignalKConnectionService);
  protected readonly app = inject(AppService);
  private readonly _ds = inject(DataService);
  private readonly _deltaService = inject(SignalKDeltaService);
  protected readonly activityGraph = viewChild<ElementRef<HTMLCanvasElement>>('activityGraph');
  protected streamStatus: IStreamStatus;
  protected endpointServiceStatus: IEndpointStatus;
  private _chart: Chart = null;
  private textColor: string; // Store the computed text color for chart styling

  constructor() {
    // get Signal K connection status
    this._connection.getServiceEndpointStatusAsO().pipe(
      takeUntilDestroyed(this._destroyRef)
    ).subscribe((status: IEndpointStatus) => {
      this.endpointServiceStatus = status;
    });

    // get Delta Service WebSocket stream status
    this._deltaService.getDataStreamStatusAsO().pipe(
      takeUntilDestroyed(this._destroyRef)
    ).subscribe((status: IStreamStatus): void => {
      this.streamStatus = status;
    });
  }

  ngAfterViewInit(): void {
    this.textColor = window.getComputedStyle(this.activityGraph().nativeElement).color;
    this._chart?.destroy();
    this.startChart();

    // Get real-time WebSocket Delta update statistics for chart
    this._ds.getSignalkDeltaUpdateStatistics().pipe(
      takeUntilDestroyed(this._destroyRef)
    ).subscribe((update: IDeltaUpdate) => {
      this._chart.data.datasets[0].data.push({ x: update.timestamp, y: update.value });
      if (this._chart.data.datasets[0].data.length > 10) {
        this._chart.data.datasets[0].data.shift();
      }
      this._chart?.update("none");
    });
  }

  protected closePage() {
    this._router.navigate(['/dashboard']);
  }

  protected onActionItem(action: string): void {
    switch (action) {
      case 'help':
      this._router.navigate(['/help']);
        break;
      case 'datainspector':
        this._router.navigate(['/data']);
        break;
      case 'datasets':
        this._router.navigate(['/datasets']);
        break;
      case 'settings':
        this._router.navigate(['/settings']);
        break;
      default:
        break;
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
}
