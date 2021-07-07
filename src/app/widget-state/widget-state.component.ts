import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';

import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { SignalKService } from '../signalk.service';
import { SignalkRequestsService, skRequest } from '../signalk-requests.service';
import { WidgetManagerService, IWidget, IWidgetConfig } from '../widget-manager.service';


const defaultConfig: IWidgetConfig = {
  displayName: null,
  filterSelfPaths: true,
  paths: {
    "boolPath": {
      description: "Boolean Data",
      path: null,
      source: null,
      pathType: "boolean",
      isPathConfigurable: true,
      convertUnitTo: "unitless"
    }
  },
  putEnable: false,
  putMomentary: false,
  putMomentaryValue: true
};


@Component({
  selector: 'app-widget-state',
  templateUrl: './widget-state.component.html',
  styleUrls: ['./widget-state.component.scss']
})
export class WidgetStateComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  valueSub: Subscription = null;
  activeWidget: IWidget;
  config: IWidgetConfig;

  state: boolean = null;
  pressed = false;
  timeoutHandler;

  skRequestSub = new Subscription; // Request result observer

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
    this.subscribeSKRequest();
  }

  subscribePath() {
    this.unsubscribePath();
    if (typeof(this.config.paths['boolPath'].path) != 'string') { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.config.paths['boolPath'].path, this.config.paths['boolPath'].source).subscribe(
      newValue => {
        this.state = newValue;
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.config.paths['boolPath'].path)
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

  handleClickDown() {
    if (!this.config.putEnable) { return; }

    if (!this.config.putMomentary) {
      //on/off mode. Send whatever we're not :)
      this.SignalkRequestsService.putRequest(
        this.config.paths['boolPath'].path,
        this.config.paths['boolPath'].source,
        this.widgetUUID
      );

      if (!this.state) {
        return;
      }
    } else {
      // momentary mode
      this.pressed = true;

      // send it once to start
      this.SignalkRequestsService.putRequest(this.config.paths['boolPath'].path, this.config.paths['boolPath'].source, this.widgetUUID);

      //send it again every 20ms
      this.timeoutHandler = setInterval(() => {
        this.SignalkRequestsService.putRequest(this.config.paths['boolPath'].path, this.config.paths['boolPath'].source, this.widgetUUID);
        this.config.putMomentaryValue;
      }, 100);

      return;
    }
  }

  handleClickUp() {
    if (!this.config.putEnable || !this.pressed) { return; }

    if (this.config.putMomentary) {
      this.pressed = false;
      clearInterval(this.timeoutHandler);
      // momentary mode
      this.SignalkRequestsService.putRequest(this.config.paths['boolPath'].path, this.config.paths['boolPath'].source, this.widgetUUID);
      if (!this.config.putMomentaryValue) {
        return;
      }
    }
  }

}
