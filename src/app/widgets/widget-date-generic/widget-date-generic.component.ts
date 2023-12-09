import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { formatDate } from '@angular/common';

import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-date-generic',
  templateUrl: './widget-date-generic.component.html',
  styleUrls: ['./widget-date-generic.component.css']
})
export class WidgetDateGenericComponent extends BaseWidgetComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;
  @ViewChild('wrapperDiv', {static: true, read: ElementRef}) wrapperDiv: ElementRef;

  dataValue: any = null;
  dataTimestamp: number = Date.now();
  valueFontSize = 1;

  // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  currentValueLength = 0;
  canvasCtx;
  canvasBGCtx;

  labelColor: string = undefined;
  valueColor: string = undefined;

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Time Label',
      filterSelfPaths: true,
      paths: {
        'gaugePath': {
          description: 'String Data',
          path: null,
          source: null,
          pathType: 'Date',
          isPathConfigurable: true,
          sampleTime: 500
        }
      },
      dateFormat: 'dd/MM/yyyy HH:mm:ss',
      dateTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      textColor: 'text',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.getColors(this.widgetProperties.config.textColor);
    this.observeDataStream('gaugePath', newValue => {
      this.dataValue = newValue.value;
      this.updateCanvas();
    });

    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.resizeWidget();
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
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
    const rect = this.wrapperDiv.nativeElement.getBoundingClientRect();

    if (rect.height < 50) { return; }
    if (rect.width < 50) { return; }
    if ((this.canvasEl.nativeElement.width != Math.floor(rect.width)) || (this.canvasEl.nativeElement.height != Math.floor(rect.height))) {
      this.canvasEl.nativeElement.width = Math.floor(rect.width);
      this.canvasEl.nativeElement.height = Math.floor(rect.height);
      this.canvasBG.nativeElement.width = Math.floor(rect.width);
      this.canvasBG.nativeElement.height = Math.floor(rect.height);
      this.currentValueLength = 0; // will force resetting the font size
      this.updateCanvas();
      this.updateCanvasBG();
    } else {
      this.updateCanvasBG();
    }

  }
/* ******************************************************************************************* */
/*                                  Canvas                                                     */
/* ******************************************************************************************* */
  updateCanvas() {
    if (this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawValue();
    }
  }

  updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0, 0, this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
      this.drawTitle();
    }
  }

  drawValue() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85);
    let valueText: string;

    if (this.dataValue === null) {
      valueText = '--';
    } else {

      valueText = this.dataValue;
      try {
        let date = formatDate(valueText, this.widgetProperties.config.dateFormat, 'en-US', this.widgetProperties.config.dateTimezone);
        valueText = date;
      } catch (error) {
        valueText = error;
        console.log("[Date Value Widget]: " + error);
      }
    }

    // check if length of string has changed since last time.
    if (this.currentValueLength != valueText.length) {
      // we need to set font size...
      this.currentValueLength = valueText.length;

      // start with large font, no sense in going bigger than the size of the canvas :)
      this.valueFontSize = maxTextHeight;
      this.canvasCtx.font = 'bold ' + this.valueFontSize.toString() + 'px Arial';
      const measure = this.canvasCtx.measureText(valueText).width;

      // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
      if (measure > maxTextWidth) {
        const estimateRatio = maxTextWidth / measure;
        this.valueFontSize = Math.floor(this.valueFontSize * estimateRatio);
        this.canvasCtx.font = 'bold ' + this.valueFontSize.toString() + 'px Arial';
      }
      // now decrease by 1 to in case still too big
      while (this.canvasCtx.measureText(valueText).width > maxTextWidth && this.valueFontSize > 0) {
        this.valueFontSize--;
        this.canvasCtx.font = 'bold ' + this.valueFontSize.toString() + 'px Arial';
      }
    }

    this.canvasCtx.font = 'bold ' + this.valueFontSize.toString() + 'px Arial';
    this.canvasCtx.textAlign = 'center';
    this.canvasCtx.textBaseline = 'middle';
    this.canvasCtx.fillStyle = this.valueColor;
    this.canvasCtx.fillText(
      valueText,
      this.canvasEl.nativeElement.width / 2,
      (this.canvasEl.nativeElement.height / 2) + (this.valueFontSize / 15),
      maxTextWidth
    );
  }

  drawTitle() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.94);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.1);
    // set font small and make bigger until we hit a max.
    if (this.widgetProperties.config.displayName === null) { return; }
    let fontSize = 1;

    this.canvasBGCtx.font = 'bold ' + fontSize.toString() + 'px Arial'; // need to init it, so we do loop at least once :)
    while ( (this.canvasBGCtx.measureText(this.widgetProperties.config.displayName).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasBGCtx.font = 'bold ' + fontSize.toString() + 'px Arial';
    }

    this.canvasBGCtx.textAlign = 'left';
    this.canvasBGCtx.textBaseline = 'top';
    this.canvasBGCtx.fillStyle = this.labelColor;
    this.canvasBGCtx.fillText(
      this.widgetProperties.config.displayName,
      this.canvasEl.nativeElement.width * 0.03,
      this.canvasEl.nativeElement.height * 0.03,
      maxTextWidth);

  }




}
