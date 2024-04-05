import { ViewChild, Component, OnInit, OnDestroy, AfterViewInit, ElementRef } from '@angular/core';
import { Subscription } from 'rxjs';
import { ResizedEvent, AngularResizeEventModule } from 'angular-resize-event';

import { IZone, IZoneState } from '../../core/interfaces/app-settings.interfaces';
import { IDataHighlight } from '../../core/interfaces/widgets-interface';

import { GaugesModule, RadialGaugeOptions, RadialGauge } from '@biacsics/ng-canvas-gauges';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import Qty from 'js-quantities';

@Component({
    selector: 'app-widget-gauge-ng-radial',
    templateUrl: './widget-gauge-ng-radial.component.html',
    styleUrls: ['./widget-gauge-ng-radial.component.css'],
    standalone: true,
    imports: [AngularResizeEventModule, GaugesModule]
})
export class WidgetGaugeNgRadialComponent extends BaseWidgetComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('ngRadialWrapperDiv', {static: true, read: ElementRef}) private wrapper: ElementRef;
  @ViewChild('radialGauge', {static: true, read: RadialGauge}) public radialGauge: RadialGauge;

  // main gauge value variable
  public dataValue = 0;

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

    let gaugeSize = this.wrapper.nativeElement.getBoundingClientRect();
    this.gaugeOptions.height = Math.floor(gaugeSize.height * 0.88);
    this.gaugeOptions.width = Math.floor(gaugeSize.width * 0.88);

    this.setGaugeConfig();
    this.setHighlights();

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
            this.radialGauge.update(this.gaugeOptions);
            break;
          case IZoneState.alarm:
            this.gaugeOptions.colorValueText = this.theme.warnDark;
            this.radialGauge.update(this.gaugeOptions);
            break;
          default:
            this.gaugeOptions.colorValueText = this.theme.text;
            this.radialGauge.update(this.gaugeOptions);
        }
      }
    );

    this.zonesSub = this.appSettingsService.getZonesAsO().subscribe(
      zones => {
        this.zones = zones;
        this.setHighlights();
      });
   }

   ngAfterViewInit(): void {
    this.radialGauge.update(this.gaugeOptions);
   }

  public onResized(event: ResizedEvent): void {
    this.gaugeOptions.height = Math.floor(event.newRect.height * 0.88);
    this.gaugeOptions.width = Math.floor(event.newRect.width * 0.88);
    this.radialGauge.update(this.gaugeOptions);
  }

  private setGaugeConfig(): void{
    // Zones color variables
    let themePaletteColor = "";
    let themePaletteDarkColor = "";

    // Set static gauge colors
    this.gaugeOptions.title = this.widgetProperties.config.displayName ? this.widgetProperties.config.displayName : "";
    this.gaugeOptions.colorTitle = this.theme.text;
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

    // Set Theme related colors
    switch (this.widgetProperties.config.barColor) {
      case "primary":
        themePaletteColor = this.theme.primary;
        themePaletteDarkColor = this.theme.primaryDark;
        this.gaugeOptions.colorBarProgress = this.gaugeOptions.colorBorderMiddle = this.gaugeOptions.colorBorderMiddleEnd = themePaletteColor;
        this.gaugeOptions.colorNeedle = themePaletteDarkColor;
        this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
        break;

      case "accent":
        themePaletteColor = this.theme.accent;
        themePaletteDarkColor = this.theme.accentDark;
        this.gaugeOptions.colorBarProgress = this.gaugeOptions.colorBorderMiddle = this.gaugeOptions.colorBorderMiddleEnd = themePaletteColor;
        this.gaugeOptions.colorNeedle = themePaletteDarkColor;
        this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
        break;

      case "warn":
        themePaletteColor = this.theme.warn;
        themePaletteDarkColor = this.theme.warnDark;
        this.gaugeOptions.colorBarProgress = this.gaugeOptions.colorBorderMiddle = this.gaugeOptions.colorBorderMiddleEnd = themePaletteColor;
        this.gaugeOptions.colorNeedle = themePaletteDarkColor;
        this.gaugeOptions.colorNeedleEnd = themePaletteDarkColor;
        break;

      default:
        break;
    }

    this.gaugeOptions.valueInt = this.widgetProperties.config.numInt;
    this.gaugeOptions.valueDec = this.widgetProperties.config.numDecimal;
    this.gaugeOptions.majorTicksInt = this.widgetProperties.config.numInt;
    this.gaugeOptions.majorTicksDec = this.widgetProperties.config.numDecimal;

    this.gaugeOptions.animation = true;
    this.gaugeOptions.animateOnInit = false;
    this.gaugeOptions.animatedValue = false;
    this.gaugeOptions.animationRule = "linear";
    this.gaugeOptions.animationDuration = this.widgetProperties.config.paths['gaugePath'].sampleTime - 50; // prevent data and animation delay collisions

    // Radial gauge type
    switch(this.widgetProperties.config.radialSize) {
      case "capacity":
        this.gaugeOptions.units = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
        this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorPlate; // bug with MajorTicks; always drawing first tick and using color="" does not work
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
        this.gaugeOptions.exactTicks = true;
        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = [];
        this.gaugeOptions.minorTicks = 0;
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 0;

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
        this.gaugeOptions.units = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
        let [minValue, maxValue, ticksArray]= this.calculateMajorTicks(this.widgetProperties.config.minValue, this.widgetProperties.config.maxValue);

        this.gaugeOptions.fontTitleSize = 20;
        this.gaugeOptions.minValue = minValue;
        this.gaugeOptions.maxValue = maxValue;
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
        this.gaugeOptions.majorTicks = ticksArray;
        this.gaugeOptions.minorTicks = 2;
        this.gaugeOptions.numbersMargin = 3;
        this.gaugeOptions.fontNumbersSize = 15;

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
        // override gauge config min/max/unit to make them compatible for 360 circular rotation
        this.gaugeOptions.minValue = 0;
        this.gaugeOptions.maxValue = 360;
        this.gaugeOptions.units = this.widgetProperties.config.paths["gaugePath"].convertUnitTo = "deg";

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

        this.gaugeOptions.majorTicks = this.widgetProperties.config.compassUseNumbers ? ["0,45,90,135,180,225,270,315,0"] : ["N,NE,E,SE,S,SW,W,NW,N"];
        this.gaugeOptions.numbersMargin = 3;
        this.gaugeOptions.fontNumbersSize = 15;
        this.gaugeOptions.minorTicks = 22;

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
        // override gauge config min/max/unit to make them compatible for 360 circular rotation
        this.gaugeOptions.minValue = 0;
        this.gaugeOptions.maxValue = 360;
        this.gaugeOptions.units = this.widgetProperties.config.paths["gaugePath"].convertUnitTo = "deg";

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
        this.gaugeOptions.majorTicks = this.widgetProperties.config.compassUseNumbers ? ["0,45,90,135,180,225,270,315,0"] : ["N,NE,E,SE,S,SW,W,NW,N"];
        this.gaugeOptions.numbersMargin = 3;
        this.gaugeOptions.fontNumbersSize = 15;
        this.gaugeOptions.minorTicks = 22;

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

  private setHighlights(): void {
    if (!this.zones.length) {return};
    if (this.widgetProperties.config.radialSize == "marineCompass" || this.widgetProperties.config.radialSize == "baseplateCompass") {
      this.gaugeOptions.highlights = [];
      this.gaugeOptions.highlightsWidth = 0;
    } else {
      let myZones: IDataHighlight = [];
      this.zones.forEach(zone => {
        // get zones for our path
        if (zone.path == this.widgetProperties.config.paths['gaugePath'].path) {

          // Perform Units conversion
          const convert = Qty.swiftConverter(zone.unit, this.widgetProperties.config.paths["gaugePath"].convertUnitTo);
          let lower = convert(zone.lower);
          let upper = convert(zone.upper);

          lower = lower || this.widgetProperties.config.minValue;
          upper = upper || this.widgetProperties.config.maxValue;
          let color: string;
          switch (zone.state) {
            case IZoneState.warning:
              color = this.theme.warn;
              break;
            case IZoneState.alarm:
              color = this.theme.warnDark;
              break;
            default:
              color = "rgba(0,0,0,0)";
          }

          myZones.push({from: lower, to: upper, color: color});
        }
      });
      //@ts-ignore - bug in highlights property definition
      this.gaugeOptions.highlights = JSON.stringify(myZones, null, 1);
      this.gaugeOptions.highlightsWidth = 6;
    }
  }

  /**
   * Method to calculate nice values for min, max and range for the
   * gaugeOptions.majorTicks. This function will recalculate a new nice rounded scale
   * the better suited to the value range.
   *
   * @private
   * @param {number} minValue suggested range min value
   * @param {number} maxValue suggested range max value
   * @return {*}  {[number, number, number[]]} array containing calculated rounded range minimal value, maximum value and the tick array
   * @memberof WidgetGaugeNgRadialComponent
   */
  private calculateMajorTicks(minValue: number, maxValue: number): [number, number, number[]] {
    const tickArray = [] as Array<number>;
    let niceRange = maxValue - minValue;
    let majorTickSpacing = 0;
    let maxNoOfMajorTicks = 10;


    niceRange = this.calcNiceNumber(maxValue - minValue, false);
    majorTickSpacing = this.calcNiceNumber(niceRange / (maxNoOfMajorTicks - 1), true);
    let niceMinValue = Math.floor(minValue / majorTickSpacing) * majorTickSpacing;
    let niceMaxValue = Math.ceil(maxValue / majorTickSpacing) * majorTickSpacing;

    tickArray.push(niceMinValue);

    const range: number = niceRange / majorTickSpacing;

    for (let index = 0; index < range; index++) {
      if (tickArray[index] < niceMaxValue) {
        // need to do some trick here to account for JavaScript fraction issues else when scale ticks are smaller than 1, nice numbers can't be produced ie. tick of 0.3 will be 0.30000000004 (see: https://flaviocopes.com/javascript-decimal-arithmetics/)
        let tick = (Number(tickArray[index].toFixed(2)) * 100 + Number(majorTickSpacing.toFixed(2)) * 100) / 100;
        tickArray.push(tick);
      }
    }
    return [niceMinValue, niceMaxValue, tickArray];
  }

  private calcNiceNumber(range: number, round: boolean): number {
    const exponent = Math.floor(Math.log10(range));   // exponent of range
    const fraction = range / Math.pow(10, exponent);  // fractional part of range
    let niceFraction: number = null;                  // nice, rounded fraction

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

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.zonesSub?.unsubscribe();
  }
}
