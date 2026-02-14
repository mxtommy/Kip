import { ActionResult, Path, Plugin, ServerAPI, SKVersion } from '@signalk/server-api'

const start = (server: ServerAPI): Plugin => {
  const PUT_CONTEXT = 'vessels.self';
  const COMMAND_PATHS = {
    SET_DISPLAY: 'kip.remote.setDisplay',
    SET_SCREEN_INDEX: 'kip.remote.setScreenIndex',
    REQUEST_ACTIVE_SCREEN: 'kip.remote.requestActiveScreen'
  } as const;
  const CONFIG_SCHEMA = {
    properties: {
      notifications: {
        type: 'object',
        title: 'Remote Control',
        description: 'This plugin requires no configuration.'
      }
    }
  };

  /**
   * Payload for the `kip.remote.setDisplay` PUT handler command.
   *
   * @example
   * ```ts
   * const payload: IDisplayCommand = {
   *   displayId: '881d9185-426e-4dc3-bb95-ed58b81392c1',
   *   display: { displayName: 'Helm Port', screens: [] }
   * };
   * ```
   */
  interface IDisplayCommand {
    /** Target display UUID. */
    displayId: string;
    /** Full display object to publish, or `null` to clear. */
    display: object | null;
  }

  /**
   * Payload for screen index related PUT handler commands.
   *
   * @example
   * ```ts
   * const payload: IScreenCommand = {
   *   displayId: '881d9185-426e-4dc3-bb95-ed58b81392c1',
   *   screenIdx: 2
   * };
   * ```
   */
  interface IScreenCommand {
    /** Target display UUID. */
    displayId: string;
    /** Dashboard index to set/request, or `null` to clear value. */
    screenIdx: number | null;
  }

  const COMPLETED_OK: ActionResult = { state: 'COMPLETED', statusCode: 200 };

  /**
   * Creates a failed synchronous action result for Signal K PUT handlers.
   *
   * @param statusCode HTTP-like status code returned to the Signal K requester.
   * @param message Human-readable error message.
   * @returns A completed Signal K action result describing the failure.
   *
   * @example
   * ```ts
   * return failed(400, 'Invalid displayId format');
   * ```
   */
  function failed(statusCode: number, message: string): ActionResult {
    return { state: 'COMPLETED', statusCode, message };
  }

  /**
   * Validates that a display identifier follows the expected UUID-like format.
   *
   * @param displayId Candidate display identifier from a PUT payload.
   * @returns `true` when the identifier is a string containing only alphanumerics and dashes.
   *
   * @example
   * ```ts
   * if (!isValidDisplayId(command.displayId)) {
   *   return failed(400, 'Invalid displayId format');
   * }
   * ```
   */
  function isValidDisplayId(displayId: unknown): displayId is string {
    return typeof displayId === 'string' && /^[A-Za-z0-9-]+$/.test(displayId);
  }

  /**
   * Applies a write to the Signal K `self.displays` tree.
   *
   * @param displayId Target display UUID.
   * @param suffix Optional child field name (`screenIndex`, `activeScreen`) or `null` for the root display object.
   * @param value Value to write to the resolved Signal K path.
   * @returns A Signal K action result indicating success or failure.
   *
   * @example
   * ```ts
   * return applyDisplayWrite('881d9185-426e-4dc3-bb95-ed58b81392c1', 'screenIndex', 1);
   * ```
   */
  function applyDisplayWrite(displayId: string, suffix: string | null, value: Path | string | number | boolean | object | null): ActionResult {
    const path = suffix ? `displays.${displayId}.${suffix}` : `displays.${displayId}`;

    server.debug(`Applying display write to path=${path} value=${JSON.stringify(value)}`);

    try {
      server.handleMessage(
        plugin.id,
        {
          updates: [
            {
              values: [
                {
                  path: path as Path,
                  value: value ?? null
                }
              ]
            }
          ]
        },
        SKVersion.v1
      );
      return COMPLETED_OK;
    } catch (error) {
      const message = (error as Error)?.message ?? 'Unable to write display path';
      server.error(`Display write failure for path=${path}: ${message}`);
      return failed(400, message);
    }
  }

  /**
   * Handles the `kip.remote.setDisplay` PUT command.
   *
   * @param value Incoming PUT payload containing a display id and display object.
   * @returns A Signal K action result with validation or write outcome.
   *
   * @example
   * ```ts
   * // PUT path: vessels.self.kip.remote.setDisplay
   * // value: { displayId: 'uuid', display: { displayName: 'Helm', screens: [] } }
   * return handleSetDisplay(value);
   * ```
   */
  function handleSetDisplay(value: unknown): ActionResult {
    const command = value as IDisplayCommand | null;
    if (!command || typeof command !== 'object') {
      return failed(400, 'Command payload is required');
    }

    if (!isValidDisplayId(command.displayId)) {
      return failed(400, 'Invalid displayId format');
    }

    const displayValue = (command as { display?: unknown }).display ?? null;
    if (displayValue !== null && typeof displayValue !== 'object') {
      return failed(400, 'display must be an object or null');
    }

    return applyDisplayWrite(command.displayId, null, displayValue as object | null);
  }

  /**
   * Coerces unknown payload input to a screen command shape.
   *
   * @param value Raw PUT payload.
   * @returns Parsed screen command object when payload is an object, otherwise `null`.
   *
   * @example
   * ```ts
   * const command = parseScreenCommand(value);
   * if (!command) return failed(400, 'Command payload is required');
   * ```
   */
  function parseScreenCommand(value: unknown): IScreenCommand | null {
    if (!value || typeof value !== 'object') {
      return null;
    }
    return value as IScreenCommand;
  }

  /**
   * Handles screen-related PUT commands and writes to the corresponding display field.
   *
   * @param value Incoming PUT payload containing `displayId` and `screenIdx`.
   * @param suffix Target display field to write (`screenIndex` or `activeScreen`).
   * @returns A Signal K action result with validation or write outcome.
   *
   * @example
   * ```ts
   * return handleScreenWrite(value, 'activeScreen');
   * ```
   */
  function handleScreenWrite(value: unknown, suffix: 'screenIndex' | 'activeScreen'): ActionResult {
    const command = parseScreenCommand(value);
    if (!command) {
      return failed(400, 'Command payload is required');
    }

    if (!isValidDisplayId(command.displayId)) {
      return failed(400, 'Invalid displayId format');
    }

    const screenIdxValue = (command as { screenIdx?: unknown }).screenIdx ?? null;
    if (screenIdxValue !== null && typeof screenIdxValue !== 'number') {
      return failed(400, 'screenIdx must be a number or null');
    }

    return applyDisplayWrite(command.displayId, suffix, screenIdxValue as number | null);
  }

  const plugin: Plugin = {
    id: 'kip',
    name: 'KIP',
    description: 'KIP server plugin',
    start: (settings) => {
      server.debug(`Starting plugin with settings: ${JSON.stringify(settings)}`);
      server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.SET_DISPLAY, (_context, _path, value) => {
        return handleSetDisplay(value);
      });

      server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.SET_SCREEN_INDEX, (_context, _path, value) => {
        return handleScreenWrite(value, 'screenIndex');
      });

      server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.REQUEST_ACTIVE_SCREEN, (_context, _path, value) => {
        return handleScreenWrite(value, 'activeScreen');
      });

      server.setPluginStatus(`Starting...`);
    },
    stop: () => {
      server.debug(`Stopping plugin`);
      const msg = 'Stopped.';
      server.setPluginStatus(msg);
    },
    schema: () => CONFIG_SCHEMA,
    registerWithRouter() {
      server.setPluginStatus(`Providing remote display screen control`);
    }
  };

  return plugin;
}
module.exports = start;
