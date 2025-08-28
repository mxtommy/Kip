import { UnitsService } from './../../core/services/units.service';
import { Component, OnChanges, SimpleChanges, OnInit, OnDestroy, input, inject, ElementRef, viewChild } from '@angular/core';
import { CanvasService } from '../../core/services/canvas.service';
import { NgxResizeObserverModule } from 'ngx-resize-observer';
import type { ITheme } from '../../core/services/app-service';
import { ISkZone, States } from '../../core/interfaces/signalk-interfaces';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let steelseries: any; // 3rd party global (loaded from asset in production build)

// Test/SSR safety: provide a minimal mock to avoid ReferenceError when the real script isn't loaded (e.g., unit tests)
// Only defines the enum-like objects accessed at module evaluation time. Runtime drawing logic won't run in specs.
if (typeof steelseries === 'undefined') {
  (globalThis as unknown as Record<string, unknown>).steelseries = {
    BackgroundColor: {
      DARK_GRAY: 'darkGray', SATIN_GRAY: 'satinGray', LIGHT_GRAY: 'lightGray', WHITE: 'white', BLACK: 'black',
      BEIGE: 'beige', BROWN: 'brown', RED: 'red', GREEN: 'green', BLUE: 'blue', ANTHRACITE: 'anthracite',
      MUD: 'mud', PUNCHED_SHEET: 'punchedSheet', CARBON: 'carbon', STAINLESS: 'stainless', BRUSHED_METAL: 'brushedMetal',
      BRUSHED_STAINLESS: 'brushedStainless', TURNED: 'turned'
    },
    FrameDesign: {
      BLACK_METAL: 'blackMetal', METAL: 'metal', SHINY_METAL: 'shinyMetal', BRASS: 'brass', STEEL: 'steel', CHROME: 'chrome',
      GOLD: 'gold', ANTHRACITE: 'anthracite', TILTED_GRAY: 'tiltedGray', TILTED_BLACK: 'tiltedBlack', GLOSSY_METAL: 'glossyMetal'
    }
  };
}

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
    imports: [NgxResizeObserverModule]
})
export class GaugeSteelComponent implements OnInit, OnChanges, OnDestroy {
  private unitsService = inject(UnitsService);
  private readonly canvasService = inject(CanvasService);
  protected readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('gaugeCanvas');

  readonly widgetUUID = input<string>(undefined);
  readonly subType = input<string>(undefined); // linear or radial
  readonly barGauge = input<boolean>(undefined);
  readonly radialSize = input<string>(undefined);
  readonly backgroundColor = input<string>(undefined);
  readonly frameColor = input<string>(undefined);
  readonly minValue = input<number>(undefined);
  readonly maxValue = input<number>(undefined);
  readonly decimals = input<number>(undefined);
  readonly zones = input<ISkZone[]>(undefined);
  readonly title = input<string>(undefined);
  readonly units = input<string>(undefined);
  readonly value = input<number>(undefined);
  // eslint-disable-next-line @angular-eslint/no-input-rename
  readonly theme = input<ITheme>(undefined, { alias: "themeColors" });

  private gaugeStarted = false;
  private gauge;
  private gaugeOptions = {};
  protected paddingTop = 0;
  private lastSizeSignature = '';
  private resizeTimer: number | null = null;
  private pendingStructuralRebuild = false;

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

  private startGauge(forceRebuild = false) {
    this.buildOptions();

    const id = this.widgetUUID();
    if (!id) return;

    // structural conditions requiring rebuild
    const structuralChange = forceRebuild || this.pendingStructuralRebuild;

    if (this.gauge && !structuralChange) {
      // Update mutable properties only
      if (this.gauge.setValueAnimated && this.value() != null) {
        // value updates handled in ngOnChanges, but keep for safety
      }
      this.gaugeStarted = true;
      return;
    }

    // Re-create
    this.pendingStructuralRebuild = false;
    this.gaugeStarted = true;
    const subType = this.subType();
    if (subType === 'radial') {
      this.gauge = new steelseries.Radial(id, this.gaugeOptions);
    } else if (subType === 'linear') {
      if (this.barGauge()) {
        this.gauge = new steelseries.LinearBargraph(id, this.gaugeOptions);
      } else {
        this.gauge = new steelseries.Linear(id, this.gaugeOptions);
      }
    }
  }

  onResized(event) {
    if (event.contentRect.height < 50 || event.contentRect.width < 50) return;
    let signature: string;
    if (this.subType() === 'radial') {
      const size = Math.min(event.contentRect.height, event.contentRect.width);
      this.gaugeOptions['size'] = size;
      signature = 'radial:' + size;
    } else {
      const w = Math.floor(event.contentRect.width);
      const h = Math.floor(event.contentRect.height);
      this.gaugeOptions['width'] = w;
      this.gaugeOptions['height'] = h;
      signature = `linear:${w}x${h}`;
    }
    if (signature === this.lastSizeSignature) return; // no meaningful change
    this.lastSizeSignature = signature;
    if (this.resizeTimer) window.clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => {
      this.startGauge(true); // size change may require rebuild
      this.resizeTimer = null;
    }, 120);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.gaugeStarted) { return; }
    if (changes.value && !changes.value.firstChange) {
        this.gauge.setValueAnimated(changes.value.currentValue);
    }
    if (changes.zones) {
      this.pendingStructuralRebuild = true;
      this.startGauge(true); // sections require rebuild
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
      this.pendingStructuralRebuild = true;
      this.startGauge(true); // radial geometry change
    }
    if(changes.minValue) {
      this.gauge.setMinValue(changes.minValue.currentValue);
    }
    if(changes.maxValue) {
      this.gauge.setMaxValue(changes.maxValue.currentValue);
    }
  }

  ngOnDestroy(): void {
    // Stop any running animations before cleanup
    if (this.gauge && this.gauge.setValue) {
      // Call setValue to stop any running setValueAnimated animations
      const currentValue = this.gauge.getValue ? this.gauge.getValue() : this.value();
      this.gauge.setValue(currentValue);
    }

    // Steelseries draws into the canvas with id widgetUUID(). Release it to free GPU memory.
    const id = this.widgetUUID();
    if (id) {
      const canvas = document.getElementById(id) as HTMLCanvasElement | null;
      this.canvasService.releaseCanvas(canvas, { clear: true, removeFromDom: true });
    }
    // Null out gauge reference for GC
    this.gauge = null;
  }
}
