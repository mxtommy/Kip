import { ViewChild, ElementRef, Component, OnInit, AfterContentInit, Input, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { ResizedEvent } from 'angular-resize-event';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service' ;
import { AppSettingsService, IZone, ZoneState } from '../app-settings.service';
import { LinearGauge, LinearGaugeOptions } from '@biacsics/ng-canvas-gauges';


const defaultConfig: IWidgetConfig = {
  displayName: null,
  filterSelfPaths: true,
  paths: {
    "gaugePath": {
      description: "Numeric Data",
      path: null,
      source: null,
      pathType: "number",
      isPathConfigurable: true,
      convertUnitTo: "unitless"
    }
  },
  gaugeType: 'ngLinearVertical',  //ngLinearVertical or ngLinearHorizontal
  gaugeTicks: false,
  minValue: 0,
  maxValue: 100,
  numInt: 1,
  numDecimal: 0,
  barColor: 'accent',
};

interface IDataHighlight extends Array<{
  from : number;
  to : number;
  color: string;
}> {};

@Component({
  selector: 'app-widget-gauge-ng-linear',
  templateUrl: './widget-gauge-ng-linear.component.html',
  styleUrls: ['./widget-gauge-ng-linear.component.scss']
})

export class WidgetGaugeNgLinearComponent implements OnInit, OnDestroy, AfterContentInit {
  @ViewChild('linearWrapperDiv', {static: true, read: ElementRef}) private wrapper: ElementRef;
  @ViewChild('linearGauge', {static: true, read: ElementRef}) protected linearGauge: ElementRef;

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  @ViewChild('primary', {static: true, read: ElementRef}) private primaryElement: ElementRef;
  @ViewChild('accent', {static: true, read: ElementRef}) private accentElement: ElementRef;
  @ViewChild('warn', {static: true, read: ElementRef}) private warnElement: ElementRef;
  @ViewChild('primaryDark', {static: true, read: ElementRef}) private primaryDarkElement: ElementRef;
  @ViewChild('accentDark', {static: true, read: ElementRef}) private accentDarkElement: ElementRef;
  @ViewChild('warnDark', {static: true, read: ElementRef}) private warnDarkElement: ElementRef;
  @ViewChild('background', {static: true, read: ElementRef}) private backgroundElement: ElementRef;

  activeWidget: IWidget;
  config: IWidgetConfig;

  public dataValue = 0;
  public dataValueTrimmed = 0;

  valueSub: Subscription = null;

  // dynamics theme support
  themeNameSub: Subscription = null;

  public gaugeOptions = {} as LinearGaugeOptions;

  public isGaugeVertical: Boolean = true;

  zones: Array<IZone> = [];
  zonesSub: Subscription;

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService,
    private AppSettingsService: AppSettingsService, // need for theme change subscription
  ) {}

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
    this.subscribeZones();
  }

  ngOnDestroy() {
    this.unsubscribePath();
    this.unsubscribeTheme();
    this.unsubscribeZones();
  }

  ngAfterContentInit(){
    this.updateGaugeConfig();
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['gaugePath'].path, this.config.paths['gaugePath'].source).subscribe(
      newValue => {
        this.dataValue = this.UnitsService.convertUnit(this.config.paths['gaugePath'].convertUnitTo, newValue.value);


        // set colors for zone state
        switch (newValue.state) {
          case ZoneState.warning:
            this.gaugeOptions.colorValueText = getComputedStyle(this.warnDarkElement.nativeElement).color;
            break;
          case ZoneState.alarm:
            this.gaugeOptions.colorValueText = getComputedStyle(this.warnDarkElement.nativeElement).color;
            break;
          default:
            this.gaugeOptions.colorValueText = getComputedStyle(this.wrapper.nativeElement).color;

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
       setTimeout(() => {   // delay so browser getComputedStyles has time to complet theme style change.
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

  // Subscribe to Zones
  subscribeZones() {
    this.zonesSub = this.AppSettingsService.getZonesAsO().subscribe(
      zones => {
        this.zones = zones;
        this.updateGaugeConfig();
      });
  }

  unsubscribeZones(){
    if (this.zonesSub !== null) {
      this.zonesSub.unsubscribe();
      this.zonesSub = null;
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
    //// Hack to get Theme colors using hidden minxin, DIV and @ViewChild
    let themePaletteColor = "";
    let themePaletteDarkColor = "";

    this.gaugeOptions.colorTitle = this.gaugeOptions.colorUnits = this.gaugeOptions.colorValueText = window.getComputedStyle(this.wrapper.nativeElement).color;

    this.gaugeOptions.colorPlate = window.getComputedStyle(this.wrapper.nativeElement).backgroundColor;
    this.gaugeOptions.colorBar = getComputedStyle(this.backgroundElement.nativeElement).color;
    this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorTitle;
    this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorTitle;

    this.gaugeOptions.colorNeedleEnd = "";
    this.gaugeOptions.colorNeedleShadowUp = "";
    this.gaugeOptions.colorNeedleShadowDown = "black";

    switch (this.config.barColor) {
      case "primary":
          themePaletteColor = getComputedStyle(this.primaryElement.nativeElement).color;
          themePaletteDarkColor = getComputedStyle(this.primaryDarkElement.nativeElement).color;
          this.gaugeOptions.colorBarProgress = themePaletteColor;
          this.gaugeOptions.colorBarProgressEnd = themePaletteDarkColor;
          this.gaugeOptions.colorNeedle = themePaletteDarkColor;
          this.gaugeOptions.needleWidth = 5;
        break;

      case "accent":
          themePaletteColor = getComputedStyle(this.accentElement.nativeElement).color;
          themePaletteDarkColor = getComputedStyle(this.accentDarkElement.nativeElement).color;
          this.gaugeOptions.colorBarProgress = themePaletteColor;
          this.gaugeOptions.colorBarProgressEnd = themePaletteDarkColor;
          this.gaugeOptions.colorNeedle = themePaletteDarkColor;
          this.gaugeOptions.needleWidth = 5;
          break;

      case "warn":
          themePaletteColor = getComputedStyle(this.warnElement.nativeElement).color;
          themePaletteDarkColor = getComputedStyle(this.warnDarkElement.nativeElement).color;
          this.gaugeOptions.colorBarProgress = themePaletteColor;
          this.gaugeOptions.colorBarProgressEnd = themePaletteDarkColor;
          this.gaugeOptions.colorNeedle = themePaletteDarkColor;
          this.gaugeOptions.needleWidth = 5;
        break;

      case "nobar":
          themePaletteColor = getComputedStyle(this.backgroundElement.nativeElement).color;
          themePaletteDarkColor = getComputedStyle(this.warnDarkElement.nativeElement).color;
          this.gaugeOptions.colorBar = themePaletteColor;
          this.gaugeOptions.colorBarProgress = themePaletteColor;
          this.gaugeOptions.colorBarProgressEnd = themePaletteColor;
          this.gaugeOptions.colorNeedle = themePaletteDarkColor;
          this.gaugeOptions.needleWidth = 20;


        default:
        break;
    }

    // highlights
    let myZones: IDataHighlight = [];
    this.zones.forEach(zone => {
      // get zones for our path
      if (zone.path == this.config.paths['gaugePath'].path) {
        let lower = zone.lower || this.config.minValue;
        let upper = zone.upper || this.config.maxValue;
        let color: string;
        switch (zone.state) {
          case 1:
            color = getComputedStyle(this.warnElement.nativeElement).color;
            break;
          case ZoneState.alarm:
            color = getComputedStyle(this.warnDarkElement.nativeElement).color;
            break;
          default:
            color = getComputedStyle(this.primaryElement.nativeElement).color;
        }

        myZones.push({from: lower, to: upper, color: color});
      }
    });
    this.gaugeOptions.highlights = myZones;


    // Config storage values
    this.gaugeOptions.minValue = this.config.minValue;
    this.gaugeOptions.maxValue = this.config.maxValue;
    this.gaugeOptions.valueInt = this.config.numInt;
    this.gaugeOptions.valueDec = this.config.numDecimal;

    this.gaugeOptions.majorTicksInt = this.config.numInt;
    this.gaugeOptions.majorTicksDec = this.config.numDecimal;

    if (this.config.gaugeTicks) {
      this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorTitle;
    } else {
      this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = "";
    }

    this.gaugeOptions.valueBox = true;
    this.gaugeOptions.valueBoxWidth = 100;
    this.gaugeOptions.valueBoxBorderRadius = 0;

    this.gaugeOptions.needle = true;
    this.gaugeOptions.needleType = "line";
    this.gaugeOptions.needleShadow = false;
    this.gaugeOptions.needleSide = "both";

    // Vertical
    if (this.config.gaugeType == 'ngLinearVertical'){
      this.isGaugeVertical = true;   // Changes div wrapper class to respect aspect ratio
      this.gaugeOptions.barLength = 75;
      this.gaugeOptions.fontUnitsSize = 40;
      this.gaugeOptions.fontTitleSize = 40;

      // Vertical With ticks
      if (this.config.gaugeTicks == true) {
        this.gaugeOptions.barWidth = 30;

        this.gaugeOptions.needleStart = -45;
        this.gaugeOptions.needleEnd = 55;

        this.gaugeOptions.exactTicks = false;
        this.gaugeOptions.tickSide = "right";
        this.gaugeOptions.ticksWidth = 8;
        this.gaugeOptions.ticksPadding = 4;

        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = [this.config.minValue, this.config.maxValue];

        this.gaugeOptions.numberSide = "right";
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 25;

        this.gaugeOptions.minorTicks = 10;
        this.gaugeOptions.ticksWidthMinor = 4;

        this.gaugeOptions.highlightsWidth = 15;
      }
      else {
        // Vertical No ticks
        this.gaugeOptions.barWidth = 100;

        this.gaugeOptions.needleStart = 0;
        this.gaugeOptions.needleEnd = 100;

        this.gaugeOptions.ticksWidth = 0;
        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = [];

        this.gaugeOptions.ticksPadding = 0;
        this.gaugeOptions.minorTicks = 0;
        this.gaugeOptions.ticksWidthMinor = 0;
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 0;

        this.gaugeOptions.highlightsWidth = 15;
      }
    }
    else {
      // horizontal
      this.isGaugeVertical = false;  // Changes div wrapper class to respect aspect ratio
      this.gaugeOptions.barLength = 80;
      this.gaugeOptions.fontTitleSize = 45;
      this.gaugeOptions.fontUnitsSize = 35;

      // horizontal With ticks
      this.gaugeOptions.barWidth = 40;
        if (this.config.gaugeTicks == true) {

          this.gaugeOptions.exactTicks = false;
          this.gaugeOptions.barWidth = 30;

          this.gaugeOptions.needleStart = -45;
          this.gaugeOptions.needleEnd = 56;

          this.gaugeOptions.tickSide = "right";
          this.gaugeOptions.ticksWidth = 8;
          this.gaugeOptions.ticksPadding = 5;

          this.gaugeOptions.strokeTicks = false;
          this.gaugeOptions.majorTicks = [this.config.minValue, this.config.maxValue];

          this.gaugeOptions.numberSide = "right";
          this.gaugeOptions.numbersMargin = -5;
          this.gaugeOptions.fontNumbersSize = 25;

          this.gaugeOptions.minorTicks = 10;
          this.gaugeOptions.ticksWidthMinor = 5;

          this.gaugeOptions.highlightsWidth = 15;
      }
      else {
        // horizontal No ticks
        this.gaugeOptions.barWidth = 60;

        this.gaugeOptions.needleStart = 0;
        this.gaugeOptions.needleEnd = 100;

        this.gaugeOptions.ticksWidth = 0;
        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = [];

        this.gaugeOptions.ticksPadding = 0;
        this.gaugeOptions.minorTicks = 0;
        this.gaugeOptions.ticksWidthMinor = 0;
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 0;

        this.gaugeOptions.highlightsWidth = 15;
      }
    }
  }

  onResized(event: ResizedEvent) {

    this.gaugeOptions.height = event.newRect.height;

    if (this.isGaugeVertical == true) {
      this.gaugeOptions.width = (event.newRect.height * 0.30);
    }
    else {
      this.gaugeOptions.width = event.newRect.width;
    }
  }

}
