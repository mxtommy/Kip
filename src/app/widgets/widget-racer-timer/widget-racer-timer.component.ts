import { Component, OnInit, OnDestroy, ElementRef, viewChild, inject, effect } from '@angular/core';
import { Subscription } from 'rxjs';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { TimersService } from '../../core/services/timers.service';
import {DashboardService} from '../../core/services/dashboard.service';
import { States } from '../../core/interfaces/signalk-interfaces';
import { NgIf } from '@angular/common';
import { MatButton } from '@angular/material/button';
import { CanvasService } from '../../core/services/canvas.service';

@Component({
    selector: 'widget-racertimer',
    templateUrl: './widget-racer-timer.component.html',
    styleUrls: ['./widget-racer-timer.component.scss'],
    standalone: true,
    imports: [ WidgetHostComponent, NgxResizeObserverModule, MatButton, NgIf ]
})
export class WidgetRacerTimerComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  private TimersService = inject(TimersService);
  private canvas = inject(CanvasService);
  readonly canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  private DashboardService = inject(DashboardService);
  dataValue: number = null;
  zoneState: string = null;

  // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  private currentValueLength = 0;
  private valueFontSize = 1;
  private flashOn = false;
  private flashInterval = null;
  public timerRunning = false;
  readonly timeName: string = 'racer';
  private warnColor: string = null;
  private warmContrast: string = null;
  private textColor: string = null;

  timerSub: Subscription = null;

  private canvasCtx: CanvasRenderingContext2D = null;

  constructor() {
    super();

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
    this.canvasCtx = this.canvasEl().nativeElement.getContext('2d');
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.updateCanvas();
  }

  onResized(event: ResizeObserverEntry) {
    if (event.contentRect.height < 50) { return; }
    if (event.contentRect.width < 50) { return; }
    if ((this.canvasEl().nativeElement.width != Math.floor(event.contentRect.width)) ||
      (this.canvasEl().nativeElement.height != Math.floor(event.contentRect.height))) {
      this.canvasEl().nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasEl().nativeElement.height = Math.floor(event.contentRect.height / 2);
      this.currentValueLength = 0; // will force resetting the font size
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

        // Set the time on the server and check if OCS
        // TODO this is not the right way to do this
        fetch(`/plugins/signalk-racer/startline/timeToStart`, {
          method: 'PUT', body: JSON.stringify({ value: newValue })
        }).then(response => {
          if (response.ok) {
            response.text().then(text => {
              const json = JSON.parse(text);
              if (json.distanceToStart && typeof json.distanceToStart === 'number' ) {
                if (json.distanceToStart < 0) {
                  // TODO highlight the onCourseSide display element
                }
                if (json.timeToStart && typeof json.timeToStart === 'number' && json.timeToStart === 0 &&
                  this.widgetProperties.config.nextDashboard >= 0) {
                 this.DashboardService.navigateTo(this.widgetProperties.config.nextDashboard);
                }
              }
            });
          }
        }).catch(error => {
          console.error(`Error setting timeToStart:`, error);
        });
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
    // TODO this is not the right way to do this
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
    if (this.canvasCtx) {
      this.canvas.clearCanvas(this.canvasCtx, this.canvasEl().nativeElement.width, this.canvasEl().nativeElement.height);
    }
    clearInterval(this.flashInterval);
    this.destroyDataStreams();
  }

/* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */

  updateCanvas() {
    if (this.canvasCtx) {
      this.canvas.clearCanvas(this.canvasCtx, this.canvasEl().nativeElement.width, this.canvasEl().nativeElement.height);
      this.drawValue();
    }
  }

  drawValue() {
    const canvasEl = this.canvasEl().nativeElement;
    const maxTextWidth = Math.floor(canvasEl.width * 0.95);
    const maxTextHeight = Math.floor(canvasEl.height);
    let valueText: string;

    if (this.dataValue != null) {
      const v = Math.abs(this.dataValue); // Always positive
      const m = Math.floor(v / 60);
      const s = Math.floor(v % 60);
      valueText = `${m}:${('0' + s).slice(-2)}`;

      if (this.dataValue < 0) {
        valueText = `-${valueText}`;
      }
    } else {
      valueText = '--';
    }

    // Check if the length of the string has changed
    if (this.currentValueLength !== valueText.length) {
      this.currentValueLength = valueText.length;
      this.valueFontSize = this.canvas.calculateOptimalFontSize(
        this.canvasCtx,
        valueText,
        maxTextWidth,
        maxTextHeight,
        'bold'
      );
    }

    // Set the text color based on the zone state
    switch (this.zoneState) {
      case States.Alarm:
        if (this.flashOn) {
          this.canvasCtx.fillStyle = this.textColor;
        } else {
          this.canvas.drawRectangle(this.canvasCtx, 0, 0, canvasEl.width, canvasEl.height, this.warnColor);
          this.canvasCtx.fillStyle = this.textColor;
        }
        break;
      case States.Warn:
        this.canvasCtx.fillStyle = this.warnColor;
        break;
      default:
        this.canvasCtx.fillStyle = this.textColor;
    }

    // Draw the text
    this.canvas.drawText(
      this.canvasCtx,
      valueText,
      canvasEl.width / 2,
      canvasEl.height / 2,
      maxTextWidth,
      maxTextHeight,
      'bold',
      this.canvasCtx.fillStyle,
      'center',
      'middle'
    );
  }
}
