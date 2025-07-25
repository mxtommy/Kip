/**
 * ng canvas gauge options should be set before ngViewInit for the gauge to be
 * instantiated with the correct options.
 *
 * Gauge .update() function should ONLY be called after ngAfterViewInit. Used to update
 * instantiated gauge config.
 */
import { Component, OnInit, OnDestroy, AfterViewInit, ElementRef, effect, viewChild } from '@angular/core';
import { NgxResizeObserverModule } from 'ngx-resize-observer';

import { GaugesModule, RadialGaugeOptions, RadialGauge } from '@godind/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { States } from '../../core/interfaces/signalk-interfaces';
import { getColors } from '../../core/utils/themeColors.utils';

function rgbaToHex(rgba: string) {
  const match = rgba.match(/(\d+(\.\d+)?|\.\d+)/g);
  if (!match || match.length < 3) {
    throw new Error("Invalid RGBA format");
  }

  // Extract RGBA values
  const [r, g, b, a = 1] = match.map(Number);

  // Convert alpha from 0-1 to 0-255 and then to HEX
  const alpha = a === 1 ? '' : Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();

  // Convert RGB to HEX
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
  protected textValue = "--";
  // Gauge value
  protected value = 0;

  readonly ngGauge = viewChild<RadialGauge>('compassGauge');
  readonly gauge = viewChild('compassGauge', { read: ElementRef });
  private initCompleted = false;

  protected gaugeOptions = {} as RadialGaugeOptions;
  // fix for RadialGauge GaugeOptions object ** missing color-stroke-ticks property
  protected colorStrokeTicks = "";
  protected unitName: string = null;
  private state: string = States.Normal;

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
          showConvertUnitTo: false,
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

    effect(() => {
      if (this.theme()) {
        if (!this.initCompleted) return;
        this.startWidget();
      }
    });
  }

  ngOnInit() {
    this.validateConfig();
  }

  protected startWidget(): void {
    this.setGaugeConfig();
    this.ngGauge().update(this.gaugeOptions);

    this.unsubscribeDataStream();

    this.observeDataStream('gaugePath', newValue => {
      if (!newValue || !newValue.data || newValue.data.value === null) {
        newValue = {
          data: {
            value: 0,
            timestamp: new Date(),
          },
          state: States.Normal // Default state
        };
        this.value = 0;
        this.textValue = '--';
      } else {
        const convertedValue: number = this.negToPortPaths.includes(this.widgetProperties.config.paths['gaugePath'].path)
          ? convertNegToPortDegree(newValue.data.value)
          : newValue.data.value;

        // Compound value to displayScale
        this.value = Math.min(Math.max(convertedValue, 0), 360);
        // Format for value box
        this.textValue = this.value.toFixed(0);
      }

      // Validate and handle `newValue.state`
      if (newValue.state == null) {
        newValue.state = States.Normal; // Provide a default value for state
      }

      if (this.state !== newValue.state) {
        this.state = newValue.state;
        const option: RadialGaugeOptions = {};
        // Set value color: reduce color changes to only warn & alarm states else it too much flickering and not clean
        switch (newValue.state) {
          case States.Emergency:
            option.colorValueText = this.theme().zoneEmergency;
            break;
          case States.Alarm:
            option.colorValueText = this.theme().zoneAlarm;
            break;
          case States.Warn:
            option.colorValueText = this.theme().zoneWarn;
            break;
          case States.Alert:
            option.colorValueText = this.theme().zoneAlert;
            break;
          default:
            option.colorValueText = this.theme().contrast; // Fallback for unknown or null state
        }
        this.ngGauge().update(option);
      }
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.setCanvasHight();
    this.startWidget();
  }

  private setCanvasHight(): void {
    const gaugeSize = this.gauge().nativeElement.getBoundingClientRect();
    const resize: RadialGaugeOptions = {};
    resize.height = gaugeSize.height;
    resize.width = gaugeSize.width;

    this.ngGauge().update(resize);
  }

  ngAfterViewInit(): void {
    this.setCanvasHight();
    this.startWidget();
    this.initCompleted = true;
  }

  protected onResized(event: ResizeObserverEntry): void {
    const resize: RadialGaugeOptions = {};
    resize.height = event.contentRect.height;
    resize.width = event.contentRect.width;

    this.ngGauge().update(resize);
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
    this.setGaugeOptions(getColors(this.widgetProperties.config.color, this.theme()).color, rgbaToHex(getColors(this.widgetProperties.config.color, this.theme()).dim), rgbaToHex(getColors(this.widgetProperties.config.color, this.theme()).dimmer));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private setGaugeOptions(color: string, dim: string, dimmer: string) {
    const contrastDim = rgbaToHex(getColors('contrast', this.theme()).dim);
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
      [this.theme().port, contrastDim, contrastDim, dim, contrastDim, contrastDim, dim, contrastDim, contrastDim, dim, contrastDim, contrastDim, this.theme().port] :
      [this.theme().port, dim, dim, dim, dim, dim, dim, dim, this.theme().port];

    this.gaugeOptions.colorMajorTicks = this.widgetProperties.config.gauge.compassUseNumbers ?
      [this.theme().port, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().port] :
      [this.theme().port, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().contrast, this.theme().port];

    this.gaugeOptions.colorPlate = this.gaugeOptions.colorPlateEnd = this.gaugeOptions.colorBorderInner = this.gaugeOptions.colorBorderInnerEnd = this.theme().cardColor;
    this.gaugeOptions.colorBar = this.theme().background;
    this.gaugeOptions.colorBarStroke="";
    this.gaugeOptions.colorValueBoxBackground = this.theme().background;
    this.gaugeOptions.colorNeedleShadowUp = "";
    this.gaugeOptions.colorNeedleShadowDown = "";
    this.gaugeOptions.colorNeedleCircleInner = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleInnerEnd = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleOuter = this.gaugeOptions.colorPlate;
    this.gaugeOptions.colorNeedleCircleOuterEnd = this.gaugeOptions.colorPlate;
  }

  ngOnDestroy(): void {
    this.destroyDataStreams();
  }
}
