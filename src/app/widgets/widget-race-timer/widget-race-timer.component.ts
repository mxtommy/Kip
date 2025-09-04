import { Component, OnInit, OnDestroy, ElementRef, viewChild, inject, effect, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { TimersService } from '../../core/services/timers.service';
import { States } from '../../core/interfaces/signalk-interfaces';

import { MatButton } from '@angular/material/button';
import { CanvasService } from '../../core/services/canvas.service';

@Component({
  selector: 'widget-racetimer',
  templateUrl: './widget-race-timer.component.html',
  styleUrls: ['./widget-race-timer.component.scss'],
  imports: [WidgetHostComponent, MatButton]
})
export class WidgetRaceTimerComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly canvas = inject(CanvasService);
  private canvasMainRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvasMainRef');
  private canvasElement: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;
  private cssWidth = 0;
  private cssHeight = 0;
  private maxTextWidth = 0;
  private maxTextHeight = 0;

  private TimersService = inject(TimersService);
  protected dataValue: number = null;
  private zoneState: string = null;
  private currentValueLength = 0; // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  private valueFontSize = 1;
  private flashOn = false;
  private flashInterval = null;
  public timerRunning = false;
  readonly timeName: string = "race";
  private warnColor: string = null;
  private warmContrast: string = null;
  private textColor: string = null;

  timerSub: Subscription = null;

  constructor() {
    super();

    this.defaultConfig = {
      timerLength: 300,
      color: 'contrast',
    };

    effect(() => {
      if (this.theme()) {
        this.getColors(this.widgetProperties.config.color);
        this.drawWidget();
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
    this.subscribeTimer();
  }

  ngAfterViewInit(): void {
    this.canvasElement = this.canvasMainRef().nativeElement;
    this.canvasCtx = this.canvasElement.getContext('2d');
    this.canvas.registerCanvas(this.canvasElement, {
      autoRelease: true,
      onResize: (w, h) => {
        this.cssWidth = w;
        this.cssHeight = h;
        this.maxTextWidth = Math.floor(this.cssWidth * 0.95);
        this.maxTextHeight = Math.floor(this.cssHeight);
        this.drawWidget();
      },
    });
    this.cssHeight = Math.round(this.canvasElement.getBoundingClientRect().height);
    this.cssWidth = Math.round(this.canvasElement.getBoundingClientRect().width);
    this.startWidget();
  }

  protected startWidget(): void {
    this.getColors(this.widgetProperties.config.color);
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.drawWidget();
  }

  private subscribeTimer() {
    this.timerRunning = this.TimersService.isRunning(this.timeName);

    this.timerSub = this.TimersService.createTimer(this.timeName, -3000, 100).subscribe(
      newValue => {
        this.dataValue = newValue;

        if (newValue > 0) {
          this.zoneState = States.Normal;
        } else if (newValue > -100) {
          this.zoneState = States.Alarm;
        } else if (newValue > -300) {
          this.zoneState = States.Warn;
        } else {
          this.zoneState = States.Normal;
        }

        //start flashing if alarm
        if (this.zoneState == States.Alarm && !this.flashInterval) {
          this.flashInterval = setInterval(() => {
            this.flashOn = !this.flashOn;
            this.drawWidget();
          }, 500); // used to flash stuff in alarm
        } else if (this.zoneState != States.Alarm) {
          // stop alarming if not in alarm state
          clearInterval(this.flashInterval);
          this.flashInterval = null;
        }
        this.drawWidget();
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
    if (this.dataValue < 0) { v = v * -1 } // always positive
    const seconds = v % 600;

    if (this.dataValue > 0) {
      if (seconds > 300) {
        this.TimersService.setTimer(this.timeName, this.dataValue + (600 - seconds));
      } else {
        this.TimersService.setTimer(this.timeName, this.dataValue - seconds);
      }
    } else {
      if (seconds > 300) {
        this.TimersService.setTimer(this.timeName, this.dataValue - (600 - seconds));
      } else {
        this.TimersService.setTimer(this.timeName, this.dataValue + seconds);
      }
    }
  }

  addOneMin() {
    this.TimersService.setTimer(this.timeName, this.dataValue + 600);
  }

  remOneMin() {
    this.TimersService.setTimer(this.timeName, this.dataValue - 600);
  }

  private getColors(color: string) {
    switch (color) {
      case "contrast":
        this.textColor = this.theme().contrast;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case "blue":
        this.textColor = this.theme().blue;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case "green":
        this.textColor = this.theme().green;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;;
        break;
      case "pink":
        this.textColor = this.theme().pink;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case "orange":
        this.textColor = this.theme().orange;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case "purple":
        this.textColor = this.theme().purple;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case "grey":
        this.textColor = this.theme().grey;
        this.warnColor = this.theme().zoneAlarm;
        this.warmContrast = this.theme().zoneAlarm;
        break;
      case "yellow":
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
    try { this.canvas.unregisterCanvas(this.canvasElement); }
    catch { /* ignore */ }
    clearInterval(this.flashInterval);
    this.flashInterval = null;
    this.destroyDataStreams();
  }

  /* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */

  drawWidget() {
    if (!this.canvasCtx) return;

    this.canvas.clearCanvas(this.canvasCtx, this.cssWidth, this.cssHeight);
    let valueText: string;

    if (this.dataValue != null) {
      const v = Math.abs(this.dataValue); // Always positive
      const m = Math.floor(v / 600);
      const s = Math.floor((v % 600) / 10);
      const d = Math.floor(v % 10);
      valueText = `${m}:${('0' + s).slice(-2)}.${d}`;

      if (this.dataValue < 0) {
        valueText = `-${valueText}`;
      }
    } else {
      valueText = "--";
    }

    // Check if the length of the string has changed
    if (this.currentValueLength !== valueText.length) {
      this.currentValueLength = valueText.length;
      this.valueFontSize = this.canvas.calculateOptimalFontSize(
        this.canvasCtx,
        valueText,
        this.maxTextWidth,
        this.maxTextHeight,
        'bold'
      );
    }

    // Set the text color based on the zone state
    switch (this.zoneState) {
      case States.Alarm:
        if (this.flashOn) {
          this.canvasCtx.fillStyle = this.textColor;
        } else {
          this.canvas.drawRectangle(
            this.canvasCtx,
            0,
            0,
            this.cssWidth,
            this.cssHeight,
            this.warnColor);
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
      this.cssWidth / 2,
      this.cssHeight / 2,
      this.maxTextWidth,
      this.maxTextHeight,
      'bold',
      this.canvasCtx.fillStyle,
      'center',
      'middle'
    );
  }
}
