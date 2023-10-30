import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { Subscription } from 'rxjs';

import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-simple-linear',
  templateUrl: './widget-simple-linear.component.html',
  styleUrls: ['./widget-simple-linear.component.scss']
})
export class WidgetSimpleLinearComponent extends BaseWidgetComponent implements OnInit, OnDestroy, OnChanges {
  public unitsLabel:string = "";
  public dataValue: string = "0";
  public gaugeValue: Number = 0;
  public barColor: string = "";
  public barColorGradient: string = "";
  public barColorBackground: string = "";

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
          convertUnitTo: "v",
          sampleTime: 500
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
  }

  ngOnInit(): void {
    this.createDataOservable();

    // set Units label sting based on gauge config
    if (this.widgetProperties.config.gaugeUnitLabelFormat == "abr") {
      //  TODO: fix label using group description for Full or measure for abr and not config conversion value as below!
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo.substr(0,1);
    } else {
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
    }

    this.observeDataStream('gaugePath', newValue => {
        if (newValue.value == null) {return}

        // convert to unit and format value using widget settings
        let value  = newValue.value.toFixed(this.widgetProperties.config.numDecimal);

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

  ngOnDestroy() {
    this.unsubscribeDataOservable();
  }
}
