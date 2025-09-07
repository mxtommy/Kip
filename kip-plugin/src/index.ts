import { Path, Plugin, ServerAPI, SKVersion } from '@signalk/server-api'
import { Request, Response, NextFunction } from 'express'
import * as openapi from './openApi.json';

export default (server: ServerAPI): Plugin => {

  const API_PATHS = {
    DISPLAYS: `/displays`,
    INSTANCE: `/displays/:displayId`,
    ACTIVE_SCREEN: `/displays/:displayId/activeScreen`
  } as const;

  // Helpers
  function getDisplaySelfPath(displayId: string, suffix?: string): string {
    const tail = suffix ? `.${suffix}` : ''
    const want = `displays.${displayId}${tail}`
    const full = server.getSelfPath(want)
    server.debug(`getDisplaySelfPath: displayId: ${displayId}, suffix: ${suffix}, want=${want}, fullPath=${full}`)
    return full
  }

  function getAvailableDisplays(): Record<string, { displayName?: string }> | string | undefined {
    const fullPath = server.getSelfPath('displays');
    return server.getPath(fullPath) as Record<string, { displayName?: string }> | undefined
  }

  function pathToDotNotation(path: string): string {
    const dottedPath = path.replace(/\//g, '.').replace(/^\./, '');
    server.debug(`pathToDotNotation: input path=${path}, dottedPath=${dottedPath}`);
    return dottedPath;
  }

  function sendOk(res: Response, body?: unknown) {
    if (body === undefined) return res.status(204).end()
    return res.status(200).json(body)
  }

  function sendFail(res: Response, statusCode: number, message: string) {
    return res.status(statusCode).json({ state: 'FAILED', statusCode, message })
  }

  const plugin: Plugin = {
    id: 'kip',
    name: 'KIP',
    description: 'KIP server plugin',
    start: (settings) => {
      server.debug(`Starting plugin with settings: ${JSON.stringify(settings)}`);
      server.setPluginStatus(`Starting...`);
    },
    stop: () => {
      server.debug(`Stopping plugin`);
      const msg = 'Stopped.';
      server.setPluginStatus(msg);
    },
    schema: () => {
      return {
        type: "object",
        properties: {}
      };
    },
    registerWithRouter(router) {
      server.debug(`Registering plugin routes: ${API_PATHS.DISPLAYS}, ${API_PATHS.INSTANCE}, ${API_PATHS.ACTIVE_SCREEN}`);

      // Validate/normalize :displayId where present
      router.param('displayId', (req: Request & { displayId?: string }, res: Response, next: NextFunction, displayId: string) => {
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
          next()
        } catch {
          return sendFail(res, 400, 'Missing or invalid displayId parameter')
        }
      })

      router.put(`${API_PATHS.INSTANCE}`, async (req: Request, res: Response) => {
        server.debug(`** PUT ${API_PATHS.INSTANCE}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
        try {
          const dottedPath = pathToDotNotation(req.path);
          server.debug(`Updating SK path ${dottedPath} with body`)
          server.handleMessage(
            plugin.id,
            {
              updates: [
                {
                  values: [
                    {
                      path: dottedPath as Path,
                      value: req.body ?? null
                    }
                  ]
                }
              ]
            },
            SKVersion.v1
          );
          return res.status(200).json({ state: 'SUCCESS', statusCode: 200 });

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.put(`${API_PATHS.ACTIVE_SCREEN}`, async (req: Request, res: Response) => {
        server.debug(`** PUT ${API_PATHS.ACTIVE_SCREEN}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
        try {
          const dottedPath = pathToDotNotation(req.path);
          server.debug(`Updating SK path ${dottedPath} with body.screenIdx`)
          server.handleMessage(
            plugin.id,
            {
              updates: [
                {
                  values: [
                    {
                      path: dottedPath as Path,
                      value: req.body.screenIdx !== undefined ? req.body.screenIdx : null
                    }
                  ]
                }
              ]
            },
            SKVersion.v1
          );
          return res.status(200).json({ state: 'SUCCESS', statusCode: 200 });

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(API_PATHS.DISPLAYS, (req: Request, res: Response) => {
        server.debug(`** GET ${API_PATHS.DISPLAYS}. Params: ${JSON.stringify(req.params)}`);
        try {
          const displays = getAvailableDisplays();
          const items =
            displays && typeof displays === 'object'
              ? Object.entries(displays)
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                .filter(([_, v]) => v && typeof v === 'object')
                .map(([displayId, v]: [string, { displayName?: string }]) => ({
                  displayId,
                  displayName: v.displayName ?? null
                }))
              : [];

          return res.status(200).json(items);
        } catch (error) {
          server.error(`Error reading displays: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(`${API_PATHS.INSTANCE}`, (req: Request, res: Response) => {
        server.debug(`** GET ${API_PATHS.INSTANCE}. Params: ${JSON.stringify(req.params)}`);
        try {
          const displayId = (req as Request & { displayId?: string }).displayId
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter')
          }

          const fullPath = getDisplaySelfPath(displayId);
          const value = server.getPath(fullPath);

          if (value === undefined) {
            return sendFail(res, 404, `Display ${displayId} not found`)
          }

          return sendOk(res, value);
        } catch (error) {
          server.error(`Error reading display ${req.params?.displayId}: ${String((error as Error).message || error)}`);
          return sendFail(res, 400, (error as Error).message)
        }
      });

      router.get(`${API_PATHS.ACTIVE_SCREEN}`, (req: Request, res: Response) => {
        server.debug(`** GET ${API_PATHS.ACTIVE_SCREEN}. Params: ${JSON.stringify(req.params)}`);
        try {
          const displayId = (req as Request & { displayId?: string }).displayId
          if (!displayId) {
            return sendFail(res, 400, 'Missing displayId parameter')
          }

          const fullPath = getDisplaySelfPath(displayId, 'activeScreen');
          const value = server.getPath(fullPath);

          if (value === undefined) {
            return sendFail(res, 404, `Active screen for display ${displayId} not found`)
          }

          return sendOk(res, value);
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
    getOpenApi: () => openapi
  };

  return plugin;
}
