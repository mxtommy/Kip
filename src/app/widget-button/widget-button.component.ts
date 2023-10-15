import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Subscription } from 'rxjs';

import { SignalKService } from '../signalk.service';
import { SignalkRequestsService } from '../signalk-requests.service';
import { AppSettingsService } from '../app-settings.service';
import { NotificationsService } from '../notifications.service';
import { IWidget, IWidgetSvcConfig } from '../widget-manager.service';


@Component({
  selector: 'app-widget-button',
  templateUrl: './widget-button.component.html',
  styleUrls: ['./widget-button.component.scss']
})
export class WidgetButtonComponent implements OnInit, AfterViewChecked, OnDestroy {

  @Input('widgetProperties') widgetProperties!: IWidget;
  @ViewChild('primary', {static: true, read: ElementRef}) private primaryElement: ElementRef;
  @ViewChild('accent', {static: true, read: ElementRef}) private accentElement: ElementRef;
  @ViewChild('warn', {static: true, read: ElementRef}) private warnElement: ElementRef;
  @ViewChild('primaryDark', {static: true, read: ElementRef}) private primaryDarkElement: ElementRef;
  @ViewChild('accentDark', {static: true, read: ElementRef}) private accentDarkElement: ElementRef;
  @ViewChild('warnDark', {static: true, read: ElementRef}) private warnDarkElement: ElementRef;
  @ViewChild('background', {static: true, read: ElementRef}) private backgroundElement: ElementRef;
  @ViewChild('text', {static: true, read: ElementRef}) private textElement: ElementRef;
  @ViewChild('btnDiv', {static: true, read: ElementRef}) divBtnElement: ElementRef;
  @ViewChild('lightDiv', {static: true, read: ElementRef}) divLightElement: ElementRef;
  @ViewChild('btnLabelCanvas', {static: true, read: ElementRef}) canvasBtnTxtElement: ElementRef;

  defaultConfig: IWidgetSvcConfig = {
    displayName: 'switch label',
    filterSelfPaths: true,
    paths: {
      "boolPath": {
        description: "Boolean Data",
        path: null,
        source: null,
        pathType: "boolean",
        isPathConfigurable: true,
        convertUnitTo: "unitless"
      }
    },
    putEnable: false,
    putMomentary: false,
    putMomentaryValue: true,
    barColor: 'accent',
  };

  valueSub: Subscription = null;

  // dynamics theme support
  private themeNameSub: Subscription = null;

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
    private SignalKService: SignalKService,
    private SignalkRequestsService: SignalkRequestsService,
    private notification: NotificationsService,
    private appSettings: AppSettingsService,
    ) {
  }

  ngOnInit() {
    this.updateGaugeSettings();
    this.canvasButtonTxt = this.canvasBtnTxtElement.nativeElement.getContext('2d');

    this.subscribePath();
    this.subscribeSKRequest();
    this.subscribeTheme();
  }

  private updateGaugeSettings() {
    this.buttonColorOff = ''; //window.getComputedStyle(this.backgroundElement.nativeElement).color;
    this.buttonColorOn = window.getComputedStyle(this.backgroundElement.nativeElement).color;
    switch (this.widgetProperties.config.barColor) {
      case "primary":
        this.buttonLabelColorOff = window.getComputedStyle(this.backgroundElement.nativeElement).color;
        this.buttonLabelColorOn = window.getComputedStyle(this.primaryElement.nativeElement).color;
        this.buttonBorberColorOff = window.getComputedStyle(this.primaryElement.nativeElement).color;
        this.buttonBorberColorOn = window.getComputedStyle(this.primaryDarkElement.nativeElement).color;
        this.lightColorOff = window.getComputedStyle(this.backgroundElement.nativeElement).color;
        this.lightColorOn = window.getComputedStyle(this.primaryDarkElement.nativeElement).color;
        break;

      case "accent":
        this.buttonLabelColorOff = window.getComputedStyle(this.backgroundElement.nativeElement).color;
        this.buttonLabelColorOn = window.getComputedStyle(this.accentElement.nativeElement).color;
        this.buttonBorberColorOff = window.getComputedStyle(this.accentElement.nativeElement).color;
        this.buttonBorberColorOn = window.getComputedStyle(this.accentDarkElement.nativeElement).color;
        this.lightColorOff = window.getComputedStyle(this.backgroundElement.nativeElement).color;
        this.lightColorOn =  window.getComputedStyle(this.accentDarkElement.nativeElement).color;
        break;

      case "warn":
        this.buttonLabelColorOff = window.getComputedStyle(this.backgroundElement.nativeElement).color;
        this.buttonLabelColorOn = window.getComputedStyle(this.warnElement.nativeElement).color;
        this.buttonBorberColorOff = window.getComputedStyle(this.warnElement.nativeElement).color;
        this.buttonBorberColorOn = window.getComputedStyle(this.warnDarkElement.nativeElement).color;
        this.lightColorOff = window.getComputedStyle(this.backgroundElement.nativeElement).color;
        this.lightColorOn = window.getComputedStyle(this.warnDarkElement.nativeElement).color;
        break;
    }
  }

  ngAfterViewChecked() {
    this.resizeWidget();
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

  private subscribePath() {
    this.unsubscribePath();
    if (typeof(this.widgetProperties.config.paths['boolPath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['boolPath'].path, this.widgetProperties.config.paths['boolPath'].source).subscribe(
      newValue => {
        this.state = newValue.value;
        this.updateBtnCanvas();
      }
    );
  }

  private unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['boolPath'].path)
    }
  }

  private subscribeSKRequest() {
    this.skRequestSub = this.SignalkRequestsService.subscribeRequest().subscribe(requestResult => {
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

  // Subscribe to theme event
  private subscribeTheme() {
    this.themeNameSub = this.appSettings.getThemeNameAsO().subscribe(
      themeChange => {
        setTimeout(() => {   // delay so browser getComputedStyles has time to complete theme style change.
          this.updateGaugeSettings();
          this.updateBtnCanvas();
        },50);
      })
  }

  private unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
    }
  }

  public handleClickDown() {
    if (!this.widgetProperties.config.putEnable) { return; }

    if (!this.widgetProperties.config.putMomentary) {
      //on/off mode. Send whatever we're not :)
      this.SignalkRequestsService.putRequest(
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
      this.SignalkRequestsService.putRequest(this.widgetProperties.config.paths['boolPath'].path, this.widgetProperties.config.paths['boolPath'].source, this.widgetProperties.uuid);

      //send it again every 20ms
      this.timeoutHandler = setInterval(() => {
        this.SignalkRequestsService.putRequest(this.widgetProperties.config.paths['boolPath'].path, this.widgetProperties.config.paths['boolPath'].source, this.widgetProperties.uuid);
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
      this.SignalkRequestsService.putRequest(this.widgetProperties.config.paths['boolPath'].path, this.widgetProperties.config.paths['boolPath'].source, this.widgetProperties.uuid);
      if (!this.widgetProperties.config.putMomentaryValue) {
        return;
      }
    }
  }

  ngOnDestroy() {
    this.unsubscribePath();
    this.unsubscribeSKRequest();
    this.unsubscribeTheme();
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
    this.canvasButtonTxt.fillStyle = window.getComputedStyle(this.textElement.nativeElement).color;
    this.canvasButtonTxt.fillText(valueText,this.canvasBtnTxtElement.nativeElement.width/2,(this.canvasBtnTxtElement.nativeElement.height/2)+(this.valueFontSize/15), maxTextWidth);
  }

}
