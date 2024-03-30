import { ViewChild, ElementRef, Component, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription, sampleTime } from 'rxjs';
import { ResizedEvent, AngularResizeEventModule } from 'angular-resize-event';

import { IZone, IZoneState } from '../../core/interfaces/app-settings.interfaces';
import { IDataHighlight } from '../../core/interfaces/widgets-interface';

import { RadialGauge, RadialGaugeOptions } from '../../gauges-module/radial-gauge';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { JsonPipe } from '@angular/common';

@Component({
    selector: 'app-widget-gauge-ng-radial',
    templateUrl: './widget-gauge-ng-radial.component.html',
    styleUrls: ['./widget-gauge-ng-radial.component.css'],
    standalone: true,
    imports: [AngularResizeEventModule, RadialGauge, JsonPipe]
})
export class WidgetGaugeNgRadialComponent extends BaseWidgetComponent implements OnInit, OnChanges, OnDestroy {
  @ViewChild('ngRadialWrapperDiv', {static: true, read: ElementRef}) private wrapper: ElementRef;
  @ViewChild('radialGauge', {static: true, read: RadialGauge}) public radialGauge: RadialGauge;

  // main gauge value variable
  public dataValue = 0;
  private valueSub$: Subscription = null;
  private sample: number = 200;

  // Gauge options
  public gaugeOptions = {} as RadialGaugeOptions;
  // fix for RadialGauge GaugeOptions object ** missing color-stroke-ticks property
  public colorStrokeTicks: string = "";
  public unitName: string = null;

  // Zones support
  zones: Array<IZone> = [];
  zonesSub: Subscription;

  constructor(private appSettingsService: AppSettingsService) {
    super();

    this.defaultConfig = {
      displayName: null,
      filterSelfPaths: true,
      paths: {
        "gaugePath": {
          description: "Numeric Data",
          path: null,
          source: null,
          pathType: "number",
          isPathConfigurable: true,
          convertUnitTo: "unitless",
          sampleTime: 500
        }
      },
      gaugeType: 'ngRadial',  //ngLinearVertical or ngLinearHorizontal
      gaugeTicks: false,
      radialSize: 'measuring',
      compassUseNumbers: false,
      minValue: 0,
      maxValue: 100,
      numInt: 1,
      numDecimal: 0,
      barColor: 'accent',     // theme palette to select
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.observeDataStream('gaugePath', newValue => {
        if (newValue.value === null) {newValue.value = 0}
        let oldValue = this.dataValue;
        let temp: any = this.formatWidgetNumberValue(newValue.value);

        if (oldValue != (temp as number)) {
          this.dataValue = temp;
        }

        // set zone state colors
        switch (newValue.state) {
          case IZoneState.warning:
            this.gaugeOptions.colorValueText = this.theme.warnDark;
            break;
          case IZoneState.alarm:
            this.gaugeOptions.colorValueText = this.theme.warnDark;
            break;
          default:
            this.gaugeOptions.colorValueText = this.theme.text;
        }
      }
    );

    this.subscribeZones();
   }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.zonesSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.theme) {
      this.updateGaugeConfig();
    }
  }

  // Subscribe to Zones
  subscribeZones() {
    this.zonesSub = this.appSettingsService.getZonesAsO().subscribe(
      zones => {
        this.zones = zones;
        this.updateGaugeConfig();
      });
  }


  updateGaugeConfig(){
    //// Hack to get Theme colors using hidden mixin, DIV and @ViewChild
    let themePaletteColor = "";
    let themePaletteDarkColor = "";

    this.gaugeOptions.colorTitle = this.gaugeOptions.colorUnits =this.theme.text;

    this.gaugeOptions.colorPlate = getComputedStyle(this.wrapper.nativeElement).backgroundColor;
    this.gaugeOptions.colorBar = this.theme.background;
    this.gaugeOptions.colorNeedleShadowUp = "";
    this.gaugeOptions.colorNeedleShadowDown = "black";
    this.gaugeOptions.colorNeedleCircleInner = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleInnerEnd = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleOuter = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleOuterEnd = this.gaugeOptions.colorPlate;

    // Theme colors
    switch (this.widgetProperties.config.barColor) {
      case "primary":
        themePaletteColor = this.theme.primary;
        themePaletteDarkColor = this.theme.primaryDark;
        this.gaugeOptions.colorBarProgress = themePaletteColor;
        this.gaugeOptions.colorNeedle = themePaletteDarkColor;
        this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
        break;

      case "accent":
        themePaletteColor = this.theme.accent;
        themePaletteDarkColor = this.theme.accentDark;
        this.gaugeOptions.colorBarProgress = themePaletteColor;
        this.gaugeOptions.colorNeedle = themePaletteDarkColor;
        this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
        break;

      case "warn":
        themePaletteColor = this.theme.warn;
        themePaletteDarkColor = this.theme.warnDark;
        this.gaugeOptions.colorBarProgress = themePaletteColor;
        this.gaugeOptions.colorNeedle = themePaletteDarkColor;
        this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
        break;

      default:
        break;
    }

    // highlights
    let myZones: IDataHighlight = [];
    this.zones.forEach(zone => {
      // get zones for our path
      if (zone.path == this.widgetProperties.config.paths['gaugePath'].path) {
        let lower = zone.lower || this.widgetProperties.config.minValue;
        let upper = zone.upper || this.widgetProperties.config.maxValue;
        let color: string;
        switch (zone.state) {
          case 1:
            color = this.theme.warn;
            break;
          case IZoneState.alarm:
            color = this.theme.warnDark;
            break;
          default:
            color = this.theme.primary;
        }

        myZones.push({from: lower, to: upper, color: color});
      }
    });
    this.gaugeOptions.highlights = myZones;

    // Config storage values
    this.gaugeOptions.valueInt = this.widgetProperties.config.numInt;
    this.gaugeOptions.valueDec = this.widgetProperties.config.numDecimal;

    this.gaugeOptions.majorTicksInt = this.widgetProperties.config.numInt;
    this.gaugeOptions.majorTicksDec = this.widgetProperties.config.numDecimal;

    this.gaugeOptions.animationDuration = this.widgetProperties.config.paths['gaugePath'].sampleTime - 25; // prevent data and animation delay collisions

    // Radial gauge type
    switch(this.widgetProperties.config.radialSize) {
      case "capacity":
        this.unitName = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
        this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorPlate; // bug with MajorTicks; always drawing firts tick and using color="" does not work
        this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = "";
        this.gaugeOptions.fontTitleSize = 60;
        this.gaugeOptions.minValue = this.widgetProperties.config.minValue;
        this.gaugeOptions.maxValue = this.widgetProperties.config.maxValue;
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
        this.gaugeOptions.highlightsWidth = 15;

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
        this.unitName = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
        let calculatedMajorTicks = this.calculateMajorTicks(this.widgetProperties.config.minValue, this.widgetProperties.config.maxValue);

        this.gaugeOptions.colorTitle = this.colorStrokeTicks = this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorNumbers = this.gaugeOptions.colorTitle;

        this.gaugeOptions.fontTitleSize = 20;
        this.gaugeOptions.minValue = this.widgetProperties.config.minValue;
        this.gaugeOptions.maxValue = this.widgetProperties.config.maxValue;
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
        this.gaugeOptions.highlightsWidth = 15;

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
        // overwrite min/max/unit to make sure we don't limit
        this.widgetProperties.config.minValue = 0;
        this.widgetProperties.config.maxValue = 360;
        this.widgetProperties.config.paths["gaugePath"].convertUnitTo = "deg";
        this.unitName = null;


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

        this.gaugeOptions.majorTicks = this.widgetProperties.config.compassUseNumbers ? ["0,45,90,135,180,225,270,315,0"] : ["N,NE,E,SE,S,SW,W,NW,N"];
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
        // overwrite min/max/unit to make sure we don't limit
        this.widgetProperties.config.minValue = 0;
        this.widgetProperties.config.maxValue = 360;
        this.widgetProperties.config.paths["gaugePath"].convertUnitTo = "deg";
        this.unitName = null;

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
        this.gaugeOptions.majorTicks = this.widgetProperties.config.compassUseNumbers ? ["0,45,90,135,180,225,270,315,0"] : ["N,NE,E,SE,S,SW,W,NW,N"];
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
        this.gaugeOptions.useMinPath = true;
        break;

      default:
        break;
    }
  }

  onResized(event: ResizedEvent) {
    this.gaugeOptions.height = Math.floor(event.newRect.height * 0.88);
    this.gaugeOptions.width = Math.floor(event.newRect.width * 0.88);
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
