const test = require('node:test');
const assert = require('node:assert/strict');

function createServerMock() {
  const putHandlers = [];
  const messages = [];

  return {
    putHandlers,
    messages,
    debug() {},
    error() {},
    setPluginStatus() {},
    setPluginError() {},
    registerPutHandler(context, path, handler, id) {
      putHandlers.push({ context, path, handler, id });
    },
    handleMessage(pluginId, delta, version) {
      messages.push({ pluginId, delta, version });
    },
    getSelfPath(path) {
      if (path === 'displays') {
        return {
          abc: { value: { displayName: 'Helm' } }
        };
      }
      return { value: null };
    }
  };
}

function createRouterMock() {
  return {
    paramHandlers: new Map(),
    putHandlers: new Map(),
    getHandlers: new Map(),
    stack: [],
    param(name, handler) {
      this.paramHandlers.set(name, handler);
    },
    put(path, handler) {
      this.putHandlers.set(path, handler);
      this.stack.push({ route: { path, stack: [{ method: 'put' }] } });
    },
    get(path, handler) {
      this.getHandlers.set(path, handler);
      this.stack.push({ route: { path, stack: [{ method: 'get' }] } });
    }
  };
}

function createResMock() {
  return {
    statusCode: 200,
    payload: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.payload = body;
      return this;
    },
    end() {
      return this;
    }
  };
}

test('registers expected Signal K PUT handlers on start', () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);

  plugin.start({});

  assert.equal(server.putHandlers.length, 3);
  assert.deepEqual(
    server.putHandlers.map((h) => `${h.context}.${h.path}`),
    [
      'vessels.self.kip.remote.setDisplay',
      'vessels.self.kip.remote.setScreenIndex',
      'vessels.self.kip.remote.requestActiveScreen'
    ]
  );
});

test('setDisplay command writes to displays.<id>', () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);

  plugin.start({});

  const setDisplayHandler = server.putHandlers.find((h) => h.path === 'kip.remote.setDisplay').handler;
  const result = setDisplayHandler('vessels.self', 'kip.remote.setDisplay', {
    displayId: 'abc-123',
    display: { displayName: 'Mast', screens: [] }
  });

  assert.equal(result.statusCode, 200);
  assert.equal(server.messages.length, 1);
  assert.equal(server.messages[0].delta.updates[0].values[0].path, 'displays.abc-123');
});

test('setScreenIndex command writes to displays.<id>.screenIndex', () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);

  plugin.start({});

  const setScreenHandler = server.putHandlers.find((h) => h.path === 'kip.remote.setScreenIndex').handler;
  const result = setScreenHandler('vessels.self', 'kip.remote.setScreenIndex', {
    displayId: 'abc-123',
    screenIdx: 2
  });

  assert.equal(result.statusCode, 200);
  assert.equal(server.messages.length, 1);
  assert.equal(server.messages[0].delta.updates[0].values[0].path, 'displays.abc-123.screenIndex');
});

test('requestActiveScreen command writes to displays.<id>.activeScreen', () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);

  plugin.start({});

  const activeScreenHandler = server.putHandlers.find((h) => h.path === 'kip.remote.requestActiveScreen').handler;
  const result = activeScreenHandler('vessels.self', 'kip.remote.requestActiveScreen', {
    displayId: 'abc-123',
    screenIdx: 3
  });

  assert.equal(result.statusCode, 200);
  assert.equal(server.messages.length, 1);
  assert.equal(server.messages[0].delta.updates[0].values[0].path, 'displays.abc-123.activeScreen');
});

test('REST PUT /screenIndex uses shared handler and writes screenIndex path', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const paramHandler = router.paramHandlers.get('displayId');
  const putHandler = router.putHandlers.get('/displays/:displayId/screenIndex');

  const req = {
    method: 'PUT',
    path: '/displays/abc-123/screenIndex',
    ip: '127.0.0.1',
    headers: {},
    params: { displayId: 'abc-123' },
    body: { screenIdx: 7 }
  };
  const res = createResMock();

  await new Promise((resolve) => {
    paramHandler(req, res, resolve, 'abc-123');
  });
  await putHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(server.messages.length, 1);
  assert.equal(server.messages[0].delta.updates[0].values[0].path, 'displays.abc-123.screenIndex');
});

test('REST PUT /activeScreen uses shared handler and writes activeScreen path', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const paramHandler = router.paramHandlers.get('displayId');
  const putHandler = router.putHandlers.get('/displays/:displayId/activeScreen');

  const req = {
    method: 'PUT',
    path: '/displays/abc-123/activeScreen',
    ip: '127.0.0.1',
    headers: {},
    params: { displayId: 'abc-123' },
    body: { screenIdx: 4 }
  };
  const res = createResMock();

  await new Promise((resolve) => {
    paramHandler(req, res, resolve, 'abc-123');
  });
  await putHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(server.messages.length, 1);
  assert.equal(server.messages[0].delta.updates[0].values[0].path, 'displays.abc-123.activeScreen');
});

test('REST PUT /displays/:id writes root display object path', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const paramHandler = router.paramHandlers.get('displayId');
  const putHandler = router.putHandlers.get('/displays/:displayId');

  const req = {
    method: 'PUT',
    path: '/displays/abc-123',
    ip: '127.0.0.1',
    headers: {},
    params: { displayId: 'abc-123' },
    body: { displayName: 'Cockpit', screens: [{ id: 's1' }] }
  };
  const res = createResMock();

  await new Promise((resolve) => {
    paramHandler(req, res, resolve, 'abc-123');
  });
  await putHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(server.messages.length, 1);
  assert.equal(server.messages[0].delta.updates[0].values[0].path, 'displays.abc-123');
});

test('REST PUT returns 400 when displayId is missing', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const putHandler = router.putHandlers.get('/displays/:displayId/screenIndex');

  const req = {
    method: 'PUT',
    path: '/displays//screenIndex',
    ip: '127.0.0.1',
    headers: {},
    params: {},
    body: { screenIdx: 1 }
  };
  const res = createResMock();

  await putHandler(req, res);

  assert.equal(res.statusCode, 400);
  assert.equal(server.messages.length, 0);
  assert.equal(res.payload?.message, 'Missing displayId parameter');
});

test('REST GET /displays/:id returns 404 when display node is missing', async () => {
  const server = createServerMock();
  server.getSelfPath = (path) => {
    if (path === 'displays.abc-404') {
      return undefined;
    }
    return { value: null };
  };

  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const paramHandler = router.paramHandlers.get('displayId');
  const getHandler = router.getHandlers.get('/displays/:displayId');

  const req = {
    method: 'GET',
    path: '/displays/abc-404',
    ip: '127.0.0.1',
    headers: {},
    params: { displayId: 'abc-404' }
  };
  const res = createResMock();

  await new Promise((resolve) => {
    paramHandler(req, res, resolve, 'abc-404');
  });
  await getHandler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.payload?.message, 'Display abc-404 not found');
});

test('REST GET /screenIndex returns 404 when screenIndex node is missing', async () => {
  const server = createServerMock();
  server.getSelfPath = (path) => {
    if (path === 'displays.abc-404.screenIndex') {
      return undefined;
    }
    return { value: null };
  };

  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const paramHandler = router.paramHandlers.get('displayId');
  const getHandler = router.getHandlers.get('/displays/:displayId/screenIndex');

  const req = {
    method: 'GET',
    path: '/displays/abc-404/screenIndex',
    ip: '127.0.0.1',
    headers: {},
    params: { displayId: 'abc-404' }
  };
  const res = createResMock();

  await new Promise((resolve) => {
    paramHandler(req, res, resolve, 'abc-404');
  });
  await getHandler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.payload?.message, 'Active screen for display Id abc-404 not found in path');
});

test('REST GET /activeScreen returns 404 when activeScreen node is missing', async () => {
  const server = createServerMock();
  server.getSelfPath = (path) => {
    if (path === 'displays.abc-404.activeScreen') {
      return undefined;
    }
    return { value: null };
  };

  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const paramHandler = router.paramHandlers.get('displayId');
  const getHandler = router.getHandlers.get('/displays/:displayId/activeScreen');

  const req = {
    method: 'GET',
    path: '/displays/abc-404/activeScreen',
    ip: '127.0.0.1',
    headers: {},
    params: { displayId: 'abc-404' }
  };
  const res = createResMock();

  await new Promise((resolve) => {
    paramHandler(req, res, resolve, 'abc-404');
  });
  await getHandler(req, res);

  assert.equal(res.statusCode, 404);
  assert.equal(res.payload?.message, 'Change display screen Id abc-404 not found in path');
});

test('invalid displayId returns 400 and does not write', () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);

  plugin.start({});

  const setDisplayHandler = server.putHandlers.find((h) => h.path === 'kip.remote.setDisplay').handler;
  const result = setDisplayHandler('vessels.self', 'kip.remote.setDisplay', {
    displayId: 'bad/id',
    display: { displayName: 'Bad' }
  });

  assert.equal(result.statusCode, 400);
  assert.equal(server.messages.length, 0);
});
