import { Injectable } from '@angular/core';

import { WidgetBlankComponent } from '../../widgets/widget-blank/widget-blank.component';
import { WidgetUnknownComponent } from '../../widgets/widget-unknown/widget-unknown.component';
import { WidgetNumericComponent } from '../../widgets/widget-numeric/widget-numeric.component';
import { WidgetTextGenericComponent } from '../../widgets/widget-text-generic/widget-text-generic.component';
import { WidgetDateGenericComponent } from '../../widgets/widget-date-generic/widget-date-generic.component';
import { WidgetHistoricalComponent } from '../../widgets/widget-historical/widget-historical.component';
import { WidgetWindComponent } from '../../widgets/widget-wind/widget-wind.component';
import { WidgetGaugeComponent } from '../../widgets/widget-gauge/widget-gauge.component';
import { WidgetButtonComponent } from '../../widgets/widget-button/widget-button.component';
import { WidgetBooleanSwitchComponent } from '../../widgets/widget-boolean-switch/widget-boolean-switch.component'
import { WidgetIframeComponent } from '../../widgets/widget-iframe/widget-iframe.component';
import { WidgetTutorialComponent } from '../../widgets/widget-tutorial/widget-tutorial.component';
import { WidgetGaugeNgLinearComponent} from '../../widgets/widget-gauge-ng-linear/widget-gauge-ng-linear.component';
import { WidgetGaugeNgRadialComponent} from '../../widgets/widget-gauge-ng-radial/widget-gauge-ng-radial.component';
import { WidgetAutopilotComponent } from "../../widgets/widget-autopilot/widget-autopilot.component";
import { WidgetSimpleLinearComponent } from "../../widgets/widget-simple-linear/widget-simple-linear.component";
import { WidgetRaceTimerComponent } from '../../widgets/widget-race-timer/widget-race-timer.component';
import { WidgetDataChartComponent } from '../../widgets/widget-data-chart/widget-data-chart.component';

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
    'Basic': [
      {
        name: 'WidgetBlank',
        componentName: WidgetBlankComponent,
        description: 'Blank',
      },
      {
        name: 'WidgetNumeric',
        componentName: WidgetNumericComponent,
        description: 'Numeric',
      },
      {
        name: 'WidgetTextGeneric',
        componentName: WidgetTextGenericComponent,
        description: 'Text',
      },
      {
        name: 'WidgetDateGeneric',
        componentName: WidgetDateGenericComponent,
        description: 'Date & Time',
      },
      {
        name: 'WidgetBooleanSwitch',
        componentName: WidgetBooleanSwitchComponent,
        description: 'Boolean Control Panel',
      },
      {
        name: 'WidgetStateComponent',
        componentName: WidgetButtonComponent,
        description: 'Boolean Button/Switch',
      }
    ],
    'Gauge': [
      {
        name: 'WidgetSimpleLinearComponent',
        componentName: WidgetSimpleLinearComponent,
        description: "Simple Linear"
      },
      {
        name: 'WidgetGaugeNgLinearComponent',
        componentName: WidgetGaugeNgLinearComponent,
        description: 'Linear'
      },
      {
        name: 'WidgetGaugeNgRadialComponent',
        componentName: WidgetGaugeNgRadialComponent,
        description: 'Radial'
      },
      {
        name: 'WidgetGaugeComponent',
        componentName: WidgetGaugeComponent,
        description: "Linear & Radial Steel Style"
      },
    ],
    'Component': [
      {
        name: 'WidgetWindComponent',
        componentName: WidgetWindComponent,
        description: 'Wind Steering Display',
      },
      {
        name: 'WidgetDataChart',
        componentName: WidgetDataChartComponent,
        description: 'Data Chart',
      },
      {
        name: 'WidgetAutopilotComponent',
        componentName: WidgetAutopilotComponent,
        description: 'Autopilot Head',
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
