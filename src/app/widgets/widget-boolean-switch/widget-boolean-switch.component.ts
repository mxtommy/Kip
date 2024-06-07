import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ResizedEvent, AngularResizeEventModule } from 'angular-resize-event';

import { SignalkRequestsService } from '../../core/services/signalk-requests.service';
import { AppService } from '../../core/services/app-service';
import { BaseWidgetComponent } from '../../core/components/base-widget/base-widget.component';
import { IDynamicControl, IWidgetPath } from '../../core/interfaces/widgets-interface';
import { SvgBooleanLightComponent } from '../svg-boolean-light/svg-boolean-light.component';
import { SvgBooleanButtonComponent } from '../svg-boolean-button/svg-boolean-button.component';
import { IDimensions, SvgBooleanSwitchComponent } from '../svg-boolean-switch/svg-boolean-switch.component';
import { NgFor, NgIf } from '@angular/common';



@Component({
    selector: 'app-widget-boolean-switch',
    templateUrl: './widget-boolean-switch.component.html',
    styleUrls: ['./widget-boolean-switch.component.css'],
    standalone: true,
    imports: [AngularResizeEventModule, NgFor, NgIf, SvgBooleanSwitchComponent, SvgBooleanButtonComponent, SvgBooleanLightComponent]
})
export class WidgetBooleanSwitchComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  @ViewChild('canvasLabel', {static: true, read: ElementRef}) canvasLabelElement: ElementRef;
  @ViewChild('widgetContainer', {static: true, read: ElementRef}) widgetContainerElement: ElementRef;

  public switchControls: IDynamicControl[] = [];
  private skRequestSub = new Subscription; // Request result observer

  // length (in characters) of value text to be displayed. if changed from last time, need to recalculate font size...
  private currentValueLength = 0;
  private canvasLabelCtx: CanvasRenderingContext2D;
  private labelColor: string = undefined;

  private nbCtrl: number = null;
  public ctrlDimensions: IDimensions = { width: 0, height: 0};

  constructor(
    private signalkRequestsService: SignalkRequestsService,
    private appService: AppService
    ) {
      super();

      this.defaultConfig = {
        displayName: 'Switch Panel Label',
        filterSelfPaths: true,
        paths: [],
        enableTimeout: false,
        dataTimeout: 5,
        textColor: "text",
        putEnable: true,
        putMomentary: false,
        multiChildCtrls: []
      };
  }

  ngOnInit(): void {
    this.initWidget();
    this.canvasLabelCtx = this.canvasLabelElement.nativeElement.getContext('2d');
    this.getColors(this.widgetProperties.config.textColor);
    this.nbCtrl = this.widgetProperties.config.multiChildCtrls.length;
    this.resizeWidget();

    // Build control array
    this.widgetProperties.config.multiChildCtrls.forEach(ctrlConfig => {
      if (!ctrlConfig.isNumeric) {
        ctrlConfig.isNumeric = false;
      }
        this.switchControls.push({...ctrlConfig});
      }
    );

    // Start Observers as path Array
    for (const key in this.switchControls) {
      if (Object.prototype.hasOwnProperty.call(this.switchControls, key)) {
        const path = this.switchControls[key];
        this.observeDataStream(key, newValue => {
          if (path.isNumeric) {
            if ([0, 1, null].includes(newValue.data.value)) {
              path.value = Boolean(newValue.data.value);
            }
          } else {
            path.value = newValue.data.value;
          }
        });
      }
    }

    // Listen to PUT response msg
    this.subscribeSKRequest();
  }

  onResized(event: ResizedEvent) {
    let calcH: number = event.newRect.height / this.nbCtrl; // divide by number of instantiated widget
    let ctrlHeightProportion = (35 * event.newRect.width / 180); //check control height not over width proportions
    let h: number = (ctrlHeightProportion < calcH) ? ctrlHeightProportion :  calcH;
    this.ctrlDimensions = { width: event.newRect.width, height: h};
    this.resizeWidget();
  }

  private subscribeSKRequest(): void {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetProperties.uuid) {
        let errMsg = `Toggle Widget ${this.widgetProperties.config.displayName}: `;
        if (requestResult.statusCode != 200){
          if (requestResult.message){
            errMsg += requestResult.message;
          } else {
            errMsg += requestResult.statusCode + " - " +requestResult.statusCodeDescription;
          }
          this.appService.sendSnackbarNotification(errMsg, 0);
        }
      }
    });
  }

  public toggle($event: IDynamicControl): void {
    const paths = <Array<IWidgetPath>>this.widgetProperties.config.paths;
    const i = paths.findIndex((path: IWidgetPath) => path.pathID == $event.pathID);
    if($event.isNumeric) {
      this.signalkRequestsService.putRequest(
        this.widgetProperties.config.paths[i].path,
        $event.value ? 1 : 0,
        this.widgetProperties.uuid
      );
    } else {
      this.signalkRequestsService.putRequest(
        this.widgetProperties.config.paths[i].path,
        $event.value,
        this.widgetProperties.uuid
      );
    }
  }

  private resizeWidget(): void {
    const rect = this.canvasLabelElement.nativeElement.getBoundingClientRect();
    if ((this.canvasLabelElement.nativeElement.width != Math.floor(rect.width)) || (this.canvasLabelElement.nativeElement.height != Math.floor(rect.height))) {
      this.canvasLabelElement.nativeElement.width = Math.floor(rect.width);
      this.canvasLabelElement.nativeElement.height = Math.floor(rect.height);
      this.currentValueLength = 0; // will force resetting the font size
      this.updateBtnCanvas();
    }
  }

  private updateBtnCanvas() {
    if (this.canvasLabelCtx) {
      this.canvasLabelCtx.clearRect(0, 0, this.canvasLabelElement.nativeElement.width, this.canvasLabelElement.nativeElement.height);
      this.drawTitle();
    }
  }

  drawTitle() {
    const maxTextWidth = Math.floor(this.canvasLabelElement.nativeElement.width * 0.935);
    const maxTextHeight = Math.floor(this.canvasLabelElement.nativeElement.height * 0.86 );
    // set font small and make bigger until we hit a max.
    if (this.widgetProperties.config.displayName === null) { return; }
    let fontSize = 1;

    this.canvasLabelCtx.font = 'bold ' + fontSize.toString() + 'px Arial'; // need to init it, so we do loop at least once :)
    while ( (this.canvasLabelCtx.measureText(this.widgetProperties.config.displayName).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasLabelCtx.font = 'bold ' + fontSize.toString() + 'px Arial';
    }

    this.canvasLabelCtx.textAlign = 'left';
    this.canvasLabelCtx.textBaseline = 'top';
    this.canvasLabelCtx.fillStyle = this.labelColor;
    this.canvasLabelCtx.fillText(
      this.widgetProperties.config.displayName,
      this.canvasLabelElement.nativeElement.width * 0.03,
      this.canvasLabelElement.nativeElement.height * 0.25,
      maxTextWidth
    );

  }

  private getColors(color: string): void {
    switch (color) {
      case "text":
        this.labelColor = this.theme.textDark;
        break;

      case "primary":
        this.labelColor = this.theme.textPrimaryDark;
        break;

      case "accent":
        this.labelColor = this.theme.textAccentDark;
        break;

      case "warn":
        this.labelColor = this.theme.textWarnDark;
        break;

      default:
        this.labelColor = this.theme.textDark;
        break;
    }
  }

  ngOnDestroy(): void {
    this.unsubscribeDataStream();
    this.skRequestSub?.unsubscribe();
  }
}
