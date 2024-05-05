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
import { LinearGaugeOptions, LinearGauge, GaugesModule } from '@biacsics/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { JsonPipe } from '@angular/common';
import { ISkMetadata, States } from '../../core/interfaces/signalk-interfaces';

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
  public isGaugeVertical: Boolean = true;

  // Zones support
  private meta: ISkMetadata = null;
  private metaSub: Subscription;

  constructor(private appSettingsService: AppSettingsService) {
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
        type: 'ngLinearVertical', // ngLinearVertical ot ngLinearHorizontal
        enableTicks: false,    // theme palette to select
      },
      numInt: 1,
      numDecimal: 0,
      textColor: 'accent',
      enableTimeout: false,
      dataTimeout: 5
    };

  }

  ngOnInit() {
    this.validateConfig();
    this.setGaugeConfig();

    const gaugeSize = this.wrapper.nativeElement.getBoundingClientRect();

    this.gaugeOptions.height = gaugeSize.height;
    if (this.isGaugeVertical == true) {
      this.gaugeOptions.width = (gaugeSize.height * 0.30);
    }
    else {
      this.gaugeOptions.width = gaugeSize.width;
    }
  }

  ngAfterViewInit() {
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

      // Set value color: reduce color changes to only warn & alarm states else it too much flickering and not clean
      switch (newValue.state) {
        case States.Emergency:
          this.gaugeOptions.colorValueText = this.theme.warnDark;
          this.linearGauge.update(this.gaugeOptions);
          break;
        case States.Alarm:
          this.gaugeOptions.colorValueText = this.theme.warnDark;
          this.linearGauge.update(this.gaugeOptions);
          break;
        case States.Warn:
          this.gaugeOptions.colorValueText = this.theme.textWarnLight;
          this.linearGauge.update(this.gaugeOptions);
          break;
        default:
          this.gaugeOptions.colorValueText = this.theme.text;
          this.linearGauge.update(this.gaugeOptions);
      }
    });

    this.metaSub = this.DataService.getPathMeta(this.widgetProperties.config.paths['gaugePath'].path).subscribe((meta: ISkMetadata) => {
      this.meta = meta || null;
      if (this.meta && this.meta.zones && this.meta.zones.length > 0) {
        this.setHighlights();
      }
    });
  }

  onResized(event: ResizedEvent) {
    if (!event.isFirst) {
      this.gaugeOptions.height = event.newRect.height;
      if (this.isGaugeVertical == true) {
        this.gaugeOptions.width = (event.newRect.height * 0.30);
      }
      else {
        this.gaugeOptions.width = event.newRect.width;
      }
      this.linearGauge.update(this.gaugeOptions);
    }
  }

  private setGaugeConfig() {
    const defaultOptions = {
      highlights: [],
      highlightsWidth: 0,
      title: this.widgetProperties.config.displayName,
      fontTitle: "arial",
      fontTitleWeight: "bold",
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
      barProgress: true,
      barBeginCircle: 0,
      barStrokeWidth: 0,
      barShadow: 0,
      colorBarEnd: "",
      colorBarStroke: "0",
      valueBoxStroke: 0,
      colorValueBoxRect: "",
      colorValueBoxRectEnd: "",
      colorValueBoxBackground: this.theme.background,
      fontValue: "arial",
      fontValueSize: 50,
      fontValueWeight: "bold",
      valueTextShadow: false,
      colorValueBoxShadow: "",
      fontNumbers: "arial",
      fontNumbersWeight: "normal",
      animation: true,
      animationRule: "linear",
      animatedValue: false,
      animateOnInit: false,
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
      minValue: this.widgetProperties.config.displayScale.lower,
      maxValue: this.widgetProperties.config.displayScale.upper,
      valueInt: this.widgetProperties.config.numInt,
      valueDec: this.widgetProperties.config.numDecimal,
      majorTicksInt: this.widgetProperties.config.numInt,
      majorTicksDec: this.widgetProperties.config.numDecimal,
      animationDuration: this.widgetProperties.config.paths['gaugePath'].sampleTime - 25,
      valueBox: true,
      valueBoxWidth: 100,
      valueBoxBorderRadius: 0,
      needle: true,
      needleType: "line",
      needleShadow: false,
      needleSide: "both",
    };

    Object.assign(this.gaugeOptions, defaultOptions);

    this.setThemePaletteColor();
    this.setGaugeTypeOptions();
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

  private setGaugeTypeOptions() {
    const isVertical = this.widgetProperties.config.gauge.type === 'ngLinearVertical';
    this.isGaugeVertical = isVertical;  // Save for resize event
    const enableTicks = this.widgetProperties.config.gauge.enableTicks;

    const defaultOptions = {
      barLength: isVertical ? 75 : 80,
      fontTitleSize: isVertical ? 40 : 45,
      fontUnitsSize: isVertical ? 40 : 35,
      barWidth: enableTicks ? 30 : (isVertical ? 100 : 60),
      needleStart: enableTicks ? -45 : 0,
      needleEnd: enableTicks ? 55 : 100,
      tickSide: enableTicks ? "right" : "",
      ticksWidth: enableTicks ? 8 : 0,
      ticksPadding: enableTicks ? 4 : 0,
      strokeTicks: false,
      majorTicks: enableTicks ? [this.widgetProperties.config.displayScale.lower, this.widgetProperties.config.displayScale.upper] : [],
      numberSide: enableTicks ? "right" : "",
      numbersMargin: enableTicks ? 0 : 0,
      fontNumbersSize: enableTicks ? 25 : 0,
      minorTicks: enableTicks ? 10 : 0,
      ticksWidthMinor: enableTicks ? 4 : 0,
      highlightsWidth: 5,
    };

    Object.assign(this.gaugeOptions, defaultOptions);
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
    this.gaugeOptions.highlightsWidth = 4;
    //@ts-ignore - bug in highlights property definition
    this.gaugeOptions.highlights = JSON.stringify(gaugeZonesHighlight, null, 1);
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.metaSub?.unsubscribe();
  }
}
