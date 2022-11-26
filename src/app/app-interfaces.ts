/*********************************************************************************
 * This file contains App (Kip) internal data interfaces.
 *
 * Those interfaces describe most (only is reuse is needed) shared app data types
 * and data structures used in the application. They are use by various services,
 * componenets and widgets.
 *
 * For Signal K data interfaces (external data), see signalk-interfaces file.
 *********************************************************************************/

import { ISignalKMetadata, State, Method } from "./signalk-interfaces";
import { IZoneState } from './app-settings.interfaces';

/**
 * An App data structure that represents the values (ie. sensor data)
 * of a path. Used as a Read/Write interface on internal App paths data source.

 * Use by: signalk-full services (parser), signalk-delta services (parser) and
 * signalk services (internal app datasource)
 *
 * @memberof app-interfaces
 */
 export interface IPathValueData {
  path: string;
  source: string;
  timestamp: number;
  value: any;
}

/**
 * An App data structure that represents a path's rich/complet data structure;
 * all possible signal K data sources and their values, default source, data type description,
 * data zone state, all meta data, etc.
 *
 * Use by: data-browser (consumer) and signalk services (internal datasource)
 *
 * @memberof app-interfaces
 */
 export interface IPathData {
  path: string;
  defaultSource?: string; // default source
  sources: {
    [sourceName: string]: { // per source data
      timestamp: number;
      value: any;
    }
  }
  meta?: ISignalKMetadata;
  type: string;
  state: IZoneState;
}

/**
 * An App data structure that represents all meta values of a path. Used
 * as an interface to access meta data subset extracted from internal App
 * paths data source.
 *
 * Use by: modal-path-selection (consumer), setting-zones (consumer) and signalk (internal datasource) service
 *
 * @memberof app-interfaces
 */
 export interface IPathMetaData {
  path: string;
  meta?: ISignalKMetadata;
}

/**
 * An App data structure that represents a resquest/response "ie. a notification"
 * message.
 *
 * Use by: Notification service (consumer), signalk-delta (parser)
 *
 * Follow URL for full SignalK specification and description of fields:
 * @url https://signalk.org/specification/1.7.0/doc/request_response.html
 *
 * @memberof app-interfaces
 */
 export interface INotification {
  method: Method[],
  state: State,
  message: string
  timestamp: string,
}

export interface IDefaultSource {
  path: string;
  source: string;
}

export interface IMeta {
  path: string;
  meta: ISignalKMetadata;
}
