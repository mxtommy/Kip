/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { ViewChild, Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Subscription } from 'rxjs';
import { ResizedEvent, AngularResizeEventModule } from 'angular-resize-event';

import { IDataHighlight } from '../../core/interfaces/widgets-interface';
import { GaugesModule, RadialGaugeOptions, RadialGauge } from '@godind/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { adjustLinearScaleAndMajorTicks } from '../../utils/dataScales';
import { ISkZone, States } from '../../core/interfaces/signalk-interfaces';

@Component({
    selector: 'app-widget-gauge-ng-radial',
    templateUrl: './widget-gauge-ng-radial.component.html',
    styleUrls: ['./widget-gauge-ng-radial.component.css'],
    standalone: true,
    imports: [AngularResizeEventModule, GaugesModule, AsyncPipe]
})
export class WidgetGaugeNgRadialComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  // Gauge option setting constant
  private readonly LINE: string = "line";
  private readonly ANIMATION_TARGET_NEEDLE:string = "needle";
  private readonly WIDGET_SIZE_FACTOR: number = 0.97;

  @ViewChild('ngRadialWrapperDiv', {static: true, read: ElementRef}) wrapper: ElementRef;
  @ViewChild('radialGauge', { static: true }) radialGauge: RadialGauge;

  // Gauge text value for value box rendering
  public textValue: string = "--";
  // Gauge value
  public value: number = 0;

  private displayScaleSub: Subscription;

  // Gauge options
  public gaugeOptions = {} as RadialGaugeOptions;
  // fix for RadialGauge GaugeOptions object ** missing color-stroke-ticks property
  public colorStrokeTicks: string = "";
  public unitName: string = null;

  // Zones support
  private metaSub: Subscription;
  private state: string = "normal";

  constructor() {
    super();

    this.defaultConfig = {
      displayName: 'Gauge Label',
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
        compassUseNumbers: false,
        highlightsWidth: 5,
      },
      numInt: 1,
      numDecimal: 0,
      enableTimeout: false,
      textColor: "accent",
      dataTimeout: 5
    };
  }

  ngOnInit() {
    //TODO: simplify initialization
    this.initWidget();
    const gaugeSize = this.wrapper.nativeElement.getBoundingClientRect();
    this.gaugeOptions.height = Math.floor(gaugeSize.height * this.WIDGET_SIZE_FACTOR);
    this.gaugeOptions.width = Math.floor(gaugeSize.width * this.WIDGET_SIZE_FACTOR);
    this.setGaugeConfig();
  }

  ngAfterViewInit(): void {
    this.radialGauge.update(this.gaugeOptions);

    this.observeDataStream('gaugePath', newValue => {
      if (!newValue.data) {
        this.value = 0;
      } else {
        this.value = newValue.data.value;
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

    this.metaSub = this.zones$.subscribe(zones => {
      if (zones && zones.length > 0 && ["capacity", "measuring"].includes(this.widgetProperties.config.gauge.subType)) {
        this.setHighlights(zones);
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

    this.gaugeOptions.valueInt = this.widgetProperties.config.numInt !== undefined && this.widgetProperties.config.numInt !== null ? this.widgetProperties.config.numInt : 1;
    this.gaugeOptions.valueDec = this.widgetProperties.config.numDecimal !== undefined && this.widgetProperties.config.numDecimal !== null ? this.widgetProperties.config.numDecimal : 2;
    this.gaugeOptions.majorTicksInt = this.widgetProperties.config.numInt !== undefined && this.widgetProperties.config.numInt !== null ? this.widgetProperties.config.numInt : 1;
    this.gaugeOptions.majorTicksDec = this.widgetProperties.config.numDecimal !== undefined && this.widgetProperties.config.numDecimal !== null ? this.widgetProperties.config.numDecimal : 2;
    this.gaugeOptions.highlightsWidth = this.widgetProperties.config.gauge.highlightsWidth;

    this.gaugeOptions.animation = true;
    this.gaugeOptions.animateOnInit = false;
    this.gaugeOptions.animatedValue = false;
    this.gaugeOptions.animationRule = "linear";
    this.gaugeOptions.animationDuration = this.widgetProperties.config.paths['gaugePath'].sampleTime - 25; // prevent data and animation delay collisions

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
      default:
    }
  }

  private setGaugeOptions(themePaletteColor: string, themePaletteDarkColor: string) {
    this.gaugeOptions.colorBarProgress = this.gaugeOptions.colorBorderMiddle = this.gaugeOptions.colorBorderMiddleEnd = themePaletteColor;
    this.gaugeOptions.colorNeedle = themePaletteDarkColor;
    this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
  }

  private configureCapacityGauge(): void {
    this.gaugeOptions.minValue = this.widgetProperties.config.displayScale.lower;
    this.gaugeOptions.maxValue = this.widgetProperties.config.displayScale.upper;
    this.gaugeOptions.units = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
    this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorPlate; // bug with MajorTicks; always drawing first tick and using color="" does not work
    this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = "";
    this.gaugeOptions.fontTitleSize = 60;
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
    const unit = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
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

  private setHighlights(zones: ISkZone[]): void {
    const gaugeZonesHighlight: IDataHighlight[] = [];
    // Sort zones based on lower value
    const sortedZones = [...zones].sort((a, b) => a.lower - b.lower);
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
    let highlights: LinearGaugeOptions = {};
    highlights.highlightsWidth = this.widgetProperties.config.gauge.highlightsWidth;
    //@ts-ignore - bug in highlights property definition
    highlights.highlights = JSON.stringify(gaugeZonesHighlight, null, 1);
    this.radialGauge.update(highlights);
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.metaSub?.unsubscribe();
    this.displayScaleSub?.unsubscribe();
  }
}
