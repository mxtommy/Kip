import { ViewChild, ElementRef, Component, Input, OnInit, OnDestroy, AfterContentInit, AfterContentChecked } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material';
import { ResizedEvent } from 'angular-resize-event';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { AppSettingsService } from '../app-settings.service';
import { RadialGauge, RadialGaugeOptions } from 'ng-canvas-gauges';

const defaultConfig: IWidgetConfig = {
  displayName: null,
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
  filterSelfPaths: true,

  gaugeType: 'ngRadial',  //ngLinearVertical or ngLinearHorizontal
  gaugeTicks: false,
  radialSize: 'measuring',
  minValue: 0,
  maxValue: 100,
  numInt: 1,
  numDecimal: 0,
  barColor: 'accent',     // theme palette to select
};

@Component({
  selector: 'app-widget-gauge-ng-radial',
  templateUrl: './widget-gauge-ng-radial.component.html',
  styleUrls: ['./widget-gauge-ng-radial.component.scss']
})
export class WidgetGaugeNgRadialComponent implements OnInit, OnDestroy, AfterContentInit, AfterContentChecked {

  @ViewChild('wrapperDiv') private wrapper: ElementRef;
  @ViewChild('radialGauge') public radialGauge: RadialGauge;

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  // hack to access material-theme palette colors
  @ViewChild('primary') private primaryElement: ElementRef;
  @ViewChild('accent') private accentElement: ElementRef;
  @ViewChild('warn') private warnElement: ElementRef;
  @ViewChild('primaryDark') private primaryDarkElement: ElementRef;
  @ViewChild('accentDark') private accentDarkElement: ElementRef;
  @ViewChild('warnDark') private warnDarkElement: ElementRef;
  @ViewChild('background') private backgroundElement: ElementRef;
  @ViewChild('text') private textElement: ElementRef;

  activeWidget: IWidget;
  config: IWidgetConfig;

  public dataValue = 0;
  valueSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;

  public gaugeOptions = {} as RadialGaugeOptions;
  // fix for RadialGauge GaugeOptions object ** missing color-stroke-ticks property
  public colorStrokeTicks: string = "";

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
  }

  ngOnDestroy() {
    this.unsubscribePath();
    this.unsubscribeTheme();
  }

  ngAfterContentInit() {
    this.updateGaugeConfig();
  }

  ngAfterContentChecked() {
    // this.resizeWidget();
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['gaugePath'].path, this.config.paths['gaugePath'].source).subscribe(
      newValue => {
        this.dataValue = this.UnitsService.convertUnit(this.config.units['gaugePath'], newValue);

        // Limit gauge progressbar overflow
        if (this.dataValue >= this.config.maxValue) {
          this.dataValue = this.config.maxValue;
        };
        if (this.dataValue <= this.config.minValue) {
          this.dataValue = this.config.minValue;
        };
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
    //// Hack to get Theme colors using hidden mixin, DIV and @ViewChild
    let themePaletteColor = "";
    let themePaletteDarkColor = "";

    this.gaugeOptions.colorTitle = this.gaugeOptions.colorUnits = this.gaugeOptions.colorValueText = getComputedStyle(this.textElement.nativeElement).color;

    this.gaugeOptions.colorPlate = getComputedStyle(this.wrapper.nativeElement).backgroundColor;
    this.gaugeOptions.colorBar = getComputedStyle(this.backgroundElement.nativeElement).color;
    this.gaugeOptions.colorNeedleShadowUp = "";
    this.gaugeOptions.colorNeedleShadowDown = "black";
    this.gaugeOptions.colorNeedleCircleInner = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleInnerEnd = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleOuter = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleOuterEnd = this.gaugeOptions.colorPlate;

    // Theme colors
    switch (this.config.barColor) {
      case "primary":
        themePaletteColor = getComputedStyle(this.primaryElement.nativeElement).color;
        themePaletteDarkColor = getComputedStyle(this.primaryDarkElement.nativeElement).color;
        this.gaugeOptions.colorBarProgress = themePaletteColor;
        this.gaugeOptions.colorNeedle = themePaletteDarkColor;
        this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
        break;

      case "accent":
        themePaletteColor = getComputedStyle(this.accentElement.nativeElement).color;
        themePaletteDarkColor = getComputedStyle(this.accentDarkElement.nativeElement).color;
        this.gaugeOptions.colorBarProgress = themePaletteColor;
        this.gaugeOptions.colorNeedle = themePaletteDarkColor;
        this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
        break;

      case "warn":
        themePaletteColor = getComputedStyle(this.warnElement.nativeElement).color;
        themePaletteDarkColor = getComputedStyle(this.warnDarkElement.nativeElement).color;
        this.gaugeOptions.colorBarProgress = themePaletteColor;
        this.gaugeOptions.colorNeedle = themePaletteDarkColor;
        this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
        break;

      default:
        break;
    }

    // Config storage values
    this.gaugeOptions.valueInt = this.config.numInt;
    this.gaugeOptions.valueDec = this.config.numDecimal;

    this.gaugeOptions.majorTicksInt = this.config.numInt;
    this.gaugeOptions.majorTicksDec = this.config.numDecimal;

    // Radial gauge type
    switch(this.config.radialSize) {
      case "capacity":
        this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorPlate; // bug with MajorTicks drawing firs tick always and using color="" does not work
        this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = "";
        this.gaugeOptions.fontTitleSize = 60;
        this.gaugeOptions.minValue = this.config.minValue;
        this.gaugeOptions.maxValue = this.config.maxValue;
        this.gaugeOptions.barProgress = true;
        this.gaugeOptions.barWidth = 15;

        this.gaugeOptions.valueBox = true;
        this.gaugeOptions.fontValueSize = 110;
        this.gaugeOptions.valueBoxWidth = 100;
        this.gaugeOptions.valueBoxBorderRadius = 0;
        this.gaugeOptions.valueBoxStroke = 0;
        this.gaugeOptions.colorValueBoxBackground = "";

        this.gaugeOptions.ticksAngle = 360;
        this.gaugeOptions.startAngle = 180;
        this.gaugeOptions.exactTicks = false;
        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = [];
        this.gaugeOptions.minorTicks = 0;
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 0;
        this.gaugeOptions.highlights = [];
        this.gaugeOptions.highlightsWidth = 0;

        this.gaugeOptions.needle = true;
        this.gaugeOptions.needleType = "line";
        this.gaugeOptions.needleWidth = 2;
        this.gaugeOptions.needleShadow = false;
        this.gaugeOptions.needleStart = 80;
        this.gaugeOptions.needleEnd = 95;
        this.gaugeOptions.needleCircleSize = 1;
        this.gaugeOptions.needleCircleInner = false;
        this.gaugeOptions.needleCircleOuter = false;

        this.gaugeOptions.borders = true;
        this.gaugeOptions.borderOuterWidth = 0;
        this.gaugeOptions.borderMiddleWidth = 2;
        this.gaugeOptions.borderInnerWidth = 2;
        this.gaugeOptions.borderShadowWidth = 0;

        this.gaugeOptions.animationTarget = "needle";
        this.gaugeOptions.useMinPath = false;
        break;

      case "measuring":
        let calculatedMajorTicks = this.calculateMajorTicks(this.config.minValue, this.config.maxValue);

        this.gaugeOptions.colorTitle = this.colorStrokeTicks = this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorNumbers = this.gaugeOptions.colorTitle;

        this.gaugeOptions.fontTitleSize = 20;
        this.gaugeOptions.minValue = this.config.minValue;
        this.gaugeOptions.maxValue = this.config.maxValue;
        this.gaugeOptions.barProgress = true;
        this.gaugeOptions.barWidth = 15;

        this.gaugeOptions.valueBox = true;
        this.gaugeOptions.fontValueSize = 60;
        this.gaugeOptions.valueBoxWidth = 100;
        this.gaugeOptions.valueBoxBorderRadius = 0;
        this.gaugeOptions.valueBoxStroke = 0;
        this.gaugeOptions.colorValueBoxBackground = "";

        this.gaugeOptions.ticksAngle = 270;
        this.gaugeOptions.startAngle = 45;
        this.gaugeOptions.exactTicks = false;
        this.gaugeOptions.strokeTicks = true;
        this.gaugeOptions.majorTicks = [calculatedMajorTicks.toString()];
        this.gaugeOptions.minorTicks = 2;
        this.gaugeOptions.numbersMargin = 3;
        this.gaugeOptions.fontNumbersSize = 15;
        this.gaugeOptions.highlights = [];
        this.gaugeOptions.highlightsWidth = 0;

        this.gaugeOptions.needle = true;
        this.gaugeOptions.needleType = "line";
        this.gaugeOptions.needleWidth = 2;
        this.gaugeOptions.needleShadow = false;
        this.gaugeOptions.needleStart = 0;
        this.gaugeOptions.needleEnd = 95;
        this.gaugeOptions.needleCircleSize = 10;
        this.gaugeOptions.needleCircleInner = false;
        this.gaugeOptions.needleCircleOuter = false;

        this.gaugeOptions.borders = false;
        this.gaugeOptions.borderOuterWidth = 0;
        this.gaugeOptions.borderMiddleWidth = 0;
        this.gaugeOptions.borderInnerWidth = 0;
        this.gaugeOptions.borderShadowWidth = 0;

        this.gaugeOptions.animationTarget = "needle";
        this.gaugeOptions.useMinPath = false;
        break;

      case "marineCompass":
        this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorUnits;
        this.gaugeOptions.fontTitleSize = 60;
        this.gaugeOptions.minValue = 0;
        this.gaugeOptions.maxValue = 360;
        this.gaugeOptions.barProgress = false;
        this.gaugeOptions.barWidth = 0;

        this.gaugeOptions.valueBox = true
        this.gaugeOptions.fontValueSize = 50;
        this.gaugeOptions.valueBoxWidth = 0;
        this.gaugeOptions.valueBoxBorderRadius = 5;
        this.gaugeOptions.valueBoxStroke = 0;
        this.gaugeOptions.colorValueBoxBackground = this.gaugeOptions.colorBar;

        this.gaugeOptions.ticksAngle = 360;
        this.gaugeOptions.startAngle = 180;
        this.gaugeOptions.exactTicks = false;
        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = ["N,NE,E,SE,S,SW,W,NW,N"];
        this.gaugeOptions.numbersMargin = 3;
        this.gaugeOptions.fontNumbersSize = 15;
        this.gaugeOptions.minorTicks = 22;
        this.gaugeOptions.highlights = [];
        this.gaugeOptions.highlightsWidth = 0;

        this.gaugeOptions.needle = true;
        this.gaugeOptions.needleType = "line";
        this.gaugeOptions.needleWidth = 3;
        this.gaugeOptions.needleShadow = false;
        this.gaugeOptions.needleStart = 75;
        this.gaugeOptions.needleEnd = 99;
        this.gaugeOptions.needleCircleSize = 2;
        this.gaugeOptions.needleCircleInner = false;
        this.gaugeOptions.needleCircleOuter = false;

        this.gaugeOptions.borders = true;
        this.gaugeOptions.borderOuterWidth = 0;
        this.gaugeOptions.borderMiddleWidth = 2;
        this.gaugeOptions.borderInnerWidth = 2;
        this.gaugeOptions.borderShadowWidth = 0;

        this.gaugeOptions.animationTarget = "plate";
        this.gaugeOptions.useMinPath = true;
        break;

      case "baseplateCompass":
        this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorUnits;
        this.gaugeOptions.fontTitleSize = 60;
        this.gaugeOptions.minValue = 0;
        this.gaugeOptions.maxValue = 360;
        this.gaugeOptions.barProgress = false;
        this.gaugeOptions.barWidth = 0;

        this.gaugeOptions.valueBox = true
        this.gaugeOptions.fontValueSize = 50;
        this.gaugeOptions.valueBoxWidth = 0;
        this.gaugeOptions.valueBoxBorderRadius = 5;
        this.gaugeOptions.valueBoxStroke = 0;
        this.gaugeOptions.colorValueBoxBackground = this.gaugeOptions.colorBar;

        this.gaugeOptions.ticksAngle = 360;
        this.gaugeOptions.startAngle = 180;
        this.gaugeOptions.exactTicks = false;
        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = ["N,NE,E,SE,S,SW,W,NW,N"];
        this.gaugeOptions.numbersMargin = 3;
        this.gaugeOptions.fontNumbersSize = 15;
        this.gaugeOptions.minorTicks = 22;
        this.gaugeOptions.highlights = [];
        this.gaugeOptions.highlightsWidth = 0;

        this.gaugeOptions.needle = true;
        this.gaugeOptions.needleType = "line";
        this.gaugeOptions.needleWidth = 3;
        this.gaugeOptions.needleShadow = false;
        this.gaugeOptions.needleStart = 75;
        this.gaugeOptions.needleEnd = 99;
        this.gaugeOptions.needleCircleSize = 2;
        this.gaugeOptions.needleCircleInner = false;
        this.gaugeOptions.needleCircleOuter = false;

        this.gaugeOptions.borders = true;
        this.gaugeOptions.borderOuterWidth = 0;
        this.gaugeOptions.borderMiddleWidth = 2;
        this.gaugeOptions.borderInnerWidth = 2;
        this.gaugeOptions.borderShadowWidth = 0;

        this.gaugeOptions.animationTarget = "needle";
        this.gaugeOptions.useMinPath = false;
        break;

      default:
        break;
    }
  }

  onResized(event: ResizedEvent) {
    this.gaugeOptions.height = Math.floor(event.newHeight * 0.88);
    this.gaugeOptions.width = Math.floor(event.newWidth * 0.88);
  }

  // Method to calculate nice values for min, max and range for the gaugeOptions.majorTicks
  calculateMajorTicks(minValue: number, maxValue: number): string[]|number[] {
    let niceMinValue = minValue;
    let niceMaxValue = maxValue;
    let niceRange = maxValue - minValue;
    let majorTickSpacing = 0;
    let maxNoOfMajorTicks = 10;
    let tickArray = [] as Array<number>;

    niceRange = this.calcNiceNumber(maxValue - minValue, false);
    majorTickSpacing = this.calcNiceNumber(niceRange / (maxNoOfMajorTicks - 1), true);
    niceMinValue = Math.floor(minValue / majorTickSpacing) * majorTickSpacing;
    niceMaxValue = Math.ceil(maxValue / majorTickSpacing) * majorTickSpacing;

    tickArray.push(niceMinValue);

    for (let index = 0; index < (niceRange / majorTickSpacing); index++) {
      if (tickArray[index] < niceMaxValue) {
        tickArray.push(tickArray[index] + majorTickSpacing);
      }
    }
    return tickArray;
  }

  calcNiceNumber(range: number, round: boolean): number {
    let exponent = Math.floor(Math.log10(range)),   // exponent of range
        fraction = range / Math.pow(10, exponent),  // fractional part of range
        niceFraction: number;                               // nice, rounded fraction

    if (round) {
        if (1.5 > fraction) {
            niceFraction = 1;
        } else if (3 > fraction) {
            niceFraction = 2;
        } else if (7 > fraction) {
            niceFraction = 5;
        } else {
            niceFraction = 10;
        }
    } else {
        if (1 >= fraction) {
            niceFraction = 1;
        } else if (2 >= fraction) {
            niceFraction = 2;
        } else if (5 >= fraction) {
            niceFraction = 5;
        } else {
            niceFraction = 10;
        }
    }
    return niceFraction * Math.pow(10, exponent);
  }
}
