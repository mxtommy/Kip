import {Component, effect, ElementRef, inject, OnDestroy, OnInit, viewChild} from '@angular/core';
import {Subscription} from 'rxjs';
import {WidgetHostComponent} from '../../core/components/widget-host/widget-host.component';
import {IWidgetSvcConfig} from '../../core/interfaces/widgets-interface';
import {NgxResizeObserverModule} from 'ngx-resize-observer';
import {BaseWidgetComponent} from '../../core/utils/base-widget.component';
import {TimersService} from '../../core/services/timers.service';
import {DashboardService} from '../../core/services/dashboard.service';
import {States} from '../../core/interfaces/signalk-interfaces';
import {MatButton} from '@angular/material/button';
import {CanvasService} from '../../core/services/canvas.service';
import {result} from 'lodash-es';

@Component({
    selector: 'widget-racer-timer',
    templateUrl: './widget-racer-timer.component.html',
    styleUrls: ['./widget-racer-timer.component.scss'],
    standalone: true,
    imports: [ WidgetHostComponent, NgxResizeObserverModule, MatButton ]
})
export class WidgetRacerTimerComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  private TimersService = inject(TimersService);
  private canvas = inject(CanvasService);

  private DashboardService = inject(DashboardService);
  readonly ttsCanvas = viewChild<ElementRef<HTMLCanvasElement>>('ttsCanvas');
  readonly dtsCanvas = viewChild<ElementRef<HTMLCanvasElement>>('dtsCanvas');
  protected dataValue: number = null;
  private zoneState: string = null;

  // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  private currentTtsLength = 0;
  private currentDtsLength = 0;
  private ttsFontSize = 1;
  private dtsFontSize = 1;
  private flashOn = false;
  private flashInterval = null;
  public timerRunning = false;
  public showAdjustStartLine = true;
  public showAdjustTimer = false;
  readonly timeName: string = 'racer';
  private warnColor: string = null;
  private warmContrast: string = null;
  private textColor: string = null;

  timerSub: Subscription = null;

  private ttsCanvasCtx: CanvasRenderingContext2D = null;
  private dtsCanvasCtx: CanvasRenderingContext2D = null;

  constructor() {
    super();
    console.log('WidgetRacerTimerComponent canvasTimer ', this.ttsCanvas);

    this.defaultConfig = {
      timerLength: 300,
      nextDashboard: 1,
      color: 'contrast',
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
    this.subscribeTimer();
    this.startWidget();
  }

  protected startWidget(): void {
    this.getColors(this.widgetProperties.config.color);
    this.ttsCanvasCtx = this.ttsCanvas().nativeElement.getContext('2d');
    this.dtsCanvasCtx = this.dtsCanvas().nativeElement.getContext('2d');
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.updateCanvas();
  }

  onResized(event: ResizeObserverEntry) {
    if (event.contentRect.height < 50) { return; }
    if (event.contentRect.width < 50) { return; }
    if ((this.ttsCanvas().nativeElement.width !== Math.floor(event.contentRect.width)) ||
      (this.ttsCanvas().nativeElement.height !== Math.floor(event.contentRect.height * 0.4))) {
      this.ttsCanvas().nativeElement.width = Math.floor(event.contentRect.width);
      this.ttsCanvas().nativeElement.height = Math.floor(event.contentRect.height * 0.4);
      this.dtsCanvas().nativeElement.width = Math.floor(event.contentRect.width);
      this.dtsCanvas().nativeElement.height = Math.floor(event.contentRect.height * 0.4);
      this.currentTtsLength = 0; // will force resetting the font size
      this.updateCanvas();
    }
  }

  private subscribeTimer() {
    this.timerRunning = this.TimersService.isRunning(this.timeName);
    const length = this.widgetProperties.config.timerLength;
    this.timerSub = this.TimersService.createTimer(this.timeName, -length, 1000).subscribe(
      newValue => {
        this.dataValue = newValue;

        if (newValue > 0) {
          this.zoneState = States.Normal;
        } else if (newValue > -10) {
          this.zoneState = States.Alarm;
        } else if (newValue > -30) {
          this.zoneState = States.Warn;
        } else {
          this.zoneState = States.Normal;
        }

        // start flashing if alarm
        if (this.zoneState === States.Alarm && !this.flashInterval) {
          this.flashInterval = setInterval(() => {
            this.flashOn = !this.flashOn;
            this.updateCanvas();
          }, 500); // used to flash stuff in alarm
        } else if (this.zoneState !== States.Alarm) {
          // stop alarming if not in alarm state
          clearInterval(this.flashInterval);
        }
        this.updateCanvas();
      }
    );
  }

  public startTimer() {
    this.TimersService.startTimer(this.timeName);
    this.timerRunning = true;
  }

  public resetTimer() {
    this.unsubscribeTimer();
    this.TimersService.deleteTimer(this.timeName);
    this.timerRunning = false;
    this.subscribeTimer();
  }

  public pauseTimer() {
    this.TimersService.stopTimer(this.timeName);
    this.timerRunning = false;
  }

  public roundToMin() {
    let v = this.dataValue;
    if (this.dataValue < 0) {
      v = v * -1; // always positive
    }
    const seconds = v % 60;

    if (this.dataValue > 0) {
      if (seconds > 30) {
        this.TimersService.setTimer(this.timeName, this.dataValue + (60 - seconds));
      } else {
        this.TimersService.setTimer(this.timeName, this.dataValue - seconds);
      }
    } else {
      if (seconds > 30) {
        this.TimersService.setTimer(this.timeName, this.dataValue - (60 - seconds));
      } else {
        this.TimersService.setTimer(this.timeName, this.dataValue + seconds);
      }
    }
  }
  private setLineEnd(end: 'port' | 'stb') {
    const url = `/plugins/signalk-racer/startline/${end}`;
    fetch(url, { method: 'PUT' })
      .then(async response => {
        if (!response.ok) {
          const err = await response.text();
          console.error(`Failed to set ${end} end: ${response.status} - ${err}`);
        } else {
          console.log(`✅ Set start line ${end} end successfully.`);
        }
      })
      .catch(error => {
        console.error(`Error setting ${end} end:`, error);
        alert(`Error setting ${end} end: ${error.message}`);
      });
  }

  setLinePort() {
    this.setLineEnd('port');
  }

  setLineStb() {
    this.setLineEnd('stb');
  }

  addOneMin() {
      this.TimersService.setTimer(this.timeName, this.dataValue + 60);
  }

  remOneMin() {
      this.TimersService.setTimer(this.timeName, this.dataValue - 60);
  }

  private getColors(color: string) {
    switch (color) {
      case 'contrast':
        this.textColor = this.theme().contrast;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case 'blue':
        this.textColor = this.theme().blue;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case 'green':
        this.textColor = this.theme().green;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case 'pink':
        this.textColor = this.theme().pink;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case 'orange':
        this.textColor = this.theme().orange;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case 'purple':
        this.textColor = this.theme().purple;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case 'grey':
        this.textColor = this.theme().grey;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case 'yellow':
        this.textColor = this.theme().yellow;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      default:
        this.textColor = this.theme().contrast;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
    }
  }

  private unsubscribeTimer() {
      this.timerSub?.unsubscribe();
  }

  ngOnDestroy() {
    this.timerSub?.unsubscribe();
    if (this.ttsCanvasCtx) {
      this.canvas.clearCanvas(this.ttsCanvasCtx, this.ttsCanvas().nativeElement.width, this.ttsCanvas().nativeElement.height);
    }
    if (this.dtsCanvasCtx) {
      this.canvas.clearCanvas(this.dtsCanvasCtx, this.dtsCanvas().nativeElement.width, this.dtsCanvas().nativeElement.height);
    }
    clearInterval(this.flashInterval);
    this.destroyDataStreams();
  }

/* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */

  updateCanvas() {
    if (this.ttsCanvasCtx) {
      this.canvas.clearCanvas(this.ttsCanvasCtx, this.ttsCanvas().nativeElement.width, this.ttsCanvas().nativeElement.height);
      this.canvas.clearCanvas(this.dtsCanvasCtx, this.dtsCanvas().nativeElement.width, this.dtsCanvas().nativeElement.height);
      this.drawValue();
    }
  }

  drawValue() {
    const ttsCanvas = this.ttsCanvas().nativeElement;
    const dtsCanvas = this.dtsCanvas().nativeElement;
    const maxTextWidth = Math.floor(ttsCanvas.width * 0.95);
    const maxTextHeight = Math.floor(ttsCanvas.height * 0.80);
    let ttsText: string;

    if (this.dataValue != null) {
      const v = Math.abs(this.dataValue); // Always positive
      const m = Math.floor(v / 60);
      const s = Math.floor(v % 60);
      ttsText = `${m}:${('0' + s).slice(-2)}`;

      if (this.dataValue < 0) {
        ttsText = `-${ttsText}`;
      }
    } else {
      ttsText = '--';
    }

    // Check if the length of the string has changed
    if (this.currentTtsLength !== ttsText.length) {
      this.currentTtsLength = ttsText.length;
      this.ttsFontSize = this.canvas.calculateOptimalFontSize(
        this.ttsCanvasCtx,
        ttsText,
        maxTextWidth,
        maxTextHeight,
        'bold'
      );
    }

    // Set the text color based on the zone state
    switch (this.zoneState) {
      case States.Alarm:
        if (this.flashOn) {
          this.ttsCanvasCtx.fillStyle = this.textColor;
        } else {
          this.canvas.drawRectangle(this.ttsCanvasCtx, 0, 0, ttsCanvas.width, ttsCanvas.height, this.warnColor);
          this.ttsCanvasCtx.fillStyle = this.textColor;
        }
        break;
      case States.Warn:
        this.ttsCanvasCtx.fillStyle = this.warnColor;
        break;
      default:
        this.ttsCanvasCtx.fillStyle = this.textColor;
    }

    // Draw the text
    this.canvas.drawTitle(this.ttsCanvasCtx,
      'TTS',
      this.ttsCanvasCtx.fillStyle,
      'normal',
      ttsCanvas.width, ttsCanvas.height);
    this.canvas.drawText(
      this.ttsCanvasCtx,
      ttsText,
      ttsCanvas.width / 2,
      ttsCanvas.height / 2,
      maxTextWidth,
      maxTextHeight,
      'bold',
      this.ttsCanvasCtx.fillStyle,
      'center',
      'middle'
    );

    this.canvas.drawText(
      this.ttsCanvasCtx,
      'At: HH:MM:SS',
      15 * this.canvas.scaleFactor,
      Math.floor(ttsCanvas.height - 15 * this.canvas.scaleFactor),
      Math.floor(ttsCanvas.width * 0.25),
      Math.floor(ttsCanvas.height * 0.15),
      'normal',
      this.ttsCanvasCtx.fillStyle,
      'start',
      'alphabetic'
    );

    this.canvas.drawTitle(this.dtsCanvasCtx,
      'DTS',
      this.ttsCanvasCtx.fillStyle,
      'normal',
      dtsCanvas.width, dtsCanvas.height);
    this.canvas.drawText(
      this.dtsCanvasCtx,
      '34.2',
      dtsCanvas.width / 2,
      dtsCanvas.height / 2,
      maxTextWidth,
      maxTextHeight,
      'bold',
      this.ttsCanvasCtx.fillStyle,
      'center',
      'middle'
    );

    this.canvas.drawText(
      this.dtsCanvasCtx,
      'm',
      Math.floor(dtsCanvas.width - 15 * this.canvas.scaleFactor),
      Math.floor(dtsCanvas.height - 15 * this.canvas.scaleFactor),
      Math.floor(dtsCanvas.width * 0.25),
      Math.floor(dtsCanvas.height * 0.15),
      'bold',
      this.ttsCanvasCtx.fillStyle,
      'end',
      'alphabetic'
    );

    this.canvas.drawText(
      this.dtsCanvasCtx,
      'Line: 120m   Bias: -5m',
      15 * this.canvas.scaleFactor,
      Math.floor(dtsCanvas.height - 15 * this.canvas.scaleFactor),
      Math.floor(dtsCanvas.width * 0.35),
      Math.floor(dtsCanvas.height * 0.15),
      'normal',
      this.ttsCanvasCtx.fillStyle,
      'start',
      'alphabetic'
    );
  }
}
