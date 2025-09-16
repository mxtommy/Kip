import { MatIconModule } from '@angular/material/icon';
import { AfterViewInit, Component, DestroyRef, effect, ElementRef, inject, model, OnDestroy, OnInit, signal, untracked, viewChild } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { States } from '../../core/interfaces/signalk-interfaces';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { CanvasService } from '../../core/services/canvas.service';
import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { MatButtonModule } from '@angular/material/button';
import { DashboardService } from '../../core/services/dashboard.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { getColors } from '../../core/utils/themeColors.utils';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'widget-racer-timer',
  templateUrl: './widget-racer-timer.component.html',
  styleUrls: ['./widget-racer-timer.component.scss'],
  imports: [WidgetHostComponent, NgxResizeObserverModule, MatButtonModule, MatIconModule, FormsModule]
})
export class WidgetRacerTimerComponent extends BaseWidgetComponent implements AfterViewInit, OnInit, OnDestroy {
  private readonly signalk = inject(SignalkRequestsService);
  private readonly router = inject(Router);
  protected readonly dashboard = inject(DashboardService);
  private readonly canvas = inject(CanvasService);
  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private titleBitmap: HTMLCanvasElement | null = null;
  private titleBitmapText: string | null = null;
  private ttsValue: number = null;
  private dtsValue: number = null;
  protected labelColor = signal<string>(undefined);
  private valueColor: string = undefined;
  private valueStateColor: string = undefined;
  private maxValueTextWidth = 0;
  private maxValueTextHeight = 0;

  private flashInterval = null;
  private isDestroyed = false; // guard against callbacks after destroyed
  protected mode = signal<number>(1);

  private readonly destroyRef = inject(DestroyRef);
  protected startAtTime = signal<string>('00:00:00');
  protected startAtTimeEdit = model<string>('');

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'TTS',
      nextDashboard: 0,
      playBeeps: true,
      filterSelfPaths: true,
      paths: {
        'ttsPath': {
          description: 'Time to the Start in seconds',
          path: 'self.navigation.racing.timeToStart',
          source: 'default',
          pathType: 'number',
          pathRequired: false,
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
          source: 'default',
          pathType: 'Date',
          pathRequired: false,
          isPathConfigurable: false,
          sampleTime: 500
        },
        'dtsPath': {
          description: 'Distance to Start Line path, used to determine OCS',
          path: 'self.navigation.racing.distanceStartline',
          source: 'default',
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
          this.labelColor.set(getColors(this.widgetProperties.config.color, this.theme()).dim);
          this.valueColor = getColors(this.widgetProperties.config.color, this.theme()).color;
          this.drawWidget();
        });
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
  }

  ngAfterViewInit(): void {
    this.canvasElement = this.canvasMainRef().nativeElement;
    this.canvasCtx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w;
        this.cssHeight = h;
        this.maxValueTextWidth = Math.floor(this.cssWidth * 0.95);
        this.maxValueTextHeight = Math.floor(this.cssHeight * 0.95);
        this.drawWidget();
      },
    });
    if (this.isDestroyed) return;
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.maxValueTextWidth = Math.floor(this.cssWidth * 0.95);
    this.maxValueTextHeight = Math.floor(this.cssHeight * 0.95);
    this.startWidget();
    this.drawWidget();
  }

  protected beep(frequency = 440, duration = 100) {
    if (this.widgetProperties.config.playBeeps) {
      const audioCtx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
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
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.ttsValue = null;
    this.dtsValue = null;
    this.labelColor.set(getColors(this.widgetProperties.config.color, this.theme()).dim);
    this.valueColor = getColors(this.widgetProperties.config.color, this.theme()).color;
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
        this.mode.set(2);
        if (this.dtsValue < 0) {
          this.valueStateColor = this.theme().zoneAlarm;
        }
      } else if (this.mode() === 1 && this.isStartTimerRunning()) {
        this.mode.set(2);
      }
      this.drawWidget();
      if (this.startAtTime() !== null && this.startAtTime() !== 'HH:MM:SS' && lastTtsValue !== 0) {
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
        this.router.navigate(['/dashboard', this.widgetProperties.config.nextDashboard]);
      }
    });

    this.observeDataStream('startTimePath', newValue => {
      if (!newValue.data.value) {
        this.startAtTime.set('HH:MM:SS');
        this.startAtTimeEdit.set('HH:MM:SS');
        if (this.mode() === 2) {
          this.mode.set(1);
        }
      } else {
        const isoTime = new Date(newValue.data.value);
        this.startAtTimeEdit.set(isoTime.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit'
        }));
        this.startAtTime.set(this.startAtTimeEdit());
      }
      this.drawWidget();
    });

    this.observeDataStream('dtsPath', newValue => {
      this.dtsValue = newValue.data.value;
    });

    this.signalk.subscribeRequest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe(requestResult => {
      if (requestResult.widgetUUID === this.widgetProperties.uuid) {
        if (requestResult.statusCode === 200) {
          this.beep(600, 20);
        } else {
          this.app.sendSnackbarNotification(`Please check the Signalk-racer plugin installation/configuration. Error: ${requestResult.message}`, 0, false);
        }
      }
    });
  }

  private isStartTimerRunning(): boolean {
    return this.ttsValue > 0 && this.startAtTime() !== null && this.startAtTime() !== 'HH:MM:SS';
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.drawWidget();
  }

  ngOnDestroy() {
    this.isDestroyed = true;
    this.destroyDataStreams();
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
    try { this.canvas.unregisterCanvas(this.canvasElement); }
    catch { /* ignore */ }
  }

  private drawWidget(): void {
    if (!this.canvasCtx) return;

    if (!this.titleBitmap ||
      this.titleBitmap.width !== this.canvasElement.width ||
      this.titleBitmap.height !== this.canvasElement.height ||
      this.titleBitmapText !== this.widgetProperties.config.displayName
    ) {
      this.titleBitmap = this.canvas.createTitleBitmap(
        this.widgetProperties.config.displayName,
        this.labelColor(),
        'normal',
        this.cssWidth,
        this.cssHeight
      );
      this.titleBitmapText = this.widgetProperties.config.displayName;
    }

    this.canvas.clearCanvas(this.canvasCtx, this.cssWidth, this.cssHeight);

    if (this.titleBitmap && this.titleBitmap.width > 0 && this.titleBitmap.height > 0) {
      this.canvasCtx.drawImage(this.titleBitmap, 0, 0, this.cssWidth, this.cssHeight);
    }

    const valueText = this.getValueText();
    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      Math.floor(this.cssWidth / 2),
      Math.floor((this.cssHeight / 2) * 1.3),
      this.maxValueTextWidth,
      this.maxValueTextHeight,
      'bold',
      this.valueStateColor
    );
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

  public toggleMode(): void {
    this.mode.update(val => (val + 1) % 5);

    switch (this.mode()) {
      case 1:
        if (this.isStartTimerRunning()) {
          this.mode.set(2);
        }
        break;
      case 2:
        if (this.ttsValue !== 0 && !this.isStartTimerRunning()) {
          this.mode.set(3);
        }
        break;
      default:
    }
    this.drawWidget();
  }

  public sendStartTimerCommand(command: string): string {
    const requestId = this.signalk.putRequest('navigation.racing.setStartTime', { command }, this.widgetProperties.uuid);
    switch (command) {
      case 'start':
        this.mode.set(0);
        break;
      case 'reset':
        this.startAtTime.set('HH:MM:SS');
        this.mode.set(1);
        break;
      default:
    }
    return requestId;
  }

  public adjustStartTime(delta: number): string {
    const requestId = this.signalk.putRequest('navigation.racing.setStartTime', { command: 'adjust', delta }, this.widgetProperties.uuid);
    return requestId;
  }

  public setStartTime(): void {
    const now = new Date();
    const parts = this.startAtTimeEdit().split(':').map(Number);
    const hours = parts[0];
    const minutes = parts[1];
    const seconds = parts.length >= 3 ? parts[2] : 0;
    const date = new Date(now); // clone the current date
    date.setHours(hours, minutes, seconds, 0);
    if (date <= now) {
      date.setDate(date.getDate() + 1);
    }
    this.mode.set(0);

    this.signalk.putRequest('navigation.racing.setStartTime',
      { command: 'set', startTime: date.toISOString() },
      this.widgetProperties.uuid
    );
  }
}
