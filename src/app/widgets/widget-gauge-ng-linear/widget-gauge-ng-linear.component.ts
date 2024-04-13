import { ViewChild, ElementRef, Component, OnInit, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';
import { ResizedEvent, AngularResizeEventModule } from 'angular-resize-event';

import { IZone, IZoneState } from '../../core/interfaces/app-settings.interfaces';
import { IDataHighlight } from '../../core/interfaces/widgets-interface';
import { LinearGaugeOptions, LinearGauge, GaugesModule } from '@biacsics/ng-canvas-gauges';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { AppSettingsService } from '../../core/services/app-settings.service';
import { JsonPipe } from '@angular/common';
import Qty from 'js-quantities';

@Component({
    selector: 'app-widget-gauge-ng-linear',
    templateUrl: './widget-gauge-ng-linear.component.html',
    styleUrls: ['./widget-gauge-ng-linear.component.scss'],
    standalone: true,
    imports: [AngularResizeEventModule, GaugesModule, JsonPipe]
})

export class WidgetGaugeNgLinearComponent extends BaseWidgetComponent implements OnInit, OnDestroy, OnChanges {
  @ViewChild('linearWrapperDiv', {static: true, read: ElementRef}) private wrapper: ElementRef;
  @ViewChild('linearGauge', {static: true, read: LinearGauge}) protected linearGauge: LinearGauge;

  // main gauge value variable
  public dataValue = 0;
  public dataValueTrimmed = 0;

  // Gauge options
  public gaugeOptions = {} as LinearGaugeOptions;
  public isGaugeVertical: Boolean = true;

  // Zones support
  zones: Array<IZone> = [];
  zonesSub: Subscription;

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
          convertUnitTo: "unitless",
          sampleTime: 500
        }
      },
      gaugeType: 'ngLinearVertical',  //ngLinearVertical or ngLinearHorizontal
      gaugeTicks: false,
      minValue: 0,
      maxValue: 100,
      numInt: 1,
      numDecimal: 0,
      barColor: 'accent',
      enableTimeout: false,
      dataTimeout: 5
    };

  }

  ngOnInit() {
    this.validateConfig();
    this.observeDataStream('gaugePath', newValue => {
        if (newValue.value === null) {newValue.value = 0}
        // Only push new values formatted to gauge settings to reduce gauge paint requests
        let oldValue = this.dataValue;
        let temp: any = this.formatWidgetNumberValue(newValue.value);
        if (oldValue != (temp as number)) {
          this.dataValue = temp;
        }

        // set colors for zone state
        switch (newValue.state) {
          case IZoneState.warning:
            this.gaugeOptions.colorValueText = this.theme.warnDark;
            break;
          case IZoneState.alarm:
            this.gaugeOptions.colorValueText = this.theme.warnDark;
            break;
          default:
            this.gaugeOptions.colorValueText = getComputedStyle(this.wrapper.nativeElement).color;
        }
      }
    );

    this.subscribeZones();
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.zonesSub?.unsubscribe();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.theme) {
      this.updateGaugeConfig();
    }
  }

  // Subscribe to Zones
  subscribeZones() {
    this.zonesSub = this.appSettingsService.getZonesAsO().subscribe(
      zones => {
        this.zones = zones;
        this.updateGaugeConfig();
      });
  }

  updateGaugeConfig(){
    let themePaletteColor = "";
    let themePaletteDarkColor = "";

    this.gaugeOptions.colorTitle = this.gaugeOptions.colorUnits = this.gaugeOptions.colorValueText = window.getComputedStyle(this.wrapper.nativeElement).color;

    this.gaugeOptions.colorPlate = window.getComputedStyle(this.wrapper.nativeElement).backgroundColor;
    this.gaugeOptions.colorBar = this.theme.background;
    this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorTitle;
    this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorTitle;

    this.gaugeOptions.colorNeedleEnd = "";
    this.gaugeOptions.colorNeedleShadowUp = "";
    this.gaugeOptions.colorNeedleShadowDown = "black";

    switch (this.widgetProperties.config.barColor) {
      case "primary":
          themePaletteColor = this.theme.primary;
          themePaletteDarkColor = this.theme.primaryDark;
          this.gaugeOptions.colorBarProgress = themePaletteColor;
          this.gaugeOptions.colorBarProgressEnd = themePaletteDarkColor;
          this.gaugeOptions.colorNeedle = themePaletteDarkColor;
          this.gaugeOptions.needleWidth = 5;
        break;

      case "accent":
          themePaletteColor = this.theme.accent;
          themePaletteDarkColor = this.theme.accentDark;
          this.gaugeOptions.colorBarProgress = themePaletteColor;
          this.gaugeOptions.colorBarProgressEnd = themePaletteDarkColor;
          this.gaugeOptions.colorNeedle = themePaletteDarkColor;
          this.gaugeOptions.needleWidth = 5;
          break;

      case "warn":
          themePaletteColor = this.theme.warn;
          themePaletteDarkColor = this.theme.warnDark;
          this.gaugeOptions.colorBarProgress = themePaletteColor;
          this.gaugeOptions.colorBarProgressEnd = themePaletteDarkColor;
          this.gaugeOptions.colorNeedle = themePaletteDarkColor;
          this.gaugeOptions.needleWidth = 5;
        break;

      case "nobar":
          themePaletteColor = this.theme.background;
          themePaletteDarkColor = this.theme.warnDark;
          this.gaugeOptions.colorBar = themePaletteColor;
          this.gaugeOptions.colorBarProgress = themePaletteColor;
          this.gaugeOptions.colorBarProgressEnd = themePaletteColor;
          this.gaugeOptions.colorNeedle = themePaletteDarkColor;
          this.gaugeOptions.needleWidth = 20;


        default:
        break;
    }

    // highlights
    let myZones: IDataHighlight = [];
    this.zones.forEach(zone => {
        // get zones for our path
        if (zone.path == this.widgetProperties.config.paths['gaugePath'].path) {
          let lower: number = null;
          let upper: number = null;
          // Perform Units conversions on zone range
          if (zone.unit == "ratio") {
            lower = zone.lower;
            upper = zone.upper;
          } else {
            const convert = Qty.swiftConverter(zone.unit, this.widgetProperties.config.paths["gaugePath"].convertUnitTo);
            lower = convert(zone.lower);
            upper = convert(zone.upper);
          }

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
      }
    );
    this.gaugeOptions.highlights = myZones;


    // Config storage values
    this.gaugeOptions.minValue = this.widgetProperties.config.minValue;
    this.gaugeOptions.maxValue = this.widgetProperties.config.maxValue;
    this.gaugeOptions.valueInt = this.widgetProperties.config.numInt;
    this.gaugeOptions.valueDec = this.widgetProperties.config.numDecimal;

    this.gaugeOptions.majorTicksInt = this.widgetProperties.config.numInt;
    this.gaugeOptions.majorTicksDec = this.widgetProperties.config.numDecimal;

    this.gaugeOptions.animateOnInit = false;
    this.gaugeOptions.animatedValue = false;
    this.gaugeOptions.animationDuration = this.widgetProperties.config.paths['gaugePath'].sampleTime - 25; // prevent data/amnimation collisions

    if (this.widgetProperties.config.gaugeTicks) {
      this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = this.gaugeOptions.colorTitle;
    } else {
      this.gaugeOptions.colorMajorTicks = this.gaugeOptions.colorNumbers = this.gaugeOptions.colorMinorTicks = "";
    }

    this.gaugeOptions.valueBox = true;
    this.gaugeOptions.valueBoxWidth = 100;
    this.gaugeOptions.valueBoxBorderRadius = 0;

    this.gaugeOptions.needle = true;
    this.gaugeOptions.needleType = "line";
    this.gaugeOptions.needleShadow = false;
    this.gaugeOptions.needleSide = "both";

    // Vertical
    if (this.widgetProperties.config.gaugeType == 'ngLinearVertical'){
      this.isGaugeVertical = true;   // Changes div wrapper class to respect aspect ratio
      this.gaugeOptions.barLength = 75;
      this.gaugeOptions.fontUnitsSize = 40;
      this.gaugeOptions.fontTitleSize = 40;

      // Vertical With ticks
      if (this.widgetProperties.config.gaugeTicks == true) {
        this.gaugeOptions.barWidth = 30;

        this.gaugeOptions.needleStart = -45;
        this.gaugeOptions.needleEnd = 55;

        this.gaugeOptions.exactTicks = false;
        this.gaugeOptions.tickSide = "right";
        this.gaugeOptions.ticksWidth = 8;
        this.gaugeOptions.ticksPadding = 4;

        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = [this.widgetProperties.config.minValue, this.widgetProperties.config.maxValue];

        this.gaugeOptions.numberSide = "right";
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 25;

        this.gaugeOptions.minorTicks = 10;
        this.gaugeOptions.ticksWidthMinor = 4;

        this.gaugeOptions.highlightsWidth = 5;
      }
      else {
        // Vertical No ticks
        this.gaugeOptions.barWidth = 100;

        this.gaugeOptions.needleStart = 0;
        this.gaugeOptions.needleEnd = 100;

        this.gaugeOptions.ticksWidth = 0;
        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = [];

        this.gaugeOptions.ticksPadding = 0;
        this.gaugeOptions.minorTicks = 0;
        this.gaugeOptions.ticksWidthMinor = 0;
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 0;

        this.gaugeOptions.highlightsWidth = 5;
      }
    }
    else {
      // horizontal
      this.isGaugeVertical = false;  // Changes div wrapper class to respect aspect ratio
      this.gaugeOptions.barLength = 80;
      this.gaugeOptions.fontTitleSize = 45;
      this.gaugeOptions.fontUnitsSize = 35;

      // horizontal With ticks
      this.gaugeOptions.barWidth = 40;
        if (this.widgetProperties.config.gaugeTicks == true) {

          this.gaugeOptions.exactTicks = false;
          this.gaugeOptions.barWidth = 30;

          this.gaugeOptions.needleStart = -45;
          this.gaugeOptions.needleEnd = 56;

          this.gaugeOptions.tickSide = "right";
          this.gaugeOptions.ticksWidth = 8;
          this.gaugeOptions.ticksPadding = 5;

          this.gaugeOptions.strokeTicks = false;
          this.gaugeOptions.majorTicks = [this.widgetProperties.config.minValue, this.widgetProperties.config.maxValue];

          this.gaugeOptions.numberSide = "right";
          this.gaugeOptions.numbersMargin = -5;
          this.gaugeOptions.fontNumbersSize = 25;

          this.gaugeOptions.minorTicks = 10;
          this.gaugeOptions.ticksWidthMinor = 5;

          this.gaugeOptions.highlightsWidth = 5;
      }
      else {
        // horizontal No ticks
        this.gaugeOptions.barWidth = 60;

        this.gaugeOptions.needleStart = 0;
        this.gaugeOptions.needleEnd = 100;

        this.gaugeOptions.ticksWidth = 0;
        this.gaugeOptions.strokeTicks = false;
        this.gaugeOptions.majorTicks = [];

        this.gaugeOptions.ticksPadding = 0;
        this.gaugeOptions.minorTicks = 0;
        this.gaugeOptions.ticksWidthMinor = 0;
        this.gaugeOptions.numbersMargin = 0;
        this.gaugeOptions.fontNumbersSize = 0;

        this.gaugeOptions.highlightsWidth = 5;
      }
    }
  }

  onResized(event: ResizedEvent) {

    this.gaugeOptions.height = event.newRect.height;

    if (this.isGaugeVertical == true) {
      this.gaugeOptions.width = (event.newRect.height * 0.30);
    }
    else {
      this.gaugeOptions.width = event.newRect.width;
    }
  }
}
