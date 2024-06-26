import { Component, OnInit, OnDestroy, OnChanges, SimpleChanges } from '@angular/core';
import { BaseWidgetComponent } from '../../core/components/base-widget/base-widget.component';
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
      color: 'yellow',
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
    switch (this.widgetProperties.config.color) {
      case "white":
        this.barColor = this.theme.white;
        this.barColorGradient = this.theme.white;
        break;
      case "blue":
        this.barColor = this.theme.blue; // Assuming you have blue defined in your theme
        this.barColorGradient = this.theme.blue;
        break;
      case "green":
        this.barColor = this.theme.green; // Assuming you have green defined in your theme
        this.barColorGradient = this.theme.green;
        break;
      case "pink":
        this.barColor = this.theme.pink; // Assuming you have pink defined in your theme
        this.barColorGradient = this.theme.pink;
        break;
      case "orange":
        this.barColor = this.theme.orange; // Assuming you have orange defined in your theme
        this.barColorGradient = this.theme.orange;
        break;
      case "purple":
        this.barColor = this.theme.purple; // Assuming you have purple defined in your theme
        this.barColorGradient = this.theme.purple;
        break;
      case "grey":
        this.barColor = this.theme.grey; // Assuming you have gray defined in your theme
        this.barColorGradient = this.theme.grey;
        break;
      case "yellow":
        this.barColor = this.theme.yellow; // Assuming you have yellow defined in your theme
        this.barColorGradient = this.theme.yellow;
        break;
      default:
        this.barColor = this.theme.white;
        this.barColorGradient = this.theme.white;
        break;
    }
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
  }
}
