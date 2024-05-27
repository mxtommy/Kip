import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { SvgSimpleLinearGaugeComponent } from '../svg-simple-linear-gauge/svg-simple-linear-gauge.component';

@Component({
    selector: 'app-widget-simple-linear',
    templateUrl: './widget-simple-linear.component.html',
    styleUrls: ['./widget-simple-linear.component.css'],
    standalone: true,
    imports: [SvgSimpleLinearGaugeComponent]
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
          showPathSkUnitsFilter: true,
          pathSkUnitsFilter: 'V',
          convertUnitTo: "V",
          sampleTime: 500
        }
      },
      displayScale: {
        lower: 0,
        upper: 15,
        type: "linear"
      },
      gauge: {
        type: 'simpleLinear',
        unitLabelFormat: "full", // Applied to Units label. abr = first letter only. full = full string
      },
      numInt: 1,
      numDecimal: 2,
      textColor: 'accent',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit(): void {
    this.initWidget();
    // set Units label sting based on gauge config
    if (this.widgetProperties.config.gauge.unitLabelFormat == "abr") {
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo.substr(0,1);
    } else {
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
    }

    this.observeDataStream('gaugePath', newValue => {
      if (newValue.data.value == null) {
        this.dataValue = 0;
        this.dataLabelValue = "--";
      } else {
        this.dataValue = Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);
        this.dataLabelValue = this.dataValue.toFixed(this.widgetProperties.config.numDecimal)
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.theme) {
      this.updateGaugeSettings();
    }
  }

  updateGaugeSettings() {
    this.barColorBackground = this.theme.background;

    switch (this.widgetProperties.config.textColor) {
      case "text":
        this.barColor = this.theme.text;
        this.barColorGradient = this.theme.textDark;
        break;
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
