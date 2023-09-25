import { Component, OnInit, Input } from '@angular/core';
import {ModalWidgetComponent} from '../modal-widget/modal-widget.component';
import {MatDialog} from '@angular/material/dialog';
import { WidgetManagerService, IWidget, IWidgetSvcConfig } from '../widget-manager.service';

const defaultConfig: IWidgetSvcConfig = {
  displayName: ''
};

@Component({
  selector: 'app-widget-blank',
  templateUrl: './widget-blank.component.html',
  styleUrls: ['./widget-blank.component.scss']
})
export class WidgetBlankComponent implements OnInit {
  @Input('widgetUUID') widgetUUID: string;
  @Input('unlockStatus') unlockStatus: boolean;

  activeWidget: IWidget;
  config: IWidgetSvcConfig;

  constructor(
    public dialog: MatDialog,
    private WidgetManagerService: WidgetManagerService
  ) { }

  ngOnInit() {
    this.activeWidget = this.WidgetManagerService.getWidget(this.widgetUUID);
    if (this.activeWidget.config === null) {
      // no data, let's set some!
      this.WidgetManagerService.updateWidgetConfig(this.widgetUUID, defaultConfig);
      this.config = defaultConfig; // load default config.
    } else {
      this.config = this.activeWidget.config;
    }
  }


  openWidgetSettings() {

    const dialogRef = this.dialog.open(ModalWidgetComponent, {
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
