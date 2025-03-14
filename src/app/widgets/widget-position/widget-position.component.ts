import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
    selector: 'app-widget-position',
    templateUrl: './widget-position.component.html',
    styleUrls: ['./widget-position.component.scss'],
    standalone: true
})

export class WidgetPositionComponent extends BaseWidgetComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasMM', {static: true, read: ElementRef}) canvasMM: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;
  @ViewChild('NumWrapperDiv', {static: true, read: ElementRef}) wrapperDiv: ElementRef;

  latPos: number = 0;
  longPos: number = 0;
  labelColor: string = undefined;
  valueColor: string = undefined;
  currentValueLength: number = 0; // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  valueFontSize: number = 1;


  canvasValCtx: CanvasRenderingContext2D;
  canvasMMCtx: CanvasRenderingContext2D;
  canvasBGCtx: CanvasRenderingContext2D;

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Position',
      filterSelfPaths: true,
      paths: {
        "longPath": {
          description: "Longitude",
          path: 'self.navigation.position.longitude',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "longitudeMin",
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        },
        "latPath": {
          description: "Latitude",
          path: 'self.navigation.position.latitude',
          source: 'default',
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "latitudeMin",
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          sampleTime: 500
        }
      },
      textColor: 'text',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.initWidget();
    this.canvasValCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasMMCtx = this.canvasMM.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.getColors(this.widgetProperties.config.textColor);
    this.observeDataStream('longPath', newValue => {
      this.longPos = newValue.data.value;
      this.updateCanvas();
    });
    this.observeDataStream('latPath', newValue => {
      this.latPos = newValue.data.value;
      this.updateCanvas();
    });

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
    }
  }

  private updateCanvasBG() {
    if (this.canvasBGCtx) {
      this.canvasBGCtx.clearRect(0,0,this.canvasBG.nativeElement.width, this.canvasBG.nativeElement.height);
      this.drawTitle();
    }
  }

  private drawValue() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85);
    let latPosText = "latitude n/a";
    let longPosText =  "longitude n/a"
    if (this.longPos !== null) {
        latPosText = this.latPos.toString() ;
    }
    if (this.latPos !== null) {
      longPosText = this.longPos.toString();
    }

    //check if length of string has changed since last time.
    if (this.currentValueLength != latPosText.length) {
      this.currentValueLength = latPosText.length;
      this.valueFontSize = (maxTextHeight/2); // we use two lines
      this.canvasValCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
      let measure = this.canvasValCtx.measureText(latPosText).width;
      // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
      if (measure > maxTextWidth) {
        let estimateRatio = maxTextWidth / measure;
        this.valueFontSize = Math.floor(this.valueFontSize * estimateRatio);
        this.canvasValCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
      }
      while (this.canvasValCtx.measureText(latPosText).width > maxTextWidth && this.valueFontSize > 0) {
        this.valueFontSize--;
      }
    }

    let center  = this.canvasEl.nativeElement.width/2;
    let middle = this.canvasEl.nativeElement.height/2;

    this.canvasValCtx.textAlign = "center";
    this.canvasValCtx.textBaseline = "middle";
    this.canvasValCtx.fillStyle = this.valueColor;
    this.canvasValCtx.font = "bold " + this.valueFontSize.toString() + "px Arial";
    this.canvasValCtx.fillText(latPosText, center, middle - (this.valueFontSize/2), maxTextWidth);
    this.canvasValCtx.fillText(longPosText, center, middle + (this.valueFontSize/2), maxTextWidth);
  }

  private drawTitle() {
    const maxTextWidth = Math.floor(this.canvasBG.nativeElement.width * 0.94);
    const maxTextHeight = Math.floor(this.canvasBG.nativeElement.height * 0.1);
    // set font small and make bigger until we hit a max.
    if (this.widgetProperties.config.displayName === null) { return; }

    let fontSize = maxTextHeight;
    let measure = this.canvasBGCtx.measureText(this.widgetProperties.config.displayName).width;

    // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
    if (measure > maxTextWidth) {
      let estimateRatio = maxTextWidth / measure;
      fontSize = Math.floor(fontSize * estimateRatio);
    }
    // now decrease by 1 to in case still too big
    while (this.canvasBGCtx.measureText(this.widgetProperties.config.displayName).width > maxTextWidth && fontSize > 0) {
      fontSize--;
    }
    this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    this.canvasBGCtx.textAlign = "left";
    this.canvasBGCtx.textBaseline="top";
    this.canvasBGCtx.fillStyle = this.labelColor;
    this.canvasBGCtx.fillText(this.widgetProperties.config.displayName,this.canvasBG.nativeElement.width*0.03,this.canvasBG.nativeElement.height*0.03, maxTextWidth);
  }

}
