import { AppSettingsService } from './../../core/services/app-settings.service';
import { Component, OnInit, OnDestroy } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { GaugeSteelComponent } from '../gauge-steel/gauge-steel.component';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-widget-gauge',
    templateUrl: './widget-gauge.component.html',
    styleUrls: ['./widget-gauge.component.css'],
    standalone: true,
    imports: [GaugeSteelComponent]
})
export class WidgetGaugeComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  dataValue: any = 0;
  private zonesSub: Subscription = null;
  public zones = [];

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
        if (newValue.value == null) {
          newValue.value = 0;
        }
        this.dataValue = newValue.value
      }
    );


    // TODO: fix for new meta zones
    // this.zonesSub = this.settings.getZonesAsO().subscribe(
    //   zones => {
    //     let myZones: IZone[] = [];
    //     zones.forEach(zone => {
    //       // get zones for our path
    //       if (zone.path == this.widgetProperties.config.paths["gaugePath"].path) {
    //         myZones.push(zone);
    //       }
    //     })
    //     this.zones = myZones;
    //   });
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.zonesSub?.unsubscribe();
  }
}
