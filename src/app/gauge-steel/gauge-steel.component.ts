import { Component, Input, AfterViewInit, OnInit, OnChanges, SimpleChanges } from '@angular/core';

declare var steelseries: any; // 3rd party
 
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
  styleUrls: ['./gauge-steel.component.css']
})
export class GaugeSteelComponent implements OnInit, AfterViewInit, OnChanges {

  @Input('widgetUUID') widgetUUID: string;
  @Input('gaugeType') gaugeType: string; // linear or radial
  @Input('barGauge') barGauge: boolean;

  @Input('radialSize') radialSize?: string;

  @Input('backgroundColor') backgroundColor?: string; 
  @Input('frameColor') frameColor: string;

  @Input('minValue') minValue: number;
  @Input('maxValue') maxValue: number;

  @Input('zones') zones: Array<{ low: number; high: number; state: string}>;

  @Input('title') title: string;
  @Input('units') units: string;

  @Input('value') value: number;

  constructor() { }

  gauge;

  gaugeOptions = {};

  // common options for both radial and linear
  width: number = 300;
  height: number = 100;
  sections;
  

  ngOnInit() {


  }

  ngAfterViewInit() {


    if (!this.gaugeType) { this.gaugeType = 'radial'; }


    this.buildOptions();
           
    this.startGauge();

  }




  buildOptions() {
    this.gaugeOptions = {};

    //size
    if (this.gaugeType == 'radial') {
      this.gaugeOptions['size'] = Math.min(this.height, this.width); // radial takes only size as both the same
    } else {
      this.gaugeOptions['width'] = this.width;
      this.gaugeOptions['height'] = this.height;
    }

    //minMax
    this.gaugeOptions['minValue'] = this.minValue;
    this.gaugeOptions['maxValue'] = this.maxValue;

    //labels
    this.gaugeOptions['titleString'] = this.title;
    this.gaugeOptions['unitString'] = this.units;

    // Radial Arc size
    if (this.gaugeType == 'radial') {
      switch(this.radialSize) {
        case 'quarter':
          this.gaugeOptions['gaugeType'] = steelseries.GaugeType.TYPE1;
          break;
        case 'half':
          this.gaugeOptions['gaugeType'] = steelseries.GaugeType.TYPE2;
          break;
        case 'three-quarter':
          this.gaugeOptions['gaugeType'] = steelseries.GaugeType.TYPE3;
          break;
        case 'full':
        default:
          this.gaugeOptions['gaugeType'] = steelseries.GaugeType.TYPE4;


      }
    }

    // Zones
    // Define some sections
    if (this.zones) {
      let sections = [];
      let areas = []
      for (let i=0;i < this.zones.length; i++) {
        switch (this.zones[i].state) {
          case 'good':
            sections.push(steelseries.Section(this.zones[i].low, this.zones[i].high, 'rgba(0, 220, 0, 0.3)'));
            break;
          case 'warn':
            sections.push(steelseries.Section(this.zones[i].low, this.zones[i].high, 'rgba(220, 220, 0, 0.3)'));
            break;
          case 'alert':
            if (this.gaugeType == 'radial' && (!this.barGauge)) {
              areas.push(steelseries.Section(this.zones[i].low, this.zones[i].high, 'rgba(220, 0, 0, 0.3)'));
            } else {
              sections.push(steelseries.Section(this.zones[i].low, this.zones[i].high, 'rgba(220, 0, 0, 0.3)'));
            }
        }
      }

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

    // Initialzing gauges
    if (this.gaugeType == 'radial') {
      if (this.barGauge) {
        this.gauge = new steelseries.RadialBargraph(this.widgetUUID, this.gaugeOptions);
      } else {
        this.gauge = new steelseries.Radial(this.widgetUUID, this.gaugeOptions);
      }
    } else if (this.gaugeType == 'linear') {
       if (this.barGauge) {
        this.gauge = new steelseries.LinearBargraph(this.widgetUUID, this.gaugeOptions);
      } else {
        this.gauge = new steelseries.Linear(this.widgetUUID, this.gaugeOptions);
      }     
    }
   
  }





  ngOnChanges(changes: SimpleChanges) {


    if (changes.value) {
      if (! changes.value.firstChange) {
        this.gauge.setValueAnimated(changes.value.currentValue);
      }
    }

    if (changes.gaugeType) {
      if ( !changes.gaugeType.firstChange) {
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

  }



}
