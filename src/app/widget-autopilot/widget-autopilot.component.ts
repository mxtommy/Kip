import { ViewChild, ElementRef, Component, OnInit, Input, AfterContentInit, AfterContentChecked, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';
import { AppSettingsService } from '../app-settings.service';
import { RadialGauge, RadialGaugeOptions } from 'ng-canvas-gauges';

const commands = {
  "auto":    {"path":"steering.autopilot.state","value":"auto"},
  "wind":    {"path":"steering.autopilot.state","value":"wind"},
  "route":   {"path":"steering.autopilot.state","value":"route"},
  "standby": {"path":"steering.autopilot.state","value":"standby"},
  "+1":      {"path":"steering.autopilot.actions.adjustHeading","value":1},
  "+10":     {"path":"steering.autopilot.actions.adjustHeading","value":10},
  "-1":      {"path":"steering.autopilot.actions.adjustHeading","value":-1},
  "-10":     {"path":"steering.autopilot.actions.adjustHeading","value":-10},
  "tackToPort":   {"path":"steering.autopilot.actions.tack","value":"port"},
  "tackToStarboard":   {"path":"steering.autopilot.actions.tack","value":"starboard"},
  "advanceWaypoint":   {"path":"steering.autopilot.actions.advanceWaypoint","value":"1"}
}

const defaultConfig: IWidgetConfig = {
  widgetLabel: 'N2k Autopilot',
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

  gaugeType: 'ngRadial',
  gaugeTicks: false,
  radialSize: 'measuring',
  minValue: 0,
  maxValue: 100,
  numInt: 1,
  numDecimal: 0,
  barColor: 'accent',     // theme palette to select
};


@Component({
  selector: 'app-widget-autopilot',
  templateUrl: './widget-autopilot.component.html',
  styleUrls: ['./widget-autopilot.component.scss']
})
export class WidgetAutopilotComponent implements OnInit, AfterContentInit, AfterContentChecked {
  @ViewChild('autopilotScreen') private wrapper: ElementRef;
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

  dataValue = 0;
  valueSub: Subscription = null;

  public gaugeOptions = {} as RadialGaugeOptions;
  // fix for RadialGauge GaugeOptions object ** missing color-stroke-ticks property
  public colorStrokeTicks: string = "";

  gaugeHeight = 0;
  gaugeWidth = 0;

  isInResizeWindow = false;

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService,
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
    this.subscribePath(); // TODO(david): setup data paths
  }

  ngAfterContentChecked() {
    this.resizeWidget();
  }

  ngAfterContentInit() {
    this.updateGaugeConfig();
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['gaugePath'].path, this.config.paths['gaugePath'].source).subscribe(
      newValue => {
          this.dataValue = this.UnitsService.convertUnit(this.config.units['gaugePath'], newValue);
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


  resizeWidget() {
    const rect = this.wrapper.nativeElement.getBoundingClientRect();

    if ((this.gaugeWidth != rect.width) || (this.gaugeHeight != rect.height)) {
      if (!this.isInResizeWindow) {
        this.isInResizeWindow = true;
          this.gaugeOptions.height = rect.height;
          this.gaugeOptions.width = rect.width;
          this.isInResizeWindow = false;
      }
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
    let calculatedMajorTicks = [];// this.calculateMajorTicks(this.config.minValue, this.config.maxValue);

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
  }




}
