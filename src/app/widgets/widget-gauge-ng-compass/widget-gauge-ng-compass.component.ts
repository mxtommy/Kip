/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { ViewChild, Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

import { GaugesModule, RadialGaugeOptions, RadialGauge } from '@godind/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { States } from '../../core/interfaces/signalk-interfaces';

function rgbaToHex(rgba) {
  let [r, g, b, a = 1] = rgba.match(/\d+(\.\d+)?/g).map(Number);
  // Convert the alpha from 0-1 to 0-255 then to HEX, default to 255 (fully opaque) if alpha is not provided
  let alpha = a === 1 ? '' : Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase() + alpha;
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
  imports: [WidgetHostComponent, NgxResizeObserverModule, GaugesModule],
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

  // Gauge text value for value box rendering
  protected textValue: string = "--";
  // Gauge value
  protected value: number = 0;

  @ViewChild('compassGauge', { static: true }) ngGauge: RadialGauge;
  @ViewChild('compassGauge', { static: true, read: ElementRef }) gauge: ElementRef;

  protected gaugeOptions = {} as RadialGaugeOptions;
  // fix for RadialGauge GaugeOptions object ** missing color-stroke-ticks property
  protected colorStrokeTicks: string = "";
  protected unitName: string = null;
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
      color: "contrast",
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.setGaugeConfig();
  }

  protected startWidget(): void {
    this.setGaugeConfig();
    this.ngGauge.update(this.gaugeOptions);

    this.unsubscribeDataStream();

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
            option.colorValueText = this.theme.zoneEmergency;
            break;
          case States.Alarm:
            option.colorValueText = this.theme.zoneAlarm;
            break;
          case States.Warn:
            option.colorValueText = this.theme.zoneWarn;
            break;
          case States.Alert:
            option.colorValueText = this.theme.zoneAlert;
            break;
          default:
            option.colorValueText = this.theme.contrast;
        }
        this.ngGauge.update(option);
      }
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.setCanvasHight();
    this.startWidget();
  }

  private setCanvasHight(): void {
    const gaugeSize = this.gauge.nativeElement.getBoundingClientRect();
    const resize: RadialGaugeOptions = {};
    resize.height = gaugeSize.height;
    resize.width = gaugeSize.width;

    this.ngGauge.update(resize);
  }

  ngAfterViewInit(): void {
    this.setCanvasHight();
    this.startWidget();
  }

  protected onResized(event: ResizeObserverEntry): void {
    //@ts-ignore
    const resize: RadialGaugeOptions = {};
    resize.height = event.contentRect.height;
    resize.width = event.contentRect.width;

    this.ngGauge.update(resize);
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

    this.gaugeOptions.fontTitle="Roboto";
    this.gaugeOptions.fontTitleWeight="normal";
    this.gaugeOptions.fontTitleSize = 25;
    this.gaugeOptions.fontUnits="Roboto";
    this.gaugeOptions.fontUnitsSize = 25;
    this.gaugeOptions.fontUnitsWeight="normal";
    this.gaugeOptions.barStrokeWidth = 0;
    this.gaugeOptions.barShadow = 0;
    this.gaugeOptions.fontValue="Roboto";
    this.gaugeOptions.fontValueWeight="bold";
    this.gaugeOptions.valueTextShadow = false;
    this.gaugeOptions.colorValueBoxShadow="";
    this.gaugeOptions.fontNumbers="Roboto";
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
    this.gaugeOptions.animationDuration = this.widgetProperties.config.paths['gaugePath'].sampleTime - 50; // prevent data and animation delay collisions
    // gauge does not support rbg abd rgba color values
    this.setGaugeOptions(this.getColors(this.widgetProperties.config.color).color, rgbaToHex(this.getColors(this.widgetProperties.config.color).dim), rgbaToHex(this.getColors(this.widgetProperties.config.color).dimmer));
  }

  private setGaugeOptions(color: string, dim: string, dimmer: string) {
    const contrastDim = rgbaToHex(this.getColors('contrast').dim);
    this.gaugeOptions.colorBarProgress = color;
    this.gaugeOptions.colorBorderMiddle = dim;
    this.gaugeOptions.colorBorderMiddleEnd = dim;
    this.gaugeOptions.colorNeedle = color;
    this.gaugeOptions.colorNeedleEnd = color;

    this.gaugeOptions.colorTitle = contrastDim;
    this.gaugeOptions.colorUnits = contrastDim;
    this.gaugeOptions.colorValueText = color;

    this.gaugeOptions.colorMinorTicks = contrastDim;
    this.gaugeOptions.colorNumbers = this.widgetProperties.config.gauge.compassUseNumbers ?
      [this.theme.port, contrastDim, contrastDim, dim, contrastDim, contrastDim, dim, contrastDim, contrastDim, dim, contrastDim, contrastDim, this.theme.port] :
      [this.theme.port, dim, dim, dim, dim, dim, dim, dim, this.theme.port];

    this.gaugeOptions.colorMajorTicks = this.widgetProperties.config.gauge.compassUseNumbers ?
      [this.theme.port, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.port] :
      [this.theme.port, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.contrast, this.theme.port];

    this.gaugeOptions.colorPlate = this.gaugeOptions.colorPlateEnd = this.gaugeOptions.colorBorderInner = this.gaugeOptions.colorBorderInnerEnd = this.theme.cardColor;
    this.gaugeOptions.colorBar = this.theme.background;
    this.gaugeOptions.colorBarStroke="";
    this.gaugeOptions.colorValueBoxBackground = this.theme.background;
    this.gaugeOptions.colorNeedleShadowUp = "";
    this.gaugeOptions.colorNeedleShadowDown = "";
    this.gaugeOptions.colorNeedleCircleInner = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleInnerEnd = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleOuter = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleOuterEnd = this.gaugeOptions.colorPlate;
  }

  private getColors(color: string): { color: string, dim: string, dimmer: string } {
    const themePalette = {
      "contrast": { color: this.theme.contrast, dim: this.theme.contrastDim, dimmer: this.theme.contrastDimmer },
      "blue": { color: this.theme.blue, dim: this.theme.blueDim, dimmer: this.theme.blueDimmer },
      "green": { color: this.theme.green, dim: this.theme.greenDim, dimmer: this.theme.greenDimmer },
      "pink": { color: this.theme.pink, dim: this.theme.pinkDim, dimmer: this.theme.pinkDimmer },
      "orange": { color: this.theme.orange, dim: this.theme.orangeDim, dimmer: this.theme.orangeDimmer },
      "purple": { color: this.theme.purple, dim: this.theme.purpleDim, dimmer: this.theme.purpleDimmer },
      "yellow": { color: this.theme.yellow, dim: this.theme.yellowDim, dimmer: this.theme.yellowDimmer },
      "grey": { color: this.theme.grey, dim: this.theme.greyDim, dimmer: this.theme.yellowDimmer }
    };
    return themePalette[color];
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
    // Clear references to DOM elements
    this.ngGauge = null;
    this.gauge = null;
  }
}
