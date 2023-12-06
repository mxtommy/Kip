import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';

import { BaseWidgetComponent } from '../../base-widget/base-widget.component';
import { SignalkRequestsService } from './../../signalk-requests.service';

@Component({
  selector: 'app-widget-switch',
  templateUrl: './widget-switch.component.html',
  styleUrls: ['./widget-switch.component.css']
})
export class WidgetSwitchComponent extends BaseWidgetComponent implements OnInit, OnDestroy {
  dataValue: number = null;
  dataTimestamp: number = Date.now();
  skRequestSub: Subscription = null;
  state: boolean = null;

  constructor(private signalkRequestsService: SignalkRequestsService) {
    super();

    this.defaultConfig = {
      displayName: 'Gauge Label',
      filterSelfPaths: true,
      paths: {
        "statePath": {
          description: "State Data",
          path: null,
          source: null,
          pathType: "boolean",
          isPathConfigurable: true,
          convertUnitTo: "unitless",
          sampleTime: 500
        }
      },
    };
  }

  ngOnInit() {
    this.validateConfig();
    this.observeDataStream('statePath', newValue => {
      this.state = newValue.value;
    });

    this.subscribeSKRequest();
  }

  ngOnDestroy() {
    this.unsubscribeDataStream();
    this.skRequestSub.unsubscribe();
  }

  subscribeSKRequest() {
    this.skRequestSub = this.signalkRequestsService.subscribeRequest().subscribe(requestResult => {
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

  sendDelta(value: boolean) {
   this.signalkRequestsService.putRequest(this.widgetProperties.config.paths['statePath'].path, value, this.widgetProperties.uuid);
  }

}
