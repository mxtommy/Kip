import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { BaseWidgetComponent } from '../../core/components/base-widget/base-widget.component';


@Component({
    selector: 'app-widget-text-generic',
    templateUrl: './widget-text-generic.component.html',
    styleUrls: ['./widget-text-generic.component.css'],
    standalone: true
})
export class WidgetTextGenericComponent extends BaseWidgetComponent implements OnInit, AfterViewChecked, OnDestroy {
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;
  @ViewChild('textGenericWrapperDiv', {static: true, read: ElementRef}) wrapperDiv: ElementRef;

  dataValue: any = null;
  dataTimestamp: number = Date.now();
  valueFontSize: number = 1;
  currentValueLength: number = 0; // length (in charaters) of value text to be displayed. if changed from last time, need to recalculate font size...
  canvasCtx: CanvasRenderingContext2D;
  canvasBGCtx: CanvasRenderingContext2D;
  labelColor: string = undefined;
  valueColor: string = undefined;

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Gauge Label',
      filterSelfPaths: true,
      paths: {
        "stringPath": {
          description: "String Data",
          path: null,
          source: null,
          pathType: "string",
          isPathConfigurable: true,
          sampleTime: 500
        }
      },
      color: 'white',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.initWidget();
    this.getColors(this.widgetProperties.config.color);
    this.canvasCtx = this.canvasEl.nativeElement.getContext('2d');
    this.canvasBGCtx = this.canvasBG.nativeElement.getContext('2d');
    this.resizeWidget();

    this.observeDataStream('stringPath', newValue => {
      this.dataValue = newValue.data.value;
      this.updateCanvas();
    });
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
  }

  ngAfterViewChecked() {
    this.resizeWidget();
  }

  private getColors(color: string): void {
    switch (color) {
      case "white":
        this.labelColor = this.theme.white;
        this.valueColor = this.theme.white;
        break;
      case "blue":
        this.labelColor = this.theme.blue;
        this.valueColor = this.theme.blue;
        break;
      case "green":
        this.labelColor = this.theme.green;
        this.valueColor = this.theme.green;
        break;
      case "pink":
        this.labelColor = this.theme.pink;
        this.valueColor = this.theme.pink;
        break;
      case "orange":
        this.labelColor = this.theme.orange;
        this.valueColor = this.theme.orange;
        break;
      case "purple":
        this.labelColor = this.theme.purple;
        this.valueColor = this.theme.purple;
        break;
      case "grey":
        this.labelColor = this.theme.grey;
        this.valueColor = this.theme.grey;
        break;
      case "yellow":
        this.labelColor = this.theme.yellow;
        this.valueColor = this.theme.yellow;
        break;
      default:
        this.labelColor = this.theme.white;
        this.valueColor = this.theme.white;
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
      this.canvasBG.nativeElement.width = Math.floor(rect.width);
      this.canvasBG.nativeElement.height = Math.floor(rect.height);
      this.currentValueLength = 0; //will force resetting the font size
      this.updateCanvas();
      this.updateCanvasBG();
    } else {
      this.updateCanvasBG();
    }

  }



/* ******************************************************************************************* */
/*                                  Canvas drawing                                             */
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
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.85);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.85);
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
    this.canvasCtx.fillStyle = this.valueColor;
    this.canvasCtx.fillText(valueText,this.canvasEl.nativeElement.width/2,(this.canvasEl.nativeElement.height/2)+(this.valueFontSize/15), maxTextWidth);
  }

  drawTitle() {
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width * 0.94);
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height * 0.1);
    // set font small and make bigger until we hit a max.
    if (this.widgetProperties.config.displayName === null) { return; }
    let fontSize = 1;

    this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial"; // need to init it so we do loop at least once :)
    while ( (this.canvasBGCtx.measureText(this.widgetProperties.config.displayName).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasBGCtx.font = "bold " + fontSize.toString() + "px Arial";
    }

    this.canvasBGCtx.textAlign = "left";
    this.canvasBGCtx.textBaseline="top";
    this.canvasBGCtx.fillStyle = this.labelColor;
    this.canvasBGCtx.fillText(this.widgetProperties.config.displayName,this.canvasEl.nativeElement.width*0.03,this.canvasEl.nativeElement.height*0.03, maxTextWidth);
  }
}
