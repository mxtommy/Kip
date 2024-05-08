/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { ViewChild, Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ResizedEvent, AngularResizeEventModule } from 'angular-resize-event';

import { IDataHighlight } from '../../core/interfaces/widgets-interface';
import { GaugesModule, RadialGaugeOptions, RadialGauge } from '@godind/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { adjustLinearScaleAndMajorTicks } from '../../utils/dataScales';
import { ISkMetadata, States } from '../../core/interfaces/signalk-interfaces';

@Component({
    selector: 'app-widget-gauge-ng-radial',
    templateUrl: './widget-gauge-ng-radial.component.html',
    styleUrls: ['./widget-gauge-ng-radial.component.css'],
    standalone: true,
    imports: [AngularResizeEventModule, GaugesModule]
})
export class WidgetGaugeNgRadialComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  // Gauge option setting constant
  private readonly DEG: string = "deg";
  private readonly LINE: string = "line";
  private readonly NEEDLE_START: number = 75;
  private readonly NEEDLE_END: number = 99;
  private readonly NEEDLE_CIRCLE_SIZE: number = 2;
  private readonly BORDER_MIDDLE_WIDTH: number = 2;
  private readonly BORDER_INNER_WIDTH: number = 2;
  private readonly ANIMATION_TARGET_PLATE:string = "plate";
  private readonly ANIMATION_TARGET_NEEDLE:string = "needle";
  private readonly WIDGET_SIZE_FACTOR: number = 0.97;

  @ViewChild('ngRadialWrapperDiv', {static: true, read: ElementRef}) wrapper: ElementRef;
  @ViewChild('radialGauge', { static: true }) radialGauge: RadialGauge;

  // Gauge text value for value box rendering
  public textValue: string = "--";
  // Gauge value
  public value: number = 0;

  // Gauge options
  public gaugeOptions = {} as RadialGaugeOptions;
  // fix for RadialGauge GaugeOptions object ** missing color-stroke-ticks property
  public colorStrokeTicks: string = "";
  public unitName: string = null;

  // Zones support
  private meta: ISkMetadata = null;
  private metaSub: Subscription;
  private state: string = "normal";

  constructor() {
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
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: null,
          convertUnitTo: "unitless",
          sampleTime: 500
        }
      },
      displayScale: {
        lower: 0,
        upper: 100,
        type: "linear"
      },
      gauge: {
        type: 'ngRadial', // capacity, measuring, marineCompass, baseplateCompass
        subType: 'measuring', // capacity, measuring, marineCompass, baseplateCompass
        enableTicks: true,
        compassUseNumbers: false
      },
      numInt: 1,
      numDecimal: 0,
      enableTimeout: false,
      textColor: "accent",
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.validateConfig();
    const gaugeSize = this.wrapper.nativeElement.getBoundingClientRect();
    this.gaugeOptions.height = Math.floor(gaugeSize.height * this.WIDGET_SIZE_FACTOR);
    this.gaugeOptions.width = Math.floor(gaugeSize.width * this.WIDGET_SIZE_FACTOR);
    this.setGaugeConfig();
  }

  ngAfterViewInit(): void {
    this.radialGauge.update(this.gaugeOptions);

    this.observeDataStream('gaugePath', newValue => {
      if (!newValue.data) {
        this.textValue = "--";
        this.value = 0;
      } else {
        // Compound value to displayScale
        this.value = Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);
        // Format for value box
        this.textValue = this.value.toFixed(this.widgetProperties.config.numDecimal);
      }

      if (this.state !== newValue.state) {
        this.state = newValue.state;
        //@ts-ignore
        let option: RadialGaugeOptions = {};
        // Set value color: reduce color changes to only warn & alarm states else it too much flickering and not clean
        switch (newValue.state) {
          case States.Emergency:
            option.colorValueText = this.theme.warnDark;
            break;
          case States.Alarm:
            option.colorValueText = this.theme.warnDark;
            break;
          case States.Warn:
            option.colorValueText = this.theme.textWarnLight;
            break;
          default:
            option.colorValueText = this.theme.text;
        }
        this.radialGauge.update(option);
      }
    });

    this.metaSub = this.DataService.getPathMeta(this.widgetProperties.config.paths['gaugePath'].path).subscribe((meta: ISkMetadata) => {
      this.meta = meta || null;
      if (this.meta && this.meta.zones && this.meta.zones.length > 0 && this.widgetProperties.config.gauge.subType == "measuring") {
        this.setHighlights();
      }
    });
  }

  public onResized(event: ResizedEvent): void {
    if (!event.isFirst) {
      //@ts-ignore
      let resize: RadialGaugeOptions = {};
      resize.height = Math.floor(event.newRect.height * this.WIDGET_SIZE_FACTOR);
      resize.width = Math.floor(event.newRect.width * this.WIDGET_SIZE_FACTOR);

      this.radialGauge.update(resize);
    }
  }

  private setGaugeConfig(): void {
    this.gaugeOptions.title = this.widgetProperties.config.displayName ? this.widgetProperties.config.displayName : "";
    this.gaugeOptions.highlights = [];

    this.gaugeOptions.fontTitle="arial";
    this.gaugeOptions.fontTitleWeight="bold";
    this.gaugeOptions.fontUnits="arial";
    this.gaugeOptions.fontUnitsSize=25;
    this.gaugeOptions.fontUnitsWeight="normal";
    this.gaugeOptions.colorBorderOuter="red";
    this.gaugeOptions.colorBorderOuterEnd="green";
    this.gaugeOptions.barStrokeWidth=0;
    this.gaugeOptions.barShadow=0;
    this.gaugeOptions.colorBarStroke="";
    this.gaugeOptions.fontValue="arial";
    this.gaugeOptions.fontValueWeight="bold";
    this.gaugeOptions.valueTextShadow=false;
    this.gaugeOptions.colorValueBoxShadow="";
    this.gaugeOptions.fontNumbers="arial";
    this.gaugeOptions.fontNumbersWeight="bold";

    this.gaugeOptions.valueInt = this.widgetProperties.config.numInt;
    this.gaugeOptions.valueDec = this.widgetProperties.config.numDecimal;
    this.gaugeOptions.majorTicksInt = this.widgetProperties.config.numInt;
    this.gaugeOptions.majorTicksDec = this.widgetProperties.config.numDecimal;
    this.gaugeOptions.highlightsWidth = 0;

    this.gaugeOptions.animation = true;
    this.gaugeOptions.animateOnInit = false;
    this.gaugeOptions.animatedValue = false;
    this.gaugeOptions.animationRule = "linear";
    this.gaugeOptions.animationDuration = this.widgetProperties.config.paths['gaugePath'].sampleTime - 50; // prevent data and animation delay collisions

     // Set Theme related colors
    const themePalette = {
      "text": { color: this.theme.text, darkColor: this.theme.text },
      "primary": { color: this.theme.primary, darkColor: this.theme.primaryDark },
      "accent": { color: this.theme.accent, darkColor: this.theme.accentDark },
      "warn": { color: this.theme.warn, darkColor: this.theme.warnDark }
    };

    if (themePalette[this.widgetProperties.config.textColor]) {
      this.setGaugeOptions(themePalette[this.widgetProperties.config.textColor].color, themePalette[this.widgetProperties.config.textColor].darkColor);

      this.gaugeOptions.colorTitle = this.theme.textDark;
      this.gaugeOptions.colorUnits = this.theme.text;
      this.gaugeOptions.colorValueText = this.theme.text;

      this.colorStrokeTicks = this.theme.text; // missing property in gaugeOptions
      this.gaugeOptions.colorMinorTicks = this.theme.text;
      this.gaugeOptions.colorNumbers = this.theme.text;

      this.gaugeOptions.colorMajorTicks = this.theme.text;

      this.gaugeOptions.colorPlate = this.gaugeOptions.colorPlateEnd = this.gaugeOptions.colorBorderInner = this.gaugeOptions.colorBorderInnerEnd = getComputedStyle(this.wrapper.nativeElement).backgroundColor;
      this.gaugeOptions.colorBar = this.theme.background;
      this.gaugeOptions.colorNeedleShadowUp = "";
      this.gaugeOptions.colorNeedleShadowDown = "black";
      this.gaugeOptions.colorNeedleCircleInner = this.gaugeOptions.colorPlate;
      this.gaugeOptions.colorNeedleCircleInnerEnd = this.gaugeOptions.colorPlate;
      this.gaugeOptions.colorNeedleCircleOuter = this.gaugeOptions.colorPlate;
      this.gaugeOptions.colorNeedleCircleOuterEnd = this.gaugeOptions.colorPlate;
    } else {
      console.error(`[ngGauge] Unknown bar color value: ${this.widgetProperties.config.textColor}`);
    }

    // Radial gauge subType
    switch(this.widgetProperties.config.gauge.subType) {
      case "capacity":
        this.configureCapacityGauge();
        break;
      case "measuring":
        this.configureMeasuringGauge();
        break;
      case "marineCompass":
        this.configureCompassGauge();
        break;
      case "baseplateCompass":
        this.configureCompassGauge();
        break;
      default:
        break;
    }
  }

  private setGaugeOptions(themePaletteColor: string, themePaletteDarkColor: string) {
    this.gaugeOptions.colorBarProgress = this.gaugeOptions.colorBorderMiddle = this.gaugeOptions.colorBorderMiddleEnd = themePaletteColor;
    this.gaugeOptions.colorNeedle = themePaletteDarkColor;
    this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
  }

  private configureCapacityGauge(): void {
    this.gaugeOptions.units = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
    this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorPlate; // bug with MajorTicks; always drawing first tick and using color="" does not work
    this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = "";
    this.gaugeOptions.fontTitleSize = 60;
    this.gaugeOptions.minValue = this.widgetProperties.config.displayScale.lower;
    this.gaugeOptions.maxValue = this.widgetProperties.config.displayScale.upper;
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
    this.gaugeOptions.exactTicks = true;
    this.gaugeOptions.strokeTicks = false;
    this.gaugeOptions.majorTicks = [];
    this.gaugeOptions.minorTicks = 0;
    this.gaugeOptions.numbersMargin = 0;
    this.gaugeOptions.fontNumbersSize = 0;

    this.gaugeOptions.needle = true;
    this.gaugeOptions.needleType = this.LINE;
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

    this.gaugeOptions.animationTarget = this.ANIMATION_TARGET_NEEDLE;
    this.gaugeOptions.useMinPath = false;
  }

  private configureMeasuringGauge(): void {
    const scale = adjustLinearScaleAndMajorTicks(this.widgetProperties.config.displayScale.lower, this.widgetProperties.config.displayScale.upper);
    this.gaugeOptions.minValue = scale.min;
    this.gaugeOptions.maxValue = scale.max;

    this.gaugeOptions.units = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
    this.gaugeOptions.fontTitleSize = 24;

    this.gaugeOptions.barProgress = true;
    this.gaugeOptions.barWidth = 15;

    this.gaugeOptions.valueBox = true;
    this.gaugeOptions.fontValueSize = 60;
    this.gaugeOptions.valueBoxWidth = 100;
    this.gaugeOptions.valueBoxBorderRadius = 0;
    this.gaugeOptions.valueBoxStroke = 0;
    this.gaugeOptions.colorValueBoxBackground = "";

    this.gaugeOptions.exactTicks = false;
    this.gaugeOptions.majorTicks = scale.majorTicks;

    this.gaugeOptions.minorTicks = 2;
    this.gaugeOptions.ticksAngle = 270;
    this.gaugeOptions.startAngle = 45;
    this.gaugeOptions.strokeTicks = true;
    this.gaugeOptions.numbersMargin = 3;
    this.gaugeOptions.fontNumbersSize = 15;

    this.gaugeOptions.needle = true;
    this.gaugeOptions.needleType = this.LINE;
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

    this.gaugeOptions.animationTarget = this.ANIMATION_TARGET_NEEDLE;
    this.gaugeOptions.useMinPath = false;
  }

  private configureCompassGauge(): void {
    // override gauge config min/max/unit to make them compatible for 360 circular rotation
    this.gaugeOptions.minValue = 0;
    this.gaugeOptions.maxValue = 360;
    this.gaugeOptions.units = this.widgetProperties.config.paths["gaugePath"].convertUnitTo = this.DEG;

    this.gaugeOptions.fontTitleSize = 60;
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
    this.gaugeOptions.majorTicks = this.widgetProperties.config.gauge.compassUseNumbers ? ["0,45,90,135,180,225,270,315,0"] : ["N,NE,E,SE,S,SW,W,NW,N"];
    this.gaugeOptions.numbersMargin = 3;
    this.gaugeOptions.fontNumbersSize = 15;
    this.gaugeOptions.minorTicks = 22;

    this.gaugeOptions.needle = true;
    this.gaugeOptions.needleType = this.LINE;
    this.gaugeOptions.needleStart = this.NEEDLE_START;
    this.gaugeOptions.needleEnd = this.NEEDLE_END;
    this.gaugeOptions.needleCircleSize = this.NEEDLE_CIRCLE_SIZE;
    this.gaugeOptions.needleWidth = 3;
    this.gaugeOptions.needleShadow = false;
    this.gaugeOptions.needleCircleInner = false;
    this.gaugeOptions.needleCircleOuter = false;

    this.gaugeOptions.borders = true;
    this.gaugeOptions.borderOuterWidth = 0;
    this.gaugeOptions.borderMiddleWidth = this.BORDER_MIDDLE_WIDTH;
    this.gaugeOptions.borderInnerWidth = this.BORDER_INNER_WIDTH;
    this.gaugeOptions.borderShadowWidth = 0;

    if (this.widgetProperties.config.gauge.subType === "marineCompass") {
      this.gaugeOptions.animationTarget = this.ANIMATION_TARGET_PLATE;
      this.gaugeOptions.useMinPath = true;
    } else if (this.widgetProperties.config.gauge.subType === "baseplateCompass") {
      this.gaugeOptions.animationTarget = this.ANIMATION_TARGET_NEEDLE;
      this.gaugeOptions.useMinPath = true;
    }
  }

  private setHighlights(): void {
    const gaugeZonesHighlight: IDataHighlight[] = [];
    // Sort zones based on lower value
    const sortedZones = [...this.meta.zones].sort((a, b) => a.lower - b.lower);
    for (const zone of sortedZones) {
      let lower: number = null;
      let upper: number = null;

      let color: string;
      switch (zone.state) {
        case States.Emergency:
          color = this.theme.warnDark;
          break;
        case States.Alarm:
          color = this.theme.warnDark;
          break;
        case States.Warn:
          color = this.theme.textWarnLight;
          break;
        case States.Alert:
          color = this.theme.accentDark;
          break;
        case States.Nominal:
          color = this.theme.primaryDark;
          break;
        default:
          color = "rgba(0,0,0,0)";
      }

      lower = this.unitsService.convertToUnit(this.widgetProperties.config.paths['gaugePath'].convertUnitTo, zone.lower);
      upper =this.unitsService.convertToUnit(this.widgetProperties.config.paths['gaugePath'].convertUnitTo, zone.upper);

      // Skip zones that are completely outside the gauge range
      if (upper < this.widgetProperties.config.displayScale.lower || lower > this.widgetProperties.config.displayScale.upper) {
        continue;
      }

      // If lower or upper are null, set them to displayScale min or max
      lower = lower !== null ? lower : this.widgetProperties.config.displayScale.lower;
      upper = upper !== null ? upper : this.widgetProperties.config.displayScale.upper;

      // Ensure lower does not go below min
      lower = Math.max(lower, this.widgetProperties.config.displayScale.lower);

      // Ensure upper does not exceed max
      if (upper > this.widgetProperties.config.displayScale.upper) {
        upper = this.widgetProperties.config.displayScale.upper;
        gaugeZonesHighlight.push({from: lower, to: upper, color: color});
        break;
      }

      gaugeZonesHighlight.push({from: lower, to: upper, color: color});
    };
    //@ts-ignore
    let highlights: RadialGaugeOptions = {};
    highlights.highlightsWidth = 6;
    //@ts-ignore - bug in highlights property definition
    highlights.highlights = JSON.stringify(gaugeZonesHighlight, null, 1);
    this.radialGauge.update(highlights);
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.metaSub?.unsubscribe();
  }
}
