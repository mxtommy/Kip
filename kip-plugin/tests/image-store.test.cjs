const test = require('node:test');
const assert = require('node:assert/strict');
const { rmSync, existsSync } = require('node:fs');
const { resolve, join } = require('node:path');
const { randomUUID } = require('node:crypto');
const sharp = require('sharp');

const {
  ImageStore,
  detectImageType,
  sanitizeSvg,
  ImageValidationError,
  MAX_UPLOAD_BYTES
} = require('../../plugin/images/image-store.js');

const TMP_ROOT = resolve('.tmp-kip-image-test');

function freshStore() {
  const dir = join(TMP_ROOT, randomUUID());
  return { store: new ImageStore(dir), dir };
}

const png = (w = 8, h = 6) => sharp({ create: { width: w, height: h, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } } }).png().toBuffer();
const jpeg = () => sharp({ create: { width: 8, height: 6, channels: 3, background: { r: 1, g: 2, b: 3 } } }).jpeg().toBuffer();
const webp = () => sharp({ create: { width: 8, height: 6, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } }).webp().toBuffer();
const gif = () => sharp({ create: { width: 8, height: 6, channels: 4, background: { r: 1, g: 2, b: 3, alpha: 1 } } }).gif().toBuffer();

test.after(() => rmSync(TMP_ROOT, { recursive: true, force: true }));

test('detectImageType recognizes real formats by content and rejects non-images', async () => {
  assert.equal(detectImageType(await png()), 'png');
  assert.equal(detectImageType(await jpeg()), 'jpeg');
  assert.equal(detectImageType(await webp()), 'webp');
  assert.equal(detectImageType(await gif()), 'gif');
  assert.equal(detectImageType(Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>')), 'svg');
  assert.equal(detectImageType(Buffer.from('this is not an image, just text')), null);
  // A text file renamed .png is still rejected (content sniff, not extension).
  assert.equal(detectImageType(Buffer.from('PNG? no. plain text payload')), null);
});

test('sanitizeSvg strips scripts and event handlers but keeps drawing', () => {
  const dirty = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script><rect width="10" height="10" onload="alert(2)" fill="red"/></svg>';
  const clean = sanitizeSvg(dirty);
  assert.ok(!/script/i.test(clean), 'script element removed');
  assert.ok(!/onload/i.test(clean), 'event handler removed');
  assert.ok(/<rect/i.test(clean), 'drawing element preserved');
});

test('sanitizeSvg strips external resource refs (modern href + xlink:href) but keeps internal fragment refs', () => {
  const dirty = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="10" height="10">'
    + '<image href="https://evil.example/beacon.png" x="0" y="0" width="10" height="10"/>'
    + '<image xlink:href="https://evil.example/legacy.png" x="0" y="0" width="10" height="10"/>'
    + '<a href="https://evil.example/link"><rect width="1" height="1"/></a>'
    + '<radialGradient id="g"><stop offset="0" stop-color="red"/></radialGradient>'
    + '<rect width="10" height="10" fill="url(#g)"/>'
    + '</svg>';
  const clean = sanitizeSvg(dirty);
  assert.ok(!/evil\.example/i.test(clean), 'external href/xlink:href beacon removed');
  assert.ok(/url\(#g\)/i.test(clean), 'internal fragment reference preserved');
  assert.ok(/<rect/i.test(clean), 'drawing element preserved');
});

test('ingest stores a raster original plus sidecar metadata', async () => {
  const { store, dir } = freshStore();
  const meta = await store.ingest(await png(12, 9), 'my map.png', 'user-1');
  assert.equal(meta.format, 'png');
  assert.equal(meta.width, 12);
  assert.equal(meta.height, 9);
  assert.equal(meta.animated, false);
  assert.equal(meta.uploadedBy, 'user-1');
  assert.match(meta.id, /^[A-Za-z0-9-]+$/);
  assert.ok(existsSync(join(dir, 'originals', `${meta.id}.png`)), 'original stored');
  assert.ok(existsSync(join(dir, 'originals', `${meta.id}.json`)), 'sidecar stored');
});

test('ingest stores a GIF (animation handling covered in the processing layer)', async () => {
  const { store } = freshStore();
  const meta = await store.ingest(await gif(), 'spin.gif');
  assert.equal(meta.format, 'gif');
  assert.equal(meta.animated, false);
});

test('ingest sanitizes SVG and stores it as vector', async () => {
  const { store, dir } = freshStore();
  const dirty = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><script>fetch("/evil")</script><circle cx="10" cy="10" r="5"/></svg>';
  const meta = await store.ingest(Buffer.from(dirty), 'logo.svg');
  assert.equal(meta.format, 'svg');
  const fs = require('node:fs');
  const stored = fs.readFileSync(join(dir, 'originals', `${meta.id}.svg`), 'utf8');
  assert.ok(!/script/i.test(stored), 'stored svg has no script');
  assert.ok(/<circle/i.test(stored), 'stored svg keeps drawing');
});

test('ingest rejects a non-image disguised as an upload', async () => {
  const { store } = freshStore();
  await assert.rejects(() => store.ingest(Buffer.from('totally not an image'), 'evil.png'), ImageValidationError);
});

test('ingest rejects an SVG that is empty after sanitization', async () => {
  const { store } = freshStore();
  // No <svg> root once the script-only content is stripped is treated as unsafe/empty.
  await assert.rejects(() => store.ingest(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>'.replace('<svg xmlns="http://www.w3.org/2000/svg">', '')), 'x.svg'), ImageValidationError);
});

test('ingest enforces the 10MB limit', async () => {
  const { store } = freshStore();
  const tooBig = Buffer.alloc(MAX_UPLOAD_BYTES + 1, 0);
  await assert.rejects(() => store.ingest(tooBig, 'big.png'), ImageValidationError);
});

test('list returns stored images and remove deletes them', async () => {
  const { store, dir } = freshStore();
  const a = await store.ingest(await png(), 'a.png');
  const b = await store.ingest(await jpeg(), 'b.jpg');
  let list = await store.list();
  assert.deepEqual(list.map(m => m.id).sort(), [a.id, b.id].sort());

  assert.equal(await store.remove(a.id), true);
  list = await store.list();
  assert.deepEqual(list.map(m => m.id), [b.id]);
  assert.ok(!existsSync(join(dir, 'originals', `${a.id}.png`)), 'original removed');
  assert.ok(!existsSync(join(dir, 'originals', `${a.id}.json`)), 'sidecar removed');
});

test('remove and getMeta reject malformed ids (no path traversal)', async () => {
  const { store } = freshStore();
  assert.equal(await store.remove('../../etc/passwd'), false);
  assert.equal(await store.getMeta('..'), null);
});

test('rejects a brand-spoofed AVIF detected as HEIC (no un-serveable poison asset) (#sec)', async () => {
  const { store } = freshStore();
  const avif = await sharp({ create: { width: 80, height: 60, channels: 3, background: { r: 1, g: 2, b: 3 } } })
    .heif({ compression: 'av1', quality: 50 }).toBuffer();
  avif.write('heic', 8, 'ascii'); // spoof the ftyp major brand to look like HEVC HEIC
  // Transcode-at-ingest proves decodability: heic-convert can't decode AV1 -> rejected, not stored broken.
  await assert.rejects(() => store.ingest(avif, 'evil.heic'), ImageValidationError);
  assert.deepEqual(await store.list(), []);
});

test('enforces the library image-count quota (#sec)', async () => {
  const store = new ImageStore(join(TMP_ROOT, randomUUID()), undefined, { maxImageCount: 2 });
  await store.ingest(await png(), 'a.png');
  await store.ingest(await png(), 'b.png');
  const c = await png();
  await assert.rejects(() => store.ingest(c, 'c.png'), /full/i);
});

test('enforces the library total-bytes quota (#sec)', async () => {
  const store = new ImageStore(join(TMP_ROOT, randomUUID()), undefined, { maxTotalBytes: 50 });
  const big = await png(200, 200);
  await assert.rejects(() => store.ingest(big, 'big.png'), /storage limit/i);
});
