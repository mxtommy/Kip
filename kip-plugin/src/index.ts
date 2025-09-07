import { Path, Plugin, ServerAPI, SKVersion } from '@signalk/server-api'
import { Request, Response } from 'express'
//import * as openapi from './openApi.json';

export default (server: ServerAPI): Plugin => {

  const API_PATHS = {
    DISPLAYS_PATH: `/displays/:kipId`,
    ACTIVESCREEN_PATH: `/displays/:kipId/activeScreen`
  } as const;

  const plugin: Plugin = {
    id: 'kip',
    name: 'KIP',
    description: 'KIP server plugin',
    start: (settings) => {
      server.debug(`Starting plugin with settings: ${JSON.stringify(settings)}`);
      server.setPluginStatus(`Starting...`)

      const p = server.getSelfPath('displays');
      server.debug(`Self path for displays.*: ${p}`);
    },
    stop: () => {
      server.debug(`Stopping plugin`);
      const msg = 'Stopped.'
      server.setPluginStatus(msg)
    },
    schema: () => {
        return {
          type: "object",
          properties: {}
        };
    },
    registerWithRouter(router) {
      server.debug(`Registering plugin routes: ${API_PATHS.DISPLAYS_PATH}`);

      router.put(`${API_PATHS.DISPLAYS_PATH}`, async (req: Request, res: Response) => {
        server.debug(`** PUT path ${API_PATHS.DISPLAYS_PATH}. Request Params: ${JSON.stringify(req.params)}, Body: ${JSON.stringify(req.body)}, Method: ${req.method}, Path: ${req.path}`);
        try {
          const dottedPath = pathToDotNotation(req.path);
          server.debug(`Converted request path ${req.path} to dot notation ${dottedPath} and updating SK path with req.body`);
          server.handleMessage(
            plugin.id,
            {
              updates: [
                {
                  values: [
                    {
                      path: dottedPath as Path,
                      value: req.body ? req.body : null
                    }
                  ]
                }
              ]
            },
            SKVersion.v1
          );
          return res.status(200).json({
            state: 'SUCCESS',
            statusCode: 200
          });

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return res.status(400).json({
            state: 'FAILED',
            statusCode: 400,
            message: (error as Error).message
          });
        }
      });

      router.put(`${API_PATHS.ACTIVESCREEN_PATH}`, async (req: Request, res: Response) => {
        server.debug(`** PUT path ${API_PATHS.ACTIVESCREEN_PATH}. Request Params: ${JSON.stringify(req.params)}, Body: ${JSON.stringify(req.body)}, Method: ${req.method}, Path: ${req.path}`);
        try {
          const dottedPath = pathToDotNotation(req.path);
          server.debug(`Converted request path ${req.path} to dot notation ${dottedPath} and updating SK path with req.body`);
          server.handleMessage(
            plugin.id,
            {
              updates: [
                {
                  values: [
                    {
                      path: dottedPath as Path,
                      value: req.body.screenId
                    }
                  ]
                }
              ]
            },
            SKVersion.v1
          );
          return res.status(200).json({
            state: 'SUCCESS',
            statusCode: 200
          });

        } catch (error) {
          const msg = `HandleMessage failed with errors!`
          server.setPluginError(msg)
          server.error(`Error in HandleMessage: ${error}`);

          return res.status(400).json({
            state: 'FAILED',
            statusCode: 400,
            message: (error as Error).message
          });
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

      server.setPluginStatus(`Providing remote display control`);
    }
  };

  /*
  * Replace all / with . and remove leading.
  */
  function pathToDotNotation(path: string): string {
    return path.replace(/\//g, '.').replace(/^\./, '');
  }

  return plugin;
}
