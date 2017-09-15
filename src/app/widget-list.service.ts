import { Injectable } from '@angular/core';

import { WidgetBlankComponent } from './widget-blank/widget-blank.component';
import { WidgetSplitComponent } from './widget-split/widget-split.component';
import { WidgetUnknownComponent } from './widget-unknown/widget-unknown.component';
import { WidgetNumericComponent } from './widget-numeric/widget-numeric.component';
import { WidgetTextGenericComponent } from './widget-text-generic/widget-text-generic.component';
import { WidgetHistoricalComponent } from './widget-historical/widget-historical.component';

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
      name: 'WidgetSplit',
      componentName: WidgetSplitComponent,
      description: 'Layout Splitter',
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
      name: 'WidgetHistorical',
      componentName: WidgetHistoricalComponent,
      description: 'Historical DataSet',
    }
  ];

  getComponentName(typeName: string) {
    let type = this.widgetList.find(c => c.name == typeName).componentName;
    return type || WidgetUnknownComponent;
  }


  getList (){
    return this.widgetList;
  }
}
