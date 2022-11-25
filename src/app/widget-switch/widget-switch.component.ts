import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs';

import { MatDialog } from '@angular/material/dialog';

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { SignalKService } from '../signalk.service';
import { SignalkRequestsService, skRequest } from '../signalk-requests.service';
import { WidgetManagerService, IWidget, IWidgetSvcConfig } from '../widget-manager.service';


const defaultConfig: IWidgetSvcConfig = {
  displayName: null,
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

@Component({
  selector: 'app-widget-switch',
  templateUrl: './widget-switch.component.html',
  styleUrls: ['./widget-switch.component.css']
})
export class WidgetSwitchComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  activeWidget: IWidget;
  config: IWidgetSvcConfig;

  dataValue: number = null;
  dataTimestamp: number = Date.now();
  valueSub: Subscription = null;

  skRequestSub: Subscription = null;

  state: boolean = null;

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private SignalkRequestsService: SignalkRequestsService,
    private WidgetManagerService: WidgetManagerService) {
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
    this.subscribeSKRequest();
  }

  ngOnDestroy() {
    this.unsubscribePath();
    this.unsubscribeSKRequest();
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['statePath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['statePath'].path, this.config.paths['statePath'].source).subscribe(
      newValue => {
        this.state = newValue.value;
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['statePath'].path);
    }
  }

  subscribeSKRequest() {
    this.skRequestSub = this.SignalkRequestsService.subscribeRequest().subscribe(requestResult => {
      if (requestResult.widgetUUID == this.widgetUUID) {
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
   this.SignalkRequestsService.putRequest(this.config.paths['statePath'].path, value, this.widgetUUID);
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
