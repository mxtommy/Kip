import { Component, OnInit, OnDestroy,ViewChild, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

import { BaseWidgetComponent } from '../../core/components/base-widget/base-widget.component';
import { TimersService } from '../../core/services/timers.service';
import { States } from '../../core/interfaces/signalk-interfaces';
import { NgIf } from '@angular/common';
import { MatButton } from '@angular/material/button';

@Component({
    selector: 'widget-racetimer',
    templateUrl: './widget-race-timer.component.html',
    styleUrls: ['./widget-race-timer.component.scss'],
    standalone: true,
    imports: [ WidgetHostComponent, NgxResizeObserverModule, MatButton, NgIf ]
})
export class WidgetRaceTimerComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;

  dataValue: number = null;
  zoneState: string = null;
  currentValueLength: number = 0; // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  valueFontSize: number = 1;
  flashOn: boolean = false;
  flashInterval = null;
  timerRunning: boolean = false;
  readonly timeName: string = "race";
  private warnColor: string = null;
  private warmContrast: string = null;
  private textColor: string = null;

  timerSub: Subscription = null;

  canvasCtx;
  canvasBGCtx;

  constructor(private TimersService: TimersService) {
    super();

    this.defaultConfig = {
      timerLength: 300,
      color: 'white',
    };
  }

  ngOnInit(): void {
    this.initWidget();
    this.subscribeTimer();
    this.startWidget();
  }

  protected startWidget(): void {
    this.getColors(this.widgetProperties.config.color);
    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
    this.updateCanvas();
    this.updateCanvasBG();
  }

  onResized(event: ResizeObserverEntry) {
    if (event.contentRect.height < 50) { return; }
    if (event.contentRect.width < 50) { return; }
    if ((this.canvasEl.nativeElement.width != Math.floor(event.contentRect.width)) || (this.canvasEl.nativeElement.height != Math.floor(event.contentRect.height))) {
      this.canvasEl.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasEl.nativeElement.height = Math.floor(event.contentRect.height);
      this.canvasBG.nativeElement.width = Math.floor(event.contentRect.width);
      this.canvasBG.nativeElement.height = Math.floor(event.contentRect.height);
      this.currentValueLength = 0; //will force resetting the font size
      this.updateCanvas();
      this.updateCanvasBG();
    }
  }

  private subscribeTimer() {
    this.timerRunning = this.TimersService.isRunning(this.timeName);
    const length = (this.widgetProperties.config.timerLength * -1) * 10;

    this.timerSub = this.TimersService.createTimer(this.timeName, -3000, 100).subscribe(
      newValue => {
        this.dataValue = newValue;

        if (newValue > 0) {
          this.zoneState = States.Normal;
        } else if (newValue > -100) {
          this.zoneState = States.Alarm;
        } else if (newValue > -300) {
          this.zoneState =States.Warn;
        } else {
          this.zoneState = States.Normal;
        }

       //start flashing if alarm
       if (this.zoneState == States.Alarm && !this.flashInterval) {
        this.flashInterval = setInterval(() => {
          this.flashOn = !this.flashOn;
          this.updateCanvas();
        }, 500); // used to flash stuff in alarm
      } else if (this.zoneState != States.Alarm) {
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
    if (this.dataValue < 0) { v = v * -1} // always positive
    let seconds = v % 600;

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
      case "white":
        this.textColor = this.theme.white;
        this.warnColor = this.theme.zoneAlarm;
        this.warmContrast = this.theme.zoneAlarm;
        break;
      case "blue":
        this.textColor = this.theme.blue;
        this.warnColor = this.theme.zoneAlarm;
        this.warmContrast = this.theme.zoneAlarm;
        break;
      case "green":
        this.textColor = this.theme.green;
        this.warnColor = this.theme.zoneAlarm;
        this.warmContrast = this.theme.zoneAlarm;;
        break;
      case "pink":
        this.textColor = this.theme.pink;
        this.warnColor = this.theme.zoneAlarm;
        this.warmContrast = this.theme.zoneAlarm;
        break;
      case "orange":
        this.textColor = this.theme.orange;
        this.warnColor = this.theme.zoneAlarm;
        this.warmContrast = this.theme.zoneAlarm;
        break;
      case "purple":
        this.textColor = this.theme.purple;
        this.warnColor = this.theme.zoneAlarm;
        this.warmContrast = this.theme.zoneAlarm;
        break;
      case "grey":
        this.textColor = this.theme.grey;
        this.warnColor = this.theme.zoneAlarm;
        this.warmContrast = this.theme.zoneAlarm;
        break;
      case "yellow":
        this.textColor = this.theme.yellow;
        this.warnColor = this.theme.zoneAlarm;
        this.warmContrast = this.theme.zoneAlarm;
        break;
      default:
        this.textColor = this.theme.white;
        this.warnColor = this.theme.zoneAlarm;
        this.warmContrast = this.theme.zoneAlarm;
        break;
    }
  }

  private unsubscribeTimer() {
      this.timerSub?.unsubscribe();
  }

  ngOnDestroy() {
    this.timerSub?.unsubscribe();
    clearInterval(this.flashInterval);
  }

/* ******************************************************************************************* */
/* ******************************************************************************************* */
/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
/* ******************************************************************************************* */
/* ******************************************************************************************* */


  updateCanvas() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
    }
  }

  updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);

    }
  }

  drawValue() {
    let maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.15));
    let maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.2));
    let valueText: string;

    if (this.dataValue != null) {

      let v = this.dataValue;
      if (this.dataValue < 0) { v = v * -1} // always positive

      let m = Math.floor(v / 600);
      let s = Math.floor(v % 600 / 10);
      let d = Math.floor(v % 600 % 10);
      valueText = m + ":" + ('0' + s).slice(-2) + "." + d;

      if (this.dataValue < 0) {
        valueText = "-" + valueText;
      }

    } else {
      valueText = "--";
    }
    //check if length of string has changed since last time.
    if (this.currentValueLength != valueText.length) {
      //we need to set font size...
      this.currentValueLength = valueText.length;

      // start with large font, no sense in going bigger than the size of the canvas :)
      this.valueFontSize = maxTextHeight;
      this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Roboto";
      let measure = this.canvasCtx.measureText(valueText).width;

      // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
      if (measure > maxTextWidth) {
        let estimateRatio = maxTextWidth / measure;
        this.valueFontSize = Math.floor(this.valueFontSize * estimateRatio);
        this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Roboto";
      }
      // now decrease by 1 to in case still too big
      let loopCount = 0;
      while (this.canvasCtx.measureText(valueText).width > maxTextWidth && this.valueFontSize > 0) {
        loopCount++;
        this.valueFontSize--;
        this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Roboto";
      }
      // console.log(`Recalculated font size, loops: ${loopCount}`);
    }

    // get color based on zone
    switch (this.zoneState) {
      case States.Alarm:

        if (this.flashOn) {
          this.canvasCtx.fillStyle = this.textColor;
        } else {
          // draw background
          this.canvasCtx.fillStyle = this.warnColor;
          this.canvasCtx.fillRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
          // text color
          this.canvasCtx.fillStyle = this.textColor;
        }
        break;

      case States.Warn:
        this.canvasCtx.fillStyle = this.warnColor;
        break;

      default:
        this.canvasCtx.fillStyle = this.textColor;
    }

    this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Roboto";
    this.canvasCtx.textAlign = "center";
    this.canvasCtx.textBaseline="middle";
    this.canvasCtx.fillText(valueText,this.canvasEl.nativeElement.width/2,(this.canvasEl.nativeElement.height * 0.45)+(this.valueFontSize/15), maxTextWidth);
  }
}
