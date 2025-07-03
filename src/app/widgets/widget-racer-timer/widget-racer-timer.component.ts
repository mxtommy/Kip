import {AfterViewInit, Component, effect, ElementRef, inject, OnDestroy, OnInit, viewChild} from '@angular/core';
import {BaseWidgetComponent} from '../../core/utils/base-widget.component';
import {States} from '../../core/interfaces/signalk-interfaces';
import {WidgetHostComponent} from '../../core/components/widget-host/widget-host.component';
import {IWidgetSvcConfig} from '../../core/interfaces/widgets-interface';
import {NgxResizeObserverModule} from 'ngx-resize-observer';
import {CanvasService} from '../../core/services/canvas.service';
import {SignalkRequestsService} from '../../core/services/signalk-requests.service';
import {WidgetTitleComponent} from '../../core/components/widget-title/widget-title.component';
import {MatButton} from '@angular/material/button';
import {Subscription} from 'rxjs';
import {FormsModule} from '@angular/forms';
import {DashboardService} from '../../core/services/dashboard.service';

@Component({
  selector: 'widget-racer-timer',
  templateUrl: './widget-racer-timer.component.html',
  styleUrls: ['./widget-racer-timer.component.scss'],
  standalone: true,
  imports: [WidgetHostComponent, NgxResizeObserverModule, WidgetTitleComponent, MatButton, FormsModule]
})
export class WidgetRacerTimerComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private signalk = inject(SignalkRequestsService);
  protected dashboard = inject(DashboardService);
  private timeToSCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('timeToSCanvas');
  private startAtCanvas = viewChild.required<ElementRef<HTMLCanvasElement>>('startAtCanvas');
  private canvasService = inject(CanvasService);
  private ttsValue: number = null;
  private dtsValue: number = null;
  protected labelColor: string = undefined;
  private valueColor: string = undefined;
  private valueStateColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;
  private maxStartAtTextWidth = 0;
  private maxStartAtTextHeight = 0;

  private flashInterval = null;
  private isDestroyed = false; // guard against callbacks after destroyed
  protected mode = 0;

  protected timeToSContext: CanvasRenderingContext2D;
  protected timeToSElement: HTMLCanvasElement;
  protected startAtContext: CanvasRenderingContext2D;
  protected startAtElement: HTMLCanvasElement;
  private skRequestSubscription: Subscription;
  protected startAtTime = 'HH:MM:SS';

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'TTS',
      nextDashboard: 2,
      filterSelfPaths: true,
      paths: {
        'ttsPath': {
          description: 'Time to Start path',
          path: 'self.navigation.racing.timeToStart',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: 's',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        },
        'startTimePath': {
          description: 'Time of the start',
          path: 'self.navigation.racing.startTime',
          source: 'default',
          pathType: 'string',
          isPathConfigurable: true,
          convertUnitTo: '',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 1000
        },
        'dtsPath': {
          description: 'Distance to Start Line path, used to determine OCS',
          path: 'self.navigation.racing.distanceStartline',
          source: 'default',
          pathType: 'number',
          isPathConfigurable: true,
          convertUnitTo: 'm',
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        },
      },
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    };

    effect(() => {
      if (this.theme()) {
        this.getColors(this.widgetProperties.config.color);
        this.updateCanvas();
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.timeToSElement = this.timeToSCanvas().nativeElement;
    this.startAtElement = this.startAtCanvas().nativeElement;
    this.canvasService.setHighDPISize(this.timeToSElement, this.timeToSElement.parentElement.getBoundingClientRect());
    this.canvasService.setHighDPISize(this.startAtElement, this.startAtElement.parentElement.getBoundingClientRect());
    this.timeToSContext = this.timeToSElement.getContext('2d');
    this.startAtContext = this.startAtElement.getContext('2d');

    this.maxValueTextWidth = Math.floor(this.timeToSElement.width * 0.85);
    this.maxValueTextHeight = Math.floor(this.timeToSElement.height * 0.70);
    this.maxStartAtTextWidth = Math.floor(this.startAtElement.width * 0.57);
    this.maxStartAtTextHeight = Math.floor(this.startAtElement.height * 0.1);
    if (this.isDestroyed) {
      return;
    }
    this.startWidget();
    this.updateCanvas();
    console.log('ngAfterViewInit!');
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.ttsValue = null;
    this.dtsValue = null;
    this.getColors(this.widgetProperties.config.color);
    this.observeDataStream('ttsPath', newValue => {
      this.ttsValue = newValue.data.value;
      if (!this.widgetProperties.config.ignoreZones) {
        switch (newValue.state) {
          case States.Alarm:
            this.valueStateColor = this.theme().zoneAlarm;
            break;
          case States.Warn:
            this.valueStateColor = this.theme().zoneWarn;
            break;
          case States.Alert:
            this.valueStateColor = this.theme().zoneAlert;
            break;
          default:
            this.valueStateColor = this.valueColor;
            break;
        }
      }
      if (this.ttsValue === 0) {
        this.mode = 1;
        if (this.widgetProperties.config.nextDashboard >= 0 && (!this.dtsValue || this.dtsValue >= 0)) {
          this.dashboard.navigateTo(this.widgetProperties.config.nextDashboard);
          return;
        }
      } else if (this.mode === 0 && this.isStartTimerRunning()) {
        this.mode = 1;
      }
      this.updateCanvas();
    });

    this.observeDataStream('startTimePath', newValue => {
      if (!newValue.data.value) {
        this.startAtTime = 'HH:MM:SS';
        if (this.mode === 1) {
          this.mode = 0;
        }
      } else {
        const isoTime = new Date(newValue.data.value);
        this.startAtTime = isoTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        });
      }
      this.updateCanvas();
    });

    this.observeDataStream('dtsPath', newValue => {
      this.dtsValue = newValue.data.value;
    });

    this.skRequestSubscription = this.signalk.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID === this.widgetProperties.uuid) {
        console.log('RESULT RECEIVED: ', JSON.stringify(requestResult));
      }
    });
  }

  private isStartTimerRunning(): boolean {
    return this.ttsValue > 0 && this.startAtTime !== null && this.startAtTime !== 'HH:MM:SS';
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.updateCanvas();
  }

  protected onResized(e: ResizeObserverEntry) {
    console.log('resize widget');
    if ((e.contentRect.height < 25) || (e.contentRect.width < 25)) {
      return;
    }

    this.canvasService.setHighDPISize(this.timeToSElement, e.contentRect);
    this.canvasService.setHighDPISize(this.startAtElement, e.contentRect);

    this.maxValueTextWidth = Math.floor(this.timeToSElement.width * 0.85);
    this.maxValueTextHeight = Math.floor(this.timeToSElement.height * 0.70);
    this.maxStartAtTextWidth = Math.floor(this.timeToSElement.width * 0.57);
    this.maxStartAtTextHeight = Math.floor(this.timeToSElement.height * 0.1);

    if (this.isDestroyed) {
      return;
    }
    this.updateCanvas();
  }

  private getColors(color: string): void {
    switch (color) {
      case 'contrast':
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
      case 'blue':
        this.labelColor = this.theme().blueDim;
        this.valueColor = this.theme().blue;
        break;
      case 'green':
        this.labelColor = this.theme().greenDim;
        this.valueColor = this.theme().green;
        break;
      case 'pink':
        this.labelColor = this.theme().pinkDim;
        this.valueColor = this.theme().pink;
        break;
      case 'orange':
        this.labelColor = this.theme().orangeDim;
        this.valueColor = this.theme().orange;
        break;
      case 'purple':
        this.labelColor = this.theme().purpleDim;
        this.valueColor = this.theme().purple;
        break;
      case 'grey':
        this.labelColor = this.theme().greyDim;
        this.valueColor = this.theme().grey;
        break;
      case 'yellow':
        this.labelColor = this.theme().yellowDim;
        this.valueColor = this.theme().yellow;
        break;
      default:
        this.labelColor = this.theme().contrastDim;
        this.valueColor = this.theme().contrast;
        break;
    }
    this.valueStateColor = this.valueColor;
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
    this.canvasService.clearCanvas(this.timeToSContext,
      this.timeToSElement.width,
      this.timeToSElement.height);

    if (this.skRequestSubscription !== null) {
      this.skRequestSubscription.unsubscribe();
      this.skRequestSubscription = null;
    }
  }

  private updateCanvas(): void {
      this.drawTimeToStart();
      this.drawStartAt();
  }

  private drawTimeToStart(): void {
    if (this.timeToSContext) {
      this.canvasService.clearCanvas(this.timeToSContext,
        this.timeToSElement.width,
        this.timeToSElement.height);
      const valueText = this.getValueText();
      this.canvasService.drawText(
        this.timeToSContext,
        valueText,
        Math.floor(this.timeToSElement.width / 2),
        Math.floor((this.timeToSElement.height / 2) * 1.15),
        this.maxValueTextWidth,
        this.maxValueTextHeight,
        'bold',
        this.valueStateColor
      );
    }
  }

  private getValueText(): string {
    if (this.ttsValue === null) {
      return '--';
    }

    const seconds = this.ttsValue;
    const minutes = Math.floor(seconds / 60);
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mm = Math.floor(minutes % 60);
      const ss = Math.floor(seconds % 60);
      return `${hours.toString()}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    } else {
      const mm = Math.floor(minutes % 60);
      const ss = Math.floor(seconds % 60);
      return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
    }
  }

  private drawStartAt(): void {
    if (this.startAtContext) {
      this.canvasService.clearCanvas(this.startAtContext,
        this.startAtElement.width,
        this.startAtElement.height);

      const valueText = this.startAtTime != null
        ? ` Start at: ${this.startAtTime}`
        : ' Start at: HH:MM:SS';

      this.canvasService.drawText(
        this.startAtContext,
        valueText,
        10 * this.canvasService.scaleFactor,
        Math.floor(this.startAtElement.height - 10 * this.canvasService.scaleFactor),
        this.maxStartAtTextWidth,
        this.maxStartAtTextHeight,
        'normal',
        this.valueColor,
        'start',
        'alphabetic'
      );
    }
  }

  toggleMode() {
    console.log('toggle mode ', this.mode);
    this.mode = (this.mode + 1) % 4;
    switch (this.mode) {
      case 0:
        if (this.isStartTimerRunning()) {
          this.mode = 1;
        }
        break;
      case 1:
        if (this.ttsValue !== 0 && !this.isStartTimerRunning()) {
          this.mode = 2;
        }
        break;
      default:
    }
    this.updateCanvas();
  }

  sendStartTimerCommand(command) {
    const requestId = this.signalk.putRequest('navigation.racing.setStartTime', {command}, this.widgetProperties.uuid);
    console.log('Start Timer Command ', command, ' ', requestId);
    switch (command) {
      case 'start':
        this.mode = 1;
        break;
      case 'reset':
        this.startAtTime = 'HH:MM:SS';
        this.mode = 0;
        break;
      default:
    }
    return requestId;
  }

  adjustStartTime(delta: number) {
    const requestId = this.signalk.putRequest('navigation.racing.setStartTime', {command: 'adjust', delta}, this.widgetProperties.uuid);
    console.log('Adjust Timer: delta=', delta, ' ', requestId);
    return requestId;
  }

  setStartTime(startAtTime: string) {
    const now = new Date();
    const [hours, minutes, seconds] = startAtTime.split(':').map(Number);

    const date = new Date(now); // clone the current date
    date.setHours(hours, minutes, seconds, 0);

    // If the scheduled time is in the past, move it to the next day
    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }

    const requestId = this.signalk.putRequest(
      'navigation.racing.setStartTime',
      { command: 'set', startTime: date.toISOString() },
      this.widgetProperties.uuid
    );

    console.log('Set Timer: startAtTime=', startAtTime, ' →', date.toISOString(), 'requestId=', requestId);
  }
}
