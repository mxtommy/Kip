import { Injectable } from '@angular/core';

const categories = ["Basic", "Gauges", "Components"] as ["Basic", "Gauges", "Components"];
export type TWidgetCategories = typeof categories[number];
export enum WidgetCategories {
  Basic = "Basic",
  Gauges = "Gauges",
  Components = "Components"
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
  private readonly _widgetCategories = ["Basic", "Gauges", "Components"];
  private _widgetDefinition: Array<WidgetDescription> = [
    {
      name: 'Numeric',
      description: 'Displays numeric data',
      icon: 'numericWidget',
      category: 'Basic',
      selector: 'widget-numeric',
      componentClassName: 'WidgetNumericComponent'
    },
    {
      name: 'Text',
      description: 'Displays numeric data',
      icon: 'textWidget',
      category: 'Basic',
      selector: 'widget-text',
      componentClassName: 'WidgetTextComponent'
    },
    {
      name: 'Date & Time',
      description: 'Displays Date & Time data',
      icon: 'datetimeWidget',
      category: 'Basic',
      selector: 'widget-datetime',
      componentClassName: 'WidgetDatetimeComponent'
    },
    {
      name: 'Switch Panel',
      description: 'A multi switch control panel',
      icon: 'switchpanelWidget',
      category: 'Basic',
      selector: 'widget-boolean-switch',
      componentClassName: 'WidgetBooleanSwitchComponent'
    },
    {
      name: 'Simple Linear',
      description: "A simple horizontal linear gauge with a large value label",
      icon: 'simpleLinearGauge',
      category: 'Gauges',
      selector: 'widget-simple-linear',
      componentClassName: 'WidgetSimpleLinearComponent'
    },
    {
      name: 'Linear',
      description: 'A horizontal or vertical linear gauge',
      icon: 'linearGauge',
      category: 'Gauges',
      selector: 'widget-gauge-ng-linear',
      componentClassName: 'WidgetGaugeNgLinearComponent'
    },
    {
      name: 'Radial',
      description: 'A typical radial gauge',
      icon: 'radialGauge',
      category: 'Gauges',
      selector: 'widget-gauge-ng-radial',
      componentClassName: 'WidgetGaugeNgRadialComponent'
    },
    {
      name: 'Compass',
      description: 'A faceplate or card rotating compass',
      icon: 'compassGauge',
      category: 'Gauges',
      selector: 'widget-gauge-ng-compass',
      componentClassName: 'WidgetGaugeNgCompassComponent'
    },
    {
      name: 'Steel Style',
      description: 'Traditional steel looking linear & radial gauges',
      icon: 'steelGauge',
      category: 'Gauges',
      selector: 'widget-gauge-steel',
      componentClassName: 'WidgetSteelGaugeComponent'
    },
    {
      name: 'Wind Steering',
      description: 'A wind steering display that combines wind, wind sectors, heading, course over ground and next waypoint information',
      icon: 'windsteeringWidget',
      category: 'Components',
      selector: 'widget-wind-steer',
      componentClassName: 'WidgetWindComponent'
    },
    {
      name: 'Freeboard-SK',
      description: 'Freeboard-SK Chart Plotter integration widget',
      icon: 'freeboardWidget',
      category: 'Components',
      selector: 'widget-freeboardsk',
      componentClassName: 'WidgetFreeboardskComponent'
    },
    {
      name: 'Autopilot Head',
      description: 'An Autopilot Head for supported Signal K autopilot devices',
      icon: 'autopilotWidget',
      category: 'Components',
      selector: 'widget-autopilot',
      componentClassName: 'WidgetAutopilotComponent'
    },
    {
      name: 'Data Chart',
      description: 'Visualize data on a chart with multiple series. Requires KIP Dataset configuration.',
      icon: 'datachartWidget',
      category: 'Components',
      selector: 'widget-data-chart',
      componentClassName: 'WidgetDataChartComponent'
    },
    {
      name: 'Race Timer',
      description: "A simple race start countdown timer",
      icon: 'racetimerWidget',
      category: 'Components',
      selector: 'widget-racetimer',
      componentClassName: 'WidgetRaceTimerComponent',
    },
    {
      name: 'Embed Webpage',
      description: 'Use to embed webpage any accessible web page',
      icon: 'embedWidget',
      category: 'Components',
      selector: 'widget-iframe',
      componentClassName: 'WidgetIframeComponent',
    },
    {
      name: 'Tutorial',
      description: "KIP's getting started introduction tutorial widget",
      icon: 'tutorialWidget',
      category: 'Components',
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
