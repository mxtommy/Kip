/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { ViewChild, Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

import { IDataHighlight } from '../../core/interfaces/widgets-interface';
import { LinearGaugeOptions, LinearGauge, GaugesModule } from '@godind/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { ISkZone, States } from '../../core/interfaces/signalk-interfaces';
import { adjustLinearScaleAndMajorTicks } from '../../core/utils/dataScales';

@Component({
    selector: 'widget-gauge-ng-linear',
    templateUrl: './widget-gauge-ng-linear.component.html',
    styleUrls: ['./widget-gauge-ng-linear.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, NgxResizeObserverModule, GaugesModule]
})

export class WidgetGaugeNgLinearComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('linearGauge', {static: true, read: LinearGauge}) protected linearGauge: LinearGauge;
  @ViewChild('linearGauge', {static: true, read: ElementRef}) protected gauge: ElementRef;

  // Gauge text value for value box rendering
  public textValue: string = "--";
  // Gauge value
  public value: number = 0;

  // Gauge options
  public gaugeOptions = {} as LinearGaugeOptions;
  private isGaugeVertical: Boolean = true;

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
      color: 'white',
      enableTimeout: false,
      dataTimeout: 5
    };

  }

  ngOnInit() {
    this.initWidget();
    const gaugeSize = this.gauge.nativeElement.getBoundingClientRect();
    this.gaugeOptions.height = gaugeSize.height;
    this.gaugeOptions.width = gaugeSize.width;
    this.startWidget();
  }

  protected startWidget(): void {
    this.setGaugeConfig();
    this.linearGauge.update(this.gaugeOptions);

    this.unsubscribeDataStream();
    this.metaSub?.unsubscribe();

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
            if (this.widgetProperties.config.color != 'nobar') {
              option.colorBarProgress = this.theme.zoneEmergency;
            } else {
              option.colorBarProgress = '';
              option.colorNeedle = this.theme.zoneEmergency;
            }
            break;
          case States.Alarm:
            if (this.widgetProperties.config.color != 'nobar') {
              option.colorBarProgress = this.theme.zoneAlarm;
            } else {
              option.colorBarProgress = '';
              option.colorNeedle = this.theme.zoneAlarm;
            }
            break;
          case States.Warn:
            if (this.widgetProperties.config.color != 'nobar') {
              option.colorBarProgress = this.theme.zoneWarn;
            } else {
              option.colorBarProgress = '';
              option.colorNeedle = this.theme.zoneWarn;
            }
            break;
          case States.Alert:
            if(this.widgetProperties.config.color != 'nobar') {
              option.colorBarProgress = this.theme.zoneAlert;
            } else {
              option.colorBarProgress = '';
              option.colorNeedle = this.theme.zoneAlert;
            }
            break;
          default:
            if (this.widgetProperties.config.color != 'nobar') {
              option.colorBarProgress = this.getColors(this.widgetProperties.config.color).color;
            } else {
              option.colorBarProgress = '';
              option.colorNeedle = this.getColors('white').color;
            }
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

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    // this.onResized({});
    this.startWidget();
  }

  ngAfterViewInit() {
    this.startWidget();
  }

  public onResized(event: ResizeObserverEntry) {
    //@ts-ignore
    let resize: LinearGaugeOptions = {};
    if (this.widgetProperties.config.gauge.subType === 'vertical') {
      resize.height = event.contentRect.height;
      resize.width = (event.contentRect.height * 0.3);
    }
    else {
      resize.height = event.contentRect.width * 0.3;
      resize.width = event.contentRect.width;
    }
    this.linearGauge.update(resize);
  }

  private setGaugeConfig() {
    const isVertical = this.widgetProperties.config.gauge.subType === 'vertical';
    const scale = adjustLinearScaleAndMajorTicks(this.widgetProperties.config.displayScale.lower, this.widgetProperties.config.displayScale.upper);
    const rect = this.gauge.nativeElement.getBoundingClientRect();
    let height, width: number = null;
    if (this.widgetProperties.config.gauge.subType === 'vertical') {
      height = rect.height;
      width = rect.height * 0.3;
    }
    else {
      height = rect.width * 0.3;
      width = rect.width;
    }
    const defaultOptions = {
      height: height,
      width: width,
      minValue: scale.min,
      maxValue: scale.max,
      valueInt: this.widgetProperties.config.numInt,
      valueDec: this.widgetProperties.config.numDecimal,

      title: this.widgetProperties.config.displayName,
      fontTitleSize: 40,
      fontTitle: "Roboto",
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
      fontUnits: "Roboto",
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
      fontValue: "Roboto",
      fontValueWeight: "bold",
      valueTextShadow: false,

      colorValueBoxShadow: "",
      fontNumbers: "Roboto",
      fontNumbersWeight: "normal",
      fontUnitsSize: this.isGaugeVertical ? 40 : 35,

      colorTitle: this.getColors('white').dim,
      colorUnits: this.getColors('white').dim,
      colorValueText: this.getColors(this.widgetProperties.config.color).color,
      colorPlate: this.theme.cardColor,
      colorBar: this.theme.background,

      colorMajorTicks: this.getColors(this.widgetProperties.config.color).dim,
      colorMinorTicks: this.getColors(this.widgetProperties.config.color).dim,
      colorNumbers: this.getColors(this.widgetProperties.config.color).dim,

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

    switch (this.widgetProperties.config.color) {
      case "white":
        themePaletteColor = this.theme.white;
        themePaletteDarkColor = this.theme.whiteDim;
        break;
      case "blue":
        themePaletteColor = this.theme.blue;
        themePaletteDarkColor = this.theme.blueDim;
        break;
      case "green":
        themePaletteColor = this.theme.green;
        themePaletteDarkColor = this.theme.greenDim;
        break;
      case "pink":
        themePaletteColor = this.theme.pink;
        themePaletteDarkColor = this.theme.pinkDim;
        break;
      case "orange":
        themePaletteColor = this.theme.orange;
        themePaletteDarkColor = this.theme.orangeDim;
        break;
      case "purple":
        themePaletteColor = this.theme.purple;
        themePaletteDarkColor = this.theme.purpleDim;
        break;
      case "grey":
        themePaletteColor = this.theme.grey;
        themePaletteDarkColor = this.theme.greyDim;
        break;
      case "yellow":
        themePaletteColor = this.theme.yellow;
        themePaletteDarkColor = this.theme.yellowDim;
        break;
      case "nobar":
        themePaletteColor = "";
        themePaletteDarkColor = this.theme.blue;
        break;
      default:
        themePaletteColor = this.theme.white;
        themePaletteDarkColor = this.theme.whiteDim;
        break;
    }

    Object.assign(this.gaugeOptions, {
      colorBarProgress: themePaletteColor,
      colorBarProgressEnd: '',
      colorNeedle: themePaletteDarkColor,
      needleWidth: this.widgetProperties.config.color === "nobar" ? 10 : 0,
    });
  }

  private getColors(color: string): { color: string, dim: string, dimmer: string } {
    const themePalette = {
      "white": { color: this.theme.white, dim: this.theme.whiteDim, dimmer: this.theme.whiteDimmer },
      "blue": { color: this.theme.blue, dim: this.theme.blueDim, dimmer: this.theme.blueDimmer },
      "green": { color: this.theme.green, dim: this.theme.greenDim, dimmer: this.theme.greenDimmer },
      "pink": { color: this.theme.pink, dim: this.theme.pinkDim, dimmer: this.theme.pinkDimmer },
      "orange": { color: this.theme.orange, dim: this.theme.orangeDim, dimmer: this.theme.orangeDimmer },
      "purple": { color: this.theme.purple, dim: this.theme.purpleDim, dimmer: this.theme.purpleDimmer },
      "yellow": { color: this.theme.yellow, dim: this.theme.yellowDim, dimmer: this.theme.yellowDimmer },
      "grey": { color: this.theme.grey, dim: this.theme.greyDim, dimmer: this.theme.yellowDimmer },
      "nobar": { color: "", dim: this.theme.whiteDim, dimmer: this.theme.whiteDimmer }
    };
    return themePalette[color];
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
          color = this.theme.zoneEmergency;
          break;
        case States.Alarm:
          color = this.theme.zoneAlarm;
          break;
        case States.Warn:
          color = this.theme.zoneWarn;
          break;
        case States.Alert:
          color = this.theme.zoneAlert;
          break;
        case States.Nominal:
          color = this.theme.zoneNominal;
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
