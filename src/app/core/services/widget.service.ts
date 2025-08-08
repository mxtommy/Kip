import { inject, Injectable } from '@angular/core';
import { SignalkPluginsService } from './signalk-plugins.service';

export const WIDGET_CATEGORIES = ['Basic', 'Gauges', 'Components'] as const;
export type TWidgetCategories = typeof WIDGET_CATEGORIES[number];
export enum WidgetCategories {
  Basic = "Basic",
  Gauges = "Gauges",
  Components = "Components"
}
export interface WidgetDescription {
  /**
   * The name of the widget, which will be displayed in the widget list.
   * It should be concise and descriptive to help users identify the widget's purpose.
   */
  name: string;
  /**
   * A brief description of the widget's functionality and purpose.
   * This will be displayed in the widget list to help users understand
   * what the widget does.
   */
  description: string;
  /**
   * The icon name in the SVG icon file to be used with MatIconModule.
   */
  icon: string;
  /**
   * An array of plugin names that this widget requires to be installed
   * and enabled on the Signal K server. If the widget does not have any
   * dependencies, this can be an empty array.
   */
  pluginDependency: string[];
  /**
   * The category of the widget, used for filtering in the widget list.
   */
  category: TWidgetCategories;
  /**
   * Minimal width constraint of the widget in grid cells.
   */
  minWidth: number;
  /**
   * Minimal height constraint of the widget in grid cells.
   */
  minHeight: number;
  /**
   * The default width of the widget in grid cells upon creation.
   */
  defaultWidth: number;
  /**
   * The default height of the widget in grid cells upon creation.
   */
  defaultHeight: number;
  /**
   * The selector for the widget component, which will be used in the dashboard
   * to instantiate the widget.
   */
  selector: string;
  /**
   * The class name of the component that implements the widget.
   * This is used to dynamically load the component when the widget is added to the dashboard.
   */
  componentClassName: string;
}

export interface WidgetDescriptionWithPluginStatus extends WidgetDescription {
  isDependencyValid: boolean;
  pluginsStatus: { name: string; enabled: boolean }[];
}

@Injectable({
  providedIn: 'root'
})
export class WidgetService {
  private readonly _plugins = inject(SignalkPluginsService);
  private readonly _widgetCategories = ["Basic", "Gauges", "Components"];
  private readonly _widgetDefinition: WidgetDescription[] = [
    {
      name: 'Numeric',
      description: 'Displays numeric data in a clear and concise format, with options to show minimum and/or maximum recorded values. Includes an optional background minichart for quick visual trend insights.',
      icon: 'numericWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Basic',
      pluginDependency: [],
      selector: 'widget-numeric',
      componentClassName: 'WidgetNumericComponent'
    },
    {
      name: 'Text',
      description: 'Displays text data with customizable color formatting option.',
      icon: 'textWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Basic',
      pluginDependency: [],
      selector: 'widget-text',
      componentClassName: 'WidgetTextComponent'
    },
    {
      name: 'Date & Time',
      description: 'Displays date and time data with fully custom formatting options and timezone correction.',
      icon: 'datetimeWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Basic',
      pluginDependency: [],
      selector: 'widget-datetime',
      componentClassName: 'WidgetDatetimeComponent'
    },
    {
      name: 'Position',
      description: 'Displays latitude and longitude for location tracking and navigation.',
      icon: 'positionWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Basic',
      pluginDependency: [],
      selector: 'widget-position',
      componentClassName: 'WidgetPositionComponent',
    },
    {
      name: 'Switch Panel',
      description: 'A switch panel group with multiple controls including toggle switches, indicator lights, and press buttons for digital switching and other operations.',
      icon: 'switchpanelWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Basic',
      pluginDependency: [],
      selector: 'widget-boolean-switch',
      componentClassName: 'WidgetBooleanSwitchComponent'
    },
    {
      name: 'Slider',
      description: 'A range slider that allows users to adjust values, such as controlling lighting intensity from 0% to 100%.',
      icon: 'sliderWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Basic',
      pluginDependency: [],
      selector: 'widget-slider',
      componentClassName: 'WidgetSliderComponent'
    },
    {
      name: 'Static Label',
      description: 'A static text widget that allows you to add customizable labels to your dashboard, helping to organize and clarify your layout effectively.',
      icon: 'labelWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Basic',
      pluginDependency: [],
      selector: 'widget-label',
      componentClassName: 'WidgetLabelComponent'
    },
    {
      name: "Simple Linear",
      description: "A simple horizontal linear gauge with a large value label offering a clean, compact modern look.",
      icon: 'simpleLinearGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Gauges',
      pluginDependency: [],
      selector: 'widget-simple-linear',
      componentClassName: 'WidgetSimpleLinearComponent'
    },
    {
      name: 'Linear',
      description: 'A horizontal or vertical linear gauge that supports zones highlights. ',
      icon: 'linearGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Gauges',
      pluginDependency: [],
      selector: 'widget-gauge-ng-linear',
      componentClassName: 'WidgetGaugeNgLinearComponent'
    },
    {
      name: 'Radial',
      description: 'A radial gauge that supports various configurations, including capacity and measurement dials and zones highlight.',
      icon: 'radialGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Gauges',
      pluginDependency: [],
      selector: 'widget-gauge-ng-radial',
      componentClassName: 'WidgetGaugeNgRadialComponent'
    },
    {
      name: 'Compass',
      description: 'A faceplate or card rotating compass gauge with various cardinal point indicator options.',
      icon: 'compassGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Gauges',
      pluginDependency: [],
      selector: 'widget-gauge-ng-compass',
      componentClassName: 'WidgetGaugeNgCompassComponent'
    },
    {
      name: 'Steel Style',
      description: 'A traditional steel looking linear & radial gauges replica that supports range sizes and zones highlights.',
      icon: 'steelGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Gauges',
      pluginDependency: [],
      selector: 'widget-gauge-steel',
      componentClassName: 'WidgetSteelGaugeComponent'
    },
    {
      name: 'Wind Trends',
      description: 'Visualize True wind trends on a realtime chart with multiple series pre configured such as averages, SMA, EMA and DEMA. The use the Data Chart widget KIP Dataset must be configured.',
      icon: 'datachartWidget',
      minWidth: 5,
      minHeight: 4,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Gauges',
      pluginDependency: [],
      selector: 'widget-windtrends-chart',
      componentClassName: 'WidgetWindTrendsChartComponent'
    },
    {
      name: 'Windsteer',
      description: 'A wind steering display that combines wind, wind sectors, heading, course over ground and next waypoint information',
      icon: 'windsteeringWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Components',
      pluginDependency: [],
      selector: 'widget-wind-steer',
      componentClassName: 'WidgetWindComponent'
    },
    {
      name: 'Racesteer',
      description: 'A dynamic race steering display that fuses polar performance data with live environmental conditions, guiding you to the optimal steering, tacking, and gybing angles for maximum speed. Instantly see how your performance stacks up against competition polars, helping you make smarter tactical decisions on the water.',
      icon: 'racesteeringWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Components',
      pluginDependency: ['signalk-polar-performance-plugin'],
      selector: 'widget-racesteer',
      componentClassName: 'WidgetRacesteerComponent'
    },
    {
      name: 'Freeboard-SK',
      description: 'Add Freeboard-SK Chart Plotter as a widget with auto sign-in to your dashboard.',
      icon: 'freeboardWidget',
      minWidth: 3,
      minHeight: 4,
      defaultWidth: 3,
      defaultHeight: 7,
      category: 'Components',
      pluginDependency: ['freeboard-sk', 'tracks', 'resources-provider', 'course-provider' ],
      selector: 'widget-freeboardsk',
      componentClassName: 'WidgetFreeboardskComponent'
    },
    {
      name: 'Data Chart',
      description: 'Visualize data on a realtime chart with multiple series pre configured such as averages, SMA, EMA and DEMA. The use the Data Chart widget KIP Dataset must be configured.',
      icon: 'datachartWidget',
      minWidth: 1,
      minHeight: 2,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Components',
      pluginDependency: [],
      selector: 'widget-data-chart',
      componentClassName: 'WidgetDataChartComponent'
    },
    {
      name: 'Autopilot Head',
      description: 'Provides typical autopilot controls for Signal K v1 & v2 Autopilot API devices. Requires a compatible hardware-specific Autopilot plugin for full functionality.',
      icon: 'autopilotWidget',
      minWidth: 2,
      minHeight: 7,
      defaultWidth: 2,
      defaultHeight: 7,
      category: 'Components',
      pluginDependency: ['autopilot'],
      selector: 'widget-autopilot',
      componentClassName: 'WidgetAutopilotComponent'
    },
    {
      name: 'Countdown Timer',
      description: 'A simple race start countdown timer. The timer can be started, paused, synched, reset and the countdown duration specified.',
      icon: 'racetimerWidget',
      minWidth: 3,
      minHeight: 3,
      defaultWidth: 3,
      defaultHeight: 4,
      category: 'Components',
      pluginDependency: [],
      selector: 'widget-racetimer',
      componentClassName: 'WidgetRaceTimerComponent',
    },
    {
      name: 'Racer - Start Line Insight',
      description: 'Gain a tactical advantage for racing starts: set and adjust the port and starboard ends of the start line, see your distance to the line, the favored end, and how much the line is favored or unfavored. Includes visual integration with Freeboard SK for interactive line adjustment and display.',
      icon: 'racerlineWidget',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 2,
      defaultHeight: 2,
      pluginDependency: ['signalk-racer'],
      category: 'Components',
      selector: 'widget-racer-line',
      componentClassName: 'WidgetRacerLineComponent',
    },
    {
      name: 'Racer - Start Timer',
      description: 'An advanced racing countdown timer that indicates if you are OCS (On Course Side). Set the start line, choose your countdown duration, easily adjust the timer, or set the exact start time. At the start, automatically switches to your desired dashboard—unless you are over early.',
      icon: 'racertimerWidget',
      minWidth: 2,
      minHeight: 2,
      defaultWidth: 2,
      defaultHeight: 2,
      pluginDependency: ['signalk-racer'],
      category: 'Components',
      selector: 'widget-racer-timer',
      componentClassName: 'WidgetRacerTimerComponent',
    },
    {
      name: 'Embed Webpage Viewer',
      description: 'Use this widget to embed a view of an external web based applications, such as Grafana graphs, other Signal K Apps and related tools, in your dashboard for a seamless integration. Interactions with the embedded page are not enabled by default but are supported.',
      icon: 'embedWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Components',
      pluginDependency: [],
      selector: 'widget-iframe',
      componentClassName: 'WidgetIframeComponent',
    },
    {
      name: "Tutorial",
      description: "KIP's getting started tutorial widget.",
      icon: 'tutorialWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 2,
      defaultHeight: 3,
      category: 'Components',
      pluginDependency: [],
      selector: 'widget-tutorial',
      componentClassName: 'WidgetTutorialComponent',
    }
  ];

  get kipWidgets(): WidgetDescription[] {
    return this._widgetDefinition;
  }

  get categories(): string[] {
    return this._widgetCategories;
  }

  /**
   * Returns the list of widget definitions, each enriched with plugin dependency status.
   *
   * For each widget, this method:
   * - Checks all unique plugin dependencies using the SignalkPluginsService (each dependency is checked only once, even if used by multiple widgets).
   * - Adds the following properties to each widget:
   *   - `isDependencyValid`: `true` if all dependencies are enabled or if there are no dependencies; `false` otherwise.
   *   - `pluginsStatus`: an array of objects, each with `{ name: string, enabled: boolean }` for every dependency.
   *
   * @returns Promise resolving to an array of WidgetDescriptionWithPluginStatus objects.
   *
   * Example usage:
   * ```typescript
   * const widgets = await widgetService.getKipWidgetsWithStatus();
   * widgets.forEach(widget => {
   *   console.log(widget.name, widget.isDependencyValid, widget.pluginsStatus);
   * });
   * ```
   */
  public async getKipWidgetsWithStatus(): Promise<WidgetDescriptionWithPluginStatus[]> {
    const pluginCache: Record<string, boolean> = {};

    // Collect all unique plugin dependencies
    const allDeps = Array.from(
      new Set(this._widgetDefinition.flatMap(w => w.pluginDependency))
    );

    // Check each unique dependency once
    await Promise.all(
      allDeps.map(async dep => {
        pluginCache[dep] = await this._plugins.isEnabled(dep);
      })
    );

    // Map widgets using the cached results
    return this._widgetDefinition.map(widget => {
      if (!widget.pluginDependency || widget.pluginDependency.length === 0) {
        return {
          ...widget,
          isDependencyValid: true,
          pluginsStatus: []
        };
      }
      const pluginsStatus = widget.pluginDependency.map(dep => ({
        name: dep,
        enabled: pluginCache[dep]
      }));
      const isDependencyValid = pluginsStatus.every(p => p.enabled);
      return {
        ...widget,
        isDependencyValid,
        pluginsStatus
      };
    });
  }
}
