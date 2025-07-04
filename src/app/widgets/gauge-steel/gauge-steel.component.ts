import { UnitsService } from './../../core/services/units.service';
import { Component, OnChanges, SimpleChanges, OnInit, input, inject } from '@angular/core';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import type { ITheme } from '../../core/services/app-service';
import { States } from '../../core/interfaces/signalk-interfaces';

declare let steelseries: any; // 3rd party

export const SteelBackgroundColors = {
  'darkGray': steelseries.BackgroundColor.DARK_GRAY,
  'satinGray': steelseries.BackgroundColor.SATIN_GRAY,
  'lightGray': steelseries.BackgroundColor.LIGHT_GRAY,
  'white': steelseries.BackgroundColor.WHITE,
  'black': steelseries.BackgroundColor.BLACK,
  'beige': steelseries.BackgroundColor.BEIGE,
  'brown': steelseries.BackgroundColor.BROWN,
  'red': steelseries.BackgroundColor.RED,
  'green': steelseries.BackgroundColor.GREEN,
  'blue': steelseries.BackgroundColor.BLUE,
  'anthracite': steelseries.BackgroundColor.ANTHRACITE,
  'mud': steelseries.BackgroundColor.MUD,
  'punchedSheet': steelseries.BackgroundColor.PUNCHED_SHEET,
  'carbon': steelseries.BackgroundColor.CARBON,
  'stainless': steelseries.BackgroundColor.STAINLESS,
  'brushedMetal': steelseries.BackgroundColor.BRUSHED_METAL,
  'brushedStainless': steelseries.BackgroundColor.BRUSHED_STAINLESS,
  'turned': steelseries.BackgroundColor.TURNED
}

export const SteelFrameColors = {
'blackMetal': steelseries.FrameDesign.BLACK_METAL,
'metal': steelseries.FrameDesign.METAL,
'shinyMetal': steelseries.FrameDesign.SHINY_METAL,
'brass': steelseries.FrameDesign.BRASS,
'steel': steelseries.FrameDesign.STEEL,
'chrome': steelseries.FrameDesign.CHROME,
'gold': steelseries.FrameDesign.GOLD,
'anthracite': steelseries.FrameDesign.ANTHRACITE,
'tiltedGray': steelseries.FrameDesign.TILTED_GRAY,
'tiltedBlack': steelseries.FrameDesign.TILTED_BLACK,
'glossyMetal': steelseries.FrameDesign.GLOSSY_METAL
}

@Component({
    selector: 'gauge-steel',
    templateUrl: './gauge-steel.component.html',
    styleUrls: ['./gauge-steel.component.scss'],
    standalone: true,
    imports: [NgxResizeObserverModule]
})
export class GaugeSteelComponent implements OnInit, OnChanges {
  private unitsService = inject(UnitsService);

  readonly widgetUUID = input<string>(undefined);
  readonly subType = input<string>(undefined); // linear or radial
  readonly barGauge = input<boolean>(undefined);
  readonly radialSize = input<string>(undefined);
  readonly backgroundColor = input<string>(undefined);
  readonly frameColor = input<string>(undefined);
  readonly minValue = input<number>(undefined);
  readonly maxValue = input<number>(undefined);
  readonly decimals = input<number>(undefined);
  readonly zones = input<any[]>(undefined);
  readonly title = input<string>(undefined);
  readonly units = input<string>(undefined);
  readonly value = input<number>(undefined);
  readonly theme = input<ITheme>(undefined, { alias: "themeColors" });

  private gaugeStarted = false;
  private gauge;
  private gaugeOptions = {};
  protected paddingTop = 0;

  ngOnInit(): void {
    this.buildOptions();
  }

  private buildOptions() {
    //minMax
    this.gaugeOptions['minValue'] = this.minValue();
    this.gaugeOptions['maxValue'] = this.maxValue();
    const decimals = this.decimals();
    this.gaugeOptions['lcdDecimals'] = decimals !== undefined && decimals !== null ? decimals : 2;

    //labels
    this.gaugeOptions['titleString'] = this.title();
    this.gaugeOptions['unitString'] = this.units();

    // Radial Arc size
    if (this.subType() == 'radial') {
      this.gaugeOptions['gaugeType'] = this.setGaugeType(this.radialSize());
    }

    // Zones
    // Define some sections
    const zones = this.zones();
    if (zones) {

      const sections = [];
      const areas = [];

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

        // Perform Units conversions on zone range
        const units = this.units();
        if (units == "ratio") {
          lower = zone.lower;
          upper = zone.upper;
        } else {
          lower = this.unitsService.convertToUnit(units, zone.lower);
          upper = this.unitsService.convertToUnit(units, zone.upper);
        }

        // Skip zones that are completely outside the gauge range
        if (upper < this.minValue() || lower > this.maxValue()) {
          continue;
        }

        // If lower or upper are null, set them to minValue or maxValue
        lower = lower !== null ? lower : this.minValue();
        upper = upper !== null ? upper : this.maxValue();

        // Ensure lower does not go below minValue
        lower = Math.max(lower, this.minValue());

        // Ensure upper does not exceed maxValue
        if (upper > this.maxValue()) {
          upper = this.maxValue();
          sections.push(steelseries.Section(lower, upper, color));
          break;
        }

        sections.push(steelseries.Section(lower, upper, color));
      };

      this.gaugeOptions['section'] = sections;
      this.gaugeOptions['area'] = areas;
      this.gaugeOptions['useSectionColors'] = true;
    }

    //Colors
    if (SteelBackgroundColors[this.backgroundColor()]) {
      this.gaugeOptions['backgroundColor'] = SteelBackgroundColors[this.backgroundColor()];
    }
    if (SteelFrameColors[this.frameColor()]) {
      this.gaugeOptions['frameDesign'] = SteelFrameColors[this.frameColor()];
    }
    if (this.barGauge()) {
      this.gaugeOptions['valueColor'] = steelseries.ColorDef.GREEN;
    }

    //defaults
    this.gaugeOptions['lcdVisible'] = true;
    this.gaugeOptions['thresholdVisible'] = false;
    this.gaugeOptions['threshold'] = this.maxValue();
    this.gaugeOptions['ledVisible'] = false;
  }

  private setGaugeType(radialSize: string): string {
    switch (radialSize) {
      case 'quarter':
        return steelseries.GaugeType.TYPE1;
      case 'half':
        return steelseries.GaugeType.TYPE2;
      case 'three-quarter':
        return steelseries.GaugeType.TYPE3;
      case 'full':
      default:
        return steelseries.GaugeType.TYPE4;
    }
  }

  private startGauge() {
    this.gaugeStarted = true;
    this.buildOptions();
        // Initializing gauges
    const subType = this.subType();
    if (subType == 'radial') {
      this.gauge = new steelseries.Radial(this.widgetUUID(), this.gaugeOptions);
    } else if (subType == 'linear') {
       if (this.barGauge()) {
        this.gauge = new steelseries.LinearBargraph(this.widgetUUID(), this.gaugeOptions);
      } else {
        this.gauge = new steelseries.Linear(this.widgetUUID(), this.gaugeOptions);
      }
    }
  }

  onResized(event) {
    if (event.contentRect.height < 50 || event.contentRect.width < 50) {
      return;
    }
    if (this.subType() == 'radial') {
      const size = Math.min(event.contentRect.height, event.contentRect.width);
      this.gaugeOptions['size'] = size; // radial uses size. takes only size as both are the same

    } else {
      this.gaugeOptions['width'] = event.contentRect.width; // linear
      this.gaugeOptions['height'] = event.contentRect.height; // linear
    }
    this.startGauge();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.gaugeStarted) { return; }
    if (changes.value && !changes.value.firstChange) {
        this.gauge.setValueAnimated(changes.value.currentValue);
    }
    if (changes.zones) {
      this.startGauge(); //reset
    }
    if (changes.title) {
      this.gauge.setTitleString(changes.title.currentValue);
    }
    if(changes.backgroundColor) {
      this.gauge.setBackgroundColor(SteelBackgroundColors[changes.backgroundColor.currentValue]);
    }
    if(changes.frameColor) {
      this.gauge.setFrameDesign(SteelFrameColors[changes.frameColor.currentValue]);
    }
    if (changes.radialSize){
      this.startGauge(); //reset
    }
    if(changes.minValue) {
      this.gauge.setMinValue(changes.minValue.currentValue);
    }
    if(changes.maxValue) {
      this.gauge.setMaxValue(changes.maxValue.currentValue);
    }
  }
}
