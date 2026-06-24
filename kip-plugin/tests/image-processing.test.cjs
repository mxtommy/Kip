const test = require('node:test');
const assert = require('node:assert/strict');
const { rmSync, existsSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');

const {
  snapWidth, computeWorkerCount, processImage, inProcessProcessor,
  WIDTH_ALLOWLIST, CANONICAL_WIDTH
} = require('../../plugin/images/image-processing.js');
const { ImageStore, safeImageHeaders } = require('../../plugin/images/image-store.js');
const { WorkerPoolImageProcessor } = require('../../plugin/images/worker-pool.js');

const TMP_ROOT = resolve('.tmp-kip-image-proc-test');
const freshDir = () => join(TMP_ROOT, randomUUID());

const png = (w = 200, h = 150) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 9, g: 8, b: 7, alpha: 1 } } }).png().toBuffer();

// Build a minimal multi-frame animated GIF (clear-before-every-pixel keeps all LZW codes 3-bit).
function animatedGif(W, H, frames) {
  const lzw = (indices) => {
    const codes = [];
    for (const idx of indices) { codes.push(4); codes.push(idx & 3); } // clear, pixel
    codes.push(5); // EOI
    const bytes = []; let cur = 0, bits = 0;
    for (const c of codes) { cur |= (c & 7) << bits; bits += 3; while (bits >= 8) { bytes.push(cur & 0xff); cur >>= 8; bits -= 8; } }
    if (bits) bytes.push(cur & 0xff);
    const out = [2]; // min code size
    for (let i = 0; i < bytes.length; i += 255) { const chunk = bytes.slice(i, i + 255); out.push(chunk.length, ...chunk); }
    out.push(0);
    return out;
  };
  const b = [];
  b.push(...Buffer.from('GIF89a'));
  b.push(W & 0xff, W >> 8, H & 0xff, H >> 8, 0x80, 0, 0, 0, 0, 0, 255, 255, 255);
  b.push(0x21, 0xFF, 0x0B, ...Buffer.from('NETSCAPE2.0'), 0x03, 0x01, 0, 0, 0);
  for (const idx of frames) {
    b.push(0x21, 0xF9, 0x04, 0x04, 50, 0, 0, 0);
    b.push(0x2C, 0, 0, 0, 0, W & 0xff, W >> 8, H & 0xff, H >> 8, 0);
    b.push(...lzw(new Array(W * H).fill(idx)));
  }
  b.push(0x3B);
  return Buffer.from(b);
}

test.after(() => rmSync(TMP_ROOT, { recursive: true, force: true }));

test('snapWidth snaps up to the allow-list and uses canonical for unset/oversized', () => {
  assert.equal(snapWidth(100), 160);
  assert.equal(snapWidth(640), 640);
  assert.equal(snapWidth(700), 960);
  assert.equal(snapWidth(null), CANONICAL_WIDTH);
  assert.equal(snapWidth(0), CANONICAL_WIDTH);
  assert.equal(snapWidth(99999), CANONICAL_WIDTH);
  assert.equal(WIDTH_ALLOWLIST[WIDTH_ALLOWLIST.length - 1], CANONICAL_WIDTH);
});

test('computeWorkerCount is n-1, clamped to at least 1', () => {
  assert.equal(computeWorkerCount(1), 1);
  assert.equal(computeWorkerCount(2), 1);
  assert.equal(computeWorkerCount(4), 3);
  assert.equal(computeWorkerCount(0), 1);
});

test('processImage converts a raster to WebP at the requested width', async () => {
  const out = await processImage({ buffer: await png(800, 600), format: 'png', width: 320, animated: false });
  const md = await sharp(out.buffer).metadata();
  assert.equal(md.format, 'webp');
  assert.equal(md.width, 320);
  assert.equal(out.width, 320);
});

test('processImage preserves animation (GIF -> animated WebP) and resizes', async () => {
  // Fixture is wider than the 64px target so resize actually downscales (withoutEnlargement).
  const out = await processImage({ buffer: animatedGif(96, 72, [0, 1, 0]), format: 'gif', width: 64, animated: true });
  const md = await sharp(out.buffer, { animated: true }).metadata();
  assert.equal(md.format, 'webp');
  assert.equal(md.pages, 3, 'all frames preserved');
  assert.equal(md.width, 64);
});

test('getServable generates a WebP variant on demand, then serves it from cache', async () => {
  const dir = freshDir();
  let calls = 0;
  const counting = { process: async (req, key) => { calls++; return inProcessProcessor.process(req, key); } };
  const store = new ImageStore(dir, counting);
  const meta = await store.ingest(await png(400, 300), 'map.png');

  const first = await store.getServable(meta.id, 100); // snaps to 160 -> generates
  assert.equal(calls, 1);
  assert.equal(first.contentType, 'image/webp');
  assert.equal(first.headers['X-Content-Type-Options'], 'nosniff');
  assert.ok(/sandbox/.test(first.headers['Content-Security-Policy']));
  assert.ok(existsSync(join(dir, 'cache', meta.id, '160.webp')), 'variant cached on disk');
  const md = await sharp(first.buffer).metadata();
  assert.equal(md.width, 160);

  const second = await store.getServable(meta.id, 100); // cache hit -> no reprocessing
  assert.equal(calls, 1);
  assert.deepEqual(second.buffer, first.buffer);
});

test('getServable serves sanitized SVG as-is without invoking the processor', async () => {
  const dir = freshDir();
  let calls = 0;
  const counting = { process: async (req, key) => { calls++; return inProcessProcessor.process(req, key); } };
  const store = new ImageStore(dir, counting);
  const meta = await store.ingest(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>'), 'v.svg');

  const s = await store.getServable(meta.id);
  assert.equal(calls, 0, 'SVG is not raster-processed');
  assert.equal(s.contentType, 'image/svg+xml');
  assert.equal(s.headers['X-Content-Type-Options'], 'nosniff');
  assert.ok(/<rect/i.test(s.buffer.toString('utf8')));
});

test('getServable returns null for unknown / malformed ids', async () => {
  const store = new ImageStore(freshDir());
  assert.equal(await store.getServable('does-not-exist'), null);
  assert.equal(await store.getServable('../../etc/passwd'), null);
});

test('cacheStats totals generated variants and purgeCache clears them (originals kept)', async () => {
  const dir = freshDir();
  const store = new ImageStore(dir);
  const meta = await store.ingest(await png(), 'm.png');
  await store.getServable(meta.id, 320);
  await store.getServable(meta.id, 640);

  let stats = await store.cacheStats();
  assert.equal(stats.files, 2);
  assert.ok(stats.bytes > 0);

  await store.purgeCache();
  stats = await store.cacheStats();
  assert.equal(stats.files, 0);
  assert.equal(stats.bytes, 0);
  // Original still present + still serveable (regenerated).
  assert.ok(await store.getMeta(meta.id));
  const reserved = await store.getServable(meta.id, 320);
  assert.equal(reserved.contentType, 'image/webp');
});

test('safeImageHeaders locks down sniffing and execution', () => {
  const h = safeImageHeaders('image/webp', 'x.webp');
  assert.equal(h['Content-Type'], 'image/webp');
  assert.equal(h['X-Content-Type-Options'], 'nosniff');
  assert.match(h['Content-Disposition'], /inline/);
  assert.match(h['Cache-Control'], /immutable/);
});

test('WorkerPoolImageProcessor: size clamps, processes, and coalesces duplicate jobs', async () => {
  const single = new WorkerPoolImageProcessor(1);
  assert.equal(single.size, 1);
  await single.destroy();

  const pool = new WorkerPoolImageProcessor(2);
  try {
    const buf = await png(300, 200);
    const req = { buffer: buf, format: 'png', width: 320, animated: false };

    const [a, b] = await Promise.all([pool.process(req, 'k'), pool.process(req, 'k')]);
    assert.equal(pool.dispatchedCount, 1, 'duplicate concurrent jobs coalesced into one dispatch');
    const md = await sharp(a.buffer).metadata();
    assert.equal(md.format, 'webp');
    assert.deepEqual(a.buffer, b.buffer);

    await pool.process({ buffer: buf, format: 'png', width: 640, animated: false }, 'k2');
    assert.equal(pool.dispatchedCount, 2, 'a distinct variant dispatches a new job');
  } finally {
    await pool.destroy();
  }
});
