import { Component, OnInit, OnDestroy, Input, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { WidgetManagerService, IWidget, IWidgetSvcConfig } from '../widget-manager.service';
import { TimersService } from '../timers.service';
import { IZoneState } from "../app-settings.interfaces";
import { AppSettingsService } from '../app-settings.service';


const defaultConfig: IWidgetSvcConfig = {
  timerLength: 300
};

@Component({
  selector: 'app-widget-race-timer',
  templateUrl: './widget-race-timer.component.html',
  styleUrls: ['./widget-race-timer.component.scss']
})
export class WidgetRaceTimerComponent implements OnInit, OnDestroy, AfterViewChecked {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;
  @ViewChild('wrapperDiv', {static: true, read: ElementRef}) wrapperDiv: ElementRef;
  @ViewChild('warn', {static: true, read: ElementRef}) private warnElement: ElementRef;
  @ViewChild('warncontrast', {static: true, read: ElementRef}) private warnContrastElement: ElementRef;


  activeWidget: IWidget;
  config: IWidgetSvcConfig;


  dataValue: number = null;
  IZoneState: IZoneState = null;
  currentValueLength: number = 0; // length (in charaters) of value text to be displayed. if changed from last time, need to recalculate font size...
  valueFontSize: number = 1;
  flashOn: boolean = false;
  flashInterval;
  timerRunning: boolean = false;

  timerSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;
  canvasCtx;
  canvasBGCtx;


  constructor(
    public dialog:MatDialog,
    private WidgetManagerService: WidgetManagerService,
    private AppSettingsService: AppSettingsService, // need for theme change
    private TimersService: TimersService
  ) { }

  ngOnInit(): void {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
    }
    this.subscribeTimer();
    this.subscribeTheme();
    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');

  }

  ngOnDestroy() {
    this.unsubscribeTimer();
    this.unsubscribeTheme();
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
  }

  ngAfterViewChecked() {
    this.resizeWidget();
  }

  resizeWidget() {
    let rect = this.wrapperDiv.nativeElement.getBoundingClientRect();

    if (rect.height < 50) { return; }
    if (rect.width < 50) { return; }
    if ((this.canvasEl.nativeElement.width != Math.floor(rect.width)) || (this.canvasEl.nativeElement.height != Math.floor(rect.height))) {
      this.canvasEl.nativeElement.width = Math.floor(rect.width);
      this.canvasEl.nativeElement.height = Math.floor(rect.height);
      this.canvasBG.nativeElement.width = Math.floor(rect.width);
      this.canvasBG.nativeElement.height = Math.floor(rect.height);
      this.currentValueLength = 0; //will force resetting the font size
      this.updateCanvas();
      this.updateCanvasBG();
    }

  }


  subscribeTimer() {
    this.unsubscribeTimer();

    let length = (this.config.timerLength*-1)*10;

    this.timerSub = this.TimersService.createTimer("race", -3000, 100).subscribe(
      newValue => {
        this.dataValue = newValue;

        if (newValue > 0) {
          this.IZoneState = IZoneState.normal;
        } else if (newValue > -100) {
          this.IZoneState = IZoneState.alarm;
        } else if (newValue > -300) {
          this.IZoneState = IZoneState.warning;
        } else {
          this.IZoneState = IZoneState.normal;
        }

       //start flashing if alarm
       if (this.IZoneState == IZoneState.alarm && !this.flashInterval) {
        this.flashInterval = setInterval(() => {
          this.flashOn = !this.flashOn;
          this.updateCanvas();
        }, 500); // used to flash stuff in alarm
      } else if (this.IZoneState != IZoneState.alarm) {
        // stop alarming if not in alarm state
        if (this.flashInterval) {
          clearInterval(this.flashInterval);
          this.flashInterval = null;
        }
      }


        this.updateCanvas();
      }
    );
  }


  // Subscribe to theme event
  subscribeTheme() {
    this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
      setTimeout(() => {   // need a delay so browser getComputedStyles has time to complete theme application.
        this.updateCanvas();
        this.updateCanvasBG();
      }, 100);
    })
  }

  unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
    }
  }


  unsubscribeTimer() {
    if (this.timerSub !== null) {
      this.timerSub.unsubscribe();
      this.timerSub = null;
    }
  }


  startTimer() {
    this.TimersService.startTimer("race");
    this.timerRunning = true;
  }

  resetTimer() {
    this.unsubscribeTimer();
    this.TimersService.deleteTimer("race");
    this.timerRunning = false;
    this.subscribeTimer();
  }

  pauseTimer() {
    this.TimersService.stopTimer("race");
    this.timerRunning = false;
  }

  roundToMin() {
    let v = this.dataValue;
    if (this.dataValue < 0) { v = v *-1} // always positive
    var seconds = v % 600;

    if (this.dataValue > 0) {
      if (seconds > 300) {
        this.TimersService.setTimer("race", this.dataValue + (600 - seconds));
      } else {
        this.TimersService.setTimer("race", this.dataValue - seconds);
      }
    } else {
      if (seconds > 300) {
        this.TimersService.setTimer("race", this.dataValue - (600 - seconds));
      } else {
        this.TimersService.setTimer("race", this.dataValue + seconds);
      }
    }
  }


  addOneMin() {
      this.TimersService.setTimer("race", this.dataValue + 600);
  }

  remOneMin() {
      this.TimersService.setTimer("race", this.dataValue - 600);
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


  strTypeHelper


  drawValue() {
    let maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.15));
    let maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.2));
    let valueText: string;

    if (this.dataValue != null) {

      let v = this.dataValue;
      if (this.dataValue < 0) { v = v *-1} // always positive

      var m = Math.floor(v / 600);
      var s = Math.floor(v % 600 / 10);
      var d = Math.floor(v % 600 % 10);
      valueText = m + ":" + ('0' + s).slice(-2) + "." + d;

      if (this.dataValue < 0) {
        valueText = "-" + valueText;
      }

    } else {
      valueText = "--";
    }
    //check if length of string has changed since laste time.
    if (this.currentValueLength != valueText.length) {
      //we need to set font size...
      this.currentValueLength = valueText.length;

      // start with large font, no sense in going bigger than the size of the canvas :)
      this.valueFontSize = maxTextHeight;
      this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
      let measure = this.canvasCtx.measureText(valueText).width;

      // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
      if (measure > maxTextWidth) {
        let estimateRatio = maxTextWidth / measure;
        this.valueFontSize = Math.floor(this.valueFontSize * estimateRatio);
        this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
      }
      // now decrease by 1 to in case still too big
      let loopCount = 0;
      while (this.canvasCtx.measureText(valueText).width > maxTextWidth && this.valueFontSize > 0) {
        loopCount++;
        this.valueFontSize--;
        this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
      }
      console.log(`Recalculated font size, loops: ${loopCount}`);
    }

    // get color based on zone
    switch (this.IZoneState) {
      case IZoneState.alarm:

        if (this.flashOn) {
          this.canvasCtx.fillStyle = window.getComputedStyle(this.warnElement.nativeElement).color;
        } else {
          // draw warn background
          this.canvasCtx.fillStyle = window.getComputedStyle(this.warnElement.nativeElement).color;
          this.canvasCtx.fillRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
          // text color
          this.canvasCtx.fillStyle = window.getComputedStyle(this.warnContrastElement.nativeElement).color;
        }
        break;

      case IZoneState.warning:
        this.canvasCtx.fillStyle = window.getComputedStyle(this.warnElement.nativeElement).color;
        break;

      default:
        this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    }

    this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
    this.canvasCtx.textAlign = "center";
    this.canvasCtx.textBaseline="middle";
    this.canvasCtx.fillText(valueText,this.canvasEl.nativeElement.width/2,(this.canvasEl.nativeElement.height/2)+(this.valueFontSize/15), maxTextWidth);
  }







}
