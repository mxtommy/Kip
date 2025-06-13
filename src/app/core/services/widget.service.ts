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
      description: 'Displays numeric data in a clear and concise format with option to display minimum and maximum recorded values.',
      icon: 'numericWidget',
      category: 'Basic',
      selector: 'widget-numeric',
      componentClassName: 'WidgetNumericComponent'
    },
    {
      name: 'Text',
      description: 'Displays text data with customizable color formatting option.',
      icon: 'textWidget',
      category: 'Basic',
      selector: 'widget-text',
      componentClassName: 'WidgetTextComponent'
    },
    {
      name: 'Date & Time',
      description: 'Displays date and time data with fully custom formatting options and timezone correction.',
      icon: 'datetimeWidget',
      category: 'Basic',
      selector: 'widget-datetime',
      componentClassName: 'WidgetDatetimeComponent'
    },
    {
      name: 'Position',
      description: 'Displays latitude and longitude for location tracking and navigation.',
      icon: 'positionWidget',
      category: 'Basic',
      selector: 'widget-position',
      componentClassName: 'WidgetPositionComponent',
    },
    {
      name: 'Switch Panel',
      description: 'A switch panel group with multiple controls including toggle switches, indicator lights, and press buttons for digital switching ond other operations.',
      icon: 'switchpanelWidget',
      category: 'Basic',
      selector: 'widget-boolean-switch',
      componentClassName: 'WidgetBooleanSwitchComponent'
    },
    {
      name: 'Slider',
      description: 'A range slider that allows users to adjust values, such as controlling lighting intensity from 0% to 100%.',
      icon: 'sliderWidget',
      category: 'Basic',
      selector: 'widget-slider',
      componentClassName: 'WidgetSliderComponent'
    },
    {
      name: 'Static Label',
      description: 'A static text widget that allows you to add customizable labels to your dashboard, helping to organize and clarify your layout effectively.',
      icon: 'labelWidget',
      category: 'Basic',
      selector: 'widget-label',
      componentClassName: 'WidgetLabelComponent'
    },
    {
      name: 'Simple Linear',
      description: "A simple horizontal linear gauge with a large value label offering a clean, compact modern look.",
      icon: 'simpleLinearGauge',
      category: 'Gauges',
      selector: 'widget-simple-linear',
      componentClassName: 'WidgetSimpleLinearComponent'
    },
    {
      name: 'Linear',
      description: 'A horizontal or vertical linear gauge that supports zones highlights. ',
      icon: 'linearGauge',
      category: 'Gauges',
      selector: 'widget-gauge-ng-linear',
      componentClassName: 'WidgetGaugeNgLinearComponent'
    },
    {
      name: 'Radial',
      description: 'A radial gauge that supports various configurations, including capacity and measurement dials and zones highlight.',
      icon: 'radialGauge',
      category: 'Gauges',
      selector: 'widget-gauge-ng-radial',
      componentClassName: 'WidgetGaugeNgRadialComponent'
    },
    {
      name: 'Compass',
      description: 'A faceplate or card rotating compass gauge with various cardinal point indicator options.',
      icon: 'compassGauge',
      category: 'Gauges',
      selector: 'widget-gauge-ng-compass',
      componentClassName: 'WidgetGaugeNgCompassComponent'
    },
    {
      name: 'Steel Style',
      description: 'A traditional steel looking linear & radial gauges replica that supports range sizes and zones highlights.',
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
      description: 'Add Freeboard-SK Chart Plotter as a widget with auto sign-in to your dashboard.',
      icon: 'freeboardWidget',
      category: 'Components',
      selector: 'widget-freeboardsk',
      componentClassName: 'WidgetFreeboardskComponent'
    },
    {
      name: 'Data Chart',
      description: 'Visualize data on a realtime chart with multiple series pre configured such as averages, SMA, EMA and DEMA. The use the Data Chart widget KIP Dataset must be configured.',
      icon: 'datachartWidget',
      category: 'Components',
      selector: 'widget-data-chart',
      componentClassName: 'WidgetDataChartComponent'
    },
    {
      name: 'Autopilot Head',
      description: 'An Autopilot Head for supported Signal K autopilot devices.',
      icon: 'autopilotWidget',
      category: 'Components',
      selector: 'widget-autopilot',
      componentClassName: 'WidgetAutopilotComponent'
    },
    {
      name: 'Race Timer',
      description: 'A simple race start countdown timer. The timer can be started, paused, reset and the countdown duration specified.',
      icon: 'racetimerWidget',
      category: 'Components',
      selector: 'widget-racetimer',
      componentClassName: 'WidgetRaceTimerComponent',
    },
    {
      name: 'Racer Timer',
      description: 'A race start timer that integrates withe the signalk-racer plugin. The line can be set and the timer can be started, paused, reset and the countdown duration specified.',
      icon: 'racertimerWidget',
      category: 'Components',
      selector: 'widget-racertimer',
      componentClassName: 'WidgetRacerTimerComponent',
    },
    {
      name: 'Embed Webpage Viewer',
      description: 'Use this widget to embed a view of an external web based applications, such as Grafana graphs, other Signal K Apps and related tools, in your dashboard for a seamless integration. Interactions with the embedded page are not supported.',
      icon: 'embedWidget',
      category: 'Components',
      selector: 'widget-iframe',
      componentClassName: 'WidgetIframeComponent',
    },
    {
      name: 'Tutorial',
      description: "KIP's getting started tutorial widget.",
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
