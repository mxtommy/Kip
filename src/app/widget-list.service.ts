import { Injectable } from '@angular/core';

import { WidgetBlankComponent } from './widget-blank/widget-blank.component';
import { WidgetSplitComponent } from './widget-split/widget-split.component';
import { WidgetUnknownComponent } from './widget-unknown/widget-unknown.component';

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
      description: 'Blank'
    },
    {
      name: 'WidgetSplit',
      componentName: WidgetSplitComponent,
      description: 'Split in two'
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
