/**
 * Signal K Autopilot API Interface Definitions
 *
 * This file contains interface definitions for Signal K Autopilot APIs
 * used by the autopilot widget component.
 *
 * @see https://signalk.org/specification/1.7.0/doc/groups/autopilot.html
 * @see https://github.com/SignalK/specification/blob/master/schemas/groups/autopilot.json
 */

export type TApMode = 'off-line' | 'auto' | 'compass' | 'gps' | 'route' | 'nav' | 'wind' | 'true wind' | 'standby';

// ========================================
// V1 API Interfaces (Legacy Plugin-based)
// ========================================

/**
 * V1 API command definition structure
 * Used with the signalk-autopilot plugin
 */
export interface IV1CommandDefinition {
  path: string;
  value: string | number;
}

/**
 * Map of V1 command names to their Signal K path definitions
 */
export type V1CommandsMap = Record<string, IV1CommandDefinition>;

// ========================================
// V2 API Core Interfaces
// ========================================

export interface IV2CommandDefinition {
  path: string
  value?: object;
}

/**
 * Response structure for V2 API autopilot discovery endpoint
 * GET /signalk/v2/api/vessels/self/autopilots
 */
export type IV2AutopilotProvider = Record<string, {
  provider: string;
  isDefault: boolean;
}>;

/**
 * Standard V2 API endpoint URLs for a specific autopilot instance
 */
export interface IV2ApiEndpoints {
  engage: string;
  disengage: string;
  mode: string;
  state: string;
  target: string;
  tack: string;
  gybe: string;
  dodge: string;
  adjustHeading: string;
}

/**
 * Response format for V2 API command execution
 */
export interface IV2CommandResponse {
  statusCode: number;
  message: string;
  state: unknown;
}

/**
 * Response structure for autopilot instance status and capabilities endpoint
 * GET /signalk/v2/api/vessels/self/autopilots/{instance}
 *
 * This interface represents the complete state and available options for a specific
 * autopilot instance, combining both current operational status and capability discovery.
 *
 * @example
 * ```typescript
 * {
 *   options: {
 *     modes: ["auto", "wind", "route", "standby"],
 *     states: ["engaged", "disengaged"]
 *   },
 *   state: "engaged",
 *   mode: "auto",
 *   target: 185.5,
 *   engaged: true
 * }
 * ```
 */
export interface IV2AutopilotOptionsResponse {
  /**
   * Available capability options for this autopilot instance
   */
  options: {
    /**
     * Array of supported autopilot modes (e.g., "auto", "wind", "route")
     * These represent the different steering modes the autopilot can operate in
     */
    modes?: string[];
    /**
     * Array of supported autopilot states
     * Only "engaged" and "disengaged" are valid autopilot states
     */
    states?: AutopilotStateDef[];
  }
  /**
   * Current operational state of the autopilot device
   * Indicates whether the autopilot is actively controlling the vessel or not
   */
  state: ('engaged' | 'disengaged') | null;
  /**
   * Current steering mode of the autopilot
   * Determines what reference the autopilot is using (compass heading, wind angle, route, etc.)
   */
  mode: string | null;
  /**
   * Current target value for the selected mode
   * Units depend on mode: degrees for heading modes, degrees for wind angles, etc.
   */
  target: number | null;
  /**
   * Whether the autopilot is actively engaged and steering the vessel
   * When true, the autopilot is controlling the rudder/steering system
   */
  engaged: boolean;
}

// response structure for V2 API Default Autopilot Identifier
export interface IV2DefaultProviderId {
    id: string;
}

interface AutopilotStateDef {
    engaged: boolean;
    name: string;
}
