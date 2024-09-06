import { Component, OnInit, OnDestroy } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { GaugeSteelComponent } from '../gauge-steel/gauge-steel.component';
import { Subscription } from 'rxjs';

@Component({
    selector: 'widget-gauge-steel',
    templateUrl: './widget-gauge-steel.component.html',
    styleUrls: ['./widget-gauge-steel.component.scss'],
    standalone: true,
    imports: [WidgetHostComponent, GaugeSteelComponent]
})
export class WidgetSteelGaugeComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  dataValue: any = 0;

  protected zones = [];

  // Zones support
  private metaSub: Subscription;

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
          pathSkUnitsFilter: null,
          convertUnitTo: "unitless",
          sampleTime: 500
        }
      },
      displayScale: {
        type: 'linear',
        lower: 0,
        upper: 100
      },
      gauge: {
        type: 'steel',
        subType: 'radial',
        backgroundColor: 'carbon',
        faceColor: 'anthracite',
        radialSize: 'full',
        rotateFace: false,
        digitalMeter: false,
      },
      // numInt: 1,
      // numDecimal: 1,
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.initWidget();
    this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.metaSub?.unsubscribe();

    this.observeDataStream('gaugePath', newValue => {
      if (newValue.data.value == null) {
        newValue.data.value = 0;
      }
      // Compound value to displayScale
      this.dataValue = Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);
    });

    this.metaSub = this.zones$.subscribe(zones => {
      if (zones && zones.length > 0) {
        this.zones = zones;
      }
    });
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.metaSub?.unsubscribe();
  }
}
