export default function (app: any) {
  const error = app.error
  const debug = app.debug


  function handler(context: string, path: string, value: number, callback: any) {
      const timestamp = new Date().toISOString();

    const delta = {
      context: context,
      updates: [
      {
        source: {label: 'kip-commander'},
        timestamp: timestamp,
        values: [{ path: path, value: value}]
      }
      ]
    };

    app.debug('Sending delta:', JSON.stringify(delta));
    app.handleMessage(context, delta);
    return { state: 'COMPLETED', statusCode: 200 };
  }

  const plugin: Plugin = {

    start: function (properties: any) {
      const logging = {
        info: (msg: any) => {
        app.debug(msg)
        },
        error: (msg: any) => {
          app.error(msg)
        }
      }

      app.registerPutHandler('vessels.self', 'plugins.displays.activeScreen', handler, 'kip-plugin');
      app.registerPutHandler('vessels.self', 'plugins.displays.screens', handler, 'kip-plugin');
    },

    stop: function () {
    },

    id: 'kip-commander',
    name: 'KIP Commander',
    description: 'Signal K Plugin For Changing KIP Dashboards remotely',

    schema: () => {
      const schema: any = {
      }

      return schema
    },

    uiSchema: () => {
      const uiSchema: any = {
        authInfo: {
          'ui:widget': 'textarea'
        }
      }
      return uiSchema
    }
  }

  return plugin
}

interface Plugin {
  start: (app: any) => void
  stop: () => void
  id: string
  name: string
  description: string
  schema: any
  uiSchema: any
}
