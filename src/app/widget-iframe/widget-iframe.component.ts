import { Component, Input, OnInit, OnDestroy, Inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';




import { ModalWidgetComponent } from '../modal-widget/modal-widget.component';
import { WidgetManagerService, IWidget, IWidgetSvcConfig } from '../widget-manager.service';

const defaultConfig: IWidgetSvcConfig = {
  widgetUrl: null
};

@Component({
  selector: 'app-widget-iframe',
  templateUrl: './widget-iframe.component.html',
  styleUrls: ['./widget-iframe.component.css']
})
export class WidgetIframeComponent implements OnInit {

  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  config: IWidgetSvcConfig;

  widgetUrl: string = null;
  activeWidget: IWidget;

  constructor(
    public dialog:MatDialog,
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
    this.widgetUrl = this.config.widgetUrl;
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
        this.config = result;
        this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, this.config);
      }
    });
  }

}
