import { Input, Component, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription, sampleTime } from 'rxjs';

import { DynamicWidget, ITheme, IWidget, IWidgetSvcConfig } from '../../widgets-interface';
import { WidgetBaseService } from '../../widget-base.service';

@Component({
  selector: 'app-widget-simple-linear',
  templateUrl: './widget-simple-linear.component.html',
  styleUrls: ['./widget-simple-linear.component.scss']
})
export class WidgetSimpleLinearComponent implements DynamicWidget, OnInit, OnDestroy, OnChanges {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;

  defaultConfig: IWidgetSvcConfig = {
    displayName: "Gauge Label",
    filterSelfPaths: true,
    paths: {
      "gaugePath": {
        description: "Numeric Data",
        path: null,
        source: null,
        pathType: "number",
        isPathConfigurable: true,
        convertUnitTo: "v"
      }
    },
    minValue: 0,
    maxValue: 15,
    numInt: 1,
    numDecimal: 2,
    gaugeType: "simpleLinear", // Applied to Units label. abr = first letter only. full = full string
    gaugeUnitLabelFormat: "full", // Applied to Units label. abr = first letter only. full = full string
    barColor: 'accent',
  };

  // main gauge value variable
  public unitsLabel:string = "";
  public dataValue: string = "0";
  public gaugeValue: Number = 0;
  public barColor: string = "";
  public barColorGradient: string = "";
  public barColorBackground: string = "";


  private valueSub$: Subscription = null;
  private sample: number = 500;

  constructor(public widgetBaseService: WidgetBaseService) { }

  ngOnInit(): void {
    this.subscribePath();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.theme) {
      this.updateGaugeSettings();
    }
  }

  updateGaugeSettings() {
    this.barColorBackground = this.theme.background;

    switch (this.widgetProperties.config.barColor) {
      case "primary":
        this.barColor = this.theme.primary;
        this.barColorGradient = this.theme.primaryDark;
        break;

      case "accent":
        this.barColor = this.theme.accent;
        this.barColorGradient = this.theme.accentDark;
        break;

      case "warn":
        this.barColor = this.theme.warn;
        this.barColorGradient = this.theme.warnDark;
        break;
    }
  }

  subscribePath() {
    this.unsubscribePath();

    // set Units label sting based on gauge config
    if (this.widgetProperties.config.gaugeUnitLabelFormat == "abr") {
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo.substr(0,1);
    } else {
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
    }

    if (typeof(this.widgetProperties.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...


    try {
      this.valueSub$ = this.widgetBaseService.signalKService.subscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['gaugePath'].path, this.widgetProperties.config.paths['gaugePath'].source).pipe(sampleTime(this.sample)).subscribe(
        newValue => {
          if (newValue.value == null) {return}

          // convert to unit and format value using widget settings
          let value  = this.widgetBaseService.unitsService.convertUnit(this.widgetProperties.config.paths['gaugePath'].convertUnitTo, newValue.value).toFixed(this.widgetProperties.config.numDecimal);

          // Format display value using widget settings
          let displayValue = value;
          if (this.widgetProperties.config.numDecimal != 0){
            this.dataValue = displayValue.padStart((this.widgetProperties.config.numInt + this.widgetProperties.config.numDecimal + 1), "0");
          } else {
            this.dataValue = displayValue.padStart(this.widgetProperties.config.numInt, "0");
          }

          // Format value for gauge bar
          let gaugeValue = Number(value);

          // Limit gauge bar animation overflow to gauge settings
          if (gaugeValue >= this.widgetProperties.config.maxValue) {
            this.gaugeValue = this.widgetProperties.config.maxValue;
          } else if (gaugeValue <= this.widgetProperties.config.minValue) {
            this.gaugeValue = this.widgetProperties.config.minValue;
          } else {
            this.gaugeValue = gaugeValue;
          }
        }
      );
    } catch (error) {
      console.log(error);
    }
  }

  unsubscribePath() {
    if (this.valueSub$ !== null) {
      this.valueSub$.unsubscribe();
      this.valueSub$ = null;
      this.widgetBaseService.signalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['gaugePath'].path)
    }
  }

  ngOnDestroy() {
    this.unsubscribePath();
  }

}
