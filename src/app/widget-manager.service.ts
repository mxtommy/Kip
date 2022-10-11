import { Injectable } from '@angular/core';
import { AppSettingsService } from './app-settings.service';
import { Format, Policy } from "./signalk-interfaces";

export interface IWidget {
  uuid: string;
  type: string;
  config: IWidgetSvcConfig;
}

export interface IWidgetSvcConfig {
  displayName?: string;
  filterSelfPaths?: boolean; //widget filter self paths only?
  paths?: {
    [key: string]: IWidgetPaths;
  },
  convertUnitTo?: string;
  usage?: {
    [key: string]: string[]; // Autopilot: key should match key in paths, specifies autopilot widget possible paths for AP mode
  },
  typeVal?: {
    [key: string]: string; // Autopilot: key should match key in paths, specifies autopilot widget paths value type for AP mode
  },

  //numeric data
  numDecimal?: number; // number of decimal places if a number
  numInt?: number;
  showMin?: boolean;
  showMax?: boolean;

  //Wind Gauge data
  windSectorEnable?: boolean;
  windSectorWindowSeconds?: number;
  laylineEnable?: boolean;
  laylineAngle?: number;

  //gauge Data
  gaugeType?: string;
  gaugeUnitLabelFormat?: string;
  gaugeTicks?: boolean;
  barGraph?: boolean;
  backgroundColor?: string;
  frameColor?: string;
  barColor?: string;
  radialSize?: string;
  minValue?: number;
  maxValue?: number;
  rotateFace?: boolean;
  autoStart?: boolean;
  compassUseNumbers?: boolean;

  //Historical
  dataSetUUID?: string;
  invertData?: boolean;
  displayMinMax?: boolean;
  animateGraph?: boolean;
  includeZero?: boolean;
  verticalGraph?: boolean;

  //Puts
  putEnable?: boolean;
  putMomentary?: boolean;
  putMomentaryValue?: boolean;

  //iFrame
  widgetUrl?: string;


  // Race Timer
  timerLength?: number;
}

interface IWidgetPaths {
  description: string;
  path: string | null;       //can be null or set
  source: string | null;     //can be null or set
  pathType: string  | null;
  pathFilter?: string,     //Future - use to filter path list ie. self.navigation.* or *.navigation.*.blabla.*
  convertUnitTo?: string;    // Convert SignalK value to specific format for display. Also used as a source to identify conversion group
  isPathConfigurable: boolean; // should we show this path in Widget Path config or is it static and hidden
  period?: number;    // SignalK - period=[millisecs] becomes the transmission rate, e.g. every period/1000 seconds. Default: 1000
  format?: Format;     // SignalK - format=[delta|full] specifies delta or full format. Default: delta
  policy?: Policy;     // SignalK - policy=[instant|ideal|fixed]. Default: ideal
  minPeriod?: number;  // SignalK - minPeriod=[millisecs] becomes the fastest message transmission rate allowed, e.g. every minPeriod/1000 seconds. This is only relevant for policy='instant' to avoid swamping the client or network.
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
