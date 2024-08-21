import { Injectable } from '@angular/core';

interface widgetInfo {
  name: string;
  description: string;
  category: string;
  selector: string;
  componentClassName: string;
}

@Injectable({
  providedIn: 'root'
})
export class WidgetService {
  private _widgetDefinition: Array<widgetInfo> = [
    {
      name: 'Numeric',
      description: 'Displays numeric data',
      category: 'Basic',
      selector: 'widget-numeric',
      componentClassName: 'WidgetNumericComponent'
    },
    {
      name: 'Text',
      description: 'Displays numeric data',
      category: 'Basic',
      selector: 'widget-text',
      componentClassName: 'WidgetTextComponent'
    },
    {
      name: 'Date & Time',
      description: 'Displays Date & Time data',
      category: 'Basic',
      selector: 'widget-datetime',
      componentClassName: 'WidgetDatetimeComponent'
    },
    {
      name: 'Multi Switch Control Panel',
      description: 'A multi switch control panel',
      category: 'Basic',
      selector: 'widget-boolean-switch',
      componentClassName: 'WidgetBooleanSwitchComponent'
    },
    // {
    //   name: 'Blank Widget',
    //   description: 'A widget that can optionally display a static text',
    //   category: 'Basic',
    //   componentClassName: 'WidgetBlankComponent'
    // },
    // {
    //   name: 'Simple Linear',
    //   description: "A simple horizontal linear gauge with a large value label",
    //   category: 'Gauge',
    //   componentClassName: 'WidgetSimpleLinearComponent'
    // },
    // {
    //   name: 'Linear',
    //   description: 'A horizontal or vertical linear gauge',
    //   category: 'Gauge',
    //   componentClassName: 'WidgetGaugeNgLinearComponent'
    // },
    // {
    //   name: 'Radial',
    //   description: 'A typical radial',
    //   category: 'Gauge',
    //   componentClassName: 'WidgetGaugeNgRadialComponent'
    // },
    // {
    //   name: 'Compass',
    //   description: "A faceplate or card rotating compass",
    //   category: 'Gauge',
    //   componentClassName: 'WidgetGaugeNgCompassComponent'
    // },
    // {
    //   name: 'Linear & Radial Steel Style',
    //   description: "Traditional steel looking linear & radial gauges",
    //   category: 'Gauge',
    //   componentClassName: 'WidgetGaugeComponent'
    // },
    // {
    //   name: 'Wind Steering Display',
    //   description: 'A wind steering display that combines wind, wind sectors, heading, course over ground and next waypoint information',
    //   category: 'Component',
    //   componentClassName: 'WidgetWindComponent'
    // },
    // {
    //   name: 'Freeboard-SK Chart Plotter',
    //   description: 'Freeboard-SK Chart Plotter integration widget',
    //   category: 'Component',
    //   componentClassName: 'WidgetFreeboardskComponent'
    // },
    // {
    //   name: 'Autopilot Head',
    //   description: 'An Autopilot Head for supported Signal K autopilot devices',
    //   category: 'Component',
    //   componentClassName: 'WidgetAutopilotComponent'
    // },
    // {
    //   name: 'Data Chart',
    //   description: 'Visualize data on a chart with multiple series. Requires KIP Dataset configuration.',
    //   category: 'Component',
    //   componentClassName: 'WidgetDataChartComponent'
    // },
    // {
    //   name: 'Race Timer',
    //   description: "A simple race start countdown timer",
    //   category: 'Component',
    //   componentClassName: 'WidgetRaceTimerComponent',
    // },
    // {
    //   name: 'Embed Webpage',
    //   description: 'Use to embed webpage any accessible web page',
    //   category: 'Component',
    //   componentClassName: 'WidgetIframeComponent',
    // },
    // {
    //   name: 'Tutorial',
    //   description: "KIP's getting started introduction tutorial widget",
    //   category: 'Component',
    //   componentClassName: 'WidgetTutorialComponent',
    // }
  ];

  constructor() {

  }

  get getWidgetDefinition(): Array<widgetInfo> {
    return this._widgetDefinition;
  }

}
