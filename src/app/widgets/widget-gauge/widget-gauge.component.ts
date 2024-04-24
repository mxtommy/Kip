import { AppSettingsService } from './../../core/services/app-settings.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { GaugeSteelComponent } from '../gauge-steel/gauge-steel.component';
import { Subscription } from 'rxjs';
import { ISkMetadata } from '../../core/interfaces/signalk-interfaces';

@Component({
    selector: 'app-widget-gauge',
    templateUrl: './widget-gauge.component.html',
    styleUrls: ['./widget-gauge.component.css'],
    standalone: true,
    imports: [GaugeSteelComponent]
})
export class WidgetGaugeComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  dataValue: any = 0;

  public zones = [];

  // Zones support
  private meta: ISkMetadata = null;
  private metaSub: Subscription;

  constructor(private settings: AppSettingsService) {
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
          convertUnitTo: "unitless",
          sampleTime: 500
        }
      },
      gaugeType: 'linear',
      barGraph: false,    // if linear/radial, is it digital?
      radialSize: 'full',
      minValue: 0,
      maxValue: 100,
      rotateFace: false,
      backgroundColor: 'carbon',
      frameColor: 'anthracite',
      enableTimeout: false,
      dataTimeout: 5
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.observeDataStream('gaugePath', newValue => {
        if (newValue.data.value == null) {
          newValue.data.value = 0;
        }
        this.dataValue = newValue.data.value
      }
    );

    this.metaSub = this.DataService.getPathMeta(this.widgetProperties.config.paths['gaugePath'].path).subscribe((meta: ISkMetadata) => {
      this.meta = meta || null;
      if (this.meta && this.meta.zones && this.meta.zones.length > 0) {
        let zonesArray = this.meta.zones.map(zone => zone);
        this.zones = zonesArray;
      }
    });
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.metaSub?.unsubscribe();
  }
}
