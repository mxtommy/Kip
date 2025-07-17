import {AfterViewInit, Component, DestroyRef, effect, ElementRef, inject, OnDestroy, OnInit, untracked, viewChild} from '@angular/core';
import {BaseWidgetComponent} from '../../core/utils/base-widget.component';
import {States} from '../../core/interfaces/signalk-interfaces';
import {WidgetHostComponent} from '../../core/components/widget-host/widget-host.component';
import {IWidgetSvcConfig} from '../../core/interfaces/widgets-interface';
import {NgxResizeObserverModule} from 'ngx-resize-observer';
import {CanvasService} from '../../core/services/canvas.service';
import {SignalkRequestsService} from '../../core/services/signalk-requests.service';
import {WidgetTitleComponent} from '../../core/components/widget-title/widget-title.component';
import {MatButton} from '@angular/material/button';
import {FormsModule} from '@angular/forms';
import {DashboardService} from '../../core/services/dashboard.service';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

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
  protected startAtValue: string;
  protected startAtFontSize: string = '1em';
  private canvasService = inject(CanvasService);
  private ttsValue: number = null;
  private dtsValue: number = null;
  protected labelColor: string = undefined;
  private valueColor: string = undefined;
  private valueStateColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;

  private flashInterval = null;
  private isDestroyed = false; // guard against callbacks after destroyed
  protected mode = 1;

  protected timeToSContext: CanvasRenderingContext2D;
  protected timeToSElement: HTMLCanvasElement;
  private readonly destroyRef = inject(DestroyRef);
  protected startAtTime = 'HH:MM:SS';
  protected startAtTimeEdit = this.startAtTime;

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'TTS',
      nextDashboard: 1,
      playBeeps: true,
      filterSelfPaths: true,
      paths: {
        'ttsPath': {
          description: 'Time to the Start in seconds',
          path: 'self.navigation.racing.timeToStart',
          source: null,
          pathType: 'number',
          pathRequired: true,
          isPathConfigurable: false,
          convertUnitTo: 's',
          showConvertUnitTo: false,
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 's',
          sampleTime: 500
        },
        'startTimePath': {
          description: 'Time of the start',
          path: 'self.navigation.racing.startTime',
          source: null,
          pathType: 'Date',
          pathRequired: false,
          isPathConfigurable: false,
          sampleTime: 500
        },
        'dtsPath': {
          description: 'Distance to Start Line path, used to determine OCS',
          path: 'self.navigation.racing.distanceStartline',
          source: null,
          pathType: 'number',
          pathRequired: false,
          isPathConfigurable: false,
          convertUnitTo: 'm',
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'm',
          sampleTime: 500
        },
      },
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: true
    };

    effect(() => {
      if (this.theme()) {
        untracked(() => {
          this.getColors(this.widgetProperties.config.color);
          this.updateCanvas();
        });
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.initCanvases();
    if (this.isDestroyed) {
      return;
    }
    this.startWidget();
    this.updateCanvas();
    console.log('ngAfterViewInit!');
  }

  private initCanvases() {
    this.timeToSElement = this.timeToSCanvas().nativeElement;
    this.canvasService.setHighDPISize(this.timeToSElement, this.timeToSElement.parentElement.getBoundingClientRect());
    this.timeToSContext = this.timeToSElement.getContext('2d');
    this.maxValueTextWidth = Math.floor(this.timeToSElement.width * 0.95);
    this.maxValueTextHeight = Math.floor(this.timeToSElement.height * 0.95);
  }

  protected beep(frequency = 440, duration = 100) {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency; // Hz
    gainNode.gain.value = 0.1; // volume

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration / 1000);
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.ttsValue = null;
    this.dtsValue = null;
    this.getColors(this.widgetProperties.config.color);
    this.observeDataStream('ttsPath', newValue => {
      const lastTtsValue = this.ttsValue;
      this.ttsValue = newValue.data.value;
      if (this.widgetProperties.config.ignoreZones) {
        if (!this.ttsValue) {
          this.valueStateColor = this.valueColor;
        } else if (this.ttsValue === 0) {
          this.valueStateColor = this.valueColor;
        } else if (this.ttsValue < 10) {
          this.valueStateColor = this.dtsValue < 0 ? this.theme().zoneAlarm : this.theme().zoneWarn;
        } else if (this.ttsValue < 60) {
          this.valueStateColor = this.theme().zoneAlert;
        } else {
          this.valueStateColor = this.valueColor;
        }
      } else {
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
        this.mode = 2;
        if (this.dtsValue < 0) {
          this.valueStateColor = this.theme().zoneAlarm;
        }
      } else if (this.mode === 1 && this.isStartTimerRunning()) {
        this.mode = 2;
      }
      this.updateCanvas();
      if (this.widgetProperties.config.playBeeps && this.startAtTime !== null && this.startAtTime !== 'HH:MM:SS' && lastTtsValue !== 0) {
        if (this.ttsValue === 0) {
          this.beep(500, 1000);
        } else if (this.ttsValue < 10) {
          this.beep(450, 100);
        } else if (this.ttsValue < 60 && this.ttsValue % 10 === 0) {
          this.beep(400, 150);
        } else if (this.ttsValue % 60 === 0) {
          this.beep(350, 200);
        }
      }
      if (this.widgetProperties.config.nextDashboard >= 0 &&
        lastTtsValue === 1 && this.ttsValue === 0 && (!this.dtsValue || this.dtsValue >= 0)) {
        console.log('next dashboard ', this.widgetProperties.config.nextDashboard);
        this.dashboard.setActiveDashboard(this.widgetProperties.config.nextDashboard);
      }
    });

    this.observeDataStream('startTimePath', newValue => {
      if (!newValue.data.value) {
        this.startAtTime = this.startAtTimeEdit = 'HH:MM:SS';
        if (this.mode === 2) {
          this.mode = 1;
        }
      } else {
        const isoTime = new Date(newValue.data.value);
        this.startAtTime = this.startAtTimeEdit = isoTime.toLocaleTimeString([], {
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

    this.signalk.subscribeRequest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(requestResult => {
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

    this.startAtFontSize = Math.floor(e.contentRect.width * 0.05) + 'px';

    this.initCanvases();
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
      return `${mm.toString().padStart(1, '0')}:${ss.toString().padStart(2, '0')}`;
    }
  }

  private drawStartAt(): void {
    if (this.widgetProperties.config.paths['startTimePath'].path !== '') {
      this.startAtValue = this.startAtTime != null
        ? `Start at: ${this.startAtTime}`
        : 'Start at: HH:MM:SS';
    }
  }

  public toggleMode(): void {
    console.log('toggle mode ', this.mode);
    this.mode = (this.mode + 1) % 5;
    switch (this.mode) {
      case 1:
        if (this.isStartTimerRunning()) {
          this.mode = 2;
        }
        break;
      case 2:
        if (this.ttsValue !== 0 && !this.isStartTimerRunning()) {
          this.mode = 3;
        }
        break;
      default:
    }
    this.updateCanvas();
  }

  public sendStartTimerCommand(command: string): string {
    const requestId = this.signalk.putRequest('navigation.racing.setStartTime', {command}, this.widgetProperties.uuid);
    console.log('Start Timer Command ', command, ' ', requestId);
    switch (command) {
      case 'start':
        this.mode = 0;
        break;
      case 'reset':
        this.startAtTime = 'HH:MM:SS';
        this.mode = 1;
        break;
      default:
    }
    return requestId;
  }

  public adjustStartTime(delta: number): string {
    const requestId = this.signalk.putRequest('navigation.racing.setStartTime', {command: 'adjust', delta}, this.widgetProperties.uuid);
    console.log('Adjust Timer: delta=', delta, ' ', requestId);
    return requestId;
  }

  public setStartTime(startAtTime: string): void {
    const now = new Date();
    const parts = startAtTime.split(':').map(Number);
    const hours = parts[0];
    const minutes = parts[1];
    const seconds = parts.length >= 3 ? parts[2] : 0;
    const date = new Date(now); // clone the current date
    date.setHours(hours, minutes, seconds, 0);
    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }
    this.mode = 0;

    const requestId = this.signalk.putRequest(
      'navigation.racing.setStartTime',
      {command: 'set', startTime: date.toISOString()},
      this.widgetProperties.uuid
    );

    console.log('Set Timer: startAtTime=', startAtTime, ' →', date.toISOString(), 'requestId=', requestId);
  }
}
