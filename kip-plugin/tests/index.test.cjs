const test = require('node:test');
const assert = require('node:assert/strict');
const { HistorySeriesService } = require('../../plugin/history-series.service.js');
const { DuckDbParquetStorageService } = require('../../plugin/duckdb-parquet-storage.service.js');

const TEST_AUTH_USER = { username: 'test-user' };

function createServerMock() {
  const putHandlers = [];
  const messages = [];
  const streamSubscribersByPath = new Map();
  let legacyHistoryProvider = null;
  let historyApiProvider = null;

  const streambundle = {
    getBus(path) {
      return {
        onValue(callback) {
          const list = streamSubscribersByPath.get(path) ?? [];
          list.push(callback);
          streamSubscribersByPath.set(path, list);
          return () => {
            const next = (streamSubscribersByPath.get(path) ?? []).filter((entry) => entry !== callback);
            streamSubscribersByPath.set(path, next);
          };
        }
      };
    }
  };

  return {
    putHandlers,
    messages,
    streambundle,
    history: {
      registerHistoryApiProvider(provider) {
        historyApiProvider = provider;
      },
      unregisterHistoryApiProvider() {
        historyApiProvider = null;
      },
      getRegisteredProvider() {
        return historyApiProvider;
      }
    },
    debug() {},
    error() {},
    setPluginStatus() {},
    setPluginError() {},
    registerHistoryProvider(provider) {
      legacyHistoryProvider = provider;
    },
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
    },
    emitStream(path, sample) {
      const callbacks = streamSubscribersByPath.get(path) ?? [];
      callbacks.forEach((callback) => callback(sample));
    },
    getLegacyHistoryProvider() {
      return legacyHistoryProvider;
    }
  };
}

function createRouterMock() {
  return {
    paramHandlers: new Map(),
    putHandlers: new Map(),
    postHandlers: new Map(),
    deleteHandlers: new Map(),
    getHandlers: new Map(),
    stack: [],
    param(name, handler) {
      this.paramHandlers.set(name, handler);
    },
    put(path, handler) {
      this.putHandlers.set(path, handler);
      this.stack.push({ route: { path, stack: [{ method: 'put' }] } });
    },
    post(path, handler) {
      this.postHandlers.set(path, handler);
      this.stack.push({ route: { path, stack: [{ method: 'post' }] } });
    },
    delete(path, handler) {
      this.deleteHandlers.set(path, handler);
      this.stack.push({ route: { path, stack: [{ method: 'delete' }] } });
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

function assertSeriesAlmostEqual(actual, expected, epsilon = 1e-9) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    const delta = Math.abs(actual[index] - expected[index]);
    assert.equal(delta <= epsilon, true, `index=${index} expected=${expected[index]} actual=${actual[index]}`);
  }
}

function createHistoryServiceWithSamples(baseTs, values) {
  const service = new HistorySeriesService(() => baseTs + 120000);
  service.upsertSeries({
    seriesId: 'math-1',
    datasetUuid: 'math-1',
    ownerWidgetUuid: 'widget-math-1',
    path: 'navigation.speedOverGround',
    context: 'vessels.self'
  });

  values.forEach((value, index) => {
    service.recordSample('math-1', value, baseTs + (index * 10000));
  });

  return service;
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

test('registers and unregisters History API provider lifecycle', () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);

  plugin.start({});

  assert.equal(typeof server.history.getRegisteredProvider(), 'object');
  assert.equal(typeof server.history.getRegisteredProvider().getValues, 'function');
  assert.equal(typeof server.history.getRegisteredProvider().getPaths, 'function');
  assert.equal(typeof server.history.getRegisteredProvider().getContexts, 'function');
  assert.equal(typeof server.getLegacyHistoryProvider(), 'object');

  plugin.stop();

  assert.equal(server.history.getRegisteredProvider(), null);
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

test('registers series and history routes', () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  assert.equal(router.getHandlers.has('/series'), true);
  assert.equal(router.putHandlers.has('/series/:seriesId'), true);
  assert.equal(router.deleteHandlers.has('/series/:seriesId'), true);
  assert.equal(router.postHandlers.has('/series/reconcile'), true);
  assert.equal(router.getHandlers.has('/history/paths'), true);
  assert.equal(router.getHandlers.has('/history/contexts'), true);
  assert.equal(router.getHandlers.has('/history/values'), true);
});

test('series CRUD works and history paths/contexts come from stored samples', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const list = router.getHandlers.get('/series');
  const getPaths = router.getHandlers.get('/history/paths');
  const getContexts = router.getHandlers.get('/history/contexts');
  const remove = router.deleteHandlers.get('/series/:seriesId');

  const upsertReq = {
    method: 'PUT',
    path: '/series/chart-1',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    params: { seriesId: 'chart-1' },
    body: {
      datasetUuid: 'chart-1',
      ownerWidgetUuid: 'widget-1',
      path: 'navigation.speedOverGround',
      context: 'vessels.self',
      timeScale: 'minute',
      period: 30
    }
  };
  const upsertRes = createResMock();
  await upsert(upsertReq, upsertRes);

  assert.equal(upsertRes.statusCode, 200);
  assert.equal(upsertRes.payload.seriesId, 'chart-1');

  const listRes = createResMock();
  await list({ params: {}, headers: {}, query: {}, user: TEST_AUTH_USER }, listRes);
  assert.equal(listRes.statusCode, 200);
  assert.equal(Array.isArray(listRes.payload), true);
  assert.equal(listRes.payload.length, 1);

  const pathsRes = createResMock();
  await getPaths({ params: {}, headers: {}, query: {}, user: TEST_AUTH_USER }, pathsRes);
  assert.deepEqual(pathsRes.payload, []);

  const contextsRes = createResMock();
  await getContexts({ params: {}, headers: {}, query: {}, user: TEST_AUTH_USER }, contextsRes);
  assert.deepEqual(contextsRes.payload, []);

  const deleteRes = createResMock();
  await remove({ params: { seriesId: 'chart-1' }, headers: {}, user: TEST_AUTH_USER, method: 'DELETE', path: '/series/chart-1', ip: '127.0.0.1' }, deleteRes);
  assert.equal(deleteRes.statusCode, 200);
});

test('history values endpoint validates required paths query', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const getValues = router.getHandlers.get('/history/values');
  const res = createResMock();

  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    query: {}
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.payload?.message, 'Query parameter paths is required');
});

test('history values endpoint rejects invalid from/to date inputs', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const getValues = router.getHandlers.get('/history/values');
  const res = createResMock();

  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    query: {
      paths: 'navigation.speedOverGround:avg',
      from: 'not-a-date',
      to: 'also-not-a-date'
    }
  }, res);

  assert.equal(res.statusCode, 400);
  assert.equal(typeof res.payload?.message, 'string');
  assert.equal(res.payload.message.includes('Invalid to date-time'), true);
});

test('history values endpoint rejects invalid duration and resolution inputs', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const getValues = router.getHandlers.get('/history/values');

  const invalidDurationRes = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    query: {
      paths: 'navigation.speedOverGround:avg',
      duration: 'NOT_A_DURATION'
    }
  }, invalidDurationRes);

  assert.equal(invalidDurationRes.statusCode, 400);
  assert.equal(typeof invalidDurationRes.payload?.message, 'string');
  assert.equal(invalidDurationRes.payload.message.includes('Invalid duration'), true);

  const invalidResolutionRes = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    query: {
      paths: 'navigation.speedOverGround:avg',
      duration: 'PT10M',
      resolution: 'NOT_A_RESOLUTION'
    }
  }, invalidResolutionRes);

  assert.equal(invalidResolutionRes.statusCode, 400);
  assert.equal(typeof invalidResolutionRes.payload?.message, 'string');
  assert.equal(invalidResolutionRes.payload.message.includes('Invalid resolution'), true);
});

test('history values endpoint returns history-compatible payload', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const getValues = router.getHandlers.get('/history/values');

  await upsert({
    method: 'PUT',
    path: '/series/chart-2',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    params: { seriesId: 'chart-2' },
    body: {
      datasetUuid: 'chart-2',
      ownerWidgetUuid: 'widget-2',
      path: 'environment.wind.speedTrue',
      context: 'vessels.self'
    }
  }, createResMock());

  const res = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    query: { paths: 'environment.wind.speedTrue:avg', duration: 'PT1H' }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.payload?.context, 'vessels.self');
  assert.equal(Array.isArray(res.payload?.values), true);
  assert.equal(res.payload?.values?.[0]?.path, 'environment.wind.speedTrue');
  assert.equal(Array.isArray(res.payload?.data), true);
});

test('stream ingestion records live samples for configured series', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const getValues = router.getHandlers.get('/history/values');

  await upsert({
    method: 'PUT',
    path: '/series/live-1',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    params: { seriesId: 'live-1' },
    body: {
      datasetUuid: 'live-1',
      ownerWidgetUuid: 'widget-live',
      path: 'navigation.speedOverGround',
      context: 'vessels.self'
    }
  }, createResMock());

  server.emitStream('navigation.speedOverGround', {
    path: 'navigation.speedOverGround',
    value: 5.6,
    context: 'vessels.self',
    timestamp: new Date().toISOString(),
    $source: 'n2k.43'
  });

  const res = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    query: {
      paths: 'navigation.speedOverGround:avg',
      duration: 'PT1H',
      context: 'vessels.self'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.payload?.data), true);
  assert.equal(Array.isArray(res.payload?.values), true);
  assert.equal(res.payload?.values?.[0]?.path, 'navigation.speedOverGround');
});

test('stream ingestion normalizes prefixed paths on capture and query', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const getValues = router.getHandlers.get('/history/values');

  await upsert({
    method: 'PUT',
    path: '/series/live-prefixed-1',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    params: { seriesId: 'live-prefixed-1' },
    body: {
      datasetUuid: 'live-prefixed-1',
      ownerWidgetUuid: 'widget-live-prefixed-1',
      path: 'self.navigation.speedOverGround',
      context: 'vessels.self'
    }
  }, createResMock());

  server.emitStream('navigation.speedOverGround', {
    path: 'navigation.speedOverGround',
    value: 6.1,
    context: 'vessels.self',
    timestamp: new Date().toISOString(),
    $source: 'n2k.61'
  });

  const res = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    query: {
      paths: 'vessels.self.navigation.speedOverGround:avg',
      duration: 'PT1H',
      context: 'vessels.self'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.payload?.data), true);
  assert.equal(res.payload.data.length > 0, true);
  assert.equal(res.payload?.values?.[0]?.path, 'navigation.speedOverGround');
});

test('history values returns pending ingested sample without waiting for timer flush', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const getValues = router.getHandlers.get('/history/values');

  await upsert({
    method: 'PUT',
    path: '/series/live-2',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    params: { seriesId: 'live-2' },
    body: {
      datasetUuid: 'live-2',
      ownerWidgetUuid: 'widget-live-2',
      path: 'environment.wind.angleTrueWater',
      context: 'vessels.self'
    }
  }, createResMock());

  const sampleTs = Date.parse('2026-02-19T12:00:00.000Z');
  server.emitStream('environment.wind.angleTrueWater', {
    path: 'environment.wind.angleTrueWater',
    value: 1.234,
    context: 'vessels.self',
    timestamp: new Date(sampleTs).toISOString(),
    $source: 'n2k.44'
  });

  const res = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    query: {
      paths: 'environment.wind.angleTrueWater:avg',
      from: new Date(sampleTs - 1000).toISOString(),
      to: new Date(sampleTs + 1000).toISOString(),
      context: 'vessels.self'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.payload?.data), true);
  assert.equal(Array.isArray(res.payload?.values), true);
  assert.equal(res.payload?.values?.[0]?.path, 'environment.wind.angleTrueWater');
});

test('history ingestion accepts source wildcard and vessels.self alias context', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const getValues = router.getHandlers.get('/history/values');

  await upsert({
    method: 'PUT',
    path: '/series/live-3',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    params: { seriesId: 'live-3' },
    body: {
      datasetUuid: 'live-3',
      ownerWidgetUuid: 'widget-live-3',
      path: 'navigation.speedOverGround',
      context: 'vessels.self',
      source: '*'
    }
  }, createResMock());

  server.emitStream('navigation.speedOverGround', {
    path: 'navigation.speedOverGround',
    value: 6.7,
    context: 'vessels.urn:mrn:signalk:uuid:test-self',
    timestamp: new Date().toISOString(),
    $source: 'n2k.55'
  });

  const res = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    query: {
      paths: 'navigation.speedOverGround:avg',
      duration: 'PT1H',
      context: 'vessels.self'
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.payload?.data), true);
  assert.equal(res.payload.data.length > 0, true);
});

test('history values resolution numeric input is interpreted as seconds', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const getValues = router.getHandlers.get('/history/values');

  await upsert({
    method: 'PUT',
    path: '/series/live-4',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    params: { seriesId: 'live-4' },
    body: {
      datasetUuid: 'live-4',
      ownerWidgetUuid: 'widget-live-4',
      path: 'navigation.speedOverGround',
      context: 'vessels.self'
    }
  }, createResMock());

  const baseTs = Date.parse('2026-02-18T10:00:00.000Z');
  const samples = [
    { seconds: 0, value: 4 },
    { seconds: 30, value: 6 },
    { seconds: 60, value: 10 },
    { seconds: 90, value: 14 }
  ];

  samples.forEach((entry) => {
    server.emitStream('navigation.speedOverGround', {
      path: 'navigation.speedOverGround',
      value: entry.value,
      context: 'vessels.self',
      timestamp: new Date(baseTs + (entry.seconds * 1000)).toISOString(),
      $source: 'n2k.77'
    });
  });

  const res = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    query: {
      paths: 'navigation.speedOverGround:avg',
      context: 'vessels.self',
      from: new Date(baseTs).toISOString(),
      to: new Date(baseTs + (2 * 60 * 1000) - 1).toISOString(),
      resolution: 60
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.payload?.data), true);
  assert.equal(res.payload.data.length, 2);
  assert.equal(res.payload.data[0][0], '2026-02-18T10:00:00.000Z');
  assert.equal(res.payload.data[1][0], '2026-02-18T10:01:00.000Z');
  assert.equal(res.payload.data[0][1], 5);
  assert.equal(res.payload.data[1][1], 12);
});

test('history values applies min and max methods when downsampling', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const getValues = router.getHandlers.get('/history/values');

  await upsert({
    method: 'PUT',
    path: '/series/live-5',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    params: { seriesId: 'live-5' },
    body: {
      datasetUuid: 'live-5',
      ownerWidgetUuid: 'widget-live-5',
      path: 'navigation.speedOverGround',
      context: 'vessels.self'
    }
  }, createResMock());

  const baseTs = Date.parse('2026-02-18T11:00:00.000Z');
  const samples = [
    { seconds: 0, value: 4 },
    { seconds: 30, value: 6 },
    { seconds: 60, value: 10 },
    { seconds: 90, value: 14 }
  ];

  samples.forEach((entry) => {
    server.emitStream('navigation.speedOverGround', {
      path: 'navigation.speedOverGround',
      value: entry.value,
      context: 'vessels.self',
      timestamp: new Date(baseTs + (entry.seconds * 1000)).toISOString(),
      $source: 'n2k.78'
    });
  });

  const res = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    query: {
      paths: 'navigation.speedOverGround:avg,navigation.speedOverGround:min,navigation.speedOverGround:max',
      context: 'vessels.self',
      from: new Date(baseTs).toISOString(),
      to: new Date(baseTs + (2 * 60 * 1000) - 1).toISOString(),
      resolution: 60
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.payload?.data), true);
  assert.equal(res.payload.data.length, 2);

  assert.equal(res.payload.data[0][1], 5);
  assert.equal(res.payload.data[0][2], 4);
  assert.equal(res.payload.data[0][3], 6);

  assert.equal(res.payload.data[1][1], 12);
  assert.equal(res.payload.data[1][2], 10);
  assert.equal(res.payload.data[1][3], 14);
});

test('table-driven history math validates min avg max sma ema across resolutions', () => {
  const baseTs = Date.parse('2026-02-18T12:00:00.000Z');
  const sourceValues = [10, 20, 30, 40, 50, 60];
  const from = new Date(baseTs).toISOString();
  const to = new Date(baseTs + 59000).toISOString();

  const cases = [
    {
      method: 'avg',
      expected: {
        10: [10, 20, 30, 40, 50, 60],
        30: [20, 50],
        60: [35]
      }
    },
    {
      method: 'min',
      expected: {
        10: [10, 20, 30, 40, 50, 60],
        30: [10, 40],
        60: [10]
      }
    },
    {
      method: 'max',
      expected: {
        10: [10, 20, 30, 40, 50, 60],
        30: [30, 60],
        60: [60]
      }
    },
    {
      method: 'sma',
      period: 3,
      expected: {
        10: [10, 15, 20, 30, 40, 50],
        30: [15, 40],
        60: [27.5]
      }
    },
    {
      method: 'ema',
      period: 3,
      expected: {
        10: [10, 15, 22.5, 31.25, 40.625, 50.3125],
        30: [15.833333333333334, 40.729166666666664],
        60: [28.28125]
      }
    }
  ];

  const resolutions = [10, 30, 60];
  cases.forEach((entry) => {
    const service = createHistoryServiceWithSamples(baseTs, sourceValues);
    resolutions.forEach((resolution) => {
      const path = entry.period
        ? `navigation.speedOverGround:${entry.method}:${entry.period}`
        : `navigation.speedOverGround:${entry.method}`;
      const response = service.getValues({
        paths: path,
        context: 'vessels.self',
        from,
        to,
        resolution
      });

      const values = response.data.map((row) => Number(row[1]));
      assertSeriesAlmostEqual(values, entry.expected[resolution]);
    });
  });
});

test('history values supports mixed avg/min/max/sma/ema in a single request', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = start(server);
  const router = createRouterMock();

  plugin.start({});
  plugin.registerWithRouter(router);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const getValues = router.getHandlers.get('/history/values');

  await upsert({
    method: 'PUT',
    path: '/series/live-6',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    params: { seriesId: 'live-6' },
    body: {
      datasetUuid: 'live-6',
      ownerWidgetUuid: 'widget-live-6',
      path: 'navigation.speedOverGround',
      context: 'vessels.self'
    }
  }, createResMock());

  const baseTs = Date.parse('2026-02-18T13:00:00.000Z');
  const samples = [10, 20, 30, 40, 50, 60];
  samples.forEach((value, index) => {
    server.emitStream('navigation.speedOverGround', {
      path: 'navigation.speedOverGround',
      value,
      context: 'vessels.self',
      timestamp: new Date(baseTs + (index * 10000)).toISOString(),
      $source: 'n2k.79'
    });
  });

  const res = createResMock();
  await getValues({
    method: 'GET',
    path: '/history/values',
    ip: '127.0.0.1',
    headers: {},
    user: TEST_AUTH_USER,
    query: {
      paths: 'navigation.speedOverGround:avg,navigation.speedOverGround:min,navigation.speedOverGround:max,navigation.speedOverGround:sma:3,navigation.speedOverGround:ema:3',
      context: 'vessels.self',
      from: new Date(baseTs).toISOString(),
      to: new Date(baseTs + 59000).toISOString(),
      resolution: 30
    }
  }, res);

  assert.equal(res.statusCode, 200);
  assert.equal(Array.isArray(res.payload?.data), true);
  assert.equal(res.payload.data.length, 2);

  assert.equal(res.payload.data[0][1], 20);
  assert.equal(res.payload.data[0][2], 10);
  assert.equal(res.payload.data[0][3], 30);
  assert.equal(Number.isFinite(res.payload.data[0][4]), true);
  assert.equal(Number.isFinite(res.payload.data[0][5]), true);

  assert.equal(res.payload.data[1][1], 50);
  assert.equal(res.payload.data[1][2], 40);
  assert.equal(res.payload.data[1][3], 60);
  assert.equal(Number.isFinite(res.payload.data[1][4]), true);
  assert.equal(Number.isFinite(res.payload.data[1][5]), true);
});

test('history values respects from/to boundaries when not aligned to bucket edges', () => {
  const baseTs = Date.parse('2026-02-18T14:00:00.000Z');
  const service = createHistoryServiceWithSamples(baseTs, [10, 20, 30, 40, 50, 60]);

  const response = service.getValues({
    paths: 'navigation.speedOverGround:avg',
    context: 'vessels.self',
    from: new Date(baseTs + 5000).toISOString(),
    to: new Date(baseTs + 35000).toISOString(),
    resolution: 10
  });

  assert.equal(response.data.length, 3);
  assert.equal(response.data[0][0], '2026-02-18T14:00:10.000Z');
  assert.equal(response.data[1][0], '2026-02-18T14:00:20.000Z');
  assert.equal(response.data[2][0], '2026-02-18T14:00:30.000Z');
  assert.equal(response.data[0][1], 20);
  assert.equal(response.data[1][1], 30);
  assert.equal(response.data[2][1], 40);
});

test('history values does not create synthetic buckets for sparse data gaps', () => {
  const baseTs = Date.parse('2026-02-18T15:00:00.000Z');
  const service = new HistorySeriesService(() => baseTs + 60000);
  service.upsertSeries({
    seriesId: 'sparse-1',
    datasetUuid: 'sparse-1',
    ownerWidgetUuid: 'widget-sparse-1',
    path: 'navigation.speedOverGround',
    context: 'vessels.self'
  });

  service.recordSample('sparse-1', 10, baseTs + 0);
  service.recordSample('sparse-1', 20, baseTs + 10000);
  service.recordSample('sparse-1', 40, baseTs + 40000);

  const response = service.getValues({
    paths: 'navigation.speedOverGround:avg',
    context: 'vessels.self',
    from: new Date(baseTs).toISOString(),
    to: new Date(baseTs + 50000).toISOString(),
    resolution: 10
  });

  assert.equal(response.data.length, 3);
  assert.equal(response.data[0][0], '2026-02-18T15:00:00.000Z');
  assert.equal(response.data[1][0], '2026-02-18T15:00:10.000Z');
  assert.equal(response.data[2][0], '2026-02-18T15:00:40.000Z');
});

test('history series enforces default 1000ms sampleTime when unset', () => {
  const service = new HistorySeriesService(() => Date.now());
  service.upsertSeries({
    seriesId: 'sampling-default-1',
    datasetUuid: 'sampling-default-1',
    ownerWidgetUuid: 'widget-sampling-default-1',
    path: 'navigation.speedOverGround',
    context: 'vessels.self'
  });

  const firstAccepted = service.recordSample('sampling-default-1', 10, 1000);
  const secondAccepted = service.recordSample('sampling-default-1', 11, 1500);
  const thirdAccepted = service.recordSample('sampling-default-1', 12, 2000);

  assert.equal(firstAccepted, true);
  assert.equal(secondAccepted, false);
  assert.equal(thirdAccepted, true);
});

test('history series enforces configured sampleTime at ingest', () => {
  const service = new HistorySeriesService(() => Date.now());
  service.upsertSeries({
    seriesId: 'sampling-config-1',
    datasetUuid: 'sampling-config-1',
    ownerWidgetUuid: 'widget-sampling-config-1',
    path: 'navigation.speedOverGround',
    context: 'vessels.self',
    sampleTime: 200
  });

  const firstAccepted = service.recordSample('sampling-config-1', 10, 1000);
  const secondAccepted = service.recordSample('sampling-config-1', 11, 1100);
  const thirdAccepted = service.recordSample('sampling-config-1', 12, 1200);

  assert.equal(firstAccepted, true);
  assert.equal(secondAccepted, false);
  assert.equal(thirdAccepted, true);
});

test('in-memory and duckdb math paths stay aligned for method and resolution combinations', () => {
  const baseTs = Date.parse('2026-02-18T16:00:00.000Z');
  const sourceValues = [10, 20, 30, 40, 50, 60];
  const rows = sourceValues.map((value, index) => ({
    ts_ms: baseTs + (index * 10000),
    value
  }));
  const from = new Date(baseTs).toISOString();
  const to = new Date(baseTs + 59000).toISOString();

  const historyService = createHistoryServiceWithSamples(baseTs, sourceValues);
  const duckdbMath = new DuckDbParquetStorageService();
  const parseRequestedPaths = duckdbMath.parseRequestedPaths.bind(duckdbMath);
  const applyMethod = duckdbMath.applyMethod.bind(duckdbMath);
  const downsampleIfNeeded = duckdbMath.downsampleIfNeeded.bind(duckdbMath);
  const resolveResolutionMs = duckdbMath.resolveResolutionMs.bind(duckdbMath);

  const methods = ['avg', 'min', 'max', 'sma:3', 'ema:3'];
  const resolutions = [10, 30, 60];

  methods.forEach((methodToken) => {
    resolutions.forEach((resolution) => {
      const paths = `navigation.speedOverGround:${methodToken}`;
      const historyResponse = historyService.getValues({
        paths,
        context: 'vessels.self',
        from,
        to,
        resolution
      });
      const historyValues = historyResponse.data.map((row) => Number(row[1]));

      const request = parseRequestedPaths(paths)[0];
      const transformed = applyMethod(request, rows);
      const duckdbValues = downsampleIfNeeded(transformed, resolveResolutionMs(resolution), request.method ?? 'avg').map((entry) => Number(entry.value));

      assertSeriesAlmostEqual(duckdbValues, historyValues);
    });
  });
});

test('history values uses explicit from/to over duration when both are provided', () => {
  const baseTs = Date.parse('2026-02-18T17:00:00.000Z');
  const service = new HistorySeriesService(() => baseTs + (35 * 60 * 1000));
  service.upsertSeries({
    seriesId: 'range-1',
    datasetUuid: 'range-1',
    ownerWidgetUuid: 'widget-range-1',
    path: 'navigation.speedOverGround',
    context: 'vessels.self'
  });

  service.recordSample('range-1', 10, baseTs + (0 * 60 * 1000));
  service.recordSample('range-1', 20, baseTs + (10 * 60 * 1000));
  service.recordSample('range-1', 30, baseTs + (20 * 60 * 1000));
  service.recordSample('range-1', 40, baseTs + (30 * 60 * 1000));

  const fromIso = new Date(baseTs).toISOString();
  const toIso = new Date(baseTs + (30 * 60 * 1000)).toISOString();

  const response = service.getValues({
    paths: 'navigation.speedOverGround:avg',
    context: 'vessels.self',
    from: fromIso,
    to: toIso,
    duration: 'PT1M',
    resolution: 600
  });

  assert.equal(response.range.from, fromIso);
  assert.equal(response.range.to, toIso);
  assert.equal(response.data.length, 4);
  assert.equal(response.data[0][1], 10);
  assert.equal(response.data[1][1], 20);
  assert.equal(response.data[2][1], 30);
  assert.equal(response.data[3][1], 40);
});

test('history values throws for invalid date inputs', () => {
  const fixedNow = Date.parse('2026-02-18T18:30:00.000Z');
  const service = new HistorySeriesService(() => fixedNow);
  service.upsertSeries({
    seriesId: 'range-2',
    datasetUuid: 'range-2',
    ownerWidgetUuid: 'widget-range-2',
    path: 'navigation.speedOverGround',
    context: 'vessels.self'
  });

  assert.throws(() => {
    service.getValues({
      paths: 'navigation.speedOverGround:avg',
      context: 'vessels.self',
      from: 'not-a-date',
      to: 'also-not-a-date'
    });
  }, /Invalid to date-time/);

  assert.throws(() => {
    service.getValues({
      paths: 'navigation.speedOverGround:avg',
      context: 'vessels.self',
      from: 'invalid-from',
      to: '2026-02-18T20:00:00.000Z'
    });
  }, /Invalid from date-time/);
});

test('history values throws for invalid duration and resolution inputs', () => {
  const fixedNow = Date.parse('2026-02-18T19:30:00.000Z');
  const service = new HistorySeriesService(() => fixedNow);
  service.upsertSeries({
    seriesId: 'range-3',
    datasetUuid: 'range-3',
    ownerWidgetUuid: 'widget-range-3',
    path: 'navigation.speedOverGround',
    context: 'vessels.self'
  });

  assert.throws(() => {
    service.getValues({
      paths: 'navigation.speedOverGround:avg',
      context: 'vessels.self',
      duration: 'BAD_DURATION'
    });
  }, /Invalid duration/);

  assert.throws(() => {
    service.getValues({
      paths: 'navigation.speedOverGround:avg',
      context: 'vessels.self',
      duration: 'PT10M',
      resolution: 'BAD_RESOLUTION'
    });
  }, /Invalid resolution/);
});

test('history service normalizes prefixed paths for direct query lookups', () => {
  const baseTs = Date.parse('2026-02-18T20:00:00.000Z');
  const service = new HistorySeriesService(() => baseTs + 60000);
  service.upsertSeries({
    seriesId: 'norm-1',
    datasetUuid: 'norm-1',
    ownerWidgetUuid: 'widget-norm-1',
    path: 'vessels.self.navigation.speedOverGround',
    context: 'vessels.self'
  });

  service.recordFromSignalKSample({
    path: 'self.navigation.speedOverGround',
    value: 7.4,
    context: 'vessels.self',
    timestamp: new Date(baseTs).toISOString(),
    $source: 'n2k.74'
  });

  const response = service.getValues({
    paths: 'self.navigation.speedOverGround:avg',
    context: 'vessels.self',
    from: new Date(baseTs - 1000).toISOString(),
    to: new Date(baseTs + 1000).toISOString(),
    resolution: 1
  });

  assert.equal(response.values[0].path, 'navigation.speedOverGround');
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0][1], 7.4);
});

test('duckdb stored paths/contexts apply requested time-range filters', async () => {
  const storage = new DuckDbParquetStorageService();
  storage.configure({ historyStorage: { engine: 'duckdb-parquet' } });

  const allSql = [];
  storage.connection = {
    run: (_sql, cb) => cb(null),
    all: (sql, cb) => {
      allSql.push(sql);
      cb(null, [{ value: 'environment.wind.angleApparent' }]);
    },
    close: (cb) => cb(null)
  };

  const fromIso = '2026-02-18T23:30:00.000Z';
  const toIso = '2026-02-18T23:40:00.000Z';
  const fromMs = Date.parse(fromIso);
  const toMs = Date.parse(toIso);

  const paths = await storage.getStoredPaths({ from: fromIso, to: toIso });
  const contexts = await storage.getStoredContexts({ from: fromIso, to: toIso });

  assert.deepEqual(paths, ['environment.wind.angleApparent']);
  assert.deepEqual(contexts, ['environment.wind.angleApparent']);
  assert.equal(allSql.length, 2);
  assert.equal(allSql[0].includes(`AND ts_ms >= ${fromMs}`), true);
  assert.equal(allSql[0].includes(`AND ts_ms <= ${toMs}`), true);
  assert.equal(allSql[1].includes(`AND ts_ms >= ${fromMs}`), true);
  assert.equal(allSql[1].includes(`AND ts_ms <= ${toMs}`), true);
});

test('duckdb lifecycle token guards stale flush/close operations', async () => {
  const storage = new DuckDbParquetStorageService();
  storage.configure({ historyStorage: { engine: 'duckdb-parquet' } });

  let closeCalls = 0;
  storage.connection = {
    run: (_sql, cb) => cb(null),
    all: (_sql, cb) => cb(null, []),
    close: (cb) => {
      closeCalls += 1;
      cb(null);
    }
  };

  storage.lifecycleToken = 2;
  storage.pendingRows = [{
    seriesId: 's1',
    datasetUuid: 's1',
    ownerWidgetUuid: 'w1',
    path: 'navigation.speedOverGround',
    context: 'vessels.self',
    source: 'default',
    timestamp: Date.now(),
    value: 1
  }];

  const staleFlush = await storage.flush(1);
  assert.deepEqual(staleFlush, { inserted: 0, exported: 0 });
  assert.equal(storage.pendingRows.length, 1);

  await storage.close(1);
  assert.equal(closeCalls, 0);
  assert.notEqual(storage.connection, null);

  await storage.close(2);
  assert.equal(closeCalls, 1);
  assert.equal(storage.connection, null);
});

test('duckdb prune removes expired rows using per-series retention windows', async () => {
  const storage = new DuckDbParquetStorageService();
  storage.configure({ historyStorage: { engine: 'duckdb-parquet' } });

  const allSql = [];
  const runSql = [];
  storage.connection = {
    run: (sql, cb) => {
      runSql.push(sql);
      cb(null);
    },
    all: (sql, cb) => {
      allSql.push(sql);
      if (sql.includes('COUNT(*) AS removed_rows')) {
        cb(null, [{ removed_rows: 3 }]);
        return;
      }
      cb(null, []);
    },
    close: (cb) => cb(null)
  };

  const nowMs = Date.parse('2026-02-19T00:00:00.000Z');
  const removed = await storage.pruneExpiredSamples(nowMs);

  assert.equal(removed, 3);
  assert.equal(allSql.length, 1);
  assert.equal(runSql.length, 1);
  assert.equal(allSql[0].includes(`history_samples.ts_ms < (${nowMs} - hs.retention_duration_ms)`), true);
  assert.equal(runSql[0].includes('DELETE FROM history_samples'), true);
  assert.equal(runSql[0].includes(`history_samples.ts_ms < (${nowMs} - hs.retention_duration_ms)`), true);
});

test('duckdb prune skips stale lifecycle token operations', async () => {
  const storage = new DuckDbParquetStorageService();
  storage.configure({ historyStorage: { engine: 'duckdb-parquet' } });

  let queryCount = 0;
  storage.connection = {
    run: (_sql, cb) => cb(null),
    all: (_sql, cb) => {
      queryCount += 1;
      cb(null, [{ removed_rows: 9 }]);
    },
    close: (cb) => cb(null)
  };

  storage.lifecycleToken = 8;
  const removed = await storage.pruneExpiredSamples(Date.now(), 7);

  assert.equal(removed, 0);
  assert.equal(queryCount, 0);
});

test('duckdb storage configure uses fixed defaults', () => {
  const storage = new DuckDbParquetStorageService();
  const config = storage.configure({
    historyStorage: {
      engine: 'memory',
      databaseFile: '/tmp/custom.duckdb',
      parquetDirectory: '/tmp/custom-parquet',
      flushIntervalMs: 12345
    }
  });

  assert.equal(config.engine, 'duckdb-parquet');
  assert.equal(config.databaseFile, 'plugin-config-data/kip/historicalData/kip-history.duckdb');
  assert.equal(config.parquetDirectory, 'plugin-config-data/kip/historicalData/parquet');
  assert.equal(config.flushIntervalMs, 30000);
});

test('history requests return 503 when duckdb is unavailable', async () => {
  const originalInitialize = DuckDbParquetStorageService.prototype.initialize;
  DuckDbParquetStorageService.prototype.initialize = async function initializeMock() {
    this.lastInitError = 'forced-test-failure';
    this.connection = null;
    return false;
  };

  try {
    const server = createServerMock();
    const start = require('../../plugin/index.js');
    const plugin = start(server);
    const router = createRouterMock();

    plugin.start({});
    plugin.registerWithRouter(router);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100));

    const getPaths = router.getHandlers.get('/history/paths');
    const res = createResMock();
    await getPaths({ method: 'GET', path: '/history/paths', ip: '127.0.0.1', headers: {}, query: {} }, res);

    assert.equal(res.statusCode, 503);
    assert.equal(String(res.payload?.message || '').includes('DuckDB storage unavailable'), true);
  } finally {
    DuckDbParquetStorageService.prototype.initialize = originalInitialize;
  }
});

test('series upsert rolls back in-memory state when duckdb write fails', async () => {
  const originalUpsert = DuckDbParquetStorageService.prototype.upsertSeriesDefinition;
  DuckDbParquetStorageService.prototype.upsertSeriesDefinition = async function upsertFail() {
    throw new Error('DuckDB forced upsert failure');
  };

  try {
    const server = createServerMock();
    const start = require('../../plugin/index.js');
    const plugin = start(server);
    const router = createRouterMock();

    plugin.start({});
    plugin.registerWithRouter(router);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100));

    const upsert = router.putHandlers.get('/series/:seriesId');
    const list = router.getHandlers.get('/series');

    const baselineRes = createResMock();
    await list({ params: {}, headers: {}, query: {}, user: TEST_AUTH_USER }, baselineRes);
    assert.equal(baselineRes.statusCode, 200);
    const baselineSeriesIds = new Set((baselineRes.payload ?? []).map(item => item.seriesId));

    const upsertRes = createResMock();
    await upsert({
      method: 'PUT',
      path: '/series/atomic-upsert-1',
      ip: '127.0.0.1',
      headers: {},
      user: TEST_AUTH_USER,
      params: { seriesId: 'atomic-upsert-1' },
      body: {
        datasetUuid: 'atomic-upsert-1',
        ownerWidgetUuid: 'widget-atomic-upsert-1',
        path: 'navigation.speedOverGround',
        context: 'vessels.self'
      }
    }, upsertRes);

    assert.equal(upsertRes.statusCode, 503);

    const listRes = createResMock();
    await list({ params: {}, headers: {}, query: {}, user: TEST_AUTH_USER }, listRes);
    assert.equal(listRes.statusCode, 200);
    const nextSeriesIds = new Set((listRes.payload ?? []).map(item => item.seriesId));
    assert.equal(nextSeriesIds.has('atomic-upsert-1'), false);
    assert.deepEqual(Array.from(nextSeriesIds).sort(), Array.from(baselineSeriesIds).sort());
  } finally {
    DuckDbParquetStorageService.prototype.upsertSeriesDefinition = originalUpsert;
  }
});

test('series delete keeps in-memory state when duckdb delete fails', async () => {
  const originalDelete = DuckDbParquetStorageService.prototype.deleteSeriesDefinitionForScope;
  DuckDbParquetStorageService.prototype.deleteSeriesDefinitionForScope = async function deleteFail() {
    throw new Error('DuckDB forced delete failure');
  };

  try {
    const server = createServerMock();
    const start = require('../../plugin/index.js');
    const plugin = start(server);
    const router = createRouterMock();

    plugin.start({});
    plugin.registerWithRouter(router);

    const upsert = router.putHandlers.get('/series/:seriesId');
    const remove = router.deleteHandlers.get('/series/:seriesId');
    const list = router.getHandlers.get('/series');

    const upsertReq = {
      method: 'PUT',
      path: '/series/atomic-delete-1',
      ip: '127.0.0.1',
      headers: {},
      user: TEST_AUTH_USER,
      params: { seriesId: 'atomic-delete-1' },
      body: {
        datasetUuid: 'atomic-delete-1',
        ownerWidgetUuid: 'widget-atomic-delete-1',
        path: 'navigation.speedOverGround',
        context: 'vessels.self'
      }
    };

    let created = false;
    for (let attempt = 0; attempt < 5 && !created; attempt += 1) {
      const upsertRes = createResMock();
      await upsert(upsertReq, upsertRes);
      if (upsertRes.statusCode !== 200) {
        await new Promise(resolvePromise => setTimeout(resolvePromise, 100));
        continue;
      }

      const listBeforeDeleteRes = createResMock();
      await list({ params: {}, headers: {}, query: {}, user: TEST_AUTH_USER }, listBeforeDeleteRes);
      created = Array.isArray(listBeforeDeleteRes.payload)
        && listBeforeDeleteRes.payload.some(item => item.seriesId === 'atomic-delete-1');

      if (!created) {
        await new Promise(resolvePromise => setTimeout(resolvePromise, 100));
      }
    }

    assert.equal(created, true);

    const deleteRes = createResMock();
    await remove({ method: 'DELETE', path: '/series/atomic-delete-1', ip: '127.0.0.1', headers: {}, user: TEST_AUTH_USER, params: { seriesId: 'atomic-delete-1' } }, deleteRes);
    assert.equal(deleteRes.statusCode, 503);

    const listRes = createResMock();
    await list({ params: {}, headers: {}, query: {}, user: TEST_AUTH_USER }, listRes);
    assert.equal(listRes.statusCode, 200);
    assert.equal(Array.isArray(listRes.payload), true);
    assert.equal(listRes.payload.some(item => item.seriesId === 'atomic-delete-1'), true);
  } finally {
    DuckDbParquetStorageService.prototype.deleteSeriesDefinitionForScope = originalDelete;
  }
});

test('history request wait for duckdb initialization is bounded', async () => {
  const originalInitialize = DuckDbParquetStorageService.prototype.initialize;
  DuckDbParquetStorageService.prototype.initialize = async function initializeHang() {
    this.lastInitError = null;
    this.connection = null;
    return new Promise(() => {});
  };

  try {
    const server = createServerMock();
    const start = require('../../plugin/index.js');
    const plugin = start(server);
    const router = createRouterMock();

    plugin.start({});
    plugin.registerWithRouter(router);

    const getPaths = router.getHandlers.get('/history/paths');
    const res = createResMock();
    const startedAt = Date.now();
    await getPaths({ method: 'GET', path: '/history/paths', ip: '127.0.0.1', headers: {}, query: {} }, res);
    const elapsedMs = Date.now() - startedAt;

    assert.equal(res.statusCode, 503);
    assert.equal(elapsedMs >= 4500, true);
    assert.equal(elapsedMs < 7500, true);
  } finally {
    DuckDbParquetStorageService.prototype.initialize = originalInitialize;
  }
});

test('duckdb getValues queries requested paths in a single sql call', async () => {
  const storage = new DuckDbParquetStorageService();
  storage.configure({ historyStorage: { engine: 'duckdb-parquet' } });

  let historySelectCount = 0;
  const executedSql = [];
  storage.connection = {
    run: (_sql, cb) => cb(null),
    all: (sql, cb) => {
      executedSql.push(sql);
      if (sql.includes('FROM history_samples')) {
        historySelectCount += 1;
        cb(null, [
          { path: 'navigation.speedOverGround', ts_ms: 1000, value: 10 },
          { path: 'navigation.courseOverGroundTrue', ts_ms: 1000, value: 20 }
        ]);
        return;
      }
      cb(null, []);
    },
    close: (cb) => cb(null)
  };

  const response = await storage.getValues({
    paths: 'navigation.speedOverGround:avg,navigation.courseOverGroundTrue:avg',
    context: 'vessels.self',
    from: '1970-01-01T00:00:00.000Z',
    to: '1970-01-01T00:00:02.000Z'
  });

  assert.notEqual(response, null);
  assert.equal(historySelectCount, 1);
  assert.equal(executedSql.some(sql => sql.includes('path IN (')), true);
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0][1], 10);
  assert.equal(response.data[0][2], 20);
});
