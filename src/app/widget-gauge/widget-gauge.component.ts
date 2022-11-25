import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { SignalKService } from '../signalk.service';
import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetSvcConfig } from '../widget-manager.service';
import { UnitsService } from '../units.service';



const defaultConfig: IWidgetSvcConfig = {
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


@Component({
  selector: 'app-widget-gauge',
  templateUrl: './widget-gauge.component.html',
  styleUrls: ['./widget-gauge.component.css']
})
export class WidgetGaugeComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;


  activeWidget: IWidget;
  config: IWidgetSvcConfig;

  dataValue: any = null;

  valueSub: Subscription = null;

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private WidgetManagerService: WidgetManagerService,
    private UnitsService: UnitsService) {
  }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
    }
    this.subscribePath();

  }

  ngOnDestroy() {
    this.unsubscribePath();
  }


  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['gaugePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['gaugePath'].path, this.config.paths['gaugePath'].source).subscribe(
      newValue => {
        this.dataValue = this.UnitsService.convertUnit(this.config.paths['gaugePath'].convertUnitTo, newValue.value);
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['gaugePath'].path)
    }
  }

  openWidgetSettings() {

    let dialogRef = this.dialog.open(ModalWidgetComponent, {
      width: '80%',
      data: this.config
    });

    dialogRef.afterClosed().subscribe(result => {
      // save new settings
      if (result) {
        console.log(result);
        this.unsubscribePath();//unsub now as we will change variables so wont know what was subbed before...
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
        this.subscribePath();
      }

    });

  }


}
