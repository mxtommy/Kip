import { inject, Injectable } from '@angular/core';
import { Type } from '@angular/core';
import { SignalkPluginsService } from './signalk-plugins.service';
import { WidgetNumericComponent } from '../../widgets/widget-numeric/widget-numeric.component';
import { WidgetTextComponent } from '../../widgets/widget-text/widget-text.component';
import { WidgetWindTrendsChartComponent } from '../../widgets/widget-windtrends-chart/widget-windtrends-chart.component';
import { WidgetWindComponent } from '../../widgets/widget-windsteer/widget-windsteer.component';
import { WidgetTutorialComponent } from '../../widgets/widget-tutorial/widget-tutorial.component';
import { WidgetSliderComponent } from '../../widgets/widget-slider/widget-slider.component';
import { WidgetSimpleLinearComponent } from '../../widgets/widget-simple-linear/widget-simple-linear.component';
import { WidgetRacesteerComponent } from '../../widgets/widget-racesteer/widget-racesteer.component';
import { WidgetRacerTimerComponent } from '../../widgets/widget-racer-timer/widget-racer-timer.component';
import { WidgetRacerLineComponent } from '../../widgets/widget-racer-line/widget-racer-line.component';
import { WidgetRaceTimerComponent } from '../../widgets/widget-race-timer/widget-race-timer.component';
import { WidgetPositionComponent } from '../../widgets/widget-position/widget-position.component';
import { WidgetLabelComponent } from '../../widgets/widget-label/widget-label.component';
import { WidgetIframeComponent } from '../../widgets/widget-iframe/widget-iframe.component';
import { WidgetHorizonComponent } from '../../widgets/widget-horizon/widget-horizon.component';
import { WidgetHeelGaugeComponent } from '../../widgets/widget-heel-gauge/widget-heel-gauge.component';
import { WidgetSteelGaugeComponent } from '../../widgets/widget-gauge-steel/widget-gauge-steel.component';
import { WidgetGaugeNgRadialComponent } from '../../widgets/widget-gauge-ng-radial/widget-gauge-ng-radial.component';
import { WidgetGaugeNgLinearComponent } from '../../widgets/widget-gauge-ng-linear/widget-gauge-ng-linear.component';
import { WidgetGaugeNgCompassComponent } from '../../widgets/widget-gauge-ng-compass/widget-gauge-ng-compass.component';
import { WidgetFreeboardskComponent } from '../../widgets/widget-freeboardsk/widget-freeboardsk.component';
import { WidgetDatetimeComponent } from '../../widgets/widget-datetime/widget-datetime.component';
import { WidgetDataChartComponent } from '../../widgets/widget-data-chart/widget-data-chart.component';
import { WidgetBooleanSwitchComponent } from '../../widgets/widget-boolean-switch/widget-boolean-switch.component';
import { WidgetAutopilotComponent } from '../../widgets/widget-autopilot/widget-autopilot.component';

export const WIDGET_CATEGORIES = ['Core', 'Gauge', 'Component', 'Racing'] as const;
export type TWidgetCategories = typeof WIDGET_CATEGORIES[number];
export enum WidgetCategories {
  Core = "Core",
  Gauge = "Gauge",
  Component = "Component",
  Racing = "Racing"
}
/**
 * WidgetDescription defines the metadata and plugin dependencies for a widget.
 *
 * - requiredPlugins: All listed plugins must be enabled for the widget to function.
 * - optionalPlugins: If present, at least one must be enabled for the widget to function. If requirements are met, missing optional plugins are shown as unavailable but do not block use.
 *
 * Example:
 * {
 *   name: 'Autopilot',
 *   ...
 *   requiredPlugins: [],
 *   optionalPlugins: ['autopilot', 'pypilot-autopilot-provider']
 * }
 */
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
   * Plugins that must be enabled for the widget to function. If empty, no required plugins.
   */
  requiredPlugins: string[];
  /**
   * Plugins that are optional for the widget. If present, at least one must be enabled for the widget to function. If omitted or empty, no optional plugin logic is applied.
   */
  optionalPlugins?: string[];
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
  pluginsStatus: { name: string; enabled: boolean, required: boolean }[];
}

@Injectable({
  providedIn: 'root'
})
export class WidgetService {
  private readonly _plugins = inject(SignalkPluginsService);
  private readonly _widgetCategories = [...WIDGET_CATEGORIES];
  // Cache for selector -> component Type resolutions to avoid repeated definition scans
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _componentTypeCache = new Map<string, Type<any> | undefined>();
  //TODO: clenup. not needed since Host2 migration was completed
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly _componentTypeMap: Record<string, Type<any>> = {
    WidgetNumericComponent: WidgetNumericComponent,
    WidgetTextComponent: WidgetTextComponent,
    WidgetWindTrendsChartComponent: WidgetWindTrendsChartComponent,
    WidgetWindComponent: WidgetWindComponent,
    WidgetTutorialComponent: WidgetTutorialComponent,
    WidgetSliderComponent: WidgetSliderComponent,
    WidgetSimpleLinearComponent: WidgetSimpleLinearComponent,
    WidgetRacesteerComponent: WidgetRacesteerComponent,
    WidgetRacerTimerComponent: WidgetRacerTimerComponent,
    WidgetRacerLineComponent: WidgetRacerLineComponent,
    WidgetRaceTimerComponent: WidgetRaceTimerComponent,
    WidgetPositionComponent: WidgetPositionComponent,
    WidgetLabelComponent: WidgetLabelComponent,
    WidgetIframeComponent: WidgetIframeComponent,
    WidgetHorizonComponent: WidgetHorizonComponent,
    WidgetHeelGaugeComponent: WidgetHeelGaugeComponent,
    WidgetSteelGaugeComponent: WidgetSteelGaugeComponent,
    WidgetGaugeNgRadialComponent: WidgetGaugeNgRadialComponent,
    WidgetGaugeNgLinearComponent: WidgetGaugeNgLinearComponent,
    WidgetGaugeNgCompassComponent: WidgetGaugeNgCompassComponent,
    WidgetFreeboardskComponent: WidgetFreeboardskComponent,
    WidgetDatetimeComponent: WidgetDatetimeComponent,
    WidgetDataChartComponent: WidgetDataChartComponent,
    WidgetBooleanSwitchComponent: WidgetBooleanSwitchComponent,
    WidgetAutopilotComponent: WidgetAutopilotComponent
};
  private readonly _widgetDefinition: readonly WidgetDescription[] = [
    {
      name: 'Numeric',
      description: 'Displays numeric data in a clear and concise format, with options to show minimum and/or maximum recorded values. Includes an optional background minichart for quick visual trend insights.',
      icon: 'numericWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-numeric',
      componentClassName: 'WidgetNumericComponent'
    },
    {
      name: 'Text',
      description: 'Displays text data with a customizable color formatting option.',
      icon: 'textWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-text',
      componentClassName: 'WidgetTextComponent'
    },
    {
      name: 'Date & Time',
      description: 'Displays date and time data with fully custom formatting options and timezone correction.',
      icon: 'datetimeWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-datetime',
      componentClassName: 'WidgetDatetimeComponent'
    },
    {
      name: 'Position',
      description: 'Displays latitude and longitude for location tracking and navigation.',
      icon: 'positionWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-position',
      componentClassName: 'WidgetPositionComponent',
    },
    {
      name: 'Static Label',
      description: 'A static text widget that allows you to add customizable labels to your dashboard, helping to organize and clarify your layout effectively.',
      icon: 'labelWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-label',
      componentClassName: 'WidgetLabelComponent'
    },
    {
      name: 'Switch Panel',
      description: 'A Digital Switching panel group with multiple controls including toggle switches, indicator lights, and press buttons to send Signal K paths values and other operations.',
      icon: 'switchpanelWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-boolean-switch',
      componentClassName: 'WidgetBooleanSwitchComponent'
    },
    {
      name: 'Slider',
      description: 'A Digital Switching range slider that allows users to adjust values, such as controlling lighting intensity or audio volume from 0% to 100%.',
      icon: 'sliderWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 8,
      defaultHeight: 12,
      category: 'Core',
      requiredPlugins: [],
      selector: 'widget-slider',
      componentClassName: 'WidgetSliderComponent'
    },
    {
      name: "Compact Linear",
      description: "A simple horizontal linear gauge with a large value label offering a clean, compact modern look.",
      icon: 'simpleLinearGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-simple-linear',
      componentClassName: 'WidgetSimpleLinearComponent'
    },
    {
      name: 'Linear',
      description: 'A horizontal or vertical linear gauge that supports zone highlighting.',
      icon: 'linearGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-gauge-ng-linear',
      componentClassName: 'WidgetGaugeNgLinearComponent'
    },
    {
      name: 'Radial',
      description: 'A radial gauge with configurable capacity and measurement dials plus zone highlighting.',
      icon: 'radialGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-gauge-ng-radial',
      componentClassName: 'WidgetGaugeNgRadialComponent'
    },
    {
      name: 'Compass',
      description: 'A faceplate or card-style rotating compass gauge with multiple cardinal point indicator options.',
      icon: 'compassGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-gauge-ng-compass',
      componentClassName: 'WidgetGaugeNgCompassComponent'
    },
    {
      name: 'Level Gauge',
      description: 'Dual-scale heel angle indicator combining a high‑precision ±5° fine level with a wide ±40° coarse arc for fast trim tuning and broader heel / sea‑state monitoring.',
      icon: 'level',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-heel-gauge',
      componentClassName: 'WidgetHeelGaugeComponent'
    },
    {
      name: 'Pitch & Roll',
      description: 'Horizon-style attitude indicator showing live pitch and roll degrees with smooth animation—ideal for monitoring trim, heel, and sea-state response.',
      icon: 'pitchRollGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-horizon',
      componentClassName: 'WidgetHorizonComponent'
    },
    {
      name: 'Classic Steel',
      description: 'A traditional steel looking linear & radial gauges replica that supports range sizes and zones highlights.',
      icon: 'steelGauge',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Gauge',
      requiredPlugins: [],
      selector: 'widget-gauge-steel',
      componentClassName: 'WidgetSteelGaugeComponent'
    },
    {
      name: 'Windsteer',
      description: 'A wind steering display that combines wind, wind sectors, heading, course over ground and next waypoint information.',
      icon: 'windsteeringWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Component',
      requiredPlugins: [],
      selector: 'widget-wind-steer',
      componentClassName: 'WidgetWindComponent'
    },
    {
      name: 'Freeboard-SK',
      description: 'Adds the Freeboard-SK chart plotter as a widget with automatic sign-in to your dashboard.',
      icon: 'freeboardWidget',
      minWidth: 6,
      minHeight: 8,
      defaultWidth: 6,
      defaultHeight: 14,
      category: 'Component',
      requiredPlugins: ['freeboard-sk', 'tracks', 'resources-provider', 'course-provider'],
      selector: 'widget-freeboardsk',
      componentClassName: 'WidgetFreeboardskComponent'
    },
    {
      name: 'Autopilot Head',
      description: 'Provides typical autopilot controls for Signal K v1 & v2 Autopilot API devices. Requires a compatible hardware-specific Autopilot plugin for full functionality.',
      icon: 'autopilotWidget',
      minWidth: 4,
      minHeight: 14,
      defaultWidth: 4,
      defaultHeight: 14,
      category: 'Component',
      requiredPlugins: [],
      optionalPlugins: ['autopilot', 'pypilot-autopilot-provider'],
      selector: 'widget-autopilot',
      componentClassName: 'WidgetAutopilotComponent'
    },
    {
      name: 'Realtime Data Chart',
      description: 'Visualizes data on a real-time chart with multiple preconfigured series including actuals, SMA and period overall averages and Min/Max. Requires the KIP Dataset to be configured.',
      icon: 'datachartWidget',
      minWidth: 2,
      minHeight: 4,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Component',
      requiredPlugins: [],
      selector: 'widget-data-chart',
      componentClassName: 'WidgetDataChartComponent'
    },
    {
      name: 'Embed Webpage Viewer',
      description: 'Embeds external web-based applications—such as Grafana graphs or other Signal K apps—into your dashboard for seamless integration. Interaction is disabled by default but can be enabled.',
      icon: 'embedWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Component',
      requiredPlugins: [],
      selector: 'widget-iframe',
      componentClassName: 'WidgetIframeComponent',
    },
    {
      name: 'Tutorial',
      description: 'An instructional widget that guides new users through basic navigation, gestures, and dashboard editing steps.',
      icon: 'helpWidget',
      minWidth: 4,
      minHeight: 4,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Component',
      requiredPlugins: [],
      selector: 'widget-tutorial',
      componentClassName: 'WidgetTutorialComponent'
    },
    {
      name: 'Racesteer (BETA)',
      description: 'A dynamic race steering display that fuses polar performance data with live conditions to guide optimal steering, tacking, and gybing angles for maximum speed. Instantly compare performance against competition polars for smarter tactical decisions.',
      icon: 'racesteeringWidget',
      minWidth: 1,
      minHeight: 1,
      defaultWidth: 4,
      defaultHeight: 6,
      category: 'Racing',
      requiredPlugins: ['signalk-polar-performance-plugin'],
      selector: 'widget-racesteer',
      componentClassName: 'WidgetRacesteerComponent'
    },
    {
      name: 'Racer - Start Line Insight',
      description: 'Gain a tactical advantage for racing starts: set and adjust the port and starboard ends of the start line, see your distance to the line, the favored end, and how much the line is favored or unfavored. Includes visual integration with Freeboard SK for interactive line adjustment and display.',
      icon: 'racerlineWidget',
      minWidth: 4,
      minHeight: 4,
      defaultWidth: 4,
      defaultHeight: 4,
      requiredPlugins: ['signalk-racer'],
      category: 'Racing',
      selector: 'widget-racer-line',
      componentClassName: 'WidgetRacerLineComponent',
    },
    {
      name: 'Racer - Start Timer',
      description: 'An advanced racing countdown timer that indicates OCS (On Course Side) status. Set the start line, choose or adjust the duration, or specify the exact start time. Automatically switches to the target dashboard at the start unless over early.',
      icon: 'racertimerWidget',
      minWidth: 4,
      minHeight: 4,
      defaultWidth: 4,
      defaultHeight: 4,
      requiredPlugins: ['signalk-racer'],
      category: 'Racing',
      selector: 'widget-racer-timer',
      componentClassName: 'WidgetRacerTimerComponent',
    },
    {
      name: 'Wind Trends',
      description: 'Real-time True Wind trends with dual top axes for direction (°) and speed (knots). Displays live values and SMA over the current period’s average.',
      icon: 'windtrendsWidget',
      minWidth: 10,
      minHeight: 8,
      defaultWidth: 10,
      defaultHeight: 8,
      category: 'Racing',
      requiredPlugins: [],
      selector: 'widget-windtrends-chart',
      componentClassName: 'WidgetWindTrendsChartComponent'
    },
  ];

  get kipWidgets(): readonly WidgetDescription[] {
    return this._widgetDefinition;
  }

  get categories(): string[] {
    return this._widgetCategories;
  }

  /**
   * Resolves a widget's runtime component Type from its selector.
   *
   * Flow:
   *  1. Locate the widget definition whose `selector` matches the provided string.
   *  2. Look up the definition's `componentClassName` inside `_componentTypeMap`.
   *  3. Return the component Type if the widget has been migrated; otherwise `undefined`.
   *
   * Host2 will fall back to a safe default (currently Numeric) when `undefined` is returned.
   * This allows incremental migration without breaking existing dashboard configs.
   *
   * NOTE: We intentionally keep this lightweight instead of using dynamic `import()` to
   * preserve tree‑shaking.
   *
   * @param selector Dashboard widget type / selector (e.g. `widget-numeric`).
   * @returns Angular component Type or undefined if not yet migrated.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public getComponentType(selector: string): Type<any> | undefined {
    // Only return cached value if it's a defined component Type; avoid sticky undefined caching
    const cached = this._componentTypeCache.get(selector);
    if (cached) return cached;

    const def = this._widgetDefinition.find(w => w.selector === selector);
    if (!def) return undefined;

    const resolved = this._componentTypeMap[def.componentClassName];
    if (!resolved) {
      // Do NOT cache undefined so that adding a new mapping later in dev picks it up without reload
      if (typeof ngDevMode !== 'undefined' && ngDevMode) {
        console.warn('[WidgetService] No component mapping for', def.componentClassName);
      }
      return undefined;
    }
    this._componentTypeCache.set(selector, resolved);
    return resolved;
  }

  /**
   * Returns the list of widget definitions, each enriched with plugin dependency status.
   *
   * For each widget, this method:
   * - Checks all unique plugin dependencies using the SignalkPluginsService (each dependency is checked only once, even if used by multiple widgets).
   * - Adds the following properties to each widget:
   * - `isDependencyValid`: `true` if all required plugins are enabled and, if optionalPlugins is present, at least one optional plugin is enabled. Otherwise `false`.
   * - `pluginsStatus`: an array of objects, each with `{ name: string, enabled: boolean, required: boolean }` for every dependency (required and optional).
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

    // Collect all unique plugin dependencies (required + optional)
    const allDeps = Array.from(
      new Set(this._widgetDefinition.flatMap(w => [
        ...(w.requiredPlugins || []),
        ...(w.optionalPlugins || [])
      ]))
    );

    // Check each unique dependency once
    await Promise.all(
      allDeps.map(async dep => {
        pluginCache[dep] = await this._plugins.isEnabled(dep);
      })
    );

    // Map widgets using the cached results
    return this._widgetDefinition.map(widget => {
      const required = widget.requiredPlugins || [];
      const optional = widget.optionalPlugins || [];

      const requiredStatus = required.map(dep => ({
        name: dep,
        enabled: pluginCache[dep],
        required: true
      }));
      const optionalStatus = optional.map(dep => ({
        name: dep,
        enabled: pluginCache[dep],
        required: false
      }));
      const pluginsStatus = [...requiredStatus, ...optionalStatus];
      // Widget is valid if all required plugins are enabled AND (if any optional plugins, at least one is enabled)
      let isDependencyValid = requiredStatus.every(p => p.enabled);
      if (isDependencyValid && optional.length > 0) {
        isDependencyValid = optionalStatus.some(p => p.enabled);
      }
      return {
        ...widget,
        isDependencyValid,
        pluginsStatus
      };
    });
  }
}
