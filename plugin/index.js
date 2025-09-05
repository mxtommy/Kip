"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = default_1;
function default_1(app) {
    const error = app.error;
    const debug = app.debug;
    function handler(context, path, value, callback) {
        const timestamp = new Date().toISOString();
        const delta = {
            context: context,
            updates: [
                {
                    source: { label: 'kip-commander' },
                    timestamp: timestamp,
                    values: [{ path: path, value: value }]
                }
            ]
        };
        app.debug('Sending delta:', JSON.stringify(delta));
        app.handleMessage(context, delta);
        return { state: 'COMPLETED', statusCode: 200 };
    }
    const plugin = {
        start: function (properties) {
            const logging = {
                info: (msg) => {
                    app.debug(msg);
                },
                error: (msg) => {
                    app.error(msg);
                }
            };
            app.registerPutHandler('vessels.self', 'plugins.displays.activeScreen', handler, 'kip-plugin');
            app.registerPutHandler('vessels.self', 'plugins.displays.screens', handler, 'kip-plugin');
        },
        stop: function () {
        },
        id: 'kip-commander',
        name: 'KIP Commander',
        description: 'Signal K Plugin For Changing KIP Dashboards remotely',
        schema: () => {
            const schema = {};
            return schema;
        },
        uiSchema: () => {
            const uiSchema = {
                authInfo: {
                    'ui:widget': 'textarea'
                }
            };
            return uiSchema;
        }
    };
    return plugin;
}
