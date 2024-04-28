import { UnitsService } from './../../core/services/units.service';
import { Component, Input, AfterViewInit, OnChanges, SimpleChanges, ViewChild, ElementRef, OnDestroy, Renderer2 } from '@angular/core';
import { ResizedEvent, AngularResizeEventModule } from 'angular-resize-event';
import { ITheme } from '../../core/interfaces/widgets-interface';
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
    styleUrls: ['./gauge-steel.component.css'],
    standalone: true,
    imports: [AngularResizeEventModule]
})
export class GaugeSteelComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('sgWrapperDiv', {static: true, read: ElementRef}) sgWrapperDiv: ElementRef<HTMLDivElement>;
  @Input('widgetUUID') widgetUUID: string;
  @Input('subType') subType: string; // linear or radial
  @Input('barGauge') barGauge: boolean;
  @Input('radialSize') radialSize?: string;
  @Input('backgroundColor') backgroundColor?: string;
  @Input('frameColor') frameColor: string;
  @Input('minValue') minValue: number;
  @Input('maxValue') maxValue: number;
  @Input('zones') zones: Array<any>;
  @Input('title') title: string;
  @Input('units') units: string;
  @Input('value') value: number;
  @Input('themeColors') theme: ITheme;


  gaugeWidth: number = 0;
  gaugeHeight: number = 0;
  isInResizeWindow: boolean = false;
  gaugeStarted: boolean = false;
  gauge;
  gaugeOptions = {};
  private resizeTimer = null;

  sections;

  constructor(private unitsService: UnitsService) {
  }

  ngAfterViewInit() {
    if (!this.subType) { this.subType = 'radial'; }
  }

  buildOptions() {
    this.gaugeOptions = {};

    //size
    if (this.subType == 'radial') {
      this.gaugeOptions['size'] = Math.min(this.gaugeHeight, this.gaugeWidth); // radial takes only size as both the same
    } else {
      this.gaugeOptions['width'] = this.gaugeWidth;
      this.gaugeOptions['height'] = this.gaugeHeight;
    }

    //minMax
    this.gaugeOptions['minValue'] = this.minValue;
    this.gaugeOptions['maxValue'] = this.maxValue;

    //labels
    this.gaugeOptions['titleString'] = this.title;
    this.gaugeOptions['unitString'] = this.units;

    // Radial Arc size
    if (this.subType == 'radial') {
      switch(this.radialSize) {
        case 'quarter':
          this.gaugeOptions['subType'] = steelseries.GaugeType.TYPE1;
          break;
        case 'half':
          this.gaugeOptions['subType'] = steelseries.GaugeType.TYPE2;
          break;
        case 'three-quarter':
          this.gaugeOptions['subType'] = steelseries.GaugeType.TYPE3;
          break;
        case 'full':
        default:
          this.gaugeOptions['subType'] = steelseries.GaugeType.TYPE4;
      }
    }

    // Zones
    // Define some sections
    if (this.zones) {

      let sections = [];
      let areas = [];

      // Sort zones based on lower value
      const sortedZones = [...this.zones].sort((a, b) => a.lower - b.lower);

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

        // Perform Units conversions on zone range
        if (this.units == "ratio") {
          lower = zone.lower;
          upper = zone.upper;
        } else {
          lower = this.unitsService.convertToUnit(this.units, zone.lower);
          upper = this.unitsService.convertToUnit(this.units, zone.upper);
        }

        // Skip zones that are completely outside the gauge range
        if (upper < this.minValue || lower > this.maxValue) {
          continue;
        }

        // If lower or upper are null, set them to minValue or maxValue
        lower = lower !== null ? lower : this.minValue;
        upper = upper !== null ? upper : this.maxValue;

        // Ensure lower does not go below minValue
        lower = Math.max(lower, this.minValue);

        // Ensure upper does not exceed maxValue
        if (upper > this.maxValue) {
          upper = this.maxValue;
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
    if (SteelBackgroundColors[this.backgroundColor]) {
      this.gaugeOptions['backgroundColor'] = SteelBackgroundColors[this.backgroundColor];
    }
    if (SteelFrameColors[this.frameColor]) {
      this.gaugeOptions['frameDesign'] = SteelFrameColors[this.frameColor];
    }
    if (this.barGauge) {
      this.gaugeOptions['valueColor'] = steelseries.ColorDef.GREEN;
    }

    //defaults
    this.gaugeOptions['lcdVisible'] = true;
    this.gaugeOptions['thresholdVisible'] = false;
    this.gaugeOptions['threshold'] = this.maxValue;
    this.gaugeOptions['ledVisible'] = false;
  }

  startGauge() {
    this.gaugeStarted = true;
    this.buildOptions();
        // Initializing gauges
    if (this.subType == 'radial') {
      if (this.barGauge) {
        this.gauge = new steelseries.RadialBargraph(this.widgetUUID, this.gaugeOptions);
      } else {
        this.gauge = new steelseries.Radial(this.widgetUUID, this.gaugeOptions);
      }
    } else if (this.subType == 'linear') {
       if (this.barGauge) {
        this.gauge = new steelseries.LinearBargraph(this.widgetUUID, this.gaugeOptions);
      } else {
        this.gauge = new steelseries.Linear(this.widgetUUID, this.gaugeOptions);
      }
    }
  }

  onResized(event: ResizedEvent) {
    if (event.newRect.height < 50) {
      return;
    }
    if (event.newRect.width < 50) {
      return;
    }
    if (!this.isInResizeWindow) {
      this.isInResizeWindow = true;

      this.resizeTimer = setTimeout(() => {
        let rect = this.sgWrapperDiv.nativeElement.getBoundingClientRect();
        this.gaugeWidth = rect.width;
        this.gaugeHeight = rect.height;
        this.isInResizeWindow = false;
        this.startGauge();
         }, 500);
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.gaugeStarted) { return; }

    if (changes.value) {
      if (!changes.value.firstChange) {
        this.gauge.setValueAnimated(changes.value.currentValue);
      }
    }

    if (changes.subType) {
      if ( !changes.subType.firstChange) {
        this.startGauge();//reset
      }
    }

    if (changes.barGauge) {
      if ( !changes.barGauge.firstChange) {
        this.startGauge();//reset
      }
    }

    if (changes.title) {
      if ( !changes.title.firstChange) {
        this.startGauge();//reset
      }
    }

    if (changes.units) {
      if ( !changes.units.firstChange) {
        this.startGauge();//reset
      }
    }
    if (changes.minValue) {
      if ( !changes.minValue.firstChange) {
        this.startGauge();//reset
      }
    }
    if (changes.maxValue) {
      if ( !changes.maxValue.firstChange) {
        this.startGauge();//reset
      }
    }

    if (changes.radialSize) {
      if ( !changes.radialSize.firstChange) {
        this.startGauge();//reset
      }
    }

    if (changes.backgroundColor) {
      if ( !changes.backgroundColor.firstChange) {
        this.startGauge();//reset
      }
    }

    if (changes.frameColor) {
      if ( !changes.frameColor.firstChange) {
        this.startGauge();//reset
      }
    }

    if (changes.zones) {
      this.startGauge(); //reset
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.resizeTimer);
  }
}
