"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const server_api_1 = require("@signalk/server-api");
const openapi = __importStar(require("./openApi.json"));
const start = (server) => {
    const API_PATHS = {
        DISPLAYS: `/displays`,
        INSTANCE: `/displays/:displayId`,
        ACTIVE_SCREEN: `/displays/:displayId/screenIndex`,
        CHANGE_SCREEN: `/displays/:displayId/activeScreen`
    };
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
    function getDisplaySelfPath(displayId, suffix) {
        const tail = suffix ? `.${suffix}` : '';
        const want = `displays.${displayId}${tail}`;
        const full = server.getSelfPath(want);
        server.debug(`getDisplaySelfPath: displayId: ${displayId}, suffix: ${suffix}, want=${want}, fullPath=${JSON.stringify(full)}`);
        return full ? full : undefined;
    }
    function getAvailableDisplays() {
        const fullPath = server.getSelfPath('displays');
        server.debug(`getAvailableDisplays: fullPath=${JSON.stringify(fullPath)}`);
        return fullPath ? fullPath : undefined;
    }
    function pathToDotNotation(path) {
        const dottedPath = path.replace(/\//g, '.').replace(/^\./, '');
        server.debug(`pathToDotNotation: input path=${path}, dottedPath=${dottedPath}`);
        return dottedPath;
    }
    function sendOk(res, body) {
        if (body === undefined)
            return res.status(204).end();
        return res.status(200).json(body);
    }
    function sendFail(res, statusCode, message) {
        return res.status(statusCode).json({ state: 'FAILED', statusCode, message });
    }
    const plugin = {
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
        schema: () => CONFIG_SCHEMA,
        registerWithRouter(router) {
            server.debug(`Registering plugin routes: ${API_PATHS.DISPLAYS}, ${API_PATHS.INSTANCE}, ${API_PATHS.ACTIVE_SCREEN}, ${API_PATHS.CHANGE_SCREEN}`);
            // Validate/normalize :displayId where present
            router.param('displayId', (req, res, next, displayId) => {
                if (displayId == null)
                    return sendFail(res, 400, 'Missing displayId parameter');
                try {
                    let id = String(displayId);
                    // Decode percent-encoding if present
                    try {
                        id = decodeURIComponent(id);
                    }
                    catch {
                        // ignore decode errors, keep original id
                    }
                    // If someone sent JSON as the path segment, try to recover {"displayId":"..."}
                    if (id.trim().startsWith('{')) {
                        try {
                            const parsed = JSON.parse(id);
                            if (parsed && typeof parsed.displayId === 'string') {
                                id = parsed.displayId;
                            }
                            else {
                                return sendFail(res, 400, 'Invalid displayId format in JSON');
                            }
                        }
                        catch {
                            return sendFail(res, 400, 'Invalid displayId JSON');
                        }
                    }
                    // Basic safety: allow UUID-like strings (alphanum + dash)
                    if (!/^[A-Za-z0-9-]+$/.test(id)) {
                        return sendFail(res, 400, 'Invalid displayId format');
                    }
                    req.displayId = id;
                    next();
                }
                catch {
                    return sendFail(res, 400, 'Missing or invalid displayId parameter');
                }
            });
            router.put(`${API_PATHS.INSTANCE}`, async (req, res) => {
                server.debug(`** PUT ${API_PATHS.INSTANCE}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
                try {
                    const dottedPath = pathToDotNotation(req.path);
                    server.debug(`Updating SK path ${dottedPath}`);
                    server.handleMessage(plugin.id, {
                        updates: [
                            {
                                values: [
                                    {
                                        path: dottedPath,
                                        value: req.body ?? null
                                    }
                                ]
                            }
                        ]
                    }, server_api_1.SKVersion.v1);
                    return res.status(200).json({ state: 'SUCCESS', statusCode: 200 });
                }
                catch (error) {
                    const msg = `HandleMessage failed with errors!`;
                    server.setPluginError(msg);
                    server.error(`Error in HandleMessage: ${error}`);
                    return sendFail(res, 400, error.message);
                }
            });
            router.put(`${API_PATHS.ACTIVE_SCREEN}`, async (req, res) => {
                server.debug(`** PUT ${API_PATHS.ACTIVE_SCREEN}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
                try {
                    const dottedPath = pathToDotNotation(req.path);
                    server.debug(`Updating SK path ${dottedPath} with body.screenIdx`);
                    server.handleMessage(plugin.id, {
                        updates: [
                            {
                                values: [
                                    {
                                        path: dottedPath,
                                        value: req.body.screenIdx !== undefined ? req.body.screenIdx : null
                                    }
                                ]
                            }
                        ]
                    }, server_api_1.SKVersion.v1);
                    return res.status(200).json({ state: 'SUCCESS', statusCode: 200 });
                }
                catch (error) {
                    const msg = `HandleMessage failed with errors!`;
                    server.setPluginError(msg);
                    server.error(`Error in HandleMessage: ${error}`);
                    return sendFail(res, 400, error.message);
                }
            });
            router.put(`${API_PATHS.CHANGE_SCREEN}`, async (req, res) => {
                server.debug(`** PUT ${API_PATHS.CHANGE_SCREEN}. Params: ${JSON.stringify(req.params)} Body: ${JSON.stringify(req.body)}`);
                try {
                    const dottedPath = pathToDotNotation(req.path);
                    server.debug(`Updating SK path ${dottedPath} with body.screenIdx`);
                    server.handleMessage(plugin.id, {
                        updates: [
                            {
                                values: [
                                    {
                                        path: dottedPath,
                                        value: req.body.screenIdx !== undefined ? req.body.screenIdx : null
                                    }
                                ]
                            }
                        ]
                    }, server_api_1.SKVersion.v1);
                    return res.status(200).json({ state: 'SUCCESS', statusCode: 200 });
                }
                catch (error) {
                    const msg = `HandleMessage failed with errors!`;
                    server.setPluginError(msg);
                    server.error(`Error in HandleMessage: ${error}`);
                    return sendFail(res, 400, error.message);
                }
            });
            router.get(API_PATHS.DISPLAYS, (req, res) => {
                server.debug(`** GET ${API_PATHS.DISPLAYS}. Params: ${JSON.stringify(req.params)}`);
                try {
                    const displays = getAvailableDisplays();
                    const items = displays && typeof displays === 'object'
                        ? Object.entries(displays)
                            .filter(([, v]) => v && typeof v === 'object')
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            .map(([displayId, v]) => ({
                            displayId,
                            displayName: v?.value?.displayName ?? null
                        }))
                        : [];
                    server.debug(`getAvailableDisplays returned: ${JSON.stringify(displays)}`);
                    server.debug(`Found ${items.length} displays: ${JSON.stringify(items)}`);
                    return res.status(200).json(items);
                }
                catch (error) {
                    server.error(`Error reading displays: ${String(error.message || error)}`);
                    return sendFail(res, 400, error.message);
                }
            });
            router.get(`${API_PATHS.INSTANCE}`, (req, res) => {
                server.debug(`** GET ${API_PATHS.INSTANCE}. Params: ${JSON.stringify(req.params)}`);
                try {
                    const displayId = req.displayId;
                    if (!displayId) {
                        return sendFail(res, 400, 'Missing displayId parameter');
                    }
                    const node = getDisplaySelfPath(displayId);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const screens = node?.value?.screens ?? null;
                    if (screens === undefined) {
                        return sendFail(res, 404, `Display ${displayId} not found`);
                    }
                    return sendOk(res, screens);
                }
                catch (error) {
                    server.error(`Error reading display ${req.params?.displayId}: ${String(error.message || error)}`);
                    return sendFail(res, 400, error.message);
                }
            });
            router.get(`${API_PATHS.ACTIVE_SCREEN}`, (req, res) => {
                server.debug(`** GET ${API_PATHS.ACTIVE_SCREEN}. Params: ${JSON.stringify(req.params)}`);
                try {
                    const displayId = req.displayId;
                    if (!displayId) {
                        return sendFail(res, 400, 'Missing displayId parameter');
                    }
                    const node = getDisplaySelfPath(displayId, 'activeScreen');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const idx = node?.value ?? null;
                    if (idx === undefined) {
                        return sendFail(res, 404, `Active screen for display ${displayId} not found`);
                    }
                    return sendOk(res, idx);
                }
                catch (error) {
                    server.error(`Error reading activeScreen for ${req.params?.displayId}: ${String(error.message || error)}`);
                    return sendFail(res, 400, error.message);
                }
            });
            router.get(`${API_PATHS.CHANGE_SCREEN}`, (req, res) => {
                server.debug(`** GET ${API_PATHS.CHANGE_SCREEN}. Params: ${JSON.stringify(req.params)}`);
                try {
                    const changeId = req.changeId;
                    if (!changeId) {
                        return sendFail(res, 400, 'Missing changeId parameter');
                    }
                    const node = getDisplaySelfPath(changeId, 'activeScreen');
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const idx = node?.value ?? null;
                    if (idx === undefined) {
                        return sendFail(res, 404, `Active screen for display ${changeId} not found`);
                    }
                    return sendOk(res, idx);
                }
                catch (error) {
                    server.error(`Error reading activeScreen for ${req.params?.changeId}: ${String(error.message || error)}`);
                    return sendFail(res, 400, error.message);
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
            server.setPluginStatus(`Providing remote display screen control`);
        },
        getOpenApi: () => openapi
    };
    return plugin;
};
module.exports = start;
