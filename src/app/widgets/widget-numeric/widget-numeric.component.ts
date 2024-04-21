import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';

import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { States } from '../../core/interfaces/signalk-interfaces';

@Component({
    selector: 'app-widget-numeric',
    templateUrl: './widget-numeric.component.html',
    styleUrls: ['./widget-numeric.component.scss'],
    standalone: true
})
export class WidgetNumericComponent extends BaseWidgetComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasMM', {static: true, read: ElementRef}) canvasMM: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;
  @ViewChild('NumWrapperDiv', {static: true, read: ElementRef}) wrapperDiv: ElementRef;


  dataValue: number = null;
  maxValue: number = null;
  minValue: number = null;
  labelColor: string = undefined;
  valueColor: string = undefined;
  dataTimestamp: number = Date.now();
  currentValueLength: number = 0; // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  currentMinMaxLength: number = 0;
  valueFontSize: number = 1;
  minMaxFontSize: number = 1;
  flashOn: boolean = false;
  flashInterval = null;
  dataState: string = States.Normal;

  canvasValCtx: CanvasRenderingContext2D;
  canvasMMCtx: CanvasRenderingContext2D;
  canvasBGCtx: CanvasRenderingContext2D;

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
      numInt: 1,
      textColor: 'text',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.canvasValCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasMMCtx = this.canvasMM.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.getColors(this.widgetProperties.config.textColor);
    this.observeDataStream('numericPath', newValue => {
        this.dataValue = newValue.data.value;
        // init min/max
        if (this.minValue === null) { this.minValue = this.dataValue; }
        if (this.maxValue === null) { this.maxValue = this.dataValue; }
        if (this.dataValue > this.maxValue) { this.maxValue = this.dataValue; }
        if (this.dataValue < this.minValue) { this.minValue = this.dataValue; }

        //start flashing if alarm
        if ((newValue.state == States.Alarm || newValue.state == States.Warn) && !this.flashInterval) {
          this.flashInterval = setInterval(() => {
            this.flashOn = !this.flashOn;
            this.updateCanvas();
          }, 350); // used to flash stuff in alarm
        } else if (newValue.state == States.Normal) {
          // stop alarming if not in alarm state
          clearInterval(this.flashInterval);
        }
        this.dataState = newValue.state;
        this.updateCanvas();
      }
    );

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

  private getColors(color: string): void {
    switch (color) {
      case "text":
        this.labelColor = this.theme.textDark;
        this.valueColor = this.theme.text;
        break;

      case "primary":
        this.labelColor = this.theme.textPrimaryDark;
        this.valueColor = this.theme.textPrimaryLight;
        break;

      case "accent":
        this.labelColor = this.theme.textAccentDark;
        this.valueColor = this.theme.textAccentLight;
        break;

      case "warn":
        this.labelColor = this.theme.textWarnDark;
        this.valueColor = this.theme.textWarnLight;
        break;

      default:
        this.labelColor = this.theme.textDark;
        this.valueColor = this.theme.text;
        break;
    }
  }

  private resizeWidget(): void {
    let rect = this.wrapperDiv.nativeElement.getBoundingClientRect();

    if (rect.height < 50) { return; }
    if (rect.width < 50) { return; }
    if ((this.canvasEl.nativeElement.width != Math.floor(rect.width)) || (this.canvasEl.nativeElement.height != Math.floor(rect.height))) {
      this.canvasEl.nativeElement.width = Math.floor(rect.width);
      this.canvasEl.nativeElement.height = Math.floor(rect.height);
      this.canvasMM.nativeElement.width = Math.floor(rect.width);
      this.canvasMM.nativeElement.height = Math.floor(rect.height);
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
//TODO: Better canvas scaling see https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas
  private updateCanvas() {
    if (this.canvasValCtx) {
      this.canvasValCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
      if (this.widgetProperties.config.showMax || this.widgetProperties.config.showMin) {
        this.canvasMMCtx.clearRect(0,0,this.canvasMM.nativeElement.width, this.canvasMM.nativeElement.height);
        this.drawMinMax();
      }
    }
  }

  private updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0,0,this.canvasBG.nativeElement.width, this.canvasBG.nativeElement.height);
      this.drawTitle();
      this.drawUnit();
    }
  }

  private drawValue() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85);
    let valueText: string;

    if (this.dataValue !== null) {
      //TODO: Check for lon/lat special case -- ugly setup. we should probably have a lon/lat widget for this!
      let cUnit: string = this.widgetProperties.config.paths['numericPath'].convertUnitTo;
      if (cUnit == 'latitudeSec' || cUnit == 'latitudeMin' || cUnit == 'longitudeSec' || cUnit == 'longitudeMin') {
        valueText = this.dataValue.toString();
      } else {
        valueText = this.applyDecorations(this.formatWidgetNumberValue(this.dataValue));
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
      this.canvasValCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
      let measure = this.canvasValCtx.measureText(valueText).width;

      // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
      if (measure > maxTextWidth) {
        let estimateRatio = maxTextWidth / measure;
        this.valueFontSize = Math.floor(this.valueFontSize * estimateRatio);
        this.canvasValCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
      }
      // now decrease by 1 to in case still too big
      while (this.canvasValCtx.measureText(valueText).width > maxTextWidth && this.valueFontSize > 0) {
        this.valueFontSize--;
        this.canvasValCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
      }
    }

    // get color based on zone
    switch (this.dataState) {
      case States.Alarm:
        if (this.flashOn) {
          this.canvasValCtx.fillStyle = this.valueColor;
        } else {
          // draw warn background
          this.canvasValCtx.fillStyle = this.theme.warn;
          this.canvasValCtx.fillRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
          this.canvasValCtx.fillStyle = this.valueColor;
        }
        break;

      case States.Warn:
        if (this.flashOn) {
          this.canvasValCtx.fillStyle = this.valueColor;
        } else {
          // draw warn background
          this.canvasValCtx.fillStyle = "#ffd00050";
          this.canvasValCtx.fillRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
          this.canvasValCtx.fillStyle = this.valueColor;
        }
        break;

      default:
        this.canvasValCtx.fillStyle = this.valueColor;
        break;
    }

    this.canvasValCtx.textAlign = "center";
    this.canvasValCtx.textBaseline = "middle";
    this.canvasValCtx.fillText(valueText,this.canvasEl.nativeElement.width/2,(this.canvasEl.nativeElement.height * 0.5)+(this.valueFontSize/15), maxTextWidth);
  }

  private drawTitle() {
    const maxTextWidth = Math.floor(this.canvasBG.nativeElement.width * 0.94);
    const maxTextHeight = Math.floor(this.canvasBG.nativeElement.height * 0.1);
    // set font small and make bigger until we hit a max.
    if (this.widgetProperties.config.displayName === null) { return; }

    // start with large font, no sense in going bigger than the size of the canvas :)
    let fontSize = maxTextHeight;
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
    this.canvasBGCtx.fillStyle = this.labelColor;
    this.canvasBGCtx.fillText(this.widgetProperties.config.displayName,this.canvasBG.nativeElement.width*0.03,this.canvasBG.nativeElement.height*0.03, maxTextWidth);
  }

  private drawUnit() {
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo == 'unitless') { return; }
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo.startsWith('percent')) { return; }
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo == 'ratio') { return; }
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo.startsWith('lat')) { return; }
    if (this.widgetProperties.config.paths['numericPath'].convertUnitTo.startsWith('lon')) { return; }
    const maxTextWidth = Math.floor(this.canvasBG.nativeElement.width * 0.35);
    const maxTextHeight = Math.floor(this.canvasBG.nativeElement.height * 0.15);

    // start with large font, no sense in going bigger than the size of the canvas :)
    let fontSize = maxTextHeight;
    this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    let measure = this.canvasBGCtx.measureText(this.widgetProperties.config.paths['numericPath'].convertUnitTo).width;

    // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
    if (measure > maxTextWidth) {
      let estimateRatio = maxTextWidth / measure;
      fontSize = Math.floor(fontSize * estimateRatio);
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    // now decrease by 1 in case font is still too big
    while (this.canvasBGCtx.measureText(this.widgetProperties.config.paths['numericPath'].convertUnitTo).width > maxTextWidth && fontSize > 0) {
      fontSize--;
      this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }

    this.canvasBGCtx.textAlign = "right";
    this.canvasBGCtx.textBaseline="bottom";
    this.canvasBGCtx.fillStyle = this.valueColor;
    this.canvasBGCtx.fillText(this.widgetProperties.config.paths['numericPath'].convertUnitTo,this.canvasBG.nativeElement.width*0.97,this.canvasBG.nativeElement.height*0.97, maxTextWidth);
  }

  private drawMinMax() {
    if (!this.widgetProperties.config.showMin && !this.widgetProperties.config.showMax) { return; } //no need to do anything if we're not showing min/max

    let valueText: string = '';
    const maxTextWidth = Math.floor(this.canvasMM.nativeElement.width * 0.45);
    const maxTextHeight = Math.floor(this.canvasMM.nativeElement.height * 0.075);

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
        valueText += " Max: --";
      }
    }
    valueText = valueText.trim();

    if (this.currentMinMaxLength != valueText.length) {
      this.currentMinMaxLength = valueText.length;

      // start with large font, no sense in going bigger than the size of the canvas :)
      this.minMaxFontSize = maxTextHeight;
      this.canvasMMCtx.font = "bold " + this.minMaxFontSize.toString() + "px Arial";
      let measure = this.canvasMMCtx.measureText(valueText).width;

      // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
      if (measure > maxTextWidth) {
        let estimateRatio = maxTextWidth / measure;
        this.minMaxFontSize = Math.floor(this.minMaxFontSize * estimateRatio);
        this.canvasMMCtx.font = "bold " + this.minMaxFontSize.toString() + "px Arial";
      }
      // now decrease by 1 to in case still too big
      while (this.canvasMMCtx.measureText(valueText).width > maxTextWidth && this.minMaxFontSize > 0) {
        this.minMaxFontSize--;
        this.canvasMMCtx.font = "bold " + this.minMaxFontSize.toString() + "px Arial";
      }
    }

    this.canvasMMCtx.textAlign = "left";
    this.canvasMMCtx.textBaseline="bottom";
    this.canvasMMCtx.fillStyle = this.valueColor;
    this.canvasMMCtx.fillText(valueText, this.canvasMM.nativeElement.width*0.03, this.canvasMM.nativeElement.height*0.95, maxTextWidth);
  }

  private applyDecorations(txtValue: string): string {
    // apply decoration when required
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
}
