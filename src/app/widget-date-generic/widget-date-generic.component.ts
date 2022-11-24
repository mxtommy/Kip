import { Component, Input, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { formatDate } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatDialog, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { SignalKService } from '../signalk.service';
import { AppSettingsService } from '../app-settings.service';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';


const defaultConfig: IWidgetConfig = {
  displayName: null,
  filterSelfPaths: true,
  paths: {
    'stringPath': {
      description: 'String Data',
      path: null,
      source: null,
      pathType: 'string',
      isPathConfigurable: true,
    }
  },
  dateFormat: 'dd/MM/yyyy HH:mm:ss',
  dateTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone
};

@Component({
  selector: 'app-widget-date-generic',
  templateUrl: './widget-date-generic.component.html',
  styleUrls: ['./widget-date-generic.component.css']
})
export class WidgetDateGenericComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;
  @ViewChild('canvasEl', {static: true, read: ElementRef}) canvasEl: ElementRef;
  @ViewChild('canvasBG', {static: true, read: ElementRef}) canvasBG: ElementRef;
  @ViewChild('wrapperDiv', {static: true, read: ElementRef}) wrapperDiv: ElementRef;

  activeWidget: IWidget;
    config: IWidgetConfig;

  dataValue: any = null;

  dataTimestamp: number = Date.now();

  valueFontSize = 1;

  // length (in charaters) of value text to be displayed. if changed from last time, need to recalculate font size...
  currentValueLength = 0;
  canvasCtx;
  canvasBGCtx;

  // subs
  valueSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;


  constructor(
    public dialog: MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private AppSettingsService: AppSettingsService, // need for theme change subscription
    ) {
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

  resizeWidget() {
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
    }

  }


  subscribePath() {

    this.unsubscribePath();
    if (typeof(this.config.paths['stringPath'].path) != 'string') { return; } // nothing to sub to...

    this.valueSub = this.SignalKService
      .subscribePath(this.widgetUUID, this.config.paths['stringPath'].path, this.config.paths['stringPath'].source).subscribe(
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
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['stringPath'].path);
    }
  }
  // Subscribe to theme event
  subscribeTheme() {
    this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
      setTimeout(() => {   // need a delay so browser getComputedStyles has time to complete theme application.
        this.drawTitle();
        this.drawValue();
      }, 100);
    });
  }

  unsubscribeTheme() {
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
    }
  }

  openWidgetSettings(content) {

    const dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.log(result);
        this.unsubscribePath(); // unsub now as we will change variables so wont know what was subbed before...
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.subscribePath();
        this.resizeWidget();
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
    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.15));
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.2));
    let valueText: string;

    if (this.dataValue === null) {
      valueText = '--';
    } else {

      valueText = this.dataValue;
      valueText = formatDate(valueText, this.config.dateFormat, 'en-US', this.config.dateTimezone);
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
    this.canvasCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasCtx.fillText(
      valueText,
      this.canvasEl.nativeElement.width / 2,
      (this.canvasEl.nativeElement.height / 2) + (this.valueFontSize / 15),
      maxTextWidth
    );
  }

  drawTitle() {

    const maxTextWidth = Math.floor(this.canvasEl.nativeElement.width - (this.canvasEl.nativeElement.width * 0.2));
    const maxTextHeight = Math.floor(this.canvasEl.nativeElement.height - (this.canvasEl.nativeElement.height * 0.8));
    // set font small and make bigger until we hit a max.
    if (this.config.displayName === null) { return; }
    let fontSize = 1;

    this.canvasBGCtx.font = 'bold ' + fontSize.toString() + 'px Arial'; // need to init it, so we do loop at least once :)
    while ( (this.canvasBGCtx.measureText(this.config.displayName).width < maxTextWidth) && (fontSize < maxTextHeight)) {
        fontSize++;
        this.canvasBGCtx.font = 'bold ' + fontSize.toString() + 'px Arial';
    }

    this.canvasBGCtx.textAlign = 'left';
    this.canvasBGCtx.textBaseline = 'top';
    this.canvasBGCtx.fillStyle = window.getComputedStyle(this.wrapperDiv.nativeElement).color;
    this.canvasBGCtx.fillText(
      this.config.displayName,
      this.canvasEl.nativeElement.width * 0.03,
      this.canvasEl.nativeElement.height * 0.03,
      maxTextWidth);

  }




}
