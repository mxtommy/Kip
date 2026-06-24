const test = require('node:test');
const assert = require('node:assert/strict');
const { rmSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');

const { ImageStore } = require('../../plugin/images/image-store.js');
const { registerImageRoutes, isAuthenticatedRequest } = require('../../plugin/images/image-router.js');

const TMP_ROOT = resolve('.tmp-kip-image-router-test');
const png = () => sharp({ create: { width: 120, height: 90, channels: 4, background: { r: 5, g: 6, b: 7, alpha: 1 } } }).png().toBuffer();

function createRouterMock() {
  return {
    getHandlers: new Map(), postHandlers: new Map(), putHandlers: new Map(), deleteHandlers: new Map(),
    get(p, h) { this.getHandlers.set(p, h); },
    post(p, h) { this.postHandlers.set(p, h); },
    put(p, h) { this.putHandlers.set(p, h); },
    delete(p, h) { this.deleteHandlers.set(p, h); },
    param() {}
  };
}

function createResMock() {
  let resolveDone;
  const done = new Promise((r) => { resolveDone = r; });
  return {
    statusCode: 200, jsonBody: undefined, sentBuffer: undefined, headers: {}, done,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.jsonBody = b; resolveDone(); return this; },
    send(b) { this.sentBuffer = b; resolveDone(); return this; },
    setHeader(k, v) { this.headers[k] = v; return this; }
  };
}

async function setup() {
  const dir = join(TMP_ROOT, randomUUID());
  const store = new ImageStore(dir);
  const router = createRouterMock();
  registerImageRoutes(router, { resolveStore: () => store });
  return { store, router };
}

test.after(() => rmSync(TMP_ROOT, { recursive: true, force: true }));

test('isAuthenticatedRequest: open when no security, requires a principal when security is on', () => {
  assert.equal(isAuthenticatedRequest({}), true);                                   // no security configured
  assert.equal(isAuthenticatedRequest({ skPrincipal: { identifier: 'u1' } }), true); // authenticated
  assert.equal(isAuthenticatedRequest({ skIsAuthenticated: true }), true);
  assert.equal(isAuthenticatedRequest({ skIsAuthenticated: false }), false);          // security on, anonymous
  assert.equal(isAuthenticatedRequest({ skPrincipal: null, skIsAuthenticated: false }), false);
});

test('POST /images rejects an anonymous (not-logged-in) request with 401', async () => {
  const { router } = await setup();
  const res = createResMock();
  router.postHandlers.get('/images')({ skIsAuthenticated: false, headers: {} }, res);
  await res.done;
  assert.equal(res.statusCode, 401);
  assert.match(res.jsonBody.error, /login required/i);
});

test('DELETE /images/:id and /images/cache require login', async () => {
  const { router } = await setup();
  for (const handler of [router.deleteHandlers.get('/images/:id'), router.deleteHandlers.get('/images/cache')]) {
    const res = createResMock();
    handler({ skIsAuthenticated: false, params: { id: 'abc' } }, res);
    await res.done;
    assert.equal(res.statusCode, 401);
  }
});

test('GET /images lists the shared library', async () => {
  const { store, router } = await setup();
  const a = await store.ingest(await png(), 'a.png');
  const res = createResMock();
  router.getHandlers.get('/images')({}, res);
  await res.done;
  assert.ok(Array.isArray(res.jsonBody));
  assert.deepEqual(res.jsonBody.map((m) => m.id), [a.id]);
});

test('GET /images/:id serves bytes with the safe headers', async () => {
  const { store, router } = await setup();
  const meta = await store.ingest(await png(), 'm.png');
  const res = createResMock();
  router.getHandlers.get('/images/:id')({ params: { id: meta.id }, query: { w: '320' } }, res);
  await res.done;
  assert.equal(res.statusCode, 200);
  assert.ok(Buffer.isBuffer(res.sentBuffer));
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff');
  assert.match(res.headers['Content-Security-Policy'], /sandbox/);
  assert.equal(res.headers['Content-Type'], 'image/webp');
});

test('GET /images/:id rejects malformed ids and 404s unknown ids', async () => {
  const { router } = await setup();
  const bad = createResMock();
  router.getHandlers.get('/images/:id')({ params: { id: '../secret' }, query: {} }, bad);
  await bad.done;
  assert.equal(bad.statusCode, 400);

  const missing = createResMock();
  router.getHandlers.get('/images/:id')({ params: { id: 'deadbeef-0000' }, query: {} }, missing);
  await missing.done;
  assert.equal(missing.statusCode, 404);
});

test('GET /images/cache reports size + count', async () => {
  const { store, router } = await setup();
  const meta = await store.ingest(await png(), 'm.png');
  await store.getServable(meta.id, 320); // populate cache
  const res = createResMock();
  router.getHandlers.get('/images/cache')({}, res);
  await res.done;
  assert.equal(res.jsonBody.files, 1);
  assert.ok(res.jsonBody.bytes > 0);
});

test('routes return 503 when the store is not ready', async () => {
  const router = createRouterMock();
  registerImageRoutes(router, { resolveStore: () => null });
  const res = createResMock();
  router.getHandlers.get('/images')({}, res);
  await res.done;
  assert.equal(res.statusCode, 503);
});
