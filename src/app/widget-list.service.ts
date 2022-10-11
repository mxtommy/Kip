import { Injectable } from '@angular/core';

import { WidgetBlankComponent } from './widget-blank/widget-blank.component';
import { WidgetUnknownComponent } from './widget-unknown/widget-unknown.component';
import { WidgetNumericComponent } from './widget-numeric/widget-numeric.component';
import { WidgetTextGenericComponent } from './widget-text-generic/widget-text-generic.component';
import { WidgetHistoricalComponent } from './widget-historical/widget-historical.component';
import { WidgetWindComponent } from './widget-wind/widget-wind.component';
import { WidgetGaugeComponent } from './widget-gauge/widget-gauge.component';
import { WidgetStateComponent } from './widget-state/widget-state.component';
import { WidgetSwitchComponent } from './widget-switch/widget-switch.component';
import { WidgetIframeComponent } from './widget-iframe/widget-iframe.component';
import { WidgetTutorialComponent } from './widget-tutorial/widget-tutorial.component';
import { WidgetGaugeNgLinearComponent} from './widget-gauge-ng-linear/widget-gauge-ng-linear.component';
import { WidgetGaugeNgRadialComponent} from './widget-gauge-ng-radial/widget-gauge-ng-radial.component';
import { WidgetAutopilotComponent } from "./widget-autopilot/widget-autopilot.component";
import { WidgetSimpleLinearComponent } from "./widget-simple-linear/widget-simple-linear.component";
import { WidgetRaceTimerComponent } from './widget-race-timer/widget-race-timer.component';

class widgetInfo {
  name: string;
  componentName;
  description: string;
}

export class widgetList {
  [groupname: string]: widgetInfo[];
}


@Injectable()
export class WidgetListService {

  constructor() { }


  widgetList: widgetList = {
    "Basic": [
      {
        name: 'WidgetBlank',
        componentName: WidgetBlankComponent,
        description: 'Blank',
      },
      {
        name: 'WidgetNumeric',
        componentName: WidgetNumericComponent,
        description: 'Numeric Value',
      },
      {
        name: 'WidgetTextGeneric',
        componentName: WidgetTextGenericComponent,
        description: 'Text Value',
      },
      {
        name: 'WidgetStateComponent',
        componentName: WidgetStateComponent,
        description: 'State (boolean) Value',
      },
    ],
    "Gauge": [
      {
        name: 'WidgetSimpleLinearComponent',
        componentName: WidgetSimpleLinearComponent,
        description: "Linear Electrical Gauge"
      },
      {
        name: 'WidgetGaugeNgLinearComponent',
        componentName: WidgetGaugeNgLinearComponent,
        description: "Linear Gauge"
      },
      {
        name: 'WidgetGaugeNgRadialComponent',
        componentName: WidgetGaugeNgRadialComponent,
        description: "Radial Gauge"
      },
      {
        name: 'WidgetGaugeComponent',
        componentName: WidgetGaugeComponent,
        description: "Steel Gauge (Radial/Linear)"
      },
    ],
    "Components": [
      {
        name: 'WidgetHistorical',
        componentName: WidgetHistoricalComponent,
        description: 'Historical DataSet',
      },
      {
        name: 'WidgetWindComponent',
        componentName: WidgetWindComponent,
        description: 'Wind Gauge',
      },
      {
        name: 'WidgetAutopilotComponent',
        componentName: WidgetAutopilotComponent,
        description: 'N2k Autopilot',
      },
      {
          name: 'WidgetRaceTimerComponent',
          componentName: WidgetRaceTimerComponent,
          description: "Race Timer"
      },
      {
        name: 'WidgetIframeComponent',
        componentName: WidgetIframeComponent,
        description: 'Embed Webpage',
      },
      {
        name: 'WidgetTutorial',
        componentName: WidgetTutorialComponent,
        description: 'Tutorial'
      }
    ]
  };

/*
    {
      name: 'WidgetSwitchComponent',
      componentName: WidgetSwitchComponent,
      description: 'Switch Input',
    },  */

  getComponentName(typeName: string) {
    for (let [group, widgetList] of Object.entries(this.widgetList)) {
      let widget = widgetList.find(c => c.name == typeName);
      if (widget) { return widget.componentName; }
    }
    return WidgetUnknownComponent;
  }


  getList (){
    return this.widgetList;
  }
}
