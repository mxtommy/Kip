import { Component, Input, OnInit, OnDestroy, Inject, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import { MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { ModalWidgetComponent, IModalSettings } from '../modal-widget/modal-widget.component';
import { SignalKService, pathObject } from '../signalk.service';
import { WidgetManagerService, IWidget } from '../widget-manager.service';
import { UnitConvertService } from '../unit-convert.service';
import { isNumeric } from 'rxjs/util/isNumeric';


interface IWidgetConfig {
  signalKPath: string;
  signalKSource: string;
  label: string;
  unitGroup: string;
  unitName: string;
  numDecimal: number; // number of decimal places if a number
  numInt: number;
}

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
  

  converter = this.UnitConvertService.getConverter();
  
  activeWidget: IWidget;

  dataValue: any = null;
  dataTimestamp: number = Date.now();

  widgetConfig: IWidgetConfig = {
    signalKPath: null,
    signalKSource: 'default',
    label: null,
    unitGroup: 'discreet',
    unitName: 'no unit',
    numDecimal: 2,
    numInt: 2
  }

  //subs
  valueSub: Subscription = null;
  
  canvasCtx;


  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitConvertService: UnitConvertService) {
  }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);
    } else {
      this.widgetConfig = this.activeWidget.config; // load existing config.
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
    if (this.widgetConfig.signalKPath === null) { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.widgetConfig.signalKPath).subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }
        let source: string;
        if (this.widgetConfig.signalKSource == 'default') {
          source = pathObject.defaultSource;
        } else {
          source = this.widgetConfig.signalKSource;
        }

        this.dataTimestamp = pathObject.sources[source].timestamp;

        if (pathObject.sources[source].value === null) {
          this.dataValue = null;
          return;
        }

        let value:number = pathObject.sources[source].value;
        let converted = this.converter[this.widgetConfig.unitGroup][this.widgetConfig.unitName](value);
        this.dataValue = converted.toFixed(this.widgetConfig.numDecimal);
        this.updateCanvas();
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.widgetConfig.signalKPath)
    }
  }

  openWidgetSettings() {

    //prepare current data
    let settingsData: IModalSettings = {
      paths: [
        {
          description: "Numeric data path",
          path: this.widgetConfig.signalKPath,
          source: this.widgetConfig.signalKSource,
          type: "number",
          unitGroup: this.widgetConfig.unitGroup,
          unitName: this.widgetConfig.unitName
        }
      ],
      widgetLabel: this.widgetConfig.label,
      numDecimal: this.widgetConfig.numDecimal,
      numInt: this.widgetConfig.numInt,
    }

    

    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: settingsData
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
     /* if (result) {
        console.debug("Updating widget config");
        this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
        this.widgetConfig.signalKPath = result.signalKPath;
        this.widgetConfig.signalKSource = result.signalKSource;
        this.widgetConfig.label = result.label;
        this.widgetConfig.unitGroup = result.unitGroup;
        this.widgetConfig.unitName = result.unitName;
        this.widgetConfig.numDecimal = result.numDecimal;
        this.widgetConfig.numInt = result.numInt;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);
        this.subscribePath();
      }*/

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
    }
  }

  clearCanvas() {
    this.canvasCtx.clearRect(0,0,this.canvasEl.nativeElement.width, this.canvasEl.nativeElement.height);
  }

  drawValue() {
    let maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.15));
    let maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.2));
    let valueText = "--";
    
    if (isNumeric(this.dataValue)) {
      valueText = this.padValue(this.dataValue, this.widgetConfig.numInt, this.widgetConfig.numDecimal);
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
    var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.8));
    var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.8));
    // set font small and make bigger until we hit a max.
 
    var fontSize = 1;
    // get color
    this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;

    this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial"; // need to init it so we do loop at least once :)
    while ( (this.canvasCtx.measureText(this.widgetConfig.label).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    this.canvasCtx.textAlign = "left";
    this.canvasCtx.textBaseline="top";
    this.canvasCtx.fillText(this.widgetConfig.label,this.canvasEl.nativeElement.width*0.03,this.canvasEl.nativeElement.height*0.03, maxTextWidth);
  }

  drawUnit() {
    var maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.8));
    var maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.8));
    // set font small and make bigger until we hit a max.
 
    var fontSize = 1;
    this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial"; // need to init it so we do loop at least once :)
    while ( (this.canvasCtx.measureText(this.widgetConfig.unitName).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasCtx.font = "bold " + fontSize.toString() + "px Arial";
    }
    this.canvasCtx.textAlign = "right";
    this.canvasCtx.textBaseline="bottom";
    this.canvasCtx.fillText(this.widgetConfig.unitName,this.canvasEl.nativeElement.width*0.97,this.canvasEl.nativeElement.height*0.97, maxTextWidth);
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


/*
@Component({
  selector: 'numeric-widget-modal',
  templateUrl: './widget-numeric.modal.html',
  styleUrls: ['./widget-numeric.component.css']
})
export class WidgetNumericModalComponent implements OnInit {

  settingsData: IWidgetConfig;
  selfPaths: boolean = true;
  availablePaths: Array<string> = [];
  availableSources: Array<string>;
  availableUnitGroups: string[];
  availableUnitNames: string[];
  
  converter: Object = this.UnitConvertService.getConverter();

  constructor(
    private SignalKService: SignalKService,
    private UnitConvertService: UnitConvertService,
    public dialogRef:MatDialogRef<WidgetNumericModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) { }

  ngOnInit() {
    this.settingsData = this.data;

    //populate available choices
    this.availablePaths = this.SignalKService.getPathsByType('number').sort();
    if (this.availablePaths.includes(this.settingsData.signalKPath)) {
      this.settingsDataUpdatePath(); //TODO: this wipes out existing config, not good when editing existing config...
    }
    this.availableUnitGroups = Object.keys(this.converter);
    if (this.converter.hasOwnProperty(this.settingsData.unitGroup)) {
            this.availableUnitNames = Object.keys(this.converter[this.settingsData.unitGroup]);
    }
  }


  settingsDataUpdatePath() { // called when we choose a new path. resets the rest with default info of this path
    let pathObject = this.SignalKService.getPathObject(this.settingsData.signalKPath);
    if (pathObject === null) { return; }
    this.availableSources = ['default'].concat(Object.keys(pathObject.sources));
    this.settingsData.signalKSource = 'default';
    this.settingsData.numDecimal = this.data.numDecimal;
    if (pathObject.meta) {
      if (typeof(pathObject.meta.abbreviation) == 'string') {
        this.settingsData.label = pathObject.meta.abbreviation;
      } else if (typeof(pathObject.meta.label) == 'string') {
        this.settingsData.label = pathObject.meta.label;
      } else {
        this.settingsData.label = this.settingsData.signalKPath; // who knows?
      }
    } else {
      this.settingsData.label = this.settingsData.signalKPath;// who knows?
    }
  }

  updateUnitType() {
    if (this.converter.hasOwnProperty(this.settingsData.unitGroup)) {
      this.availableUnitNames = Object.keys(this.converter[this.settingsData.unitGroup]);
      // select first name
      this.settingsData.unitName = this.availableUnitNames[0];
    }
  }


  submitConfig() {
    this.dialogRef.close(this.settingsData);
  }
  
}
*/