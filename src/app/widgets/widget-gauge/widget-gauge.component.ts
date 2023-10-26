import { WidgetBaseService } from '../../widget-base.service';
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { DynamicWidget, ITheme, IWidget, IWidgetSvcConfig } from '../../widgets-interface';

@Component({
  selector: 'app-widget-gauge',
  templateUrl: './widget-gauge.component.html',
  styleUrls: ['./widget-gauge.component.css']
})
export class WidgetGaugeComponent implements DynamicWidget, OnInit, OnDestroy {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;

  defaultConfig: IWidgetSvcConfig = {
    displayName: "Gauge Label",
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

  constructor(private widgetBaseService: WidgetBaseService) {
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

    this.valueSub = this.widgetBaseService.signalKService.subscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['gaugePath'].path, this.widgetProperties.config.paths['gaugePath'].source).subscribe(
      newValue => {
        this.dataValue = this.widgetBaseService.unitsService.convertUnit(this.widgetProperties.config.paths['gaugePath'].convertUnitTo, newValue.value);
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.widgetBaseService.signalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['gaugePath'].path)
    }
  }
}
