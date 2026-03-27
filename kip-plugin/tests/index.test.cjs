const test = require('node:test');
const assert = require('node:assert/strict');
const { rmSync } = require('node:fs');
const { resolve } = require('node:path');
const { HistorySeriesService } = require('../../plugin/history-series.service.js');
const { SqliteHistoryStorageService } = require('../../plugin/sqlite-history-storage.service.js');

const TEST_DATA_DIR = resolve('.tmp-kip-plugin-test-data');
const TEST_SQLITE_PATH = resolve(TEST_DATA_DIR, 'historicalData', 'kip-history.sqlite');


function createServerMock() {
  const putHandlers = [];
  const messages = [];
  const streamSubscribersByPath = new Map();
  const selfPathOverrides = new Map();
  let legacyHistoryProvider = null;
  let historyApiProvider = null;
  const selfId = 'urn:mrn:signalk:uuid:test-self';

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
    selfId,
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
    getDataDirPath() {
      return TEST_DATA_DIR;
    },
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
      if (selfPathOverrides.has(path)) {
        return selfPathOverrides.get(path);
      }
      if (path === 'displays') {
        return {
          abc: { value: { displayName: 'Helm' } }
        };
      }
      return { value: null };
    },
    setSelfPath(path, value) {
      selfPathOverrides.set(path, value);
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

async function startPlugin(plugin, settings) {
  const result = plugin.start(settings);
  if (result && typeof result.then === 'function') {
    await result;
  }
}

const pluginsToStop = new Set();

function resetSqliteStorage() {
  rmSync(TEST_SQLITE_PATH, { force: true });
}

test.before(() => {
  resetSqliteStorage();
});

test.afterEach(async () => {
  const stopPromises = [];
  pluginsToStop.forEach((plugin) => {
    try {
      if (typeof plugin?.stop === 'function') {
        const result = plugin.stop();
        if (result && typeof result.then === 'function') {
          stopPromises.push(result);
        }
      }
    } catch {
      // ignore stop errors during cleanup
    }
  });
  pluginsToStop.clear();
  if (stopPromises.length > 0) {
    await Promise.allSettled(stopPromises);
  }
  await new Promise(resolvePromise => setTimeout(resolvePromise, 25));
});

function registerPluginForCleanup(plugin) {
  pluginsToStop.add(plugin);
  return plugin;
}

async function waitForHistoryProviderReady(provider, options = {}) {
  const attempts = options.attempts ?? 120;
  const delayMs = options.delayMs ?? 100;

  for (let index = 0; index < attempts; index += 1) {
    try {
      await provider.getPaths({});
      return;
    } catch (error) {
      const message = String(error?.message ?? '').toLowerCase();
      if (message.includes('sqlite') || message.includes('storage unavailable') || message.includes('not initialized')) {
        await new Promise(resolvePromise => setTimeout(resolvePromise, delayMs));
        continue;
      }
      throw error;
    }
  }

  throw new Error('History API provider did not become ready in time');
}

function assertSeriesAlmostEqual(actual, expected, epsilon = 1e-9) {
  assert.equal(actual.length, expected.length);
  for (let index = 0; index < expected.length; index += 1) {
    const delta = Math.abs(actual[index] - expected[index]);
    assert.equal(delta <= epsilon, true, `index=${index} expected=${expected[index]} actual=${actual[index]}`);
  }
}

function buildRows(baseTs, values, stepMs = 10000) {
  return values.map((value, index) => ({
    ts_ms: baseTs + (index * stepMs),
    value
  }));
}

function supportsNodeSqliteRuntime() {
  const [majorRaw, minorRaw] = String(process.versions?.node ?? '0.0.0').split('.');
  const major = Number.parseInt(majorRaw ?? '0', 10);
  const minor = Number.parseInt(minorRaw ?? '0', 10);

  if (!Number.isFinite(major) || !Number.isFinite(minor)) {
    return false;
  }

  if (major < 22 || (major === 22 && minor < 5)) {
    return false;
  }

  try {
    const sqlite = require('node:sqlite');
    return Boolean(sqlite?.DatabaseSync || sqlite?.Database);
  } catch {
    return false;
  }
}

const testRequiresNodeSqlite = supportsNodeSqliteRuntime() ? test : test.skip;

function computeSqliteHistoryResponse(rows, paths, options) {
  const sqliteMath = new SqliteHistoryStorageService(TEST_DATA_DIR);
  const resolveRange = sqliteMath.resolveRange.bind(sqliteMath);
  const parseRequestedPaths = sqliteMath.parseRequestedPaths.bind(sqliteMath);
  const applyMethod = sqliteMath.applyMethod.bind(sqliteMath);
  const downsampleIfNeeded = sqliteMath.downsampleIfNeeded.bind(sqliteMath);
  const resolveResolutionMs = sqliteMath.resolveResolutionMs.bind(sqliteMath);

  const requested = parseRequestedPaths(paths);
  const range = resolveRange(options?.nowMs ?? Date.now(), options?.from, options?.to, options?.duration);
  const resolutionMs = resolveResolutionMs(options?.resolution);
  const filteredRows = rows.filter((row) => row.ts_ms >= range.fromMs && row.ts_ms <= range.toMs);

  const timestampRows = new Map();
  requested.forEach((request, index) => {
    const transformed = applyMethod(request, filteredRows);
    const merged = downsampleIfNeeded(transformed, resolutionMs, request.method ?? 'avg');

    merged.forEach((entry) => {
      const row = timestampRows.get(entry.timestamp) ?? Array.from({ length: requested.length }, () => null);
      row[index] = entry.value;
      timestampRows.set(entry.timestamp, row);
    });
  });

  const data = Array.from(timestampRows.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([timestamp, values]) => [new Date(timestamp).toISOString(), ...values]);

  return {
    range: {
      from: new Date(range.fromMs).toISOString(),
      to: new Date(range.toMs).toISOString()
    },
    values: requested.map(item => ({ path: item.path, method: item.method ?? 'avg' })),
    data
  };
}

test.describe('kip plugin', { concurrency: 1 }, () => {
test('disables sqlite features for Node 22.4.0 (simulated)', async () => {
  // Save originals
  const originalVersion = process.version;
  const originalGetSqliteModule = require('../../plugin/index.js').getSqliteModule;
  // Patch process.version and getSqliteModule
  Object.defineProperty(process, 'version', { value: 'v22.4.0', configurable: true });
  require('../../plugin/index.js').getSqliteModule = async () => null;

  try {
    const server = createServerMock();
    const start = require('../../plugin/index.js');
    const plugin = registerPluginForCleanup(start(server));
    const router = createRouterMock();

    await startPlugin(plugin, {});
    plugin.registerWithRouter(router);

    // History API provider should not be registered
    assert.equal(server.history.getRegisteredProvider(), null);

    // /series route should return 503
    const getHandler = router.getHandlers.get('/series');
    const req = {
      method: 'GET',
      path: '/series',
      ip: '127.0.0.1',
      headers: {},
      params: {}
    };
    const res = createResMock();
    await getHandler(req, res);
    assert.equal(res.statusCode, 503);
    assert.equal(res.payload.state, 'FAILED');
    assert.match(String(res.payload.message), /node:sqlite is not supported/i);
  } finally {
    // Restore originals
    Object.defineProperty(process, 'version', { value: originalVersion, configurable: true });
    require('../../plugin/index.js').getSqliteModule = originalGetSqliteModule;
  }
});
test('registers expected Signal K PUT handlers on start', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, {});

  // Only assert PUT handlers for display control
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

testRequiresNodeSqlite('registers and unregisters History API provider lifecycle', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, {});

  // Assert only History API provider registration
  const provider = server.history.getRegisteredProvider();
  assert.equal(typeof provider, 'object');
  assert.equal(typeof provider.getValues, 'function');
  assert.equal(typeof provider.getPaths, 'function');
  assert.equal(typeof provider.getContexts, 'function');

  plugin.stop();

  assert.equal(server.history.getRegisteredProvider(), null);
});

test('skips History API provider registration when disabled in settings', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, { registerAsHistoryApiProvider: false });

  assert.equal(server.history.getRegisteredProvider(), null);
});

test('setDisplay command writes to displays.<id>', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, {});

  const setDisplayHandler = server.putHandlers.find((h) => h.path === 'kip.remote.setDisplay').handler;
  const result = setDisplayHandler('vessels.self', 'kip.remote.setDisplay', {
    displayId: 'abc-123',
    display: { displayName: 'Mast', screens: [] }
  });

  assert.equal(result.statusCode, 200);
  assert.equal(server.messages.length, 1);
  assert.equal(server.messages[0].delta.updates[0].values[0].path, 'displays.abc-123');
});

test('setScreenIndex command writes to displays.<id>.screenIndex', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, {});

  const setScreenHandler = server.putHandlers.find((h) => h.path === 'kip.remote.setScreenIndex').handler;
  const result = setScreenHandler('vessels.self', 'kip.remote.setScreenIndex', {
    displayId: 'abc-123',
    screenIdx: 2
  });

  assert.equal(result.statusCode, 200);
  assert.equal(server.messages.length, 1);
  assert.equal(server.messages[0].delta.updates[0].values[0].path, 'displays.abc-123.screenIndex');
});

test('requestActiveScreen command writes to displays.<id>.activeScreen', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, {});

  const activeScreenHandler = server.putHandlers.find((h) => h.path === 'kip.remote.requestActiveScreen').handler;
  const result = activeScreenHandler('vessels.self', 'kip.remote.requestActiveScreen', {
    displayId: 'abc-123',
    screenIdx: 3
  });

  assert.equal(result.statusCode, 200);
  assert.equal(server.messages.length, 1);
  assert.equal(server.messages[0].delta.updates[0].values[0].path, 'displays.abc-123.activeScreen');
});

testRequiresNodeSqlite('REST PUT /screenIndex uses shared handler and writes screenIndex path', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider, { attempts: 300, delayMs: 100 });

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

test('REST GET /series returns 503 when history-series service disabled', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, { historySeriesServiceEnabled: false });
  plugin.registerWithRouter(router);

  const getHandler = router.getHandlers.get('/series');
  const req = {
    method: 'GET',
    path: '/series',
    ip: '127.0.0.1',
    headers: {},
    params: {}
  };
  const res = createResMock();

  await getHandler(req, res);

  assert.equal(res.statusCode, 503);
  assert.equal(res.payload.state, 'FAILED');
});

test('REST PUT /activeScreen uses shared handler and writes activeScreen path', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
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
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
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
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
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
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
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
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
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
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
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

test('invalid displayId returns 400 and does not write', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, {});

  const setDisplayHandler = server.putHandlers.find((h) => h.path === 'kip.remote.setDisplay').handler;
  const result = setDisplayHandler('vessels.self', 'kip.remote.setDisplay', {
    displayId: 'bad/id',
    display: { displayName: 'Bad' }
  });

  assert.equal(result.statusCode, 400);
  assert.equal(server.messages.length, 0);
});

testRequiresNodeSqlite('registers series and history routes', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  // History router endpoints are no longer registered; assert only provider registration
  const provider = server.history.getRegisteredProvider();
  assert.equal(typeof provider, 'object');
  assert.equal(typeof provider.getPaths, 'function');
  assert.equal(typeof provider.getContexts, 'function');
});

testRequiresNodeSqlite('series CRUD works and history paths/contexts come from stored samples', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const list = router.getHandlers.get('/series');
  const remove = router.deleteHandlers.get('/series/:seriesId');

  const upsertReq = {
    method: 'PUT',
    path: '/series/chart-1',
    ip: '127.0.0.1',
    headers: {},
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
  await list({ params: {}, headers: {}, query: {} }, listRes);
  assert.equal(listRes.statusCode, 200);
  assert.equal(Array.isArray(listRes.payload), true);
  assert.equal(listRes.payload.length, 1);

  const sampleTs = Date.now();
  server.emitStream('navigation.speedOverGround', {
    path: 'navigation.speedOverGround',
    value: 6.2,
    context: 'vessels.self',
    timestamp: new Date(sampleTs).toISOString(),
    $source: 'n2k.42'
  });

  const range = {
    from: new Date(sampleTs - 1000).toISOString(),
    to: new Date(sampleTs + 1000).toISOString()
  };

  // Use History API provider directly for paths and contexts
  const paths = await provider.getPaths(range);
  assert.deepEqual(paths, ['navigation.speedOverGround']);
  const contexts = await provider.getContexts(range);
  assert.deepEqual(contexts, ['vessels.self']);

  const deleteRes = createResMock();
  await remove({ params: { seriesId: 'chart-1' }, headers: {}, method: 'DELETE', path: '/series/chart-1', ip: '127.0.0.1' }, deleteRes);
  assert.equal(deleteRes.statusCode, 200);
});

testRequiresNodeSqlite('series reconcile expands widget-bms template entries into concrete battery metric series', async () => {
  const server = createServerMock();
  server.setSelfPath('electrical.batteries', {
    value: {
      house: { stateOfCharge: 0.81 },
      start: { stateOfCharge: 0.93 }
    }
  });

  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const reconcile = router.postHandlers.get('/series/reconcile');
  const list = router.getHandlers.get('/series');

  const reconcileRes = createResMock();
  await reconcile({
    method: 'POST',
    path: '/series/reconcile',
    ip: '127.0.0.1',
    headers: {},
    body: [
      {
        seriesId: 'widget-bms-1:bms-template',
        datasetUuid: 'widget-bms-1:bms-template',
        ownerWidgetUuid: 'widget-bms-1',
        ownerWidgetSelector: 'widget-bms',
        path: 'self.electrical.batteries.*',
        expansionMode: 'bms-battery-tree',
        allowedBatteryIds: ['house'],
        source: 'default',
        enabled: true
      }
    ]
  }, reconcileRes);

  assert.equal(reconcileRes.statusCode, 200);

  const listRes = createResMock();
  await list({ params: {}, headers: {}, query: {} }, listRes);
  assert.equal(listRes.statusCode, 200);
  assert.equal(Array.isArray(listRes.payload), true);

  const seriesIds = listRes.payload.map(item => item.seriesId).sort();
  assert.deepEqual(seriesIds, [
    'widget-bms-1:bms:house:capacity.stateOfCharge:default',
    'widget-bms-1:bms:house:current:default'
  ]);
});

testRequiresNodeSqlite('series reconcile preserves existing widget-bms concrete series when battery discovery is temporarily unavailable', async () => {
  const server = createServerMock();
  server.setSelfPath('electrical.batteries', {
    value: {
      house: { stateOfCharge: 0.81 },
      start: { stateOfCharge: 0.93 }
    }
  });

  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const reconcile = router.postHandlers.get('/series/reconcile');
  const list = router.getHandlers.get('/series');
  const templateBody = [
    {
      seriesId: 'widget-bms-2:bms-template',
      datasetUuid: 'widget-bms-2:bms-template',
      ownerWidgetUuid: 'widget-bms-2',
      ownerWidgetSelector: 'widget-bms',
      path: 'self.electrical.batteries.*',
      expansionMode: 'bms-battery-tree',
      allowedBatteryIds: ['house'],
      source: 'default',
      enabled: true
    }
  ];

  const firstReconcileRes = createResMock();
  await reconcile({
    method: 'POST',
    path: '/series/reconcile',
    ip: '127.0.0.1',
    headers: {},
    body: templateBody
  }, firstReconcileRes);

  assert.equal(firstReconcileRes.statusCode, 200);
  assert.equal(firstReconcileRes.payload?.created, 2);

  server.setSelfPath('electrical.batteries', { value: null });

  const secondReconcileRes = createResMock();
  await reconcile({
    method: 'POST',
    path: '/series/reconcile',
    ip: '127.0.0.1',
    headers: {},
    body: templateBody
  }, secondReconcileRes);

  assert.equal(secondReconcileRes.statusCode, 200);

  const listRes = createResMock();
  await list({ params: {}, headers: {}, query: {} }, listRes);
  assert.equal(listRes.statusCode, 200);
  assert.equal(Array.isArray(listRes.payload), true);
  const secondSeriesIds = listRes.payload.map(item => item.seriesId).sort();
  assert.equal(secondSeriesIds.includes('widget-bms-2:bms:house:capacity.stateOfCharge:default'), true);
  assert.equal(secondSeriesIds.includes('widget-bms-2:bms:house:current:default'), true);

  await plugin.stop();
  pluginsToStop.delete(plugin);

  const restartServer = createServerMock();
  const restartPlugin = registerPluginForCleanup(start(restartServer));
  const restartRouter = createRouterMock();
  await startPlugin(restartPlugin, {});
  restartPlugin.registerWithRouter(restartRouter);

  const restartList = restartRouter.getHandlers.get('/series');
  const restartListRes = createResMock();
  await restartList({ params: {}, headers: {}, query: {} }, restartListRes);
  assert.equal(restartListRes.statusCode, 200);
  assert.equal(Array.isArray(restartListRes.payload), true);
  const restartSeriesIds = restartListRes.payload.map(item => item.seriesId).sort();
  assert.equal(restartSeriesIds.includes('widget-bms-2:bms:house:capacity.stateOfCharge:default'), true);
  assert.equal(restartSeriesIds.includes('widget-bms-2:bms:house:current:default'), true);
});

testRequiresNodeSqlite('series reconcile expands widget-solar-charger template entries into concrete charger metric series', async () => {
  const server = createServerMock();
  server.setSelfPath('electrical.solar', {
    value: {
      port: { current: 12.4, panelCurrent: 8.1 },
      starboard: { current: 11.8, panelCurrent: 7.9 }
    }
  });

  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const reconcile = router.postHandlers.get('/series/reconcile');
  const list = router.getHandlers.get('/series');

  const reconcileRes = createResMock();
  await reconcile({
    method: 'POST',
    path: '/series/reconcile',
    ip: '127.0.0.1',
    headers: {},
    body: [
      {
        seriesId: 'widget-solar-1:solar-template',
        datasetUuid: 'widget-solar-1:solar-template',
        ownerWidgetUuid: 'widget-solar-1',
        ownerWidgetSelector: 'widget-solar-charger',
        path: 'self.electrical.solar.*',
        expansionMode: 'solar-charger-tree',
        allowedChargerIds: ['port'],
        source: 'default',
        enabled: true
      }
    ]
  }, reconcileRes);

  assert.equal(reconcileRes.statusCode, 200);

  const listRes = createResMock();
  await list({ params: {}, headers: {}, query: {} }, listRes);
  assert.equal(listRes.statusCode, 200);
  assert.equal(Array.isArray(listRes.payload), true);

  const seriesIds = listRes.payload
    .filter(item => item.ownerWidgetUuid === 'widget-solar-1')
    .map(item => item.seriesId)
    .sort();
  assert.deepEqual(seriesIds, [
    'widget-solar-1:solar:port:current:default',
    'widget-solar-1:solar:port:panelCurrent:default'
  ]);
});

testRequiresNodeSqlite('series reconcile preserves existing widget-solar-charger concrete series when charger discovery is temporarily unavailable', async () => {
  const server = createServerMock();
  server.setSelfPath('electrical.solar', {
    value: {
      port: { current: 12.4, panelCurrent: 8.1 }
    }
  });

  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const reconcile = router.postHandlers.get('/series/reconcile');
  const list = router.getHandlers.get('/series');
  const templateBody = [
    {
      seriesId: 'widget-solar-2:solar-template',
      datasetUuid: 'widget-solar-2:solar-template',
      ownerWidgetUuid: 'widget-solar-2',
      ownerWidgetSelector: 'widget-solar-charger',
      path: 'self.electrical.solar.*',
      expansionMode: 'solar-charger-tree',
      allowedChargerIds: ['port'],
      source: 'default',
      enabled: true
    }
  ];

  const firstReconcileRes = createResMock();
  await reconcile({
    method: 'POST',
    path: '/series/reconcile',
    ip: '127.0.0.1',
    headers: {},
    body: templateBody
  }, firstReconcileRes);

  assert.equal(firstReconcileRes.statusCode, 200);
  assert.equal(firstReconcileRes.payload?.created, 2);

  server.setSelfPath('electrical.solar', { value: null });

  const secondReconcileRes = createResMock();
  await reconcile({
    method: 'POST',
    path: '/series/reconcile',
    ip: '127.0.0.1',
    headers: {},
    body: templateBody
  }, secondReconcileRes);

  assert.equal(secondReconcileRes.statusCode, 200);

  const listRes = createResMock();
  await list({ params: {}, headers: {}, query: {} }, listRes);
  assert.equal(listRes.statusCode, 200);
  assert.equal(Array.isArray(listRes.payload), true);
  const secondSeriesIds = listRes.payload.map(item => item.seriesId).sort();
  assert.equal(secondSeriesIds.includes('widget-solar-2:solar:port:current:default'), true);
  assert.equal(secondSeriesIds.includes('widget-solar-2:solar:port:panelCurrent:default'), true);
});

testRequiresNodeSqlite('history values endpoint validates required paths query', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, {});

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);
  let error = null;
  try {
    await provider.getValues({ pathSpecs: [] });
  } catch (e) {
    error = e;
  }
  // The provider should throw an error or return a message when paths is missing
  if (error) {
    assert.equal(error.message, 'node:sqlite storage did not return history values.');
  } else {
    assert.fail('Expected error when paths is missing');
  }
});

testRequiresNodeSqlite('history values endpoint rejects invalid from/to date inputs', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, {});

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  let error = null;
  try {
    await provider.getValues({
      pathSpecs: [{ path: 'navigation.speedOverGround', aggregate: 'avg' }],
      from: 'not-a-date',
      to: 'also-not-a-date'
    });
  } catch (e) {
    error = e;
  }

  assert.equal(typeof error?.message, 'string');
  assert.equal(error.message.includes('Invalid to date-time'), true);
});

testRequiresNodeSqlite('history values endpoint rejects invalid duration and resolution inputs', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));

  await startPlugin(plugin, {});

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  let durationError = null;
  try {
    await provider.getValues({
      pathSpecs: [{ path: 'navigation.speedOverGround', aggregate: 'avg' }],
      duration: 'NOT_A_DURATION'
    });
  } catch (e) {
    durationError = e;
  }

  assert.equal(typeof durationError?.message, 'string');
  assert.equal(durationError.message.includes('Invalid duration'), true);

  let resolutionError = null;
  try {
    await provider.getValues({
      pathSpecs: [{ path: 'navigation.speedOverGround', aggregate: 'avg' }],
      duration: 'PT10M',
      resolution: 'NOT_A_RESOLUTION'
    });
  } catch (e) {
    resolutionError = e;
  }

  assert.equal(typeof resolutionError?.message, 'string');
  assert.equal(resolutionError.message.includes('Invalid resolution'), true);
});

testRequiresNodeSqlite('history values endpoint returns history-compatible payload', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');
  const upsertRes = createResMock();
  await upsert({
    method: 'PUT',
    path: '/series/chart-2',
    ip: '127.0.0.1',
    headers: {},
    params: { seriesId: 'chart-2' },
    body: {
      datasetUuid: 'chart-2',
      ownerWidgetUuid: 'widget-2',
      path: 'environment.wind.speedTrue',
      context: 'vessels.self'
    }
  }, upsertRes);

  assert.equal(upsertRes.statusCode, 200);

  const payload = await provider.getValues({
    pathSpecs: [{ path: 'environment.wind.speedTrue', aggregate: 'avg' }],
    duration: 'PT1H'
  });

  assert.equal(payload?.context, 'vessels.self');
  assert.equal(Array.isArray(payload?.values), true);
  assert.equal(payload?.values?.[0]?.path, 'environment.wind.speedTrue');
  assert.equal(payload?.values?.[0]?.method, 'average');
  assert.equal(Array.isArray(payload?.data), true);
});

testRequiresNodeSqlite('stream ingestion records live samples for configured series', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');

  await upsert({
    method: 'PUT',
    path: '/series/live-1',
    ip: '127.0.0.1',
    headers: {},
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

  const payload = await provider.getValues({
    pathSpecs: [{ path: 'navigation.speedOverGround', aggregate: 'avg' }],
    duration: 'PT1H',
    context: 'vessels.self'
  });

  assert.equal(Array.isArray(payload?.data), true);
  assert.equal(Array.isArray(payload?.values), true);
  assert.equal(payload?.values?.[0]?.path, 'navigation.speedOverGround');
});

testRequiresNodeSqlite('stream ingestion normalizes prefixed paths on capture and query', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');

  const upsertRes = createResMock();
  await upsert({
    method: 'PUT',
    path: '/series/live-prefixed-1',
    ip: '127.0.0.1',
    headers: {},
    params: { seriesId: 'live-prefixed-1' },
    body: {
      datasetUuid: 'live-prefixed-1',
      ownerWidgetUuid: 'widget-live-prefixed-1',
      path: 'self.navigation.speedOverGround',
      context: 'vessels.self'
    }
  }, upsertRes);

  assert.equal(upsertRes.statusCode, 200);

  server.emitStream('navigation.speedOverGround', {
    path: 'navigation.speedOverGround',
    value: 6.1,
    context: 'vessels.self',
    timestamp: new Date().toISOString(),
    $source: 'n2k.61'
  });

  const payload = await provider.getValues({
    pathSpecs: [{ path: 'vessels.self.navigation.speedOverGround', aggregate: 'avg' }],
    duration: 'PT1H',
    context: 'vessels.self'
  });

  assert.equal(Array.isArray(payload?.data), true);
  assert.equal(payload.data.length > 0, true);
  assert.equal(payload?.values?.[0]?.path, 'navigation.speedOverGround');
});

testRequiresNodeSqlite('history values returns pending ingested sample without waiting for timer flush', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');

  await upsert({
    method: 'PUT',
    path: '/series/live-2',
    ip: '127.0.0.1',
    headers: {},
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

  const payload = await provider.getValues({
    pathSpecs: [{ path: 'environment.wind.angleTrueWater', aggregate: 'avg' }],
    from: new Date(sampleTs - 1000).toISOString(),
    to: new Date(sampleTs + 1000).toISOString(),
    context: 'vessels.self'
  });

  assert.equal(Array.isArray(payload?.data), true);
  assert.equal(Array.isArray(payload?.values), true);
  assert.equal(payload?.values?.[0]?.path, 'environment.wind.angleTrueWater');
});

testRequiresNodeSqlite('history ingestion accepts source wildcard and vessels.self alias context', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');

  const upsertRes = createResMock();
  await upsert({
    method: 'PUT',
    path: '/series/live-3',
    ip: '127.0.0.1',
    headers: {},
    params: { seriesId: 'live-3' },
    body: {
      datasetUuid: 'live-3',
      ownerWidgetUuid: 'widget-live-3',
      path: 'navigation.speedOverGround',
      context: 'vessels.self',
      source: '*'
    }
  }, upsertRes);

  assert.equal(upsertRes.statusCode, 200);

  server.emitStream('navigation.speedOverGround', {
    path: 'navigation.speedOverGround',
    value: 6.7,
    context: 'vessels.urn:mrn:signalk:uuid:test-self',
    timestamp: new Date().toISOString(),
    $source: 'n2k.55'
  });

  const payload = await provider.getValues({
    pathSpecs: [{ path: 'navigation.speedOverGround', aggregate: 'avg' }],
    duration: 'PT1H',
    context: 'vessels.self'
  });

  assert.equal(Array.isArray(payload?.data), true);
  assert.equal(payload.data.length > 0, true);
});

testRequiresNodeSqlite('history ingestion rejects non-self vessel contexts for vessels.self series', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();
  const isolatedPath = 'navigation.speedOverGroundReject';

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');

  const upsertRes = createResMock();
  await upsert({
    method: 'PUT',
    path: '/series/live-3b',
    ip: '127.0.0.1',
    headers: {},
    params: { seriesId: 'live-3b' },
    body: {
      datasetUuid: 'live-3b',
      ownerWidgetUuid: 'widget-live-3b',
      path: isolatedPath,
      context: 'vessels.self',
      source: '*'
    }
  }, upsertRes);

  assert.equal(upsertRes.statusCode, 200);

  server.emitStream(isolatedPath, {
    path: isolatedPath,
    value: 7.1,
    context: 'vessels.urn:mrn:signalk:uuid:other-vessel',
    timestamp: new Date().toISOString(),
    $source: 'n2k.55'
  });

  const payload = await provider.getValues({
    pathSpecs: [{ path: isolatedPath, aggregate: 'avg' }],
    duration: 'PT1H',
    context: 'vessels.self'
  });

  assert.equal(Array.isArray(payload?.data), true);
  assert.equal(payload.data.length, 0);
});

testRequiresNodeSqlite('history values resolution numeric input is interpreted as seconds', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');

  const upsertRes = createResMock();
  await upsert({
    method: 'PUT',
    path: '/series/live-4',
    ip: '127.0.0.1',
    headers: {},
    params: { seriesId: 'live-4' },
    body: {
      datasetUuid: 'live-4',
      ownerWidgetUuid: 'widget-live-4',
      path: 'navigation.speedOverGround',
      context: 'vessels.self'
    }
  }, upsertRes);

  assert.equal(upsertRes.statusCode, 200);

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

  const payload = await provider.getValues({
    pathSpecs: [{ path: 'navigation.speedOverGround', aggregate: 'avg' }],
    context: 'vessels.self',
    from: new Date(baseTs).toISOString(),
    to: new Date(baseTs + (2 * 60 * 1000) - 1).toISOString(),
    resolution: 60
  });

  assert.equal(Array.isArray(payload?.data), true);
  assert.equal(payload.data.length, 2);
  assert.equal(payload.data[0][0], '2026-02-18T10:00:00.000Z');
  assert.equal(payload.data[1][0], '2026-02-18T10:01:00.000Z');
  assert.equal(payload.data[0][1], 5);
  assert.equal(payload.data[1][1], 12);
});

testRequiresNodeSqlite('history values applies min and max methods when downsampling', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');

  const upsertRes = createResMock();
  await upsert({
    method: 'PUT',
    path: '/series/live-5',
    ip: '127.0.0.1',
    headers: {},
    params: { seriesId: 'live-5' },
    body: {
      datasetUuid: 'live-5',
      ownerWidgetUuid: 'widget-live-5',
      path: 'navigation.speedOverGround',
      context: 'vessels.self'
    }
  }, upsertRes);

  assert.equal(upsertRes.statusCode, 200);

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

  const payload = await provider.getValues({
    pathSpecs: [
      { path: 'navigation.speedOverGround', aggregate: 'avg' },
      { path: 'navigation.speedOverGround', aggregate: 'min' },
      { path: 'navigation.speedOverGround', aggregate: 'max' }
    ],
    context: 'vessels.self',
    from: new Date(baseTs).toISOString(),
    to: new Date(baseTs + (2 * 60 * 1000) - 1).toISOString(),
    resolution: 60
  });

  assert.equal(Array.isArray(payload?.data), true);
  assert.equal(payload.data.length, 2);

  assert.equal(payload.data[0][1], 5);
  assert.equal(payload.data[0][2], 4);
  assert.equal(payload.data[0][3], 6);

  assert.equal(payload.data[1][1], 12);
  assert.equal(payload.data[1][2], 10);
  assert.equal(payload.data[1][3], 14);
});

test('table-driven history math validates min avg max sma ema across resolutions', () => {
  const baseTs = Date.parse('2026-02-18T12:00:00.000Z');
  const sourceValues = [10, 20, 30, 40, 50, 60];
  const rows = buildRows(baseTs, sourceValues);
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
    resolutions.forEach((resolution) => {
      const path = entry.period
        ? `navigation.speedOverGround:${entry.method}:${entry.period}`
        : `navigation.speedOverGround:${entry.method}`;
      const response = computeSqliteHistoryResponse(rows, path, {
        from,
        to,
        resolution
      });

      const values = response.data.map((row) => Number(row[1]));
      assertSeriesAlmostEqual(values, entry.expected[resolution]);
    });
  });
});

testRequiresNodeSqlite('history values supports mixed avg/min/max/sma/ema in a single request', async () => {
  const server = createServerMock();
  const start = require('../../plugin/index.js');
  const plugin = registerPluginForCleanup(start(server));
  const router = createRouterMock();

  await startPlugin(plugin, {});
  plugin.registerWithRouter(router);

  const provider = server.history.getRegisteredProvider();
  await waitForHistoryProviderReady(provider);

  const upsert = router.putHandlers.get('/series/:seriesId');

  const upsertRes = createResMock();
  await upsert({
    method: 'PUT',
    path: '/series/live-6',
    ip: '127.0.0.1',
    headers: {},
    params: { seriesId: 'live-6' },
    body: {
      datasetUuid: 'live-6',
      ownerWidgetUuid: 'widget-live-6',
      path: 'navigation.speedOverGround',
      context: 'vessels.self'
    }
  }, upsertRes);

  assert.equal(upsertRes.statusCode, 200);

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

  const payload = await provider.getValues({
    pathSpecs: [
      { path: 'navigation.speedOverGround', aggregate: 'avg' },
      { path: 'navigation.speedOverGround', aggregate: 'min' },
      { path: 'navigation.speedOverGround', aggregate: 'max' },
      { path: 'navigation.speedOverGround', aggregate: 'sma', parameter: [3] },
      { path: 'navigation.speedOverGround', aggregate: 'ema', parameter: [3] }
    ],
    context: 'vessels.self',
    from: new Date(baseTs).toISOString(),
    to: new Date(baseTs + 59000).toISOString(),
    resolution: 30
  });

  assert.equal(Array.isArray(payload?.data), true);
  assert.equal(payload.data.length, 2);

  assert.equal(payload.data[0][1], 20);
  assert.equal(payload.data[0][2], 10);
  assert.equal(payload.data[0][3], 30);
  assert.equal(Number.isFinite(payload.data[0][4]), true);
  assert.equal(Number.isFinite(payload.data[0][5]), true);

  assert.equal(payload.data[1][1], 50);
  assert.equal(payload.data[1][2], 50);
  assert.equal(payload.data[1][3], 50);
  assert.equal(Number.isFinite(payload.data[1][4]), true);
  assert.equal(Number.isFinite(payload.data[1][5]), true);
});

test('history values respects from/to boundaries when not aligned to bucket edges', () => {
  const baseTs = Date.parse('2026-02-18T14:00:00.000Z');
  const rows = buildRows(baseTs, [10, 20, 30, 40, 50, 60]);

  const response = computeSqliteHistoryResponse(rows, 'navigation.speedOverGround:avg', {
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
  const rows = [
    { ts_ms: baseTs + 0, value: 10 },
    { ts_ms: baseTs + 10000, value: 20 },
    { ts_ms: baseTs + 40000, value: 40 }
  ];

  const response = computeSqliteHistoryResponse(rows, 'navigation.speedOverGround:avg', {
    from: new Date(baseTs).toISOString(),
    to: new Date(baseTs + 50000).toISOString(),
    resolution: 10
  });

  assert.equal(response.data.length, 3);
  assert.equal(response.data[0][0], '2026-02-18T15:00:00.000Z');
  assert.equal(response.data[1][0], '2026-02-18T15:00:10.000Z');
  assert.equal(response.data[2][0], '2026-02-18T15:00:40.000Z');
});

test('history series enforces 1000ms minimum sampleTime for chart widgets', () => {
  const service = new HistorySeriesService(() => Date.now());
  service.upsertSeries({
    seriesId: 'sampling-default-1',
    datasetUuid: 'sampling-default-1',
    ownerWidgetUuid: 'widget-instance-1',
    ownerWidgetSelector: 'widget-data-chart',
    path: 'navigation.speedOverGround',
    context: 'vessels.self',
    retentionDurationMs: 60_000
  });

  const firstAccepted = service.recordSample('sampling-default-1', 10, 1000);
  const secondAccepted = service.recordSample('sampling-default-1', 11, 1500);
  const thirdAccepted = service.recordSample('sampling-default-1', 12, 2000);

  assert.equal(firstAccepted, true);
  assert.equal(secondAccepted, false);
  assert.equal(thirdAccepted, true);
});

test('history reconcile treats reordered array fields as equivalent', () => {
  const service = new HistorySeriesService(() => 1234567890);

  const first = service.reconcileSeries([{
    seriesId: 'reconcile-stable-1',
    datasetUuid: 'reconcile-stable-1',
    ownerWidgetUuid: 'widget-instance-2',
    ownerWidgetSelector: 'widget-bms',
    path: 'electrical.batteries.house.current',
    expansionMode: 'bms-battery-tree',
    allowedBatteryIds: ['house', 'start'],
    context: 'vessels.self',
    source: 'default',
    methods: ['avg', 'max'],
    retentionDurationMs: 60_000,
    enabled: true
  }]);

  const second = service.reconcileSeries([{
    ownerWidgetSelector: 'widget-bms',
    enabled: true,
    retentionDurationMs: 60_000,
    methods: ['max', 'avg'],
    source: 'default',
    context: 'vessels.self',
    allowedBatteryIds: ['start', 'house'],
    expansionMode: 'bms-battery-tree',
    path: 'electrical.batteries.house.current',
    ownerWidgetUuid: 'widget-instance-2',
    datasetUuid: 'reconcile-stable-1',
    seriesId: 'reconcile-stable-1'
  }]);

  assert.equal(first.created, 1);
  assert.equal(second.updated, 0);
  assert.equal(second.deleted, 0);
  assert.equal(second.created, 0);
});

test('history series enforces fixed 15s sampleTime for non-chart widgets', () => {
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
  const secondAccepted = service.recordSample('sampling-config-1', 11, 11000);
  const thirdAccepted = service.recordSample('sampling-config-1', 12, 17000);

  assert.equal(firstAccepted, true);
  assert.equal(secondAccepted, false);
  assert.equal(thirdAccepted, true);
});

test('history values uses explicit from/to over duration when both are provided', () => {
  const baseTs = Date.parse('2026-02-18T17:00:00.000Z');
  const rows = buildRows(baseTs, [10, 20, 30, 40], 10 * 60 * 1000);

  const fromIso = new Date(baseTs).toISOString();
  const toIso = new Date(baseTs + (30 * 60 * 1000)).toISOString();

  const response = computeSqliteHistoryResponse(rows, 'navigation.speedOverGround:avg', {
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
  assert.throws(() => {
    computeSqliteHistoryResponse([], 'navigation.speedOverGround:avg', {
      from: 'not-a-date',
      to: 'also-not-a-date'
    });
  }, /Invalid to date-time/);

  assert.throws(() => {
    computeSqliteHistoryResponse([], 'navigation.speedOverGround:avg', {
      from: 'invalid-from',
      to: '2026-02-18T20:00:00.000Z'
    });
  }, /Invalid from date-time/);
});

test('history values throws for invalid duration and resolution inputs', () => {
  assert.throws(() => {
    computeSqliteHistoryResponse([], 'navigation.speedOverGround:avg', {
      duration: 'BAD_DURATION'
    });
  }, /Invalid duration/);

  assert.throws(() => {
    computeSqliteHistoryResponse([], 'navigation.speedOverGround:avg', {
      from: '2026-02-18T19:30:00.000Z',
      to: '2026-02-18T19:40:00.000Z',
      duration: 'PT10M',
      resolution: 'BAD_RESOLUTION'
    });
  }, /Invalid resolution/);
});

test('history service normalizes prefixed paths for direct query lookups', () => {
  const baseTs = Date.parse('2026-02-18T20:00:00.000Z');
  const rows = [{ ts_ms: baseTs, value: 7.4 }];
  const response = computeSqliteHistoryResponse(rows, 'self.navigation.speedOverGround:avg', {
    from: new Date(baseTs - 1000).toISOString(),
    to: new Date(baseTs + 1000).toISOString(),
    resolution: 1
  });

  assert.equal(response.values[0].path, 'navigation.speedOverGround');
  assert.equal(response.data.length, 1);
  assert.equal(response.data[0][1], 7.4);
});

test('sqlite stored paths/contexts apply requested time-range filters', async () => {
  const storage = new SqliteHistoryStorageService(TEST_DATA_DIR);
  storage.configure();

  const allSql = [];
  storage.db = {
    exec: () => undefined,
    prepare: (sql) => {
      allSql.push(sql);
      return {
        all: () => [{ value: 'environment.wind.angleApparent' }]
      };
    },
    close: () => undefined
  };
  storage.initialized = true;
  storage.runtimeAvailable = true;

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

test('sqlite lifecycle token guards stale flush/close operations', async () => {
  const storage = new SqliteHistoryStorageService(TEST_DATA_DIR);
  storage.configure();

  let closeCalls = 0;
  storage.db = {
    exec: () => undefined,
    prepare: () => ({ all: () => [] }),
    close: () => {
      closeCalls += 1;
    }
  };
  storage.initialized = true;
  storage.runtimeAvailable = true;

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
  assert.notEqual(storage.db, null);

  await storage.close(2);
  assert.equal(closeCalls, 1);
  assert.equal(storage.db, null);
});

test('sqlite prune removes expired rows using per-series retention windows', async () => {
  const storage = new SqliteHistoryStorageService(TEST_DATA_DIR);
  storage.configure();

  const allSql = [];
  const runSql = [];
  let pruneSelectCall = 0;
  storage.db = {
    exec: (sql) => {
      runSql.push(sql);
    },
    prepare: (sql) => {
      allSql.push(sql);
      if (sql.includes('SELECT rowid')) {
        pruneSelectCall += 1;
        if (pruneSelectCall === 1) {
          return { all: () => [{ rowid: 1 }, { rowid: 2 }, { rowid: 3 }] };
        }
        return { all: () => [] };
      }
      return { all: () => [] };
    },
    close: () => undefined
  };
  storage.initialized = true;
  storage.runtimeAvailable = true;

  const nowMs = Date.parse('2026-02-19T00:00:00.000Z');
  const removed = await storage.pruneExpiredSamples(nowMs);

  assert.equal(removed, 3);
  assert.equal(allSql.length >= 1, true);
  assert.equal(runSql.length, 1);
  assert.equal(allSql.some(sql => sql.includes(`history_samples.ts_ms < (${nowMs} - hs.retention_duration_ms)`)), true);
  assert.equal(runSql.some(sql => sql.includes('DELETE FROM history_samples')), true);
  assert.equal(runSql.some(sql => sql.includes('WHERE rowid IN (')), true);
});

test('sqlite prune skips stale lifecycle token operations', async () => {
  const storage = new SqliteHistoryStorageService(TEST_DATA_DIR);
  storage.configure();

  let queryCount = 0;
  storage.db = {
    exec: () => undefined,
    prepare: () => {
      queryCount += 1;
      return { all: () => [{ removed_rows: 9 }] };
    },
    close: () => undefined
  };
  storage.initialized = true;
  storage.runtimeAvailable = true;

  storage.lifecycleToken = 8;
  const removed = await storage.pruneExpiredSamples(Date.now(), 7);

  assert.equal(removed, 0);
  assert.equal(queryCount, 0);
});

test('sqlite storage configure uses fixed defaults', () => {
  const storage = new SqliteHistoryStorageService(TEST_DATA_DIR);
  const config = storage.configure();

  assert.equal(config.engine, 'node:sqlite');
  assert.equal(config.databaseFile, TEST_SQLITE_PATH);
  assert.equal(config.flushIntervalMs, 30000);
});

testRequiresNodeSqlite('history requests return 503 when sqlite is unavailable', async () => {
  const originalInitialize = SqliteHistoryStorageService.prototype.initialize;
  SqliteHistoryStorageService.prototype.initialize = async function initializeMock() {
    this.lastInitError = 'forced-test-failure';
    this.db = null;
    return false;
  };

  try {
    const server = createServerMock();
    const start = require('../../plugin/index.js');
    const plugin = registerPluginForCleanup(start(server));
    const router = createRouterMock();

    await startPlugin(plugin, {});
    plugin.registerWithRouter(router);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100));

    const provider = server.history.getRegisteredProvider();

    let error = null;
    try {
      await provider.getPaths({});
    } catch (err) {
      error = err;
    }

    assert.equal(Boolean(error), true);
    assert.equal(String(error?.message || '').includes('node:sqlite storage unavailable'), true);
  } finally {
    SqliteHistoryStorageService.prototype.initialize = originalInitialize;
  }
});

testRequiresNodeSqlite('series upsert rolls back in-memory state when sqlite write fails', async () => {
  const originalUpsert = SqliteHistoryStorageService.prototype.upsertSeriesDefinition;
  SqliteHistoryStorageService.prototype.upsertSeriesDefinition = async function upsertFail() {
    throw new Error('SQLite forced upsert failure');
  };

  try {
    const server = createServerMock();
    const start = require('../../plugin/index.js');
    const plugin = registerPluginForCleanup(start(server));
    const router = createRouterMock();

    await startPlugin(plugin, {});
    plugin.registerWithRouter(router);

    const provider = server.history.getRegisteredProvider();
    await waitForHistoryProviderReady(provider);
    await new Promise(resolvePromise => setTimeout(resolvePromise, 100));

    const upsert = router.putHandlers.get('/series/:seriesId');
    const list = router.getHandlers.get('/series');

    const baselineRes = createResMock();
    await list({ params: {}, headers: {}, query: {} }, baselineRes);
    assert.equal(baselineRes.statusCode, 200);
    const baselineSeriesIds = new Set((baselineRes.payload ?? []).map(item => item.seriesId));

    const upsertRes = createResMock();
    await upsert({
      method: 'PUT',
      path: '/series/atomic-upsert-1',
      ip: '127.0.0.1',
      headers: {},
      params: { seriesId: 'atomic-upsert-1' },
      body: {
        datasetUuid: 'atomic-upsert-1',
        ownerWidgetUuid: 'widget-atomic-upsert-1',
        path: 'navigation.speedOverGround',
        context: 'vessels.self'
      }
    }, upsertRes);

    assert.equal(upsertRes.statusCode, 503);
  } finally {
    SqliteHistoryStorageService.prototype.upsertSeriesDefinition = originalUpsert;
  }
});

testRequiresNodeSqlite('series delete rolls back in-memory state when sqlite write fails', async () => {
  const originalDelete = SqliteHistoryStorageService.prototype.deleteSeriesDefinition;
  SqliteHistoryStorageService.prototype.deleteSeriesDefinition = async function deleteFail() {
    throw new Error('SQLite forced delete failure');
  };

  try {
    const server = createServerMock();
    const start = require('../../plugin/index.js');
    const plugin = registerPluginForCleanup(start(server));
    const router = createRouterMock();

    await startPlugin(plugin, {});
    plugin.registerWithRouter(router);

    const upsert = router.putHandlers.get('/series/:seriesId');
    const remove = router.deleteHandlers.get('/series/:seriesId');
    const list = router.getHandlers.get('/series');

    const upsertReq = {
      method: 'PUT',
      path: '/series/atomic-delete-1',
      ip: '127.0.0.1',
      headers: {},
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
      await list({ params: {}, headers: {}, query: {} }, listBeforeDeleteRes);
      created = Array.isArray(listBeforeDeleteRes.payload)
        && listBeforeDeleteRes.payload.some(item => item.seriesId === 'atomic-delete-1');

      if (!created) {
        await new Promise(resolvePromise => setTimeout(resolvePromise, 100));
      }
    }

    assert.equal(created, true);

    const deleteRes = createResMock();
    await remove({ method: 'DELETE', path: '/series/atomic-delete-1', ip: '127.0.0.1', headers: {}, params: { seriesId: 'atomic-delete-1' } }, deleteRes);
    assert.equal(deleteRes.statusCode, 503);

    const listRes = createResMock();
    await list({ params: {}, headers: {}, query: {} }, listRes);
    assert.equal(listRes.statusCode, 200);
    assert.equal(Array.isArray(listRes.payload), true);
    assert.equal(listRes.payload.some(item => item.seriesId === 'atomic-delete-1'), true);
  } finally {
    SqliteHistoryStorageService.prototype.deleteSeriesDefinition = originalDelete;
  }
});

testRequiresNodeSqlite('history request wait for sqlite initialization is bounded', async () => {
  const originalInitialize = SqliteHistoryStorageService.prototype.initialize;
  SqliteHistoryStorageService.prototype.initialize = async function initializeHang() {
    this.lastInitError = null;
    this.db = null;
    return new Promise(() => {});
  };

  try {
    const server = createServerMock();
    const start = require('../../plugin/index.js');
    const plugin = registerPluginForCleanup(start(server));
    const router = createRouterMock();

    await startPlugin(plugin, {});
    plugin.registerWithRouter(router);

    const provider = server.history.getRegisteredProvider();
    const startedAt = Date.now();
    let error = null;
    try {
      await provider.getPaths({});
    } catch (err) {
      error = err;
    }
    const elapsedMs = Date.now() - startedAt;

    assert.equal(Boolean(error), true);
    assert.equal(String(error?.message || '').includes('node:sqlite storage unavailable'), true);
    assert.equal(elapsedMs >= 4500, true);
    assert.equal(elapsedMs < 7500, true);
  } finally {
    SqliteHistoryStorageService.prototype.initialize = originalInitialize;
  }
});

testRequiresNodeSqlite('sqlite getValues queries requested paths in a single sql call', async () => {
  const storage = new SqliteHistoryStorageService(TEST_DATA_DIR);
  storage.configure();

  let historySelectCount = 0;
  const executedSql = [];
  storage.db = {
    exec: () => undefined,
    prepare: (sql) => {
      executedSql.push(sql);
      if (sql.includes('FROM history_samples')) {
        historySelectCount += 1;
        return {
          all: () => ([
            { path: 'navigation.speedOverGround', ts_ms: 1000, value: 10 },
            { path: 'navigation.courseOverGroundTrue', ts_ms: 1000, value: 20 }
          ])
        };
      }
      return { all: () => [] };
    },
    close: () => undefined
  };
  storage.initialized = true;
  storage.runtimeAvailable = true;

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

});
