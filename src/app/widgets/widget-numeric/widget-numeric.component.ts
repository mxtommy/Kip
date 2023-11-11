import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';

import { IZoneState } from "../../app-settings.interfaces";
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-numeric',
  templateUrl: './widget-numeric.component.html',
  styleUrls: ['./widget-numeric.component.scss']
})
export class WidgetNumericComponent extends BaseWidgetComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;
  @ViewChild('NumWrapperDiv', {static: true, read: ElementRef}) wrapperDiv: ElementRef;
  @ViewChild('warn', {static: true, read: ElementRef}) private warnElement: ElementRef;
  @ViewChild('warncontrast', {static: true, read: ElementRef}) private warnContrastElement: ElementRef;

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

  canvasCtx;
  canvasBGCtx;

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Gauge Label',
      filterSelfPaths: true,
      paths: {
        "numericPath": {
          description: "Numeric Data",
          path: null,
          source: null,
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "unitless",
          sampleTime: 500
        }
      },
      showMax: false,
      showMin: false,
      numDecimal: 1,
      numInt: 1
    };
  }

  ngOnInit() {
    this.observeDataStream('numericPath', newValue => {
        this.dataValue = newValue.value;

        // init min/max
        if (this.minValue === null) { this.minValue = this.dataValue; }
        if (this.maxValue === null) { this.maxValue = this.dataValue; }
        if (this.dataValue > this.maxValue) { this.maxValue = this.dataValue; }
        if (this.dataValue < this.minValue) { this.minValue = this.dataValue; }



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

        this.updateCanvas();
      }
    );

    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.resizeWidget();
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();

    if (this.flashInterval) {
      clearInterval(this.flashInterval);
      this.flashInterval = null;
    }
  }

  ngAfterViewChecked() {
    this.resizeWidget();
  }

  private resizeWidget(): void {
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


/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
  private updateCanvas() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
      if (this.widgetProperties.config.showMax || this.widgetProperties.config.showMin) {
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
      //TODO: Check for lon/lat special case -- ugly setup. we should probably have a lon/lat wodget for this!
      let cUnit = this.widgetProperties.config.paths['numericPath'].convertUnitTo;
      if (cUnit == 'latitudeSec' || cUnit == 'latitudeMin' || cUnit == 'longitudeSec' || cUnit == 'longitudeMin') {
        valueText = this.dataValue.toString();
      } else {
        valueText = this.applyDecorations(this.formatWidgetNumberValue(this.dataValue));
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
    if (this.widgetProperties.config.displayName === null) { return; }

    // start with large font, no sense in going bigger than the size of the canvas :)
    var fontSize = maxTextHeight;
    this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    let measure = this.canvasBGCtx.measureText(this.widgetProperties.config.displayName).width;

    // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
    if (measure > maxTextWidth) {
      let estimateRatio = maxTextWidth / measure;
      fontSize = Math.floor(fontSize * estimateRatio);
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    // now decrease by 1 to in case still too big
    while (this.canvasBGCtx.measureText(this.widgetProperties.config.displayName).width > maxTextWidth && fontSize > 0) {
      fontSize--;
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }

    this.canvasBGCtx.textAlign = "left";
    this.canvasBGCtx.textBaseline="top";
    this.canvasBGCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasBGCtx.fillText(this.widgetProperties.config.displayName,this.canvasEl.nativeElement.width*0.03,this.canvasEl.nativeElement.height*0.03, maxTextWidth);
  }

  private drawUnit() {
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo == 'unitless') { return; }
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo.startsWith('percent')) { return; }
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo == 'ratio') { return; }
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo.startsWith('lat')) { return; }
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo.startsWith('lon')) { return; }
    var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.8));
    var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.8));

    // start with large font, no sense in going bigger than the size of the canvas :)
    var fontSize = maxTextHeight;
    this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    let measure = this.canvasBGCtx.measureText(this.widgetProperties.config.paths['numericPath'].convertUnitTo).width;

    // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
    if (measure > maxTextWidth) {
      let estimateRatio = maxTextWidth / measure;
      fontSize = Math.floor(fontSize * estimateRatio);
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    // now decrease by 1 to in case still too big
    while (this.canvasBGCtx.measureText(this.widgetProperties.config.paths['numericPath'].convertUnitTo).width > maxTextWidth && fontSize > 0) {
      fontSize--;
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }

    this.canvasBGCtx.textAlign = "right";
    this.canvasBGCtx.textBaseline="bottom";
    this.canvasBGCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasBGCtx.fillText(this.widgetProperties.config.paths['numericPath'].convertUnitTo,this.canvasEl.nativeElement.width*0.97,this.canvasEl.nativeElement.height*0.97, maxTextWidth);
  }

  private drawMinMax() {
    if (!this.widgetProperties.config.showMin && !this.widgetProperties.config.showMax) { return; } //no need to do anything if we're not showing min/max

    let valueText: string = '';

    if (this.widgetProperties.config.showMin) {
      if (this.minValue != null) {
        valueText = " Min: " + this.applyDecorations(this.formatWidgetNumberValue(this.minValue));
      } else {
        valueText = " Min: --";
      }
    }
    if (this.widgetProperties.config.showMax) {
      if (this.maxValue != null) {
        valueText += " Max: " + this.applyDecorations(this.formatWidgetNumberValue(this.maxValue));
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

  private applyDecorations(txtValue: string): string {
    // apply decoration when requied
    switch (this.widgetProperties.config.paths['numericPath'].convertUnitTo) {
      case 'percent':
        txtValue += '%';
        break;

      case 'percentraw':
        txtValue += '%';
      break;

      default:
        break;
    }
    return txtValue;
  }

  // private padValue(val, int, dec): string {
  //   let i = 0;
  //   let s, n, foo;
  //   let strVal: string
  //   val = parseFloat(val);
  //   n = (val < 0);
  //   val = Math.abs(val);
  //   if (dec > 0) {
  //       foo = val.toFixed(dec).toString().split('.');
  //       s = int - foo[0].length;
  //       for (; i < s; ++i) {
  //           foo[0] = '0' + foo[0];
  //       }
  //       strVal = (n ? '-' : '') + foo[0] + '.' + foo[1];
  //   }
  //   else {
  //       strVal = Math.round(val).toString();
  //       s = int - strVal.length;
  //       for (; i < s; ++i) {
  //           strVal = '0' + strVal;
  //       }
  //       strVal = (n ? '-' : '') + strVal;
  //   }
  //   return strVal;
  // }

}
