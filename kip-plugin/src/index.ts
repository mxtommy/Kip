import { Delta, Path, Plugin, ServerAPI, Value } from '@signalk/server-api'

export default (app: ServerAPI): Plugin => {
  const displaysPath = 'displays.134-12341-1234-1234.activeScreen';
  const context = 'vessels.self';

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function displayPutHandler(context: string, path: string, value: Value, callback?: unknown): { state: 'COMPLETED'; statusCode: number; message?: string } {
    app.debug(`PUT handler called for context ${context}, path ${path}, value ${value}`);
    try {
      const delta: Delta = {
        updates: [
          {
            values: [
              {
                path: path as Path,
                value: value
              }
            ]
          }
        ]
      };
      app.debug(`Sending message: `, JSON.stringify(delta));
      app.handleMessage(plugin.id, delta);
      return { state: "COMPLETED" as const, statusCode: 200 };

    } catch (error) {
      app.error(`Error in PUT handler: ${error}`);
      return { state: "COMPLETED" as const, statusCode: 400, message: (error as Error).message };
    }
  }

  const plugin: Plugin = {
    id: 'kip',
    name: 'KIP',
    description: 'KIP server plugin',
    start: (settings) => {
      app.debug(`Starting plugin with settings: ${JSON.stringify(settings)}`);
      app.registerPutHandler(context, displaysPath, displayPutHandler);
    },
    stop: () => {
      app.debug(`Stopping plugin`);
    },
    schema: () => {
        return {
          type: "object",
          properties: {}
        };
    }
  };

  return plugin;
}
