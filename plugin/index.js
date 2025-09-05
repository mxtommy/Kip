"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = (app) => {
    const displaysPath = 'displays.134-12341-1234-1234.activeScreen';
    const context = 'vessels.self';
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    function displayPutHandler(context, path, value, callback) {
        app.debug(`PUT handler called for context ${context}, path ${path}, value ${value}`);
        try {
            const delta = {
                updates: [
                    {
                        values: [
                            {
                                path: path,
                                value: value
                            }
                        ]
                    }
                ]
            };
            app.debug(`Sending message: `, JSON.stringify(delta));
            app.handleMessage(plugin.id, delta);
            return { state: "COMPLETED", statusCode: 200 };
        }
        catch (error) {
            app.error(`Error in PUT handler: ${error}`);
            return { state: "COMPLETED", statusCode: 400, message: error.message };
        }
    }
    const plugin = {
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
};
