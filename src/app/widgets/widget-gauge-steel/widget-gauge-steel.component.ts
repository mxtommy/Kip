import { Component, OnInit, OnDestroy } from '@angular/core';
import { BaseWidgetComponent } from '../../core/utils/base-widget.component';
import { WidgetHostComponent } from '../../core/components/widget-host/widget-host.component';
import { IWidgetSvcConfig } from '../../core/interfaces/widgets-interface';
import { GaugeSteelComponent } from '../gauge-steel/gauge-steel.component';
import { Subscription } from 'rxjs';
import { ISkZone } from '../../core/interfaces/signalk-interfaces';

@Component({
    selector: 'widget-gauge-steel',
    templateUrl: './widget-gauge-steel.component.html',
    styleUrls: ['./widget-gauge-steel.component.scss'],
    imports: [WidgetHostComponent, GaugeSteelComponent]
})
export class WidgetSteelGaugeComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  protected dataValue = 0;
  protected zones: ISkZone[] = [];

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
      numDecimal: 2,
      enableTimeout: false,
      dataTimeout: 5,
      ignoreZones: false
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.startWidget();
  }

  protected startWidget(): void {
    this.unsubscribeDataStream();
    this.unsubscribeMetaStream();
    this.metaSub?.unsubscribe();

    this.observeDataStream('gaugePath', newValue => {
      if (!newValue || !newValue.data) {
        newValue = {
          data: {
            value: 0,
            timestamp: new Date(),
          },
          state: "normal" // Default state
        };
      }

      // Compound value to displayScale
      this.dataValue = Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);
    });

    if (!this.widgetProperties.config.ignoreZones) {
      this.observeMetaStream();
      this.metaSub = this.zones$.subscribe(zones => {
        if (zones) {
          if (zones.length > 0) {
          this.zones = zones;
          } else {
            this.zones = [];
          }
        } else {
          this.zones = [];
        }
      });
    } else {
      this.zones = [];
    }
  }

  protected updateConfig(config: IWidgetSvcConfig): void {
    this.widgetProperties.config = config;
    this.startWidget();
  }

  ngOnDestroy() {
    this.destroyDataStreams();
    this.metaSub?.unsubscribe();
  }
}
