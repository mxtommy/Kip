/**
 * Signal K Autopilot API Interface Definitions
 *
 * This file contains interface definitions for Signal K Autopilot APIs
 * used by the autopilot widget component.
 *
 * @see https://signalk.org/specification/1.7.0/doc/groups/autopilot.html
 * @see https://github.com/SignalK/specification/blob/master/schemas/groups/autopilot.json
 */

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

/**
 * Response structure for V2 API autopilot discovery endpoint
 * GET /signalk/v2/api/vessels/self/autopilots
 */
export type IV2AutopilotsDiscoveryResponse = Record<string, {
  name?: string;
  description?: string;
  capabilities?: string[];
}>;

/**
 * Standard V2 API endpoint URLs for a specific autopilot instance
 */
export interface IV2ApiEndpoints {
  engage: string;
  disengage: string;
  mode: string;
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
  status: 'success' | 'error';
  message?: string;
  data?: unknown;
}
