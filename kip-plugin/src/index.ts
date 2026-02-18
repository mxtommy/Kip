import { ActionResult, Path, Plugin, ServerAPI, SKVersion } from '@signalk/server-api'
import { Request, Response, NextFunction } from 'express'
import * as openapi from './openApi.json';

const start = (server: ServerAPI): Plugin => {

  const mutableOpenApi = JSON.parse(JSON.stringify((openapi as { default?: unknown }).default ?? openapi));

  const API_PATHS = {
    DISPLAYS: `/displays`,
    INSTANCE: `/displays/:displayId`,
    SCREEN_INDEX: `/displays/:displayId/screenIndex`,
    ACTIVATE_SCREEN: `/displays/:displayId/activeScreen`
  } as const;

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

  // Helpers
  function getDisplaySelfPath(displayId: string, suffix?: string): object | undefined {
    const tail = suffix ? `.${suffix}` : ''
    const want = `displays.${displayId}${tail}`
    const full = server.getSelfPath(want)
    server.debug(`getDisplaySelfPath: displayId: ${displayId}, suffix: ${suffix}, want=${want}, fullPath=${JSON.stringify(full)}`)
    return typeof full === 'object' && full !== null ? full : undefined;
  }

  function getAvailableDisplays(): object | undefined {
    const fullPath = server.getSelfPath('displays') ;
    server.debug(`getAvailableDisplays: fullPath=${JSON.stringify(fullPath)}`);
    return typeof fullPath === 'object' && fullPath !== null ? fullPath : undefined;
  }

  function sendOk(res: Response, body?: unknown) {
    if (body === undefined) return res.status(204).end()
    return res.status(200).json(body)
  }

  function sendFail(res: Response, statusCode: number, message: string) {
    return res.status(statusCode).json({ state: 'FAILED', statusCode, message })
  }

  function logAuthTrace(req: Request, stage: string) {
    const hasAuthorizationHeader = typeof req.headers.authorization === 'string' && req.headers.authorization.length > 0;
    const hasCookieHeader = typeof req.headers.cookie === 'string' && req.headers.cookie.length > 0;
    const origin = req.headers.origin ?? null;
    const userAgent = req.headers['user-agent'] ?? null;
    const contentType = req.headers['content-type'] ?? null;

    server.debug(
      `[AUTH TRACE] stage=${stage} method=${req.method} path=${req.path} ip=${req.ip} origin=${String(origin)} authHeader=${hasAuthorizationHeader} cookieHeader=${hasCookieHeader} contentType=${String(contentType)} userAgent=${String(userAgent)}`
    );
  }

  function completed(statusCode: number, message?: string): ActionResult {
    return { state: 'COMPLETED', statusCode, message };
  }

  function isValidDisplayId(displayId: unknown): displayId is string {
    return typeof displayId === 'string' && /^[A-Za-z0-9-]+$/.test(displayId);
  }

  function applyDisplayWrite(displayId: string, suffix: 'screenIndex' | 'activeScreen' | null, value: string | number | boolean | object | null): ActionResult {
    const path = suffix ? `displays.${displayId}.${suffix}` : `displays.${displayId}`;
    server.debug(`[WRITE TRACE] applyDisplayWrite path=${path} value=${JSON.stringify(value)}`);
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
      server.debug(`[WRITE TRACE] handleMessage success path=${path}`);
      return completed(200);
    } catch (error) {
      const message = (error as Error)?.message ?? 'Unable to write display path';
      server.error(`[WRITE TRACE] handleMessage failure path=${path} message=${message}`);
      return completed(400, message);
    }
  }

  function handleSetDisplay(value: unknown): ActionResult {
    server.debug(`[COMMAND TRACE] handleSetDisplay payload=${JSON.stringify(value)}`);
    const command = value as { displayId?: unknown; display?: unknown } | null;
    if (!command || typeof command !== 'object') {
      return completed(400, 'Command payload is required');
    }

    if (!isValidDisplayId(command.displayId)) {
      return completed(400, 'Invalid displayId format');
    }

    const displayValue = command.display ?? null;
    if (displayValue !== null && typeof displayValue !== 'object') {
      return completed(400, 'display must be an object or null');
    }

    return applyDisplayWrite(command.displayId, null, displayValue as object | null);
  }

  function handleScreenWrite(value: unknown, suffix: 'screenIndex' | 'activeScreen'): ActionResult {
    server.debug(`[COMMAND TRACE] handleScreenWrite suffix=${suffix} payload=${JSON.stringify(value)}`);
    const command = value as { displayId?: unknown; screenIdx?: unknown } | null;
    if (!command || typeof command !== 'object') {
      return completed(400, 'Command payload is required');
    }

    if (!isValidDisplayId(command.displayId)) {
      return completed(400, 'Invalid displayId format');
    }

    const screenIdxValue = command.screenIdx ?? null;
    if (screenIdxValue !== null && typeof screenIdxValue !== 'number') {
      return completed(400, 'screenIdx must be a number or null');
    }

    return applyDisplayWrite(command.displayId, suffix, screenIdxValue as number | null);
  }

  function sendActionAsRest(res: Response, result: ActionResult) {
    server.debug(`[REST TRACE] sendActionAsRest statusCode=${result.statusCode} message=${result.message ?? ''}`);
    if (result.statusCode === 200) {
      return res.status(200).json({ state: 'SUCCESS', statusCode: 200 });
    }
    return sendFail(res, result.statusCode || 400, result.message || 'Command failed');
  }

  const plugin: Plugin = {
    id: 'kip',
    name: 'KIP',
    description: 'KIP server plugin',
    start: (settings) => {
      server.debug(`Starting plugin with settings: ${JSON.stringify(settings)}`);

      if (server.registerPutHandler) {
        server.debug(`[COMMAND TRACE] Registering PUT handlers under context=${PUT_CONTEXT}`);
        server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.SET_DISPLAY, (context, path, value) => {
          server.debug(`[COMMAND TRACE] PUT handler hit path=${String(path)} context=${String(context)} command=${COMMAND_PATHS.SET_DISPLAY}`);
          void context;
          void path;
          return handleSetDisplay(value);
        }, plugin.id);

        server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.SET_SCREEN_INDEX, (context, path, value) => {
          server.debug(`[COMMAND TRACE] PUT handler hit path=${String(path)} context=${String(context)} command=${COMMAND_PATHS.SET_SCREEN_INDEX}`);
          void context;
          void path;
          return handleScreenWrite(value, 'screenIndex');
        }, plugin.id);

        server.registerPutHandler(PUT_CONTEXT, COMMAND_PATHS.REQUEST_ACTIVE_SCREEN, (context, path, value) => {
          server.debug(`[COMMAND TRACE] PUT handler hit path=${String(path)} context=${String(context)} command=${COMMAND_PATHS.REQUEST_ACTIVE_SCREEN}`);
          void context;
          void path;
          return handleScreenWrite(value, 'activeScreen');
        }, plugin.id);
      }

      server.setPluginStatus(`Starting...`);
    },
    stop: () => {
      server.debug(`Stopping plugin`);
      const msg = 'Stopped.';
      server.setPluginStatus(msg);
    },
    schema: () => CONFIG_SCHEMA,
    registerWithRouter(router) {
      server.debug(`Registering plugin routes: ${API_PATHS.DISPLAYS}, ${API_PATHS.INSTANCE}, ${API_PATHS.SCREEN_INDEX}, ${API_PATHS.ACTIVATE_SCREEN}`);

      // Validate/normalize :displayId where present
      router.param('displayId', (req: Request & { displayId?: string }, res: Response, next: NextFunction, displayId: string) => {
        logAuthTrace(req, 'router.param:displayId:entry');
        if (displayId == null) return sendFail(res, 400, 'Missing displayId parameter')
        try {
          let id = String(displayId)
          // Decode percent-encoding if present
          try {
            id = decodeURIComponent(id)
          } catch {
            // ignore decode errors, keep original id
          }
          // If someone sent JSON as the path segment, try to recover {"displayId":"..."}
          if (id.trim().startsWith('{')) {
            try {
              const parsed = JSON.parse(id)
              if (parsed && typeof parsed.displayId === 'string') {
                id = parsed.displayId
              } else {
                return sendFail(res, 400, 'Invalid displayId format in JSON')
              }
            } catch {
              return sendFail(res, 400, 'Invalid displayId JSON')
            }
          }
          // Basic safety: allow UUID-like strings (alphanum + dash)
          if (!/^[A-Za-z0-9-]+$/.test(id)) {
            return sendFail(res, 400, 'Invalid displayId format')
          }
          req.displayId = id
          server.debug(`[AUTH TRACE] router.param:displayId:normalized displayId=${id}`);
          next()
        } catch {
          server.error(`[AUTH TRACE] router.param:displayId:failed rawDisplayId=${String(displayId)}`);
          return sendFail(res, 400, 'Missing or invalid displayId parameter')
        }
      })

      router.put(`${API_PATHS.INSTANCE}`, async (req: Request & { displayId?: string }, res: Response) => {
        logAuthTrace(req, 'route:PUT:INSTANCE:entry');
        server.debug(`** PUT ${API_PATHS.INSTANCE}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
        try {
          const displayId = req.displayId;
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter');
          }
          const result = handleSetDisplay({ displayId, display: req.body ?? null });
          return sendActionAsRest(res, result);

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.put(`${API_PATHS.SCREEN_INDEX}`, async (req: Request & { displayId?: string }, res: Response) => {
        logAuthTrace(req, 'route:PUT:SCREEN_INDEX:entry');
        server.debug(`** PUT ${API_PATHS.SCREEN_INDEX}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
        try {
          const displayId = req.displayId;
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter');
          }
          const result = handleScreenWrite({
            displayId,
            screenIdx: req.body?.screenIdx !== undefined ? req.body.screenIdx : null
          }, 'screenIndex');
          return sendActionAsRest(res, result);

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.put(`${API_PATHS.ACTIVATE_SCREEN}`, async (req: Request & { displayId?: string }, res: Response) => {
        logAuthTrace(req, 'route:PUT:ACTIVATE_SCREEN:entry');
        server.debug(`** PUT ${API_PATHS.ACTIVATE_SCREEN}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
        try {
          const displayId = req.displayId;
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter');
          }
          const result = handleScreenWrite({
            displayId,
            screenIdx: req.body?.screenIdx !== undefined ? req.body.screenIdx : null
          }, 'activeScreen');
          return sendActionAsRest(res, result);

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(API_PATHS.DISPLAYS, (req: Request, res: Response) => {
        server.debug(`*** GET DISPLAY ${API_PATHS.DISPLAYS}. Params: ${JSON.stringify(req.params)}`);
        try {
          const displays = getAvailableDisplays();
          const items = displays && typeof displays === 'object'
            ? Object.entries(displays)
                .filter(([, v]) => v && typeof v === 'object')
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                .map(([displayId, v]: [string, any]) => ({
                  displayId,
                  displayName: v?.value?.displayName ?? null
                }))
            : [];
          server.debug(`getAvailableDisplays returned: ${JSON.stringify(displays)}`);
          server.debug(`Found ${items.length} displays: ${JSON.stringify(items)}`);
          return res.status(200).json(items);
        } catch (error) {
          server.error(`Error reading displays: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(`${API_PATHS.INSTANCE}`, (req: Request, res: Response) => {
        server.debug(`*** GET INSTANCE ${API_PATHS.INSTANCE}. Params: ${JSON.stringify(req.params)}`);
        try {
          const displayId = (req as Request & { displayId?: string }).displayId
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter')
          }

          const node = getDisplaySelfPath(displayId);
          if (node === undefined) {
            return sendFail(res, 404, `Display ${displayId} not found`)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const screens = (node as any)?.value?.screens ?? null;

          return sendOk(res, screens);
        } catch (error) {
          server.error(`Error reading display ${req.params?.displayId}: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(`${API_PATHS.SCREEN_INDEX}`, (req: Request, res: Response) => {
        server.debug(`*** GET SCREEN_INDEX ${API_PATHS.SCREEN_INDEX}. Params: ${JSON.stringify(req.params)}`);
        try {
          const displayId = (req as Request & { displayId?: string }).displayId
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter')
          }

          const node = getDisplaySelfPath(displayId, 'screenIndex');
          if (node === undefined) {
            return sendFail(res, 404, `Active screen for display Id ${displayId} not found in path`)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const idx = (node as any)?.value ?? null;

          return sendOk(res, idx);
        } catch (error) {
          server.error(`Error reading activeScreen for ${req.params?.displayId}: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(`${API_PATHS.ACTIVATE_SCREEN}`, (req: Request, res: Response) => {
        server.debug(`*** GET ACTIVATE_SCREEN ${API_PATHS.ACTIVATE_SCREEN}. Params: ${JSON.stringify(req.params)}`);
        try {
          const displayId = (req as Request & { displayId?: string }).displayId
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter')
          }

          const node = getDisplaySelfPath(displayId, 'activeScreen');
          if (node === undefined) {
            return sendFail(res, 404, `Change display screen Id ${displayId} not found in path`)
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const idx = (node as any)?.value ?? null;

          return sendOk(res, idx);
        } catch (error) {
          server.error(`Error reading activeScreen for ${req.params?.displayId}: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      // List all registered routes for debugging
      if (router.stack) {
        router.stack.forEach((layer: { route?: { path?: string; stack: { method: string }[] } }) => {
          if (layer.route && layer.route.path) {
            server.debug(`Registered route: ${layer.route.stack[0].method.toUpperCase()} ${layer.route.path}`);
          }
        });
      }

      server.setPluginStatus(`Providing remote display screen control`);
    },
    getOpenApi: () => mutableOpenApi
  };

  return plugin;
}
module.exports = start;
