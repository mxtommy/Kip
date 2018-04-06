import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs/BehaviorSubject';

import { AppSettingsService } from './app-settings.service';

export interface IWidget {
  uuid: string;
  name?: string;
  type: string;
  config: IWidgetConfig;
}

export interface IWidgetConfig {
  paths: {
    [key: string]: ISignalKPathInfo;
  }
  units?: {
    [key: string]: string; // key should match key in paths, specifies unit for that path
  }
  widgetLabel?: string;
  selfPaths: boolean;

  //numeric data
  numDecimal?: number; // number of decimal places if a number
  numInt?: number;

  //Wind Gague data
  windSectorEnable?: boolean;
  windSectorWindowSeconds?: number;
  laylineEnable?: boolean;
  laylineAngle?: number;

  //gauge Data
  gaugeType?: string;
  barGraph?: boolean;
  radialSize?: string;
  minValue?: number;
  maxValue?: number;
  rotateFace?: boolean;
  backgroundColor?: string;
  frameColor?: string;
}

interface ISignalKPathInfo {
  description: string;
  path: string;       //can be null or set
  source: string;     //can be null or set
  pathType: string;
}



@Injectable()
export class WidgetManagerService {

  widgets: Array<IWidget>;

  constructor(
    private AppSettingsService: AppSettingsService
  ) {
    this.widgets = this.AppSettingsService.getWidgets();
  }



  private newUuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
            return v.toString(16);
        });
  }

  getWidget(uuid: string) {
      return this.widgets.find(w => w.uuid == uuid);
  }

  newWidget() {
    let uuid = this.newUuid();
    this.widgets.push({ uuid: uuid, type: "WidgetBlank", config: null });
    this.saveWidgets();
    return uuid; 
  }

  deleteWidget(uuid) {
    let wIndex = this.widgets.findIndex(w => w.uuid == uuid)
    if (wIndex < 0) { return; } // not found
    this.widgets.splice(wIndex, 1);
  }

  updateWidgetType(uuid: string, newNodeType: string) {
    let wIndex = this.widgets.findIndex(w => w.uuid == uuid)
    if (wIndex < 0) { return; } // not found
    this.widgets[wIndex].config = null;
    this.widgets[wIndex].type = newNodeType;
    this.saveWidgets();  
  }

  updateWidgetConfig(uuid: string, newConfig) {
    let wIndex = this.widgets.findIndex(w => w.uuid == uuid)
    if (wIndex < 0) { return; } // not found
    this.widgets[wIndex].config = newConfig;
    this.saveWidgets();
  }

  saveWidgets() {
    this.AppSettingsService.saveWidgets(this.widgets);
  }

}
