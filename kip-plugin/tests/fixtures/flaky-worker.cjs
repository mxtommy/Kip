// Test fixture worker: behaves like the real image worker, but simulates failures on sentinel
// widths so the pool's crash/hang recovery can be exercised.
//   width 666 -> hard crash via process.exit (fires only 'exit', NOT 'error' — the OOM/native case)
//   width 777 -> hang: never reply (exercises the per-job timeout)
const { parentPort } = require('node:worker_threads');
const { processImage } = require('../../../plugin/images/image-processing.js');

parentPort.on('message', (msg) => {
  if (msg.width === 666) { process.exit(7); return; }
  if (msg.width === 777) { return; }
  (async () => {
    try {
      const r = await processImage({ buffer: Buffer.from(msg.buffer), format: msg.format, width: msg.width, animated: msg.animated });
      const out = r.buffer.buffer.slice(r.buffer.byteOffset, r.buffer.byteOffset + r.buffer.byteLength);
      parentPort.postMessage({ id: msg.id, ok: true, buffer: out, width: r.width, height: r.height }, [out]);
    } catch (e) {
      parentPort.postMessage({ id: msg.id, ok: false, error: e.message });
    }
  })();
});
