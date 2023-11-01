import { Component, OnInit, OnChanges, OnDestroy, AfterViewChecked, ViewChild, ElementRef, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';

import { SignalkRequestsService } from '../../signalk-requests.service';
import { NotificationsService } from '../../notifications.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';


@Component({
  selector: 'app-widget-button',
  templateUrl: './widget-button.component.html',
  styleUrls: ['./widget-button.component.scss']
})
export class WidgetButtonComponent extends BaseWidgetComponent implements OnInit, OnChanges, OnDestroy, AfterViewChecked {
  @ViewChild('btnDiv', {static: true, read: ElementRef}) divBtnElement: ElementRef;
  @ViewChild('lightDiv', {static: true, read: ElementRef}) divLightElement: ElementRef;
  @ViewChild('btnLabelCanvas', {static: true, read: ElementRef}) canvasBtnTxtElement: ElementRef;

  public buttonBorberColorOn: string = "";
  public buttonColorOn: string = "";
  public buttonLabelColorOn: string = "";
  public buttonBorberColorOff: string = "";
  public buttonColorOff: string = "";
  public buttonLabelColorOff: string = "";
  public lightColorOn: string = "";
  public lightColorOff: string = "";

  public canvasButtonTxt;
  private currentValueLength: number = 0; // length (in charaters) of value text to be displayed. if changed from last time, need to recalculate font size...
  private valueFontSize: number = 1;

  public state: boolean = null;
  pressed = false;
  timeoutHandler;

  skRequestSub = new Subscription; // Request result observer

  constructor(
    private signalkRequestsService: SignalkRequestsService,
    private notification: NotificationsService
    ) {
      super();

      this.defaultConfig = {
        displayName: 'Switch Label',
        filterSelfPaths: true,
        paths: {
          "boolPath": {
            description: "Boolean Data",
            path: null,
            source: null,
            pathType: "boolean",
            isPathConfigurable: true,
            convertUnitTo: "unitless",
            sampleTime: 500
          }
        },
        putEnable: false,
        putMomentary: false,
        putMomentaryValue: true,
        barColor: 'accent',
      };
  }

  ngOnInit() {
    this.canvasButtonTxt = this.canvasBtnTxtElement.nativeElement.getContext('2d');

    this.observeDataStream('boolPath', newValue => {
      this.state = newValue.value;
      this.updateBtnCanvas();
      }
    );
    this.subscribeSKRequest();
  }

  private updateGaugeSettings() {
    this.buttonColorOff = ''; //this.theme.background;
    this.buttonColorOn = this.theme.background;
    switch (this.widgetProperties.config.barColor) {
      case "primary":
        this.buttonLabelColorOff = this.theme.background;
        this.buttonLabelColorOn = this.theme.primary;
        this.buttonBorberColorOff = this.theme.primary;
        this.buttonBorberColorOn = this.theme.primaryDark;
        this.lightColorOff = this.theme.background;
        this.lightColorOn = this.theme.primaryDark;
        break;

      case "accent":
        this.buttonLabelColorOff = this.theme.background;
        this.buttonLabelColorOn = this.theme.accent;
        this.buttonBorberColorOff = this.theme.accent;
        this.buttonBorberColorOn = this.theme.accentDark;
        this.lightColorOff = this.theme.background;
        this.lightColorOn =  this.theme.accentDark;
        break;

      case "warn":
        this.buttonLabelColorOff = this.theme.background;
        this.buttonLabelColorOn = this.theme.warn;
        this.buttonBorberColorOff = this.theme.warn;;
        this.buttonBorberColorOn = this.theme.warnDark;
        this.lightColorOff = this.theme.background;
        this.lightColorOn = this.theme.warnDark;
        break;
    }
  }

  ngAfterViewChecked() {
    this.resizeWidget();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.theme) {
      this.updateGaugeSettings();
      this.updateBtnCanvas();
    }
  }

  private resizeWidget() {
    let rect = this.divBtnElement.nativeElement.getBoundingClientRect();

    if (rect.height < 50) { return; }
    if (rect.width < 50) { return; }
    if ((this.canvasBtnTxtElement.nativeElement.width != Math.floor(rect.width)) || (this.canvasBtnTxtElement.nativeElement.height != Math.floor(rect.height))) {
      this.canvasBtnTxtElement.nativeElement.width = Math.floor(rect.width);
      this.canvasBtnTxtElement.nativeElement.height = Math.floor(rect.height);
      this.currentValueLength = 0; //will force resetting the font size
      this.updateBtnCanvas();
    }

  }

  private subscribeSKRequest() {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetProperties.uuid) {
        let errMsg = `Button ${this.widgetProperties.config.displayName}: `;
        if (requestResult.statusCode != 200){
          if (requestResult.message){
            errMsg += requestResult.message;
          } else {
            errMsg += requestResult.statusCode + " - " +requestResult.statusCodeDescription;
          }
          this.notification.sendSnackbarNotification(errMsg, 0);
        }
      }
    });
  }

  private unsubscribeSKRequest() {
    this.skRequestSub.unsubscribe();
  }

  public handleClickDown() {
    if (!this.widgetProperties.config.putEnable) { return; }

    if (!this.widgetProperties.config.putMomentary) {
      //on/off mode. Send whatever we're not :)
      this.signalkRequestsService.putRequest(
        this.widgetProperties.config.paths['boolPath'].path,
        this.widgetProperties.config.paths['boolPath'].source,
        this.widgetProperties.uuid
      );

      if (!this.state) {
        return;
      }
    } else {
      // momentary mode
      this.pressed = true;

      // send it once to start
      this.signalkRequestsService.putRequest(this.widgetProperties.config.paths['boolPath'].path, this.widgetProperties.config.paths['boolPath'].source, this.widgetProperties.uuid);

      //send it again every 20ms
      this.timeoutHandler = setInterval(() => {
        this.signalkRequestsService.putRequest(this.widgetProperties.config.paths['boolPath'].path, this.widgetProperties.config.paths['boolPath'].source, this.widgetProperties.uuid);
        this.widgetProperties.config.putMomentaryValue;
      }, 100);

      return;
    }
  }

  public handleClickUp() {
    if (!this.widgetProperties.config.putEnable || !this.pressed) { return; }

    if (this.widgetProperties.config.putMomentary) {
      this.pressed = false;
      clearInterval(this.timeoutHandler);
      // momentary mode
      this.signalkRequestsService.putRequest(this.widgetProperties.config.paths['boolPath'].path, this.widgetProperties.config.paths['boolPath'].source, this.widgetProperties.uuid);
      if (!this.widgetProperties.config.putMomentaryValue) {
        return;
      }
    }
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.unsubscribeSKRequest();
  }

  /* ******************************************************************************************* */
  /* ******************************************************************************************* */
  /* ******************************************************************************************* */
  /*                                  Canvas                                                     */
  /* ******************************************************************************************* */
  /* ******************************************************************************************* */
  /* ******************************************************************************************* */

  private updateBtnCanvas() {
    if (this.canvasButtonTxt) {
      this.canvasButtonTxt.clearRect(0,0,this.canvasBtnTxtElement.nativeElement.width, this.canvasBtnTxtElement.nativeElement.height);
      this.drawBtnLabel();
    }
  }

  private drawBtnLabel() {
    let maxTextWidth = Math.floor(this.canvasBtnTxtElement.nativeElement.width - (this.canvasBtnTxtElement.nativeElement.width * 0.15));
    let maxTextHeight = Math.floor(this.canvasBtnTxtElement.nativeElement.height - (this.canvasBtnTxtElement.nativeElement.height * 0.2));
    let valueText : string;

    if (this.widgetProperties.config.displayName === null) {
      valueText = "";
    } else {
      valueText = this.widgetProperties.config.displayName;
    }
    //check if length of string has changed since laste time.
    if (this.currentValueLength != valueText.length) {
      //we need to set font size...
      this.currentValueLength = valueText.length;

      // start with large font, no sense in going bigger than the size of the canvas :)
      this.valueFontSize = maxTextHeight;
      this.canvasButtonTxt.font = this.valueFontSize.toString() + "px Arial";
      let measure = this.canvasButtonTxt.measureText(valueText).width;

      // if we are not too wide, we stop there, maxHeight was our limit... if we're too wide, we need to scale back
      if (measure > maxTextWidth) {
        let estimateRatio = maxTextWidth / measure;
        this.valueFontSize = Math.floor(this.valueFontSize * estimateRatio);
        this.canvasButtonTxt.font = this.valueFontSize.toString() + "px Arial";
      }
      // now decrease by 1 to in case still too big
      while (this.canvasButtonTxt.measureText(valueText).width > maxTextWidth && this.valueFontSize > 0) {
        this.valueFontSize--;
        this.canvasButtonTxt.font = this.valueFontSize.toString() + "px Arial";
      }
    }

    this.canvasButtonTxt.font = this.valueFontSize.toString() + "px Arial";
    this.canvasButtonTxt.textAlign = "center";
    this.canvasButtonTxt.textBaseline="middle";
    this.canvasButtonTxt.fillStyle = this.theme.text;
    this.canvasButtonTxt.fillText(valueText,this.canvasBtnTxtElement.nativeElement.width/2,(this.canvasBtnTxtElement.nativeElement.height/2)+(this.valueFontSize/15), maxTextWidth);
  }

}
