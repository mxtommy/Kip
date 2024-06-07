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

import { GaugesModule, RadialGaugeOptions, RadialGauge } from '@godind/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../core/components/base-widget/base-widget.component';
import { ISkMetadata, States } from '../../core/interfaces/signalk-interfaces';

function rgbToHex(rgb) {
  let [r, g, b] = rgb.match(/\d+/g).map(Number);
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function convertNegToPortDegree(degree: number) {
  if (degree < 0) {
      degree = 360 + degree;
  }
  return degree;
}

@Component({
  selector: 'widget-gauge-ng-compass',
  standalone: true,
  imports: [AngularResizeEventModule, GaugesModule],
  templateUrl: './widget-gauge-ng-compass.component.html',
  styleUrl: './widget-gauge-ng-compass.component.scss'
})
export class WidgetGaugeNgCompassComponent extends BaseWidgetComponent implements OnInit, OnDestroy, AfterViewInit {
  private readonly DEG: string = "deg";
  private readonly LINE: string = "line";
  private readonly NEEDLE_START: number = 40;
  private readonly NEEDLE_END: number = 100;
  private readonly NEEDLE_CIRCLE_SIZE: number = 15;
  private readonly BORDER_MIDDLE_WIDTH: number = 2;
  private readonly BORDER_INNER_WIDTH: number = 2;
  private readonly ANIMATION_TARGET_PLATE:string = "plate";
  private readonly ANIMATION_TARGET_NEEDLE:string = "needle";
  private readonly WIDGET_SIZE_FACTOR: number = 0.97;

  // Gauge text value for value box rendering
  public textValue: string = "--";
  // Gauge value
  public value: number = 0;

  @ViewChild('ngCompassWrapperDiv', {static: true, read: ElementRef}) wrapper: ElementRef;
  @ViewChild('compassGauge', { static: true }) compassGauge: RadialGauge;

  public gaugeOptions = {} as RadialGaugeOptions;
  // fix for RadialGauge GaugeOptions object ** missing color-stroke-ticks property
  public colorStrokeTicks: string = "";
  public unitName: string = null;

  // Zones support
  private meta: ISkMetadata = null;
  private metaSub: Subscription;
  private state: string = "normal";

  private readonly negToPortPaths = [
    "self.environment.wind.angleApparent",
    "self.environment.wind.angleTrueGround",
    "self.environment.wind.angleTrueWater"
  ];

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
          showPathSkUnitsFilter: false,
          pathSkUnitsFilter: 'rad',
          isConvertUnitToConfigurable: false,
          convertUnitTo: this.DEG,
          sampleTime: 500
        }
      },
      gauge: {
        type: 'ngRadial',
        subType: 'baseplateCompass', // marineCompass, baseplateCompass
        enableTicks: true,
        compassUseNumbers: false,
        showValueBox: false
      },
      enableTimeout: false,
      textColor: "accent",
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.initWidget();
    const gaugeSize = this.wrapper.nativeElement.getBoundingClientRect();
    this.gaugeOptions.height = Math.floor(gaugeSize.height * this.WIDGET_SIZE_FACTOR);
    this.gaugeOptions.width = Math.floor(gaugeSize.width * this.WIDGET_SIZE_FACTOR);
    this.setGaugeConfig();
  }

  ngAfterViewInit(): void {
    this.compassGauge.update(this.gaugeOptions);

    this.observeDataStream('gaugePath', newValue => {
      if (!newValue.data) {
        this.textValue = "--";
        this.value = 0;
      } else {
        let convertedValue: number = this.negToPortPaths.includes(this.widgetProperties.config.paths['gaugePath'].path) ? convertNegToPortDegree(newValue.data.value) : newValue.data.value;

        // Compound value to displayScale
        this.value = Math.min(Math.max(convertedValue, 0), 360);
        // Format for value box
        this.textValue = this.value.toFixed(0);
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
        this.compassGauge.update(option);
      }
    });
  }

  public onResized(event: ResizedEvent): void {
    if (!event.isFirst) {
      //@ts-ignore
      let resize: RadialGaugeOptions = {};
      resize.height = Math.floor(event.newRect.height * this.WIDGET_SIZE_FACTOR);
      resize.width = Math.floor(event.newRect.width * this.WIDGET_SIZE_FACTOR);

      this.compassGauge.update(resize);
    }
  }

  private setGaugeConfig(): void {
    this.gaugeOptions.title = this.widgetProperties.config.displayName ? this.widgetProperties.config.displayName : "";
    // override gauge config min/max/unit to make them compatible for 360 circular rotation
    this.gaugeOptions.minValue = 0;
    this.gaugeOptions.maxValue = 360;
    this.gaugeOptions.valueDec = 0;
    this.gaugeOptions.valueInt = 1;
    this.gaugeOptions.units = "";

    this.gaugeOptions.barProgress = false;
    this.gaugeOptions.barWidth = 0;

    this.gaugeOptions.valueBox = this.widgetProperties.config.gauge.showValueBox;
    this.gaugeOptions.fontValueSize = 60;
    this.gaugeOptions.valueBoxWidth = 26;
    this.gaugeOptions.valueBoxBorderRadius = 10;
    this.gaugeOptions.valueBoxStroke = 0;

    this.gaugeOptions.ticksAngle = 360;
    this.gaugeOptions.startAngle = 180;
    this.gaugeOptions.exactTicks = false;
    this.gaugeOptions.strokeTicks = "";
    this.gaugeOptions.majorTicks = this.widgetProperties.config.gauge.compassUseNumbers ? ["N", "30", "60", "E", "120", "150", "S", "210", "240", "W", "300", "330", "N"] : ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
    this.gaugeOptions.majorTicksDec = 0;
    this.gaugeOptions.majorTicksInt = 1;
    this.gaugeOptions.numbersMargin = 5;
    this.gaugeOptions.fontNumbersSize = 25;
    this.gaugeOptions.minorTicks = this.widgetProperties.config.gauge.compassUseNumbers ? 3 : 2;

    this.gaugeOptions.needle = true;
    this.gaugeOptions.needleType = this.LINE;
    this.gaugeOptions.needleStart = this.NEEDLE_START;
    this.gaugeOptions.needleEnd = this.NEEDLE_END;
    this.gaugeOptions.needleCircleSize = this.NEEDLE_CIRCLE_SIZE;
    this.gaugeOptions.needleWidth = 4;
    this.gaugeOptions.needleShadow = false;
    this.gaugeOptions.needleCircleInner = false;
    this.gaugeOptions.needleCircleOuter = false;

    this.gaugeOptions.borders = true;
    this.gaugeOptions.borderOuterWidth = 0;
    this.gaugeOptions.borderMiddleWidth = this.BORDER_MIDDLE_WIDTH;
    this.gaugeOptions.borderInnerWidth = this.BORDER_INNER_WIDTH;
    this.gaugeOptions.borderShadowWidth = 0;
    this.gaugeOptions.highlights = [];

    this.gaugeOptions.fontTitle="arial";
    this.gaugeOptions.fontTitleWeight="normal";
    this.gaugeOptions.fontTitleSize = 25;
    this.gaugeOptions.fontUnits="arial";
    this.gaugeOptions.fontUnitsSize = 25;
    this.gaugeOptions.fontUnitsWeight="normal";
    this.gaugeOptions.barStrokeWidth = 0;
    this.gaugeOptions.barShadow = 0;
    this.gaugeOptions.fontValue="arial";
    this.gaugeOptions.fontValueWeight="bold";
    this.gaugeOptions.valueTextShadow = false;
    this.gaugeOptions.colorValueBoxShadow="";
    this.gaugeOptions.fontNumbers="arial";
    this.gaugeOptions.fontNumbersWeight="bold";

    this.gaugeOptions.highlightsWidth = 0;

    if (this.widgetProperties.config.gauge.subType === "marineCompass") {
      this.gaugeOptions.animationTarget = this.ANIMATION_TARGET_PLATE;
      this.gaugeOptions.useMinPath = true;
    } else if (this.widgetProperties.config.gauge.subType === "baseplateCompass") {
      this.gaugeOptions.animationTarget = this.ANIMATION_TARGET_NEEDLE;
      this.gaugeOptions.useMinPath = true;
    }

    this.gaugeOptions.animation = true;
    this.gaugeOptions.animateOnInit = true;
    this.gaugeOptions.animatedValue = true;
    this.gaugeOptions.animationRule = "linear";
    this.gaugeOptions.animationDuration = 500;//this.widgetProperties.config.paths['gaugePath'].sampleTime - 50; // prevent data and animation delay collisions

     // Set Theme related colors
    const themePalette = {
      "text": { color: this.theme.text, darkColor: this.theme.text },
      "primary": { color: this.theme.primary, darkColor: this.theme.primaryDark },
      "accent": { color: this.theme.accent, darkColor: this.theme.accentDark },
      "warn": { color: this.theme.warn, darkColor: this.theme.warnDark }
    };

    if (themePalette[this.widgetProperties.config.textColor]) {
      this.setGaugeOptions(themePalette[this.widgetProperties.config.textColor].color, themePalette[this.widgetProperties.config.textColor].darkColor);
      const tColor = themePalette[this.widgetProperties.config.textColor].color
      const dColor = themePalette[this.widgetProperties.config.textColor].darkColor

      this.gaugeOptions.colorTitle = this.theme.textDark;
      this.gaugeOptions.colorUnits = this.theme.text;
      this.gaugeOptions.colorValueText = this.theme.text;

      this.gaugeOptions.colorMinorTicks = this.theme.text;
      this.gaugeOptions.colorNumbers = this.widgetProperties.config.gauge.compassUseNumbers ?
        [rgbToHex(this.theme.textWarnDark), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(dColor), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(dColor), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(dColor), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.textWarnDark)] :
        [rgbToHex(this.theme.textWarnDark), rgbToHex(dColor), rgbToHex(dColor), rgbToHex(dColor), rgbToHex(dColor), rgbToHex(dColor), rgbToHex(dColor), rgbToHex(dColor), rgbToHex(this.theme.textWarnDark)];

      this.colorStrokeTicks = this.theme.warn; // missing property in gaugeOptions
      this.gaugeOptions.colorMajorTicks = this.widgetProperties.config.gauge.compassUseNumbers ?
        [rgbToHex(this.theme.textWarnDark), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.textWarnDark)] :
        [rgbToHex(this.theme.textWarnDark), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.text), rgbToHex(this.theme.textWarnDark)];

      this.gaugeOptions.colorPlate = this.gaugeOptions.colorPlateEnd = this.gaugeOptions.colorBorderInner = this.gaugeOptions.colorBorderInnerEnd = getComputedStyle(this.wrapper.nativeElement).backgroundColor;
      this.gaugeOptions.colorBar = this.theme.background;
      this.gaugeOptions.colorBarStroke="";
      this.gaugeOptions.colorValueBoxBackground = this.theme.background;
      this.gaugeOptions.colorNeedleShadowUp = "";
      this.gaugeOptions.colorNeedleShadowDown = "black";
      this.gaugeOptions.colorNeedleCircleInner = this.gaugeOptions.colorPlate;
      this.gaugeOptions.colorNeedleCircleInnerEnd = this.gaugeOptions.colorPlate;
      this.gaugeOptions.colorNeedleCircleOuter = this.gaugeOptions.colorPlate;
      this.gaugeOptions.colorNeedleCircleOuterEnd = this.gaugeOptions.colorPlate;
    } else {
      console.error(`[ngGauge] Unknown bar color value: ${this.widgetProperties.config.textColor}`);
    }
  }

  private setGaugeOptions(themePaletteColor: string, themePaletteDarkColor: string) {
    this.gaugeOptions.colorBarProgress = themePaletteColor;
    this.gaugeOptions.colorBorderMiddle = themePaletteDarkColor;
    this.gaugeOptions.colorBorderMiddleEnd = themePaletteDarkColor;
    this.gaugeOptions.colorNeedle = themePaletteColor;
    this.gaugeOptions.colorNeedleEnd = themePaletteColor;
  }

  ngOnDestroy(): void {
    this.unsubscribeDataStream();
    this.metaSub?.unsubscribe();
  }
}
