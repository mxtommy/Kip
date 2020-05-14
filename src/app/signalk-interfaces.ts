// Metadata, Notification and Stream Subscription type restrictions.
const states = ["nominal", "normal", "alert", "warn", "alarm", "emergency"] as ["nominal", "normal", "alert", "warn", "alarm", "emergency"];
type State = typeof states[number];

const types = ["linear", "logarithmic", "squareroot", "power"] as ["linear", "logarithmic", "squareroot", "power"];
type Type = typeof types[number];

const methods = ["visual", "sound"] as ["visual", "sound"];
type Method = typeof methods[number];

const formats = ["delta", "full"] as ["delta", "full"];
export type Format = typeof formats[number];

const policies = ["instant", "ideal", "fixed"] as ["instant", "ideal", "fixed"];
export type Policy = typeof policies[number];

/**
 * Not used
 */
export interface updateMessage {
  source: {
    label: string;
    type: string;
    pgn?: string;
    src?: string;
    talker?: string;
  };
  timestamp: string;
  values: {
    path: string;
    value: any;
  }[]
}
/**
 * SignalK Delta low level raw message interface.
 */
export interface deltaMessage {
  updates?: updateMessage[];
  requestId?: string;
  state?: string;
  statusCode?: number;
  context: string;
  self?: string;
  version?: string;
  message?: string;
  accessRequest?: {
    permission?: string;
    token?: string
  }
}

/**
 * SignalK Notification Object interface. Follow URL for full SignalK specification
 * and description of fields:
 * @url https://signalk.org/specification/1.4.0/doc/data_model_metadata.html
 */
export interface SignalKMetadata {
  // normal state value
  state: State;
  method: Method[];
  description?: string;
  displayName?: string;
  longName?: string;
  shortName?: string;
  timeout?: number;
  displayScale?: {
    lower: number;
    upper: number;
    type: Type;
  }
  // elevated state value
  alertMethod?: Method[];
  warnMethod?: Method[];
  alarmMethod?: Method[];
  emergencyMethod?: Method[];
  zones?: []
}

/**
 * SignalK Notification Object interface. Follow URL for full SignalK specification
 * and description of fields:
 * @url https://signalk.org/specification/1.4.0/doc/notifications.html
 */
export interface SignalKNotification {
  value: {
    method: Method[],
    state: State,
    message: string
  },
  timestamp: string,
  $source: string,
}
