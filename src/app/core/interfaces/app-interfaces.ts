/*********************************************************************************
 * This file contains the most, but not all, common KIP App internal data types and
 * structure interfaces. They are used by various services, components and widgets.
 *
 * For external data interfaces, such as Signal K, see signalk-interfaces file.
 *********************************************************************************/

import { ISkMetadata, TState } from "./signalk-interfaces";

/**
 * An App data structure that represents the values (ie. sensor data)
 * of a path. Used as a Read/Write interface on internal App paths data source.

 * Use by: signalk-full services (parser), signalk-delta services (parser) and
 * Signal K services (internal app dataSource)
 *
 * @memberof app-interfaces
 */
 export interface IPathValueData {
  context: string;
  path: string;
  source: string;
  timestamp: string;
  value: any;
}

/**
 * An App data structure that represents a path's complete data structure:
 * Path properties, value, value data type, data sources,
 * data zone state, meta data, etc.
 *
 * In latest SK implementation with support for Source priority, we
 * should always have one unique value per path. Without Priority each sources
 * will, inturn, update the path value, and it's own source value, causing
 * erratic path value updates. This is by design.
 * To prevent this, users need to set Priority rules or select a specific source.
 *
 * Use by: data-browser (consumer) and Signal K services (internal data source)
 *
 * @memberof app-interfaces
 */
 export interface ISkPathData {
  path: string;
  pathValue: any;
  defaultSource?: string; // default source
  sources: {
    [sourceName: string]: { // per source data
      timestamp: string;
      sourceValue: any;
    }
  };
  meta?: ISkMetadata;
  type: string;
  state: TState;
}

/**
 * An App data structure that represents all meta values of a path. Used
 * as an interface to access meta data subset extracted from internal App
 * paths data source.
 *
 * Use by: modal-path-selection (consumer) and Signal K (internal data source) service
 *
 * @memberof app-interfaces
 */
 export interface IPathMetaData {
  path: string;
  meta?: ISkMetadata;
}

export interface IDefaultSource {
  path: string;
  source: string;
}

export interface IMeta {
  /** Optional SK context representing the root node emitting the value. Empty context should assume the message is from Self. Other contexts can be from AIS, DCS and other types of remote emitting sources configured */
  context: string,
  path: string;
  meta: ISkMetadata;
}
