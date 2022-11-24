import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { IZoneState } from "../app-settings.interfaces";
import { AppSettingsService } from '../app-settings.service';
import { SignalKService } from '../signalk.service';
import { UnitsService } from '../units.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetSvcConfig } from '../widget-manager.service';

const defaultConfig: IWidgetSvcConfig = {
  displayName: null,
  filterSelfPaths: true,
  paths: {
    "numericPath": {
      description: "Numeric Data",
      path: null,
      source: null,
      pathType: "number",
      isPathConfigurable: true,
      convertUnitTo: "unitless"
    }
  },
  showMax: false,
  showMin: false,
  numDecimal: 1,
  numInt: 1
};

@Component({
  selector: 'app-widget-numeric',
  templateUrl: './widget-numeric.component.html',
  styleUrls: ['./widget-numeric.component.scss']
})
export class WidgetNumericComponent implements OnInit, OnDestroy, AfterViewChecked {

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
  maxValue: number = null;
  minValue: number = null;
  dataTimestamp: number = Date.now();
  currentValueLength: number = 0; // length (in charaters) of value text to be displayed. if changed from last time, need to recalculate font size...
  currentMinMaxLength: number = 0;
  valueFontSize: number = 1;
  minMaxFontSize: number = 1;
  flashOn: boolean = false;
  flashInterval;

  //subs
  valueSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;

  canvasCtx;
  canvasBGCtx;

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService,
    private AppSettingsService: AppSettingsService, // need for theme change subscription
    ) {
  }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
    }
    this.subscribePath();
    this.subscribeTheme();

    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.resizeWidget();
  }

  ngOnDestroy() {
    this.unsubscribePath();
    this.unsubscribeTheme();
    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
  }

  ngAfterViewChecked() {
    this.resizeWidget();
  }

  private resizeWidget() {
    let rect = this.wrapperDiv.nativeElement.getBoundingClientRect();

    if (rect.height < 50) { return; }
    if (rect.width < 50) { return; }
    if ((this.canvasEl.nativeElement.width != Math.floor(rect.width)) || (this.canvasEl.nativeElement.height != Math.floor(rect.height))) {
      this.canvasEl.nativeElement.width = Math.floor(rect.width);
      this.canvasEl.nativeElement.height = Math.floor(rect.height);
      this.canvasBG.nativeElement.width = Math.floor(rect.width);
      this.canvasBG.nativeElement.height = Math.floor(rect.height);
      this.currentValueLength = 0; //will force resetting the font size
      this.currentMinMaxLength = 0;
      this.updateCanvas();
      this.updateCanvasBG();
    }

  }

  private subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['numericPath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['numericPath'].path, this.config.paths['numericPath'].source).subscribe(
      newValue => {
        this.dataValue = newValue.value;
        this.IZoneState = newValue.state;
        //start flashing if alarm
        if (this.IZoneState == IZoneState.alarm && !this.flashInterval) {
          this.flashInterval = setInterval(() => {
            this.flashOn = !this.flashOn;
            this.updateCanvas();
          }, 350); // used to flash stuff in alarm
        } else if (this.IZoneState != IZoneState.alarm) {
          // stop alarming if not in alarm state
          if (this.flashInterval) {
            clearInterval(this.flashInterval);
            this.flashInterval = null;
          }
        }
        // init min/max
        if (this.minValue === null) { this.minValue = this.dataValue; }
        if (this.maxValue === null) { this.maxValue = this.dataValue; }
        if (this.dataValue > this.maxValue) { this.maxValue = this.dataValue; }
        if (this.dataValue < this.minValue) { this.minValue = this.dataValue; }
        this.updateCanvas();
      }
    );
  }

  private unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;

      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['numericPath'].path);
    }
  }

  // Subscribe to theme event
  private subscribeTheme() {
    this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
      setTimeout(() => {   // need a delay so browser getComputedStyles has time to complete theme application.
        this.updateCanvas();
        this.updateCanvasBG();
      }, 100);
    })
  }

  private unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
    }
  }

  public openWidgetSettings() {

    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.log(result);
        this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.subscribePath();
        this.updateCanvas();
        this.updateCanvasBG();
      }
    });
  }

/* ******************************************************************************************* */
/* ******************************************************************************************* */
/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
/* ******************************************************************************************* */
/* ******************************************************************************************* */

  private updateCanvas() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
      if (this.config.showMax || this.config.showMin) {
        this.drawMinMax();
      }
    }
  }

  private updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawTitle();
      this.drawUnit();
    }
  }

  private drawValue() {
    let maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.15));
    let maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.2));
    let valueText: any;

    if (this.dataValue !== null) {
      valueText = this.formatValue(Number(this.dataValue));
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
      while (this.canvasCtx.measureText(valueText).width > maxTextWidth && this.valueFontSize > 0) {
        this.valueFontSize--;
        this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
      }
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
        break;
    }

    this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
    this.canvasCtx.textAlign = "center";
    this.canvasCtx.textBaseline="middle";
    this.canvasCtx.fillText(valueText,this.canvasEl.nativeElement.width/2,(this.canvasEl.nativeElement.height/2)+(this.valueFontSize/15), maxTextWidth);
  }

  private drawTitle() {
    var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.2));
    var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.8));
    // set font small and make bigger until we hit a max.
    if (this.config.displayName === null) { return; }

    // start with large font, no sense in going bigger than the size of the canvas :)
    var fontSize = maxTextHeight;
    this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    let measure = this.canvasBGCtx.measureText(this.config.displayName).width;

    // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
    if (measure > maxTextWidth) {
      let estimateRatio = maxTextWidth / measure;
      fontSize = Math.floor(fontSize * estimateRatio);
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    // now decrease by 1 to in case still too big
    while (this.canvasBGCtx.measureText(this.config.displayName).width > maxTextWidth && fontSize > 0) {
      fontSize--;
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }

    this.canvasBGCtx.textAlign = "left";
    this.canvasBGCtx.textBaseline="top";
    this.canvasBGCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasBGCtx.fillText(this.config.displayName,this.canvasEl.nativeElement.width*0.03,this.canvasEl.nativeElement.height*0.03, maxTextWidth);
  }

  private drawUnit() {
    if (this.config.paths['numericPath'].convertUnitTo == 'unitless') { return; }
    if (this.config.paths['numericPath'].convertUnitTo.startsWith('percent')) { return; }
    if (this.config.paths['numericPath'].convertUnitTo == 'ratio') { return; }
    if (this.config.paths['numericPath'].convertUnitTo.startsWith('lat')) { return; }
    if (this.config.paths['numericPath'].convertUnitTo.startsWith('lon')) { return; }
    var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.8));
    var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.8));

    // start with large font, no sense in going bigger than the size of the canvas :)
    var fontSize = maxTextHeight;
    this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    let measure = this.canvasBGCtx.measureText(this.config.paths['numericPath'].convertUnitTo).width;

    // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
    if (measure > maxTextWidth) {
      let estimateRatio = maxTextWidth / measure;
      fontSize = Math.floor(fontSize * estimateRatio);
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    // now decrease by 1 to in case still too big
    while (this.canvasBGCtx.measureText(this.config.paths['numericPath'].convertUnitTo).width > maxTextWidth && fontSize > 0) {
      fontSize--;
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }

    this.canvasBGCtx.textAlign = "right";
    this.canvasBGCtx.textBaseline="bottom";
    this.canvasBGCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasBGCtx.fillText(this.config.paths['numericPath'].convertUnitTo,this.canvasEl.nativeElement.width*0.97,this.canvasEl.nativeElement.height*0.97, maxTextWidth);
  }

  private drawMinMax() {
    if (!this.config.showMin && !this.config.showMax) { return; } //no need to do anything if we're not showing min/max

    let valueText: string = '';

    if (this.config.showMin) {
      if (this.minValue != null) {
        valueText = " Min: " + this.formatValue(Number(this.minValue));
      } else {
        valueText = " Min: --";
      }
    }
    if (this.config.showMax) {
      if (this.maxValue != null) {
        valueText += " Max: " + this.formatValue(Number(this.maxValue));
      } else {
        valueText += valueText + " Max: --";
      }
    }
    valueText = valueText.trim();

    if (this.currentMinMaxLength != valueText.length) {
      this.currentMinMaxLength = valueText.length;
      var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.6));
      var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.85));

      // start with large font, no sense in going bigger than the size of the canvas :)
      this.minMaxFontSize = maxTextHeight;
      this.canvasBGCtx.font = "bold " + this.minMaxFontSize.toString() + "px Arial";
      let measure = this.canvasBGCtx.measureText(valueText).width;

      // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
      if (measure > maxTextWidth) {
        let estimateRatio = maxTextWidth / measure;
        this.minMaxFontSize = Math.floor(this.minMaxFontSize * estimateRatio);
        this.canvasBGCtx.font = "bold " + this.minMaxFontSize.toString() + "px Arial";
      }
      // now decrease by 1 to in case still too big
      while (this.canvasBGCtx.measureText(valueText).width > maxTextWidth && this.minMaxFontSize > 0) {
        this.minMaxFontSize--;
        this.canvasBGCtx.font = "bold " + this.minMaxFontSize.toString() + "px Arial";
      }

    }

    this.canvasCtx.font = "bold " + this.minMaxFontSize.toString() + "px Arial";
    this.canvasCtx.textAlign = "left";
    this.canvasCtx.textBaseline="bottom";
    this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasCtx.fillText(valueText,this.canvasEl.nativeElement.width*0.03,this.canvasEl.nativeElement.height*0.97, maxTextWidth);
  }

  /**
   * Transforms a value to be ready for presentation based on Widget configuration settings. Handles
   * data conversions, format masking and decorations.
   *
   * Ex: for Ratio value set to display as percentage with 2 integers and 1 decimals.
   * The conversion will multiply ratio by 100, apply format masking 99.9 and append a % sign. Returned
   * value for a ration of 0.095345 would be: 09.5%
   *
   * @private
   * @param {number} val the numeric value to the formated
   * @return {*}  {string} formated value ready for display
   * @memberof WidgetNumericComponent
   */
  private formatValue(val: number): string {
    let valConverted: any = null;
    let valText: string = null;

    // apply converstion
    valConverted = this.UnitsService.convertUnit(this.config.paths['numericPath'].convertUnitTo, val);

    if (!isNaN(valConverted)) { // retest as convert stuff might have returned a text string
      // apply mask
      valText = this.padValue(valConverted.toFixed(this.config.numDecimal), this.config.numInt, this.config.numDecimal);
    } else {
      valText = valConverted;
    }
    // apply decoration
    switch (this.config.paths['numericPath'].convertUnitTo) {
      case 'percent':
        valText += '%';
        break;

      case 'percentraw':
        valText += '%';
      break;

      default:
        break;
    }

    return valText;
  }

  private padValue(val, int, dec): string {
    let i = 0;
    let s, n, foo;
    let strVal: string
    val = parseFloat(val);
    n = (val < 0);
    val = Math.abs(val);
    if (dec > 0) {
        foo = val.toFixed(dec).toString().split('.');
        s = int - foo[0].length;
        for (; i < s; ++i) {
            foo[0] = '0' + foo[0];
        }
        strVal = (n ? '-' : '') + foo[0] + '.' + foo[1];
    }
    else {
        strVal = Math.round(val).toString();
        s = int - strVal.length;
        for (; i < s; ++i) {
            strVal = '0' + strVal;
        }
        strVal = (n ? '-' : '') + strVal;
    }
    return strVal;
  }

}
