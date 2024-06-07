/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { ViewChild, ElementRef, Component, OnInit, OnDestroy, AfterViewInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { ResizedEvent, AngularResizeEventModule } from 'angular-resize-event';

import { IDataHighlight } from '../../core/interfaces/widgets-interface';
import { LinearGaugeOptions, LinearGauge, GaugesModule } from '@godind/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../core/components/base-widget/base-widget.component';
import { JsonPipe } from '@angular/common';
import { ISkMetadata, ISkZone, States } from '../../core/interfaces/signalk-interfaces';
import { adjustLinearScaleAndMajorTicks } from '../../core/utils/dataScales';

@Component({
    selector: 'app-widget-gauge-ng-linear',
    templateUrl: './widget-gauge-ng-linear.component.html',
    styleUrls: ['./widget-gauge-ng-linear.component.scss'],
    standalone: true,
    imports: [AngularResizeEventModule, GaugesModule, JsonPipe]
})

export class WidgetGaugeNgLinearComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('linearWrapperDiv', {static: true, read: ElementRef}) private wrapper: ElementRef;
  @ViewChild('linearGauge', {static: true, read: LinearGauge}) protected linearGauge: LinearGauge;

  // Gauge text value for value box rendering
  public textValue: string = "--";
  // Gauge value
  public value: number = 0;

  // Gauge options
  public gaugeOptions = {} as LinearGaugeOptions;
  private isGaugeVertical: Boolean = true;
  public height: string = "";

  // Zones support
  private metaSub: Subscription;
  private state: string = "normal";

  constructor() {
    super();

    this.defaultConfig = {
      displayName: "Gauge Label",
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
        type: 'ngLinear',
        subType: 'vertical',    // vertical or horizontal
        enableTicks: true,
      },
      numInt: 1,
      numDecimal: 0,
      textColor: 'accent',
      enableTimeout: false,
      dataTimeout: 5
    };

  }

  ngOnInit() {
    this.initWidget();
    this.setGaugeConfig();

    const gaugeSize = this.wrapper.nativeElement.getBoundingClientRect();
    this.isGaugeVertical = this.widgetProperties.config.gauge.subType === 'vertical';  // Save for resize event

    if (this.isGaugeVertical) {
      this.gaugeOptions.height = gaugeSize.height;
      this.gaugeOptions.width = (gaugeSize.height * 0.3);
      this.height = "0px";
    }
    else {
      this.gaugeOptions.height = gaugeSize.width * 0.3;
      this.gaugeOptions.width = gaugeSize.width;
      this.height = ((gaugeSize.height - this.gaugeOptions.height) / 2).toString() + "px";
    }
  }

  ngAfterViewInit() {
    this.observeDataStream('gaugePath', newValue => {
      if (!newValue.data) {
        this.value = 0;
      } else {
        // Compound value to displayScale
        this.value = Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);
      }

      if (this.state !== newValue.state) {
        this.state = newValue.state;
        //@ts-ignore
        let option: LinearGaugeOptions = {};
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
        this.linearGauge.update(option);
      }
    });

    this.metaSub = this.zones$.subscribe(zones => {
      if (zones && zones.length > 0) {
        this.setHighlights(zones);
      }
    });
  }

  public onResized(event: ResizedEvent) {
    if (!event.isFirst) {
      //@ts-ignore
      let resize: LinearGaugeOptions = {};
      if (this.isGaugeVertical) {
        resize.height = event.newRect.height;
        resize.width = (event.newRect.height * 0.3);
        this.height = "0px";
      }
      else {
        resize.height = event.newRect.width * 0.3;
        resize.width = event.newRect.width;
        this.height = ((event.newRect.height - resize.height) / 2).toString() + "px";
      }
      this.linearGauge.update(resize);
    }
  }

  private setGaugeConfig() {
    const isVertical = this.widgetProperties.config.gauge.subType === 'vertical';
    const scale = adjustLinearScaleAndMajorTicks(this.widgetProperties.config.displayScale.lower, this.widgetProperties.config.displayScale.upper);
    const defaultOptions = {
      minValue: scale.min,
      maxValue: scale.max,
      valueInt: this.widgetProperties.config.numInt,
      valueDec: this.widgetProperties.config.numDecimal,

      title: this.widgetProperties.config.displayName,
      fontTitleSize: 40,
      fontTitle: "arial",
      fontTitleWeight: "bold",

      barLength: isVertical ? 80 : 90,
      barWidth: 30,
      barProgress: true,
      barBeginCircle: 0,
      barStrokeWidth: 0,
      barShadow: 0,

      needleStart: -45,
      needleEnd: 55,


      units: this.widgetProperties.config.paths['gaugePath'].convertUnitTo,
      fontUnits: "arial",
      fontUnitsWeight: "normal",
      borders: false,
      borderOuterWidth: 0,
      colorBorderOuter: "red",
      colorBorderOuterEnd: "red",
      borderMiddleWidth: 0,
      colorBorderMiddle: "#63afdf",
      colorBorderMiddleEnd: "#63afdf",
      borderInnerWidth: 0,
      colorBorderInner: "red",
      colorBorderInnerEnd: "#121212",
      borderShadowWidth: 0,
      borderRadius: 0,

      colorBarEnd: "",
      colorBarStroke: "0",
      valueBoxStroke: 0,
      colorValueBoxRect: "",
      colorValueBoxRectEnd: "",
      colorValueBoxBackground: this.theme.background,
      fontValueSize: 50,
      fontValue: "arial",
      fontValueWeight: "bold",
      valueTextShadow: false,

      colorValueBoxShadow: "",
      fontNumbers: "arial",
      fontNumbersWeight: "normal",
      fontUnitsSize: this.isGaugeVertical ? 40 : 35,

      colorTitle: this.theme.textDark,
      colorUnits: this.theme.text,
      colorValueText: this.theme.text,
      colorPlate: window.getComputedStyle(this.wrapper.nativeElement).backgroundColor,
      colorBar: this.theme.background,

      colorMajorTicks: this.theme.text,
      colorMinorTicks: this.theme.text,
      colorNumbers: this.theme.text,

      colorNeedleEnd: "",
      colorNeedleShadowUp: "",
      colorNeedleShadowDown: "black",

      majorTicks: scale.majorTicks,
      majorTicksInt: this.widgetProperties.config.numInt,
      majorTicksDec: this.widgetProperties.config.numDecimal,
      numberSide: "left",
      fontNumbersSize: 25,
      numbersMargin: isVertical ? 8 : 4,
      tickSide: "left",
      ticksWidth: 10,
      ticksPadding: 0,
      strokeTicks: false,
      minorTicks: 2,
      ticksWidthMinor: 6,


      valueBox: true,
      valueBoxWidth: 35,
      valueBoxBorderRadius: 10,
      needle: true,
      needleType: "line",
      needleShadow: false,
      needleSide: "both",

      highlights: [],
      highlightsWidth: 0,

      animation: true,
      animationRule: "linear",
      animatedValue: false,
      animateOnInit: false,
      animationDuration: this.widgetProperties.config.paths['gaugePath'].sampleTime - 25,
    };

    Object.assign(this.gaugeOptions, defaultOptions);

    this.setThemePaletteColor();
  }

  private setThemePaletteColor() {
    let themePaletteColor = "";
    let themePaletteDarkColor = "";

    switch (this.widgetProperties.config.textColor) {
      case "text":
        themePaletteColor = this.theme.textDark;
        themePaletteDarkColor = this.theme.text;
        break;
      case "primary":
        themePaletteColor = this.theme.primary;
        themePaletteDarkColor = this.theme.primaryDark;
        break;
      case "accent":
        themePaletteColor = this.theme.accent;
        themePaletteDarkColor = this.theme.accentDark;
        break;
      case "warn":
        themePaletteColor = this.theme.warn;
        themePaletteDarkColor = this.theme.warnDark;
        break;
      case "nobar":
        themePaletteColor = "";
        themePaletteDarkColor = this.theme.accentDark;
        break;
      default:
        break;
    }

    Object.assign(this.gaugeOptions, {
      colorBarProgress: themePaletteColor,
      colorBarProgressEnd: themePaletteColor,
      colorNeedle: themePaletteDarkColor,
      needleWidth: this.widgetProperties.config.textColor === "nobar" ? 20 : 5,
    });
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
    highlights.highlightsWidth = 5;
    //@ts-ignore - bug in highlights property definition
    highlights.highlights = JSON.stringify(gaugeZonesHighlight, null, 1);
    this.linearGauge.update(highlights);
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.metaSub?.unsubscribe();
  }
}
