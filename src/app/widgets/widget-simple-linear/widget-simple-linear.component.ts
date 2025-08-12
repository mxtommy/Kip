import { Component, OnInit, OnDestroy, effect, signal, inject } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IDataHighlight, IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { SvgSimpleLinearGaugeComponent } from '../svg-simple-linear-gauge/svg-simple-linear-gauge.component';
import { States } from '../../core/interfaces/signalk-interfaces';
import { Subscription } from 'rxjs';
import { getColors } from '../../core/utils/themeColors.utils';
import { isEqual } from 'lodash-es';
import { getHighlights } from '../../core/utils/zones-highlight.utils';
import { UnitsService } from '../../core/services/units.service';


@Component({
    selector: 'widget-simple-linear',
    templateUrl: './widget-simple-linear.component.html',
    styleUrls: ['./widget-simple-linear.component.css'],
    imports: [ WidgetHostComponent, SvgSimpleLinearGaugeComponent ]
})
export class WidgetSimpleLinearComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  private  readonly _units = inject(UnitsService);
  protected readonly unitsLabel = signal<string>("");
  protected readonly dataLabelValue = signal<string>("0");
  protected readonly dataValue = signal<number>(null);
  protected readonly barColor = signal<string>("");
  protected readonly barColorGradient = signal<string>("");
  protected readonly barColorBackground = signal<string>("");
  protected readonly highlights = signal<IDataHighlight[]>([], {equal: isEqual});
  private zonesSub: Subscription;

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
      ignoreZones: false,
      color: 'contrast',
      enableTimeout: false,
      dataTimeout: 5
    };

    effect(() => {
      if (this.theme()) {
        this.updateGaugeSettings();
        this.startWidget();
      }
    });
  }

  ngOnInit(): void {
    this.validateConfig();
    this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.unsubscribeMetaStream();
    this.zonesSub?.unsubscribe();
    // set Units label sting based on gauge config
    if (this.widgetProperties.config.gauge.unitLabelFormat == "abr") {
      this.unitsLabel.set(this.widgetProperties.config.paths['gaugePath'].convertUnitTo.substr(0,1));
    } else {
      this.unitsLabel.set(this.widgetProperties.config.paths['gaugePath'].convertUnitTo);
    }

    this.observeDataStream('gaugePath', newValue => {
      if (newValue.data.value == null) {
        this.dataValue.set(this.widgetProperties.config.displayScale.lower);
        this.dataLabelValue.set("--");
      } else {
        this.dataValue.set(Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper));
        this.dataLabelValue.set(this.dataValue().toFixed(this.widgetProperties.config.numDecimal));
      }

      if (!this.widgetProperties.config.ignoreZones) {
        switch (newValue.state) {
          case States.Alarm:
            this.barColor.set(this.theme().zoneAlarm);
            break;
          case States.Warn:
            this.barColor.set(this.theme().zoneWarn);
            break;
          case States.Alert:
            this.barColor.set(this.theme().zoneAlert);
            break;
          case States.Nominal:
            this.barColor.set(this.theme().zoneNominal);
            break;
          default:
            this.barColor.set(getColors(this.widgetProperties.config.color, this.theme()).color);
        }
      }
    });

    if (!this.widgetProperties.config.ignoreZones) {
      this.observeMetaStream();
      this.zonesSub = this.zones$.subscribe(zones => {
        if (zones && zones.length > 0) {
          this.highlights.set(getHighlights(zones, this.theme(), this.widgetProperties.config.paths['gaugePath'].convertUnitTo, this._units, this.widgetProperties.config.displayScale.lower, this.widgetProperties.config.displayScale.upper));
        } else {
          this.highlights.set([]);
        }
      });
    }
    else {
      this.highlights.set([]);
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.updateGaugeSettings();
    this.startWidget();
  }

  private updateGaugeSettings() {
    this.barColorBackground.set(this.theme().background);
    switch (this.widgetProperties.config.color) {
      case "contrast":
        this.barColor.set(this.theme().contrast);
        this.barColorGradient.set(this.theme().contrastDimmer);
        break;
      case "blue":
        this.barColor.set(this.theme().blue);
        this.barColorGradient.set(this.theme().blueDimmer);
        break;
      case "green":
        this.barColor.set(this.theme().green);
        this.barColorGradient.set(this.theme().greenDimmer);
        break;
      case "pink":
        this.barColor.set(this.theme().pink);
        this.barColorGradient.set(this.theme().pinkDimmer);
        break;
      case "orange":
        this.barColor.set(this.theme().orange);
        this.barColorGradient.set(this.theme().orangeDimmer);
        break;
      case "purple":
        this.barColor.set(this.theme().purple);
        this.barColorGradient.set(this.theme().purpleDimmer);
        break;
      case "grey":
        this.barColor.set(this.theme().grey);
        this.barColorGradient.set(this.theme().greyDimmer);
        break;
      case "yellow":
        this.barColor.set(this.theme().yellow);
        this.barColorGradient.set(this.theme().yellowDimmer);
        break;
      default:
        this.barColor.set(this.theme().contrast);
        this.barColorGradient.set(this.theme().contrastDimmer);
    }
  }

  ngOnDestroy() {
    this.destroyDataStreams();
    this.unsubscribeMetaStream();
    this.zonesSub?.unsubscribe();
  }
}
