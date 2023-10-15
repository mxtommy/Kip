import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { SignalKService } from '../signalk.service';
import { IWidget, IWidgetSvcConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';


@Component({
  selector: 'app-widget-gauge',
  templateUrl: './widget-gauge.component.html',
  styleUrls: ['./widget-gauge.component.css']
})
export class WidgetGaugeComponent implements OnInit, OnDestroy {

  @Input('widgetProperties') widgetProperties!: IWidget;

  defaultConfig: IWidgetSvcConfig = {
    displayName: null,
    filterSelfPaths: true,
    paths: {
      "gaugePath": {
        description: "Numeric Data",
        path: null,
        source: null,
        pathType: "number",
        isPathConfigurable: true,
        convertUnitTo: "unitless"
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

  dataValue: any = null;
  valueSub: Subscription = null;

  constructor(
    private SignalKService: SignalKService,
    private UnitsService: UnitsService) {
  }

  ngOnInit() {
    this.subscribePath();
  }

  ngOnDestroy() {
    this.unsubscribePath();
  }


  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.widgetProperties.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['gaugePath'].path, this.widgetProperties.config.paths['gaugePath'].source).subscribe(
      newValue => {
        this.dataValue = this.UnitsService.convertUnit(this.widgetProperties.config.paths['gaugePath'].convertUnitTo, newValue.value);
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['gaugePath'].path)
    }
  }
}
