import { Format, Policy } from './signalk-interfaces';

/**
 * KIP Dynamic Widgets interface.
 *
 * @export
 * @interface DynamicWidget
 */
export interface DynamicWidget {
  widgetProperties: IWidget;
  theme: ITheme;
  defaultConfig: IWidgetSvcConfig;
  unlockStatus?: boolean; // only used by Tutorial
}

/**
 * Description of standard Angualr Material Theme colors.
 *
 * @export
 * @interface ITheme
 */
export interface ITheme {
  primary: string;
  accent: string;
  warn: string;
  primaryDark: string;
  accentDark: string;
  warnDark: string;
  background: string;
  text: string;
}

/**
 * This interface defines possible Widget properties.
 *
 * @export
 * @interface IWidget
 */
export interface IWidget {
  uuid: string;
  type: string;
  config: IWidgetSvcConfig;
}

export interface IPathArray {
  [key: string]: IWidgetPath;
}

/**
 * This interface defines all possible Widget configuration settings.
 * Usage: Widgets for configuration storage and Widget Manager service.
 *
 * Note: Used by IWidget interface.
 *
 * @export
 * @interface IWidgetSvcConfig
 */
export interface IWidgetSvcConfig {
  displayName?: string;
  filterSelfPaths?: boolean; // widget filter self paths only?
  paths?:IPathArray;
  convertUnitTo?: string;
  usage?: {
    [key: string]: string[]; // Autopilot: key should match key in paths, specifies autopilot widget possible paths for AP mode
  };
  typeVal?: {
    [key: string]: string; // Autopilot: key should match key in paths, specifies autopilot widget paths value type for AP mode
  };

  // numeric data
  numDecimal?: number; // number of decimal places if a number
  numInt?: number;
  showMin?: boolean;
  showMax?: boolean;

  // date data
  dateFormat?: string;
  dateTimezone?: string;

  // Wind Gauge data
  windSectorEnable?: boolean;
  windSectorWindowSeconds?: number;
  laylineEnable?: boolean;
  laylineAngle?: number;

  // gauge Data
  gaugeType?: string;
  gaugeUnitLabelFormat?: string;
  gaugeTicks?: boolean;
  barGraph?: boolean;
  backgroundColor?: string;
  frameColor?: string;
  barColor?: string;
  radialSize?: string;
  minValue?: number;
  maxValue?: number;
  rotateFace?: boolean;
  autoStart?: boolean;
  compassUseNumbers?: boolean;

  // Historical
  dataSetUUID?: string;
  invertData?: boolean;
  displayMinMax?: boolean;
  animateGraph?: boolean;
  includeZero?: boolean;
  verticalGraph?: boolean;

  // Puts
  putEnable?: boolean;
  putMomentary?: boolean;
  putMomentaryValue?: boolean;

  // iFrame
  widgetUrl?: string;


  // Race Timer
  timerLength?: number;
}
/**
 * Widget Zones data highlights interface. Used to defined how current path data
 * value should be displayed/highlighted with respect to the zones configuration.
 *
 * @exports
 * @interface IDataHighlight
 * @extends {Array<{
 *   from : number;
 *   to : number;
 *   color: string;
 * }>}
 */
export interface IDataHighlight extends Array<{
  from: number;
  to: number;
  color: string;
}> {};

/**
 * Defines all possible properties for data paths. Combines both
 * both KIP and Signal K path features.
 *
 * @interface IWidgetPaths
 */
export interface IWidgetPath {
  description: string;
  path: string | null;
  source: string | null;
  pathType: string  | null;
  pathFilter?: string;     // Future - use to filter path list ie. self.navigation.* or *.navigation.*.blabla.*
  convertUnitTo?: string;    // Convert SignalK value to specific format for display. Also used as a source to identify conversion group
  isPathConfigurable: boolean; // should we show this path in Widget Path config or is it static and hidden
  sampleTime: number;  // Used to throttle/limit Observer emited data and reduce Angular change detection. Configure according to data type source and human perception. Value in milliseconds
  period?: number;    // Signal K - period=[millisecs] becomes the transmission rate, e.g. every period/1000 seconds. Default: 1000
  format?: Format;     // Signal K - format=[delta|full] specifies delta or full format. Default: delta
  policy?: Policy;     // Signal K - policy=[instant|ideal|fixed]. Default: ideal
  minPeriod?: number;  // Signal K - minPeriod=[millisecs] becomes the fastest message transmission rate allowed, e.g. every minPeriod/1000 seconds. This is only relevant for policy='instant' to avoid swamping the client or network.
}
