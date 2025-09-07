"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const server_api_1 = require("@signalk/server-api");
//import * as openapi from './openApi.json';
exports.default = (server) => {
    const API_PATHS = {
        DISPLAYS_PATH: `/displays/:kipId`,
        ACTIVESCREEN_PATH: `/displays/:kipId/activeScreen`
    };
    const plugin = {
        id: 'kip',
        name: 'KIP',
        description: 'KIP server plugin',
        start: (settings) => {
            server.debug(`Starting plugin with settings: ${JSON.stringify(settings)}`);
            server.setPluginStatus(`Starting...`);
            const p = server.getSelfPath('displays.*');
            server.debug(`Self path for displays.*: ${p}`);
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
            server.debug(`Registering plugin routes: ${API_PATHS.DISPLAYS_PATH}`);
            router.put(`${API_PATHS.DISPLAYS_PATH}`, async (req, res) => {
                server.debug(`** PUT path ${API_PATHS.DISPLAYS_PATH}. Request Params: ${JSON.stringify(req.params)}, Body: ${JSON.stringify(req.body)}, Method: ${req.method}, Path: ${req.path}`);
                try {
                    const dottedPath = pathToDotNotation(req.path);
                    server.debug(`Converted request path ${req.path} to dot notation ${dottedPath} and updating SK path with req.body`);
                    server.handleMessage(plugin.id, {
                        updates: [
                            {
                                values: [
                                    {
                                        path: dottedPath,
                                        value: req.body ? req.body : null
                                    }
                                ]
                            }
                        ]
                    }, server_api_1.SKVersion.v1);
                    return res.status(200).json({
                        state: 'SUCCESS',
                        statusCode: 200
                    });
                }
                catch (error) {
                    const msg = `HandleMessage failed with errors!`;
                    server.setPluginError(msg);
                    server.error(`Error in HandleMessage: ${error}`);
                    return res.status(400).json({
                        state: 'FAILED',
                        statusCode: 400,
                        message: error.message
                    });
                }
            });
            router.put(`${API_PATHS.ACTIVESCREEN_PATH}`, async (req, res) => {
                server.debug(`** PUT path ${API_PATHS.ACTIVESCREEN_PATH}. Request Params: ${JSON.stringify(req.params)}, Body: ${JSON.stringify(req.body)}, Method: ${req.method}, Path: ${req.path}`);
                try {
                    const dottedPath = pathToDotNotation(req.path);
                    server.debug(`Converted request path ${req.path} to dot notation ${dottedPath} and updating SK path with req.body`);
                    server.handleMessage(plugin.id, {
                        updates: [
                            {
                                values: [
                                    {
                                        path: dottedPath,
                                        value: req.body.screenId
                                    }
                                ]
                            }
                        ]
                    }, server_api_1.SKVersion.v1);
                    return res.status(200).json({
                        state: 'SUCCESS',
                        statusCode: 200
                    });
                }
                catch (error) {
                    const msg = `HandleMessage failed with errors!`;
                    server.setPluginError(msg);
                    server.error(`Error in HandleMessage: ${error}`);
                    return res.status(400).json({
                        state: 'FAILED',
                        statusCode: 400,
                        message: error.message
                    });
                }
            });
            // List all registered routes for debugging
            if (router.stack) {
                router.stack.forEach((layer) => {
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
    function pathToDotNotation(path) {
        return path.replace(/\//g, '.').replace(/^\./, '');
    }
    return plugin;
};
