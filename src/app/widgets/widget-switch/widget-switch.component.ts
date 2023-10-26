import { DynamicWidget, ITheme } from '../../widgets-interface';
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { SignalkRequestsService } from '../../signalk-requests.service';
import { IWidget, IWidgetSvcConfig } from '../../widgets-interface';
import { WidgetBaseService } from '../../widget-base.service';


@Component({
  selector: 'app-widget-switch',
  templateUrl: './widget-switch.component.html',
  styleUrls: ['./widget-switch.component.css']
})
export class WidgetSwitchComponent implements DynamicWidget, OnInit, OnDestroy {
  @Input() theme!: ITheme;
  @Input() widgetProperties!: IWidget;

  defaultConfig: IWidgetSvcConfig = {
    displayName: 'Gauge Label',
    filterSelfPaths: true,
    paths: {
      "statePath": {
        description: "State Data",
        path: null,
        source: null,
        pathType: "boolean",
        isPathConfigurable: true,
        convertUnitTo: "unitless"
      }
    },
  };

  dataValue: number = null;
  dataTimestamp: number = Date.now();
  valueSub: Subscription = null;

  skRequestSub: Subscription = null;

  state: boolean = null;

  constructor(
    public widgetBaseService: WidgetBaseService,
    public SignalkRequestsService: SignalkRequestsService
    ) {
  }

  ngOnInit() {
    this.subscribePath();
    this.subscribeSKRequest();
  }

  ngOnDestroy() {
    this.unsubscribePath();
    this.unsubscribeSKRequest();
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.widgetProperties.config.paths['statePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.widgetBaseService.signalKService.subscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['statePath'].path, this.widgetProperties.config.paths['statePath'].source).subscribe(
      newValue => {
        this.state = newValue.value;
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.widgetBaseService.signalKService.unsubscribePath(this.widgetProperties.uuid, this.widgetProperties.config.paths['statePath'].path);
    }
  }

  subscribeSKRequest() {
    this.skRequestSub = this.SignalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetProperties.uuid) {
        if (requestResult.statusCode != 200){
          let errMsg = requestResult.statusCode + " - " +requestResult.statusCodeDescription;
          if (requestResult.message){
            errMsg = errMsg + " Server Message: " + requestResult.message;
          }
          alert('[Widget Name: ' + errMsg);
        } else {
          console.log("AP Received: \n" + JSON.stringify(requestResult));
        }
      }
    });
  }

  unsubscribeSKRequest() {
    this.skRequestSub.unsubscribe();
  }

  sendDelta(value: boolean) {
   this.SignalkRequestsService.putRequest(this.widgetProperties.config.paths['statePath'].path, value, this.widgetProperties.uuid);
  }

}
