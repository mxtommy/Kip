import { Injectable } from '@angular/core';
import { IWidget, IWidgetSvcConfig } from '../interfaces/widgets-interface';
import { UUID } from '../utils/uuid'

import { WidgetBlankComponent } from '../../widgets/widget-blank/widget-blank.component';
import { WidgetUnknownComponent } from '../../widgets/widget-unknown/widget-unknown.component';
import { WidgetNumericComponent } from '../../widgets/widget-numeric/widget-numeric.component';
import { WidgetTextGenericComponent } from '../../widgets/widget-text-generic/widget-text-generic.component';
import { WidgetDateGenericComponent } from '../../widgets/widget-date-generic/widget-date-generic.component';
import { WidgetWindComponent } from '../../widgets/widget-wind/widget-wind.component';
import { WidgetGaugeComponent } from '../../widgets/widget-gauge-steel/widget-gauge-steel.component';
import { WidgetBooleanSwitchComponent } from '../../widgets/widget-boolean-switch/widget-boolean-switch.component'
import { WidgetIframeComponent } from '../../widgets/widget-iframe/widget-iframe.component';
import { WidgetTutorialComponent } from '../../widgets/widget-tutorial/widget-tutorial.component';
import { WidgetGaugeNgLinearComponent} from '../../widgets/widget-gauge-ng-linear/widget-gauge-ng-linear.component';
import { WidgetGaugeNgRadialComponent} from '../../widgets/widget-gauge-ng-radial/widget-gauge-ng-radial.component';
import { WidgetAutopilotComponent } from "../../widgets/widget-autopilot/widget-autopilot.component";
import { WidgetSimpleLinearComponent } from "../../widgets/widget-simple-linear/widget-simple-linear.component";
import { WidgetRaceTimerComponent } from '../../widgets/widget-race-timer/widget-race-timer.component';
import { WidgetDataChartComponent } from '../../widgets/widget-data-chart/widget-data-chart.component';
import { WidgetFreeboardskComponent } from '../../widgets/widget-freeboardsk/widget-freeboardsk.component';
import { WidgetGaugeNgCompassComponent } from '../../widgets/widget-gauge-ng-compass/widget-gauge-ng-compass.component';


interface widgetInfo {
  name: string;
  description: string;
  category: string;
  componentClassName: string;
}

@Injectable({
  providedIn: 'root'
})
export class WidgetService {
  private _widgetDefinition: Array<widgetInfo> = [
    {
      name: 'WidgetNumeric',
      description: 'Numeric',
      category: 'Basic',
      componentClassName: 'WidgetNumericComponent'
    },
    {
      name: 'WidgetTextGeneric',
      description: 'Text',
      category: 'Basic',
      componentClassName: 'WidgetTextGenericComponent'
    },
    {
      name: 'WidgetDateGeneric',
      description: 'Date & Time',
      category: 'Basic',
      componentClassName: 'WidgetDateGenericComponent'
    },
    {
      name: 'WidgetBooleanSwitch',
      description: 'Boolean Control Panel',
      category: 'Basic',
      componentClassName: 'WidgetBooleanSwitchComponent'
    },
    {
      name: 'WidgetBlank',
      description: 'Blank',
      category: 'Basic',
      componentClassName: 'WidgetBlankComponent'
    },
    {
      name: 'WidgetSimpleLinearComponent',
      description: "Simple Linear",
      category: 'Gauge',
      componentClassName: 'WidgetSimpleLinearComponent'
    },
    {
      name: 'WidgetGaugeNgLinearComponent',
      description: 'Linear',
      category: 'Gauge',
      componentClassName: 'WidgetGaugeNgLinearComponent'
    },
    {
      name: 'WidgetGaugeNgRadialComponent',
      description: 'Radial',
      category: 'Gauge',
      componentClassName: 'WidgetGaugeNgRadialComponent'
    },
    {
      name: 'WidgetGaugeNgCompassComponent',
      description: "Compass",
      category: 'Gauge',
      componentClassName: 'WidgetGaugeNgCompassComponent'
    },
    {
      name: 'WidgetGaugeComponent',
      description: "Linear & Radial Steel Style",
      category: 'Gauge',
      componentClassName: 'WidgetGaugeComponent'
    },
    {
      name: 'WidgetWindComponent',
      description: 'Wind Steering Display',
      category: 'Component',
      componentClassName: 'WidgetWindComponent'
    },
    {
      name: 'WidgetFreeboardskComponent',
      description: 'Freeboard-SK Chart Plotter',
      category: 'Component',
      componentClassName: 'WidgetFreeboardskComponent'
    },
    {
      name: 'WidgetAutopilotComponent',
      description: 'Autopilot Head',
      category: 'Component',
      componentClassName: 'WidgetAutopilotComponent'
    },
    {
      name: 'WidgetDataChart',
      description: 'Data Chart',
      category: 'Component',
      componentClassName: 'WidgetDataChartComponent'
    },
    {
      name: 'WidgetRaceTimerComponent',
      description: "Race Timer",
      category: 'Component',
      componentClassName: 'WidgetRaceTimerComponent',
    },
    {
      name: 'WidgetIframeComponent',
      description: 'Embed Webpage',
      category: 'Component',
      componentClassName: 'WidgetIframeComponent',
    },
    {
      name: 'WidgetTutorial',
      description: 'Tutorial',
      category: 'Component',
      componentClassName: 'WidgetTutorialComponent',
    }
  ];

  constructor() {

  }

  public getWidgetDefinition(): Array<widgetInfo> {
    return this._widgetDefinition;
  }

  // /**
  //  * Creates and persists a new widget.
  //  *
  //  * @returns {string} The UUID of the newly created widget.
  //  */
  // public newWidget(): string {
  //   const uuid = UUID.create();
  //   this._oldWidgets.push({ uuid: uuid, type: 'WidgetBlank', config: {displayName: ''} });
  //   this.saveWidgets();
  //   return uuid;
  // }

  // public deleteWidget(uuid): void {
  //   const wIndex = this._oldWidgets.findIndex(w => w.uuid == uuid);
  //   if (wIndex < 0) { return; } // not found
  //   this._oldWidgets.splice(wIndex, 1);
  // }

  // public updateWidgetType(uuid: string, newNodeType: string): void {
  //   const wIndex = this._oldWidgets.findIndex(w => w.uuid == uuid);
  //   if (wIndex < 0) { return; } // not found
  //   this._oldWidgets[wIndex].config = null;
  //   this._oldWidgets[wIndex].type = newNodeType;
  //   this.saveWidgets();
  // }

  // public updateWidgetConfig(uuid: string, newConfig: IWidgetSvcConfig): void {
  //   const widget = this._oldWidgets.find(w => w.uuid == uuid);

  //   if (!widget) { return; } // not found

  //   widget.config = newConfig;
  //   this.saveWidgets();
  // }

  // //TODO: update or delete this method
  // public saveWidgets(): void {
  //   this.settings.saveWidgets(this._oldWidgets);
  // }

  // public getComponentName(typeName: string): any {
  //   for (let [group, widgetList] of Object.entries(this._oldWidgetList)) {
  //     let widget = widgetList.find(c => c.name == typeName);
  //     if (widget) { return widget.componentName; }
  //   }
  //   return WidgetUnknownComponent;
  // }

  // public getAllWidgetComponentClass(): Array<any> {
  //   const widgetClasses = Object.values(this._oldWidgetList)
  //     .flatMap(widgetGroup => widgetGroup.map(widget => widget.componentName));
  //   return widgetClasses;
  // }


  // public getList(): widgetList {
  //   return this._oldWidgetList;
  // }
}
