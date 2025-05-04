/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { ViewChild, Component, OnInit, OnDestroy, AfterViewInit, ElementRef, effect } from '@angular/core';
import { Subscription } from 'rxjs';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

import { IDataHighlight } from '../../core/interfaces/widgets-interface';
import { LinearGaugeOptions, LinearGauge, GaugesModule, RadialGaugeOptions } from '@godind/ng-canvas-gauges';
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
  @ViewChild('linearGauge', {static: true, read: LinearGauge}) protected ngGauge: LinearGauge;
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
  private state: string = States.Normal;

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
        enableTicks: false,
        highlightsWidth: 5,
        useNeedle: false,
      },
      numInt: 1,
      numDecimal: 0,
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    };

    effect(() => {
      if (this.theme()) {
       this.startWidget();
      }
    });
  }

  ngOnInit() {
    this.validateConfig();
  }

  protected startWidget(): void {
    this.setGaugeConfig();
    this.ngGauge.update(this.gaugeOptions);

    this.unsubscribeDataStream();
    this.unsubscribeMetaStream();
    this.metaSub?.unsubscribe();

    this.observeDataStream('gaugePath', newValue => {
      if (!newValue || !newValue.data) {
        newValue = {
          data: {
            value: 0,
            timestamp: new Date(),
          },
          state: States.Normal // Default state
        };
      }

      // Validate and handle `newValue.state`
      if (newValue.state == null) {
        newValue.state = States.Normal; // Provide a default value for state
      }

      // Compound value to displayScale
      this.value = Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);

      if (this.state !== newValue.state) {
        this.state = newValue.state;
        //@ts-ignore
        let option: LinearGaugeOptions = {};
        // Set value color: reduce color changes to only warn & alarm states else it too much flickering and not clean
        if (!this.widgetProperties.config.ignoreZones) {
          switch (newValue.state) {
            case States.Emergency:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.theme().zoneEmergency;
                option.colorValueText = this.theme().zoneEmergency;
              } else {
                option.colorNeedle = this.theme().zoneEmergency;
                option.colorValueText = this.theme().zoneEmergency;
              }
              break;
            case States.Alarm:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.theme().zoneAlarm;
                option.colorValueText = this.theme().zoneAlarm;
              } else {
                option.colorNeedle = this.theme().zoneAlarm;
                option.colorValueText = this.theme().zoneAlarm;
              }
              break;
            case States.Warn:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.theme().zoneWarn;
                option.colorValueText = this.theme().zoneWarn;
              } else {
                option.colorNeedle = this.theme().zoneWarn;
                option.colorValueText = this.theme().zoneWarn;
              }
              break;
            case States.Alert:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.theme().zoneAlert;
                option.colorValueText = this.theme().zoneAlert;
              } else {
                option.colorNeedle = this.theme().zoneAlert;
                option.colorValueText = this.theme().zoneAlert;
              }
              break;
            default:
              if (!this.widgetProperties.config.gauge.useNeedle) {
                option.colorBarProgress = this.getColors(this.widgetProperties.config.color).color;
                option.colorValueText = this.getColors(this.widgetProperties.config.color).color;
              } else {
                option.colorNeedle = this.getColors(this.widgetProperties.config.color).color;
                option.colorValueText = this.getColors(this.widgetProperties.config.color).color;
              }
          }
        }
        this.ngGauge.update(option);
      }
    });
    if (!this.widgetProperties.config.ignoreZones) {
      this.observeMetaStream();
      this.metaSub = this.zones$.subscribe(zones => {
        if (zones && zones.length > 0) {
          this.setHighlights(zones);
        }
      });
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  ngAfterViewInit() {
    this.setCanvasHight
    this.startWidget();
  }

  public onResized(event: ResizeObserverEntry) {
    //@ts-ignore
    let resize: LinearGaugeOptions = {};
    const aspectRatio = 0.3; // Aspect ratio to maintain (e.g., height/width or width/height)

    if (this.widgetProperties.config.gauge.subType === 'vertical') {
        // Enforce vertical orientation: Height is the primary dimension, width is 30% less
        resize.height = event.contentRect.height;
        resize.width = resize.height * aspectRatio;

        // Ensure the canvas fits within the parent dimensions
        if (resize.width > event.contentRect.width) {
            resize.width = event.contentRect.width;
            resize.height = resize.width / aspectRatio;
        }
    } else {
        // Enforce horizontal orientation: Width is the primary dimension, height is 30% less
        resize.width = event.contentRect.width;
        resize.height = resize.width * aspectRatio;

        // Ensure the canvas fits within the parent dimensions
        if (resize.height > event.contentRect.height) {
            resize.height = event.contentRect.height;
            resize.width = resize.height / aspectRatio;
        }
    }
    resize.height -= 10; // Adjust height to account for margin-top

    // Apply the calculated dimensions to the canvas
    this.ngGauge.update(resize);
  }

  private setCanvasHight(): void {
    const gaugeSize = this.gauge.nativeElement.getBoundingClientRect();
    const resize: RadialGaugeOptions = {};
    resize.height = gaugeSize.height;
    resize.width = gaugeSize.width;

    this.ngGauge.update(resize);
  }

  private setGaugeConfig() {
    const isVertical = this.widgetProperties.config.gauge.subType === 'vertical';
    const isNeedle = this.widgetProperties.config.gauge.useNeedle;
    const isTicks = this.widgetProperties.config.gauge.enableTicks;
    let scale = {
      min: this.widgetProperties.config.displayScale.lower,
      max: this.widgetProperties.config.displayScale.upper,
      majorTicks: []
    };

    const rect = this.gauge.nativeElement.getBoundingClientRect();
    let height: number = null;
    let width: number = null;

    if (this.widgetProperties.config.gauge.subType === 'vertical') {
      height = rect.height;
      width = rect.height * 0.3;
    }
    else {
      height = rect.width * 0.3;
      width = rect.width;
    }

    if (isTicks) {
      scale = adjustLinearScaleAndMajorTicks(this.widgetProperties.config.displayScale.lower, this.widgetProperties.config.displayScale.upper);
    }

    const defaultOptions = {
      height: height,
      width: width,
      minValue: scale.min,
      maxValue: scale.max,

      valueInt: this.widgetProperties.config.numInt !== undefined && this.widgetProperties.config.numInt !== null ? this.widgetProperties.config.numInt : 1,
      valueDec: this.widgetProperties.config.numDecimal !== undefined && this.widgetProperties.config.numDecimal !== null ? this.widgetProperties.config.numDecimal : 2,

      title: this.widgetProperties.config.displayName,
      fontTitleSize: 40,
      fontTitle: "Roboto",
      fontTitleWeight: "bold",

      barLength: isVertical ? 80 : 90,
      barWidth: isTicks ? 30 : 60,
      barProgress: true,
      barBeginCircle: 0,
      barStrokeWidth: 0,
      barShadow: 0,

      needle: isNeedle,
      needleType: this.widgetProperties.config.gauge.useNeedle ? "arrow" : "line",
      needleShadow: false,
      needleSide: "both",
      needleStart: this.widgetProperties.config.gauge.useNeedle ? 22 : -45,
      needleEnd: this.widgetProperties.config.gauge.useNeedle ? 120 : 55,

      colorNeedleEnd: "",
      colorNeedleShadowUp: "",
      colorNeedleShadowDown: "black",

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
      colorValueBoxBackground: this.theme().background,
      fontValueSize: 50,
      fontValue: "Roboto",
      fontValueWeight: "bold",
      valueTextShadow: false,

      colorValueBoxShadow: "",
      fontNumbers: "Roboto",
      fontNumbersWeight: "normal",
      fontUnitsSize: this.isGaugeVertical ? 40 : 35,

      colorTitle: this.getColors('contrast').dim,
      colorUnits: this.getColors('contrast').dim,
      colorValueText: this.getColors(this.widgetProperties.config.color).color,
      colorPlate: this.theme().cardColor,
      colorBar: this.theme().background,

      colorMajorTicks: this.getColors('contrast').dim,
      colorMinorTicks: this.getColors('contrast').dim,
      colorNumbers: this.getColors('contrast').dim,

      majorTicks:  isTicks ? scale.majorTicks : [],

      majorTicksInt: this.widgetProperties.config.numInt !== undefined && this.widgetProperties.config.numInt !== null ? this.widgetProperties.config.numInt : 1,
      majorTicksDec: this.widgetProperties.config.numDecimal !== undefined && this.widgetProperties.config.numDecimal !== null ? this.widgetProperties.config.numDecimal : 2,
      numberSide: "left",
      fontNumbersSize: isTicks ? 25 : 0,
      numbersMargin: isVertical ? -3 : -5,
      tickSide: "left",
      ticksWidth: isTicks ? 10 : 0,
      ticksPadding: isTicks ? isVertical ? 5 : 8 : 0,
      strokeTicks: isTicks,
      minorTicks: isTicks ? 2 : 0,
      ticksWidthMinor: isTicks ? 6 : 0,

      valueBox: true,
      valueBoxWidth: 35,
      valueBoxBorderRadius: 10,

      highlights: [],
      highlightsWidth: this.widgetProperties.config.gauge.highlightsWidth,

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
      case "contrast":
        themePaletteColor = this.theme().contrast;
        themePaletteDarkColor = this.theme().contrastDim;
        break;
      case "blue":
        themePaletteColor = this.theme().blue;
        themePaletteDarkColor = this.theme().blueDim;
        break;
      case "green":
        themePaletteColor = this.theme().green;
        themePaletteDarkColor = this.theme().greenDim;
        break;
      case "pink":
        themePaletteColor = this.theme().pink;
        themePaletteDarkColor = this.theme().pinkDim;
        break;
      case "orange":
        themePaletteColor = this.theme().orange;
        themePaletteDarkColor = this.theme().orangeDim;
        break;
      case "purple":
        themePaletteColor = this.theme().purple;
        themePaletteDarkColor = this.theme().purpleDim;
        break;
      case "grey":
        themePaletteColor = this.theme().grey;
        themePaletteDarkColor = this.theme().greyDim;
        break;
      case "yellow":
        themePaletteColor = this.theme().yellow;
        themePaletteDarkColor = this.theme().yellowDim;
        break;
      default:
        themePaletteColor = this.theme().contrast;
        themePaletteDarkColor = this.theme().contrastDim;
        break;
    }

    Object.assign(this.gaugeOptions, {
      colorBarProgress: this.widgetProperties.config.gauge.useNeedle ? "" : themePaletteColor,
      colorBarProgressEnd: '',
      colorNeedle: this.widgetProperties.config.gauge.useNeedle ? themePaletteColor : themePaletteDarkColor,
      needleWidth: this.widgetProperties.config.gauge.useNeedle ? 20 : 0,
    });
  }

  private getColors(color: string): { color: string, dim: string, dimmer: string } {
    const themePalette = {
      "contrast": { color: this.theme().contrast, dim: this.theme().contrastDim, dimmer: this.theme().contrastDimmer },
      "blue": { color: this.theme().blue, dim: this.theme().blueDim, dimmer: this.theme().blueDimmer },
      "green": { color: this.theme().green, dim: this.theme().greenDim, dimmer: this.theme().greenDimmer },
      "pink": { color: this.theme().pink, dim: this.theme().pinkDim, dimmer: this.theme().pinkDimmer },
      "orange": { color: this.theme().orange, dim: this.theme().orangeDim, dimmer: this.theme().orangeDimmer },
      "purple": { color: this.theme().purple, dim: this.theme().purpleDim, dimmer: this.theme().purpleDimmer },
      "yellow": { color: this.theme().yellow, dim: this.theme().yellowDim, dimmer: this.theme().yellowDimmer },
      "grey": { color: this.theme().grey, dim: this.theme().greyDim, dimmer: this.theme().yellowDimmer }
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
          color = this.theme().zoneEmergency;
          break;
        case States.Alarm:
          color = this.theme().zoneAlarm;
          break;
        case States.Warn:
          color = this.theme().zoneWarn;
          break;
        case States.Alert:
          color = this.theme().zoneAlert;
          break;
        case States.Nominal:
          color = this.theme().zoneNominal;
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
    this.ngGauge.update(highlights);
  }

  ngOnDestroy() {
    this.destroyDataStreams();
    this.metaSub?.unsubscribe();
    // Clear references to DOM elements
    this.ngGauge = null;
    this.gauge = null;
  }
}
