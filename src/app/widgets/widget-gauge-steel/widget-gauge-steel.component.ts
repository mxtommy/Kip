import { AppSettingsService } from '../../core/services/app-settings.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { GaugeSteelComponent } from '../gauge-steel/gauge-steel.component';
import { Subscription } from 'rxjs';
import { ISkMetadata } from '../../core/interfaces/signalk-interfaces';

@Component({
    selector: 'app-widget-gauge-steel',
    templateUrl: './widget-gauge-steel.component.html',
    styleUrls: ['./widget-gauge-steel.component.css'],
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
      textColor: 'accent',
      // numInt: 1,
      // numDecimal: 1,
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
        // Compound value to displayScale
        this.dataValue = Math.min(Math.max(newValue.data.value, this.widgetProperties.config.displayScale.lower), this.widgetProperties.config.displayScale.upper);
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
