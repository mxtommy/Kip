import { Component, OnInit, OnDestroy } from '@angular/core';
import { BaseWidgetComponent } from '../../base-widget/base-widget.component';

@Component({
  selector: 'app-widget-gauge',
  templateUrl: './widget-gauge.component.html',
  styleUrls: ['./widget-gauge.component.css']
})
export class WidgetGaugeComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  dataValue: any = 0;

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
      frameColor: 'anthracite'
    };
  }

  ngOnInit() {
    this.observeDataStream('gaugePath', newValue => {
        this.dataValue = newValue.value
      }
    );
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
  }
}
