import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Subscription } from 'rxjs';

import { SignalKService } from '../signalk.service';
import { AppSettingsService } from '../app-settings.service';
import { IWidget, IWidgetSvcConfig } from '../widget-manager.service';


@Component({
  selector: 'app-widget-text-generic',
  templateUrl: './widget-text-generic.component.html',
  styleUrls: ['./widget-text-generic.component.css']
})
export class WidgetTextGenericComponent implements OnInit, AfterViewChecked, OnDestroy {

  @Input('widgetProperties') widgetProperties!: IWidget;
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;
  @ViewChild('textGenericWrapperDiv', {static: true, read: ElementRef}) wrapperDiv: ElementRef;

  defaultConfig: IWidgetSvcConfig = {
    displayName: null,
    filterSelfPaths: true,
    paths: {
      "stringPath": {
        description: "String Data",
        path: null,
        source: null,
        pathType: "string",
        isPathConfigurable: true,
      }
    },
  };

  dataValue: any = null;
  dataTimestamp: number = Date.now();
  valueFontSize: number = 1;
  currentValueLength: number = 0; // length (in charaters) of value text to be displayed. if changed from last time, need to recalculate font size...
  canvasCtx;
  canvasBGCtx;

  //subs
  valueSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;


  constructor(
    private signalKService: SignalKService,
    private appSettingsService: AppSettingsService, // need for theme change subscription
    ) {
  }

  ngOnInit() {
    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');

    this.subscribePath();
    this.subscribeTheme();
    this.resizeWidget();
  }

  ngOnDestroy() {
    this.unsubscribePath();
    this.unsubscribeTheme();
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
      this.updateCanvas();
      this.updateCanvasBG();
    } else {
      this.updateCanvasBG();
    }

  }


  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.widgetProperties.config.paths['stringPath'].path) != 'string') { return } // nothing to sub to...
    this.valueSub = this.signalKService.subscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['stringPath'].path, this.widgetProperties.config.paths['stringPath'].source).subscribe(
      newValue => {
        this.dataValue = newValue.value;
        this.updateCanvas();
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.signalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['stringPath'].path)
    }
  }
  // Subscribe to theme event
  subscribeTheme() {
    this.themeNameSub = this.appSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
      setTimeout(() => {   // need a delay so browser getComputedStyles has time to complete theme application.
        this.drawTitle();
        this.drawValue();
      }, 100);
    })
  }

  unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
    }
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
      this.drawTitle();
    }
  }

  drawValue() {
    let maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.15));
    let maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.2));
    let valueText : string;

    if (this.dataValue === null) {
      valueText = "--";
    } else {
      valueText = this.dataValue;
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

    this.canvasCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
    this.canvasCtx.textAlign = "center";
    this.canvasCtx.textBaseline="middle";
    this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasCtx.fillText(valueText,this.canvasEl.nativeElement.width/2,(this.canvasEl.nativeElement.height/2)+(this.valueFontSize/15), maxTextWidth);
  }

  drawTitle() {
    var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.2));
    var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.8));
    // set font small and make bigger until we hit a max.
    if (this.widgetProperties.config.displayName === null) { return; }
    var fontSize = 1;

    this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial"; // need to init it so we do loop at least once :)
    while ( (this.canvasBGCtx.measureText(this.widgetProperties.config.displayName).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }

    this.canvasBGCtx.textAlign = "left";
    this.canvasBGCtx.textBaseline="top";
    this.canvasBGCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasBGCtx.fillText(this.widgetProperties.config.displayName,this.canvasEl.nativeElement.width*0.03,this.canvasEl.nativeElement.height*0.03, maxTextWidth);
  }




}
