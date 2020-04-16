import { ViewChild, ElementRef, Component, OnInit, AfterContentInit, AfterContentChecked, Input, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { AppSettingsService } from '../app-settings.service';
import { LinearGauge, LinearGaugeOptions } from 'ng-canvas-gauges';


const defaultConfig: IWidgetConfig = {
  widgetLabel: null,
  paths: {
    "gaugePath": {
      description: "Numeric Data",
      path: null,
      source: null,
      pathType: "number",
    }
  },
  units: {
    "gaugePath": "unitless"
  },
  selfPaths: true,

  gaugeType: 'ngLinearVertical',  //ngLinearVertical or ngLinearHorizontal
  gaugeTicks: false,
  minValue: 0,
  maxValue: 100,
  numInt: 1,
  numDecimal: 0,
  barColor: 'accent',
};

@Component({
  selector: 'app-widget-gauge-ng-linear',
  templateUrl: './widget-gauge-ng-linear.component.html',
  styleUrls: ['./widget-gauge-ng-linear.component.scss']
})

export class WidgetGaugeNgLinearComponent implements OnInit, OnDestroy, AfterContentInit, AfterContentChecked {
  @ViewChild('linearWrapperDiv') wrapper: ElementRef;
  @ViewChild('linearGauge') public linearGauge: LinearGauge;

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  @ViewChild('primary') primaryElement: ElementRef;
  @ViewChild('accent') accentElement: ElementRef;
  @ViewChild('warn') warnElement: ElementRef;
  @ViewChild('background') backgroundElement: ElementRef;

  activeWidget: IWidget;
  config: IWidgetConfig;

  public dataValue = 0;
  public dataValueTrimmed = 0;

  valueSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;

  themePrimaryColor: string;
  themeAccentColor: string;
  themeWarnColor: string;
  themeBackgroundColor: string;

  public gaugeOptions = {} as LinearGaugeOptions;

  isGaugeVertical: Boolean = true;
  isInResizeWindow: boolean = false;

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService,
    private AppSettingsService: AppSettingsService, // need for theme change subscription
  ) { }

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
    this.subscribeTheme();

    if (this.config.gaugeType == "ngLinearVertical") {
      this.isGaugeVertical = true;
    }
    else {
      this.isGaugeVertical = false;
    }
  }

  ngOnDestroy() {
    this.unsubscribePath();
    this.unsubscribeTheme();
  }

  ngAfterContentInit(){
    this.updateGaugeConfig();
  }

  ngAfterContentChecked() {
    this.resizeWidget();
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['gaugePath'].path, this.config.paths['gaugePath'].source).subscribe(
      newValue => {
        this.dataValue = this.UnitsService.convertUnit(this.config.units['gaugePath'], newValue);

        // for custom SVG text element
        if (!isNaN(Number(this.dataValue))){
          this.dataValueTrimmed = Number(this.padValue(this.dataValue, this.gaugeOptions.valueInt, this.gaugeOptions.valueDec));
        }
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['gaugePath'].path)
    }
  }

   // Subscribe to theme event
   subscribeTheme() {
    this.themeNameSub = this.AppSettingsService.getThemeNameAsO().subscribe(
      themeChange => {
       setTimeout(() => {   // need a delay so browser getComputedStyles has time to complete theme application.
        this.updateGaugeConfig();
       }, 50);
    })
  }

  unsubscribeTheme(){
    if (this.themeNameSub !== null) {
      this.themeNameSub.unsubscribe();
      this.themeNameSub = null;
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
        this.unsubscribePath();  //unsub now as we will change variables so wont know what was subbed before...
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.subscribePath();

        this.updateGaugeConfig();
      }
    });
  }

  updateGaugeConfig(){
    ////  Colors
    // Hack to get Theme colors using hidden minxin, DIV and @ViewChild
    this.themePrimaryColor = getComputedStyle(this.primaryElement.nativeElement).color;
    this.themeAccentColor = getComputedStyle(this.accentElement.nativeElement).color;
    this.themeWarnColor = getComputedStyle(this.warnElement.nativeElement).color;
    this.themeBackgroundColor = getComputedStyle(this.backgroundElement.nativeElement).color;

    // Labels - match selected theme
    this.gaugeOptions.colorTitle = this.gaugeOptions.colorUnits = this.gaugeOptions.colorValueText = window.getComputedStyle(this.wrapper.nativeElement).color;

    // Faceplate and gauge bar background - match selected theme
    this.gaugeOptions.colorPlate = window.getComputedStyle(this.wrapper.nativeElement).backgroundColor;
    this.gaugeOptions.colorBar = this.themeBackgroundColor;

    // Integer and decimal display
    this.gaugeOptions.valueInt = this.config.numInt;
    this.gaugeOptions.valueDec = this.config.numDecimal;
    this.gaugeOptions.majorTicksInt = this.config.numInt;
    this.gaugeOptions.majorTicksDec = this.config.numDecimal;

    this.gaugeOptions.minValue = this.config.minValue;
    this.gaugeOptions.maxValue = this.config.maxValue;

    // Vertical
    if (this.config.gaugeType == 'ngLinearVertical'){
      this.isGaugeVertical = true;   // Changes div wrapper class to respect aspect ratio
      this.gaugeOptions.barLength = 75;
      this.gaugeOptions.fontUnitsSize = 40;
      this.gaugeOptions.fontTitleSize = 40;

      // With ticks
      if (this.config.gaugeTicks == true) {
        this.gaugeOptions.minValue = 11.9;
        this.gaugeOptions.maxValue = 15;

        this.gaugeOptions.exactTicks = false;
        this.gaugeOptions.barWidth = 30;
        this.gaugeOptions.tickSide = "right";
        this.gaugeOptions.ticksWidth = 10;
        this.gaugeOptions.ticksPadding = 5;

        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = [11.9, 12, 13, 14, 15];
        this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorTitle;

        this.gaugeOptions.numberSide = "right";
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 25;
        this.gaugeOptions.colorNumbers = this.gaugeOptions.colorTitle;

        this.gaugeOptions.minorTicks = 4;
        this.gaugeOptions.ticksWidthMinor = 5;
        this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorTitle;

        this.gaugeOptions.highlights = [
          { "from": 11.9, "to": 12.2, "color": "yellow" },
          { "from": 12.2, "to": 12.8, "color": "green" }
        ];
        this.gaugeOptions.highlightsWidth = 5;
      }
      else {
        // No ticks
        this.isGaugeVertical = true;
        this.gaugeOptions.barWidth = 100;

        this.gaugeOptions.majorTicks = [];
        this.gaugeOptions.colorMajorTicks = "";
        this.gaugeOptions.ticksPadding = 0;
        this.gaugeOptions.minorTicks = 0;
        this.gaugeOptions.colorMinorTicks = "";
        this.gaugeOptions.ticksWidthMinor = 0;
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 0;
      }
    }
    else {
      // horizontal
      this.isGaugeVertical = false;  // Changes div wrapper class to respect aspect ratio
      this.gaugeOptions.barLength = 80;
      this.gaugeOptions.fontTitleSize = 50;
      this.gaugeOptions.fontUnitsSize = 40;


      // With ticks
      this.gaugeOptions.barWidth = 40;
        if (this.config.gaugeTicks == true) {

        this.gaugeOptions.tickSide = "right";
        this.gaugeOptions.ticksWidth = 1;
        this.gaugeOptions.ticksPadding = 5;

        this.gaugeOptions.majorTicks = [this.config.minValue, this.config.maxValue];
        this.gaugeOptions.colorMajorTicks = "red";

        this.gaugeOptions.numberSide = "right";
        this.gaugeOptions.numbersMargin = 5;
        this.gaugeOptions.fontNumbersSize = 30;
        this.gaugeOptions.colorNumbers = this.gaugeOptions.colorTitle;

        this.gaugeOptions.minorTicks = 10;
        this.gaugeOptions.ticksWidthMinor = 8;
        this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorTitle;


      }
      else {
        // No ticks
        this.gaugeOptions.barWidth = 60;
        this.gaugeOptions.majorTicks = [];
        this.gaugeOptions.colorMajorTicks = "";
        this.gaugeOptions.ticksPadding = 0;
        this.gaugeOptions.minorTicks = 0;
        this.gaugeOptions.colorMinorTicks = "";
        this.gaugeOptions.ticksWidthMinor = 0;
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 0;
      }
    }

    switch (this.config.barColor) {
      case "primary": this.gaugeOptions.colorBarProgress = this.themePrimaryColor;
        break;

      case "accent": this.gaugeOptions.colorBarProgress = this.themeAccentColor;
        break;

      case "warn": this.gaugeOptions.colorBarProgress = this.themeWarnColor;
        break;

      default: this.gaugeOptions.colorBarProgress = "white"
        break;
    }
  }

  resizeWidget() {
    let rect = this.wrapper.nativeElement.getBoundingClientRect();

    if ((this.gaugeOptions.width != rect.width) || (this.gaugeOptions.height != rect.height)) {
      if (!this.isInResizeWindow) {
        this.isInResizeWindow = true;

        setTimeout(() => {
          let rect = this.wrapper.nativeElement.getBoundingClientRect();
          this.gaugeOptions.height = rect.height;

          if (this.isGaugeVertical == true) {
            this.gaugeOptions.width = (rect.height * 0.30);
          }
          else {
            this.gaugeOptions.width = rect.width;
          }

          this.isInResizeWindow = false;
          }, 10);
      }

    }
  }

  padValue(val, int, dec): string {
    let i = 0;
    let s, n, foo;
    let strVal: string
    val = parseFloat(val);
    n = (val < 0);
    val = Math.abs(val);
    if (dec > 0) {
        foo = val.toFixed(dec).toString().split('.');
        s = int - foo[0].length;
        for (; i < s; ++i) {
            foo[0] = '0' + foo[0];
        }
        strVal = (n ? '-' : '') + foo[0] + '.' + foo[1];
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
