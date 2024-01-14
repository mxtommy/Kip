import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-simple-linear',
  templateUrl: './widget-simple-linear.component.html',
  styleUrls: ['./widget-simple-linear.component.css']
})
export class WidgetSimpleLinearComponent extends BaseWidgetComponent implements OnInit, OnDestroy, OnChanges {
  public unitsLabel:string = "";
  public dataLabelValue: string = "0";
  public dataValue: Number = 0;
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
          convertUnitTo: "V",
          sampleTime: 500,
          isFilterFixed: false,
          unitGrpFilter: "Unitless"
        }
      },
      minValue: 0,
      maxValue: 15,
      numInt: 1,
      numDecimal: 2,
      gaugeType: "simpleLinear", // Applied to Units label. abr = first letter only. full = full string
      gaugeUnitLabelFormat: "full", // Applied to Units label. abr = first letter only. full = full string
      barColor: 'accent',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit(): void {
    this.validateConfig();
    // set Units label sting based on gauge config
    if (this.widgetProperties.config.gaugeUnitLabelFormat == "abr") {
      //  TODO: Improve Units service to have Full Measure label, abbreviation and descriptions so that we can use Full or abr display labels...!
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo.substr(0,1);
    } else {
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
    }

    this.observeDataStream('gaugePath', newValue => {
        if (newValue.value == null) {
          newValue.value = 0;
        }

        newValue.value = this.formatWidgetNumberValue(newValue.value);
        this.dataValue = (newValue.value as number);
        // Format Widget display label value using settings
        if (this.widgetProperties.config.numDecimal != 0){
          this.dataLabelValue = newValue.value.padStart((this.widgetProperties.config.numInt + 1 + this.widgetProperties.config.numDecimal), "0");
        } else {
          this.dataLabelValue = newValue.value.padStart(this.widgetProperties.config.numInt, "0");
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
    this.unsubscribeDataStream();
  }
}
