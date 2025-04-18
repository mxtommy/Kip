import { Component, OnInit, OnDestroy, effect } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SvgSimpleLinearGaugeComponent } from '../svg-simple-linear-gauge/svg-simple-linear-gauge.component';

@Component({
    selector: 'widget-simple-linear',
    templateUrl: './widget-simple-linear.component.html',
    styleUrls: ['./widget-simple-linear.component.css'],
    standalone: true,
    imports: [ WidgetHostComponent, SvgSimpleLinearGaugeComponent ]
})
export class WidgetSimpleLinearComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  protected unitsLabel:string = "";
  protected dataLabelValue: string = "0";
  protected dataValue: Number = 0;
  protected barColor: string = "";
  protected barColorGradient: string = "";
  protected barColorBackground: string = "";

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
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5
    };

    effect(() => {
      if (this.theme()) {
        this.updateGaugeSettings();
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
    this.startWidget();
  }

  protected startWidget(): void {
    // set Units label sting based on gauge config
    if (this.widgetProperties.config.gauge.unitLabelFormat == "abr") {
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo.substr(0,1);
    } else {
      this.unitsLabel = this.widgetProperties.config.paths['gaugePath'].convertUnitTo;
    }

    this.unsubscribeDataStream();
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

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  private updateGaugeSettings() {
    this.barColorBackground = this.theme().background;
    switch (this.widgetProperties.config.color) {
      case "contrast":
        this.barColor = this.theme().contrast;
        this.barColorGradient = this.theme().contrastDimmer;
        break;
      case "blue":
        this.barColor = this.theme().blue;
        this.barColorGradient = this.theme().blueDimmer;
        break;
      case "green":
        this.barColor = this.theme().green;
        this.barColorGradient = this.theme().greenDimmer;
        break;
      case "pink":
        this.barColor = this.theme().pink;
        this.barColorGradient = this.theme().pinkDimmer;
        break;
      case "orange":
        this.barColor = this.theme().orange;
        this.barColorGradient = this.theme().orangeDimmer;
        break;
      case "purple":
        this.barColor = this.theme().purple;
        this.barColorGradient = this.theme().purpleDimmer;
        break;
      case "grey":
        this.barColor = this.theme().grey;
        this.barColorGradient = this.theme().greyDimmer;
        break;
      case "yellow":
        this.barColor = this.theme().yellow;
        this.barColorGradient = this.theme().yellowDimmer;
        break;
      default:
        this.barColor = this.theme().contrast;
        this.barColorGradient = this.theme().contrastDimmer;
    }
  }

  ngOnDestroy() {
    this.destroyDataStreams();
  }
}
