import { Injectable } from '@angular/core';

const categories = ["Basic", "Gauge", "Component"] as ["Basic", "Gauge", "Component"];
export type TWidgetCategories = typeof categories[number];
export enum WidgetCategories {
  Basic = "Basic",
  Gauge = "Gauge",
  Component = "Component"
}
export interface WidgetDescription {
  name: string;
  description: string;
  image?: string;
  icon?: string;
  category: TWidgetCategories;
  selector: string;
  componentClassName: string;
}

@Injectable({
  providedIn: 'root'
})
export class WidgetService {
  private readonly _widgetCategories = ["Basic", "Gauge", "Component"];
  private _widgetDefinition: Array<WidgetDescription> = [
    {
      name: 'Numeric',
      description: 'Displays numeric data',
      icon: 'pin',
      category: 'Basic',
      selector: 'widget-numeric',
      componentClassName: 'WidgetNumericComponent'
    },
    {
      name: 'Text',
      description: 'Displays numeric data',
      icon: 'text_fields',
      category: 'Basic',
      selector: 'widget-text',
      componentClassName: 'WidgetTextComponent'
    },
    {
      name: 'Date & Time',
      description: 'Displays Date & Time data',
      icon: 'calendar_month',
      category: 'Basic',
      selector: 'widget-datetime',
      componentClassName: 'WidgetDatetimeComponent'
    },
    {
      name: 'Switch Panel',
      description: 'A multi switch control panel',
      icon: 'toggle_on',
      category: 'Basic',
      selector: 'widget-boolean-switch',
      componentClassName: 'WidgetBooleanSwitchComponent'
    },
    {
      name: 'Simple Linear',
      description: "A simple horizontal linear gauge with a large value label",
      icon: 'speed',
      category: 'Gauge',
      selector: 'widget-simple-linear',
      componentClassName: 'WidgetSimpleLinearComponent'
    },
    {
      name: 'Linear',
      description: 'A horizontal or vertical linear gauge',
      icon: 'speed',
      category: 'Gauge',
      selector: 'widget-gauge-ng-linear',
      componentClassName: 'WidgetGaugeNgLinearComponent'
    },
    {
      name: 'Radial',
      description: 'A typical radial gauge',
      icon: 'speed',
      category: 'Gauge',
      selector: 'widget-gauge-ng-radial',
      componentClassName: 'WidgetGaugeNgRadialComponent'
    },
    {
      name: 'Compass',
      description: 'A faceplate or card rotating compass',
      icon: 'speed',
      category: 'Gauge',
      selector: 'widget-gauge-ng-compass',
      componentClassName: 'WidgetGaugeNgCompassComponent'
    },
    {
      name: 'Steel Style',
      description: 'Traditional steel looking linear & radial gauges',
      icon: 'speed',
      category: 'Gauge',
      selector: 'widget-gauge-steel',
      componentClassName: 'WidgetSteelGaugeComponent'
    },
    {
      name: 'Wind Steering',
      description: 'A wind steering display that combines wind, wind sectors, heading, course over ground and next waypoint information',
      icon: 'analytics',
      category: 'Component',
      selector: 'widget-wind-steer',
      componentClassName: 'WidgetWindComponent'
    },
    {
      name: 'Freeboard-SK',
      description: 'Freeboard-SK Chart Plotter integration widget',
      icon: 'analytics',
      category: 'Component',
      selector: 'widget-freeboardsk',
      componentClassName: 'WidgetFreeboardskComponent'
    },
    {
      name: 'Autopilot Head',
      description: 'An Autopilot Head for supported Signal K autopilot devices',
      icon: 'analytics',
      category: 'Component',
      selector: 'widget-autopilot',
      componentClassName: 'WidgetAutopilotComponent'
    },
    {
      name: 'Data Chart',
      description: 'Visualize data on a chart with multiple series. Requires KIP Dataset configuration.',
      icon: 'analytics',
      category: 'Component',
      selector: 'widget-data-chart',
      componentClassName: 'WidgetDataChartComponent'
    },
    {
      name: 'Race Timer',
      description: "A simple race start countdown timer",
      icon: 'analytics',
      category: 'Component',
      selector: 'widget-racetimer',
      componentClassName: 'WidgetRaceTimerComponent',
    },
    {
      name: 'Embed Webpage',
      description: 'Use to embed webpage any accessible web page',
      icon: 'analytics',
      category: 'Component',
      selector: 'widget-iframe',
      componentClassName: 'WidgetIframeComponent',
    },
    {
      name: 'Tutorial',
      description: "KIP's getting started introduction tutorial widget",
      icon: 'analytics',
      category: 'Component',
      selector: 'widget-tutorial',
      componentClassName: 'WidgetTutorialComponent',
    }
  ];

  get kipWidgets(): Array<WidgetDescription> {
    return this._widgetDefinition;
  }

  get categories(): string[] {
    return this._widgetCategories;
  }
}
