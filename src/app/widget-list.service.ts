import { Injectable } from '@angular/core';

import { WidgetBlankComponent } from './widget-blank/widget-blank.component';
import { WidgetUnknownComponent } from './widget-unknown/widget-unknown.component';
import { WidgetNumericComponent } from './widget-numeric/widget-numeric.component';
import { WidgetTextGenericComponent } from './widget-text-generic/widget-text-generic.component';
import { WidgetHistoricalComponent } from './widget-historical/widget-historical.component';
import { WidgetWindComponent } from './widget-wind/widget-wind.component';
import { WidgetGaugeComponent } from './widget-gauge/widget-gauge.component';
import { WidgetStateComponent } from './widget-state/widget-state.component';
import { WidgetTutorialComponent } from './widget-tutorial/widget-tutorial.component';

export class widgetInfo {
  name: string;
  componentName;
  description: string;
}




@Injectable()
export class WidgetListService {

  constructor() { }


 widgetList: widgetInfo[] = 
  [
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
    {
      name: 'WidgetGaugeComponent',
      componentName: WidgetGaugeComponent,
      description: "Gauge (Radial/Linear)"
    },
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
      name: 'WidgetTutorial',
      componentName: WidgetTutorialComponent,
      description: 'Tutorial'
    }
  ];

  getComponentName(typeName: string) {
    let type = this.widgetList.find(c => c.name == typeName).componentName;
    return type || WidgetUnknownComponent;
  }


  getList (){
    return this.widgetList.filter(w => w.name != 'WidgetTutorial');
  }
}
