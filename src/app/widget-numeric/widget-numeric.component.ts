import { Component, Input, OnInit, OnDestroy, Inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { SignalKService, pathObject } from '../signalk.service';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { isNumeric } from 'rxjs/util/isNumeric';
import { isNull } from '@angular/compiler/src/output/output_ast';




const defaultConfig: IWidgetConfig = {
  widgetLabel: null,
  paths: {
    "numericPath": {
      description: "Numeric Data",
      path: null,
      source: null,
      pathType: "number",
    }
  },
  units: {
    "numericPath": "unitless"
  },
  selfPaths: true,
  showMax: false,
  showMin: false,
  numDecimal: 1,
  numInt: 1
};

@Component({
  selector: 'app-widget-numeric',
  templateUrl: './widget-numeric.component.html',
  styleUrls: ['./widget-numeric.component.css']
})
export class WidgetNumericComponent implements OnInit, OnDestroy, AfterViewChecked {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;
  @ViewChild('canvasEl') canvasEl: ElementRef;
  @ViewChild('wrapperDiv') wrapperDiv: ElementRef;
    
  activeWidget: IWidget;
  config: IWidgetConfig;
  
  dataValue: number = null;
  maxValue: number = null;
  minValue: number = null;
  dataTimestamp: number = Date.now();



  //subs
  valueSub: Subscription = null;
  
  canvasCtx;


  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService) {
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

    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.updateCanvas();
  }

  ngOnDestroy() {
    this.unsubscribePath();
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
    }
    this.updateCanvas();
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['numericPath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['numericPath'].path, this.config.paths['numericPath'].source).subscribe(
      newValue => {
        this.dataValue = this.UnitsService.convertUnit(this.config.units['numericPath'], newValue);
        // init min/max 
        if (this.minValue === null) { this.minValue = this.dataValue; }
        if (this.maxValue === null) { this.maxValue = this.dataValue; }
        if (this.dataValue > this.maxValue) { this.maxValue = this.dataValue; }
        if (this.dataValue < this.minValue) { this.minValue = this.dataValue; }
        this.updateCanvas();
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;

      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['numericPath'].path);
    }
  }

  openWidgetSettings() {

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

  updateCanvas() {
    if (this.canvasCtx) {
      this.clearCanvas();
      this.drawValue();
      this.drawTitle();
      this.drawUnit();
      if (this.config.showMax || this.config.showMin) {
        this.drawMinMax();
      }
    }
  }

  clearCanvas() {
    this.canvasCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
  }

  drawValue() {
    let maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.15));
    let maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.2));
    let valueText;
    
    if (isNumeric(this.dataValue)) {
      valueText = this.padValue(this.dataValue.toFixed(this.config.numDecimal), this.config.numInt, this.config.numDecimal);
    } else {
      valueText = "--";
    }
    
    //TODO: at high res.large area, this can take way too long :( (500ms+) (added skip by 10 which helps, still feel it could be better...)
    // set font small and make bigger until we hit a max.
    let fontSize = 1;
    this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial"; // need to init it so we do loop at least once :)
    //first increase fontsize by 10, skips lots of loops.
    while ( (this.canvasCtx.measureText(valueText).width < maxTextWidth) && (fontSize < maxTextHeight)) {
      fontSize = fontSize + 10;
      this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial";
    }    
    // now decrease by 1 to find the right size
    while ( (this.canvasCtx.measureText(valueText).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize--;
        this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    this.canvasCtx.textAlign = "center";
    this.canvasCtx.textBaseline="middle";
    
    this.canvasCtx.fillText(valueText,this.canvasEl.nativeElement.width/2,(this.canvasEl.nativeElement.height/2)+(fontSize/15), maxTextWidth);
  }

  drawTitle() {
    var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.2));
    var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.8));
    // set font small and make bigger until we hit a max.
    if (this.config.widgetLabel === null) { return; }
    var fontSize = 1;
    // get color
    this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;

    this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial"; // need to init it so we do loop at least once :)
    while ( (this.canvasCtx.measureText(this.config.widgetLabel).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    this.canvasCtx.textAlign = "left";
    this.canvasCtx.textBaseline="top";
    this.canvasCtx.fillText(this.config.widgetLabel,this.canvasEl.nativeElement.width*0.03,this.canvasEl.nativeElement.height*0.03, maxTextWidth);
  }

  drawUnit() {
    if (this.config.units['numericPath'] == 'unitless') { return; }
    var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.8));
    var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.8));
    // set font small and make bigger until we hit a max.
 
    var fontSize = 1;
    this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial"; // need to init it so we do loop at least once :)
    while ( (this.canvasCtx.measureText(this.config.units['numericPath']).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    this.canvasCtx.textAlign = "right";
    this.canvasCtx.textBaseline="bottom";
    this.canvasCtx.fillText(this.config.units['numericPath'],this.canvasEl.nativeElement.width*0.97,this.canvasEl.nativeElement.height*0.97, maxTextWidth);
  }

  drawMinMax() {
    var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.6));
    var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.85));
    // set font small and make bigger until we hit a max.
 
    let valueText: string = '';
    
    if (this.config.showMin) {
      if (isNumeric(this.minValue)) {
        valueText = valueText + " Min: " + this.padValue(this.minValue.toFixed(this.config.numDecimal), this.config.numInt, this.config.numDecimal);
      } else {
        valueText = valueText + " Min: --";
      }
    }
    if (this.config.showMax) {
      if (isNumeric(this.maxValue)) {
        valueText = valueText + " Max: " + this.padValue(this.maxValue.toFixed(this.config.numDecimal), this.config.numInt, this.config.numDecimal);
      } else {
        valueText = valueText + " Max: --";
      }
    }
    valueText = valueText.trim();
    var fontSize = 1;
    this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial"; // need to init it so we do loop at least once :)
    while ( (this.canvasCtx.measureText(valueText).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    this.canvasCtx.textAlign = "left";
    this.canvasCtx.textBaseline="bottom";
    this.canvasCtx.fillText(valueText,this.canvasEl.nativeElement.width*0.03,this.canvasEl.nativeElement.height*0.97, maxTextWidth);
  }

  padValue(val, int, dec) {
    let i = 0;
    let s, strVal, n;
    val = parseFloat(val);
    n = (val < 0);
    val = Math.abs(val);
    if (dec > 0) {
        strVal = val.toFixed(dec).toString().split('.');
        s = int - strVal[0].length;
        for (; i < s; ++i) {
            strVal[0] = '0' + strVal[0];
        }
        strVal = (n ? '-' : '') + strVal[0] + '.' + strVal[1];
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
