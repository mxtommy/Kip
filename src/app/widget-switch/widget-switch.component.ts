import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { Subscription } from 'rxjs/Subscription';
import {MatDialog,MatDialogRef,MAT_DIALOG_DATA } from '@angular/material';

import { SignalKService, pathObject } from '../signalk.service';
import { SignalKConnectionService } from '../signalk-connection.service';
import { WidgetManagerService, IWidget } from '../widget-manager.service';


interface widgetConfig {
  signalKPath: string;
  signalKSource: string;
  label: string;
}



@Component({
  selector: 'app-widget-switch',
  templateUrl: './widget-switch.component.html',
  styleUrls: ['./widget-switch.component.css']
})
export class WidgetSwitchComponent implements OnInit, OnDestroy {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  valueSub: Subscription = null;
  activeWidget: IWidget;
  
  state: boolean = null;

  widgetConfig: widgetConfig = {
    signalKPath: null,
    signalKSource: 'default',
    label: null
  }

  constructor(
    public dialog:MatDialog,
    private SignalKService: SignalKService,
    private SignalKConnectionService: SignalKConnectionService,
    private WidgetManagerService: WidgetManagerService) {
  }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
        // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.widgetConfig);
    } else {
      this.widgetConfig = this.activeWidget.config; // load existing config.
    }
    this.subscribePath();
  }

  ngOnDestroy() {
    this.unsubscribePath();
  }

  subscribePath() {
    this.unsubscribePath();
    if (this.widgetConfig.signalKPath === null) { return } // nothing to sub to...

    this.valueSub = this.SignalKService.subscribePath(this.widgetUUID, this.widgetConfig.signalKPath).subscribe(
      pathObject => {
        if (pathObject === null) {
          return; // we will get null back if we subscribe to a path before the app knows about it. when it learns about it we will get first value
        }
        let source: string;
        if (this.widgetConfig.signalKSource == 'default') {
          source = pathObject.defaultSource;
        } else {
          source = this.widgetConfig.signalKSource;
        }


        if (pathObject.sources[source].value === null) {
          this.state = null;
        }

        this.state = pathObject.sources[source].value;
        
      }
    );
  }

  unsubscribePath() {
    if (this.valueSub !== null) {
      this.valueSub.unsubscribe();
      this.valueSub = null;
      this.SignalKService.unsubscribePath(this.widgetUUID, this.widgetConfig.signalKPath)
    }
  }


  sendDelta(value: boolean) {
    this.SignalKConnectionService.publishDelta("pushBool", value);
  }

}
