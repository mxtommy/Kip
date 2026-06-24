import { parentPort } from 'node:worker_threads';
import sharp from 'sharp';
import { processImage } from './image-processing';
import type { ImageFormat } from './image-store';

// Each worker uses a single libvips thread so total CPU use stays ~= pool size.
sharp.concurrency(1);

interface WorkerJob {
  id: number;
  buffer: ArrayBuffer;
  format: ImageFormat;
  width: number;
  animated: boolean;
}

if (parentPort) {
  parentPort.on('message', (msg: WorkerJob) => {
    void (async () => {
      try {
        const result = await processImage({
          buffer: Buffer.from(msg.buffer),
          format: msg.format,
          width: msg.width,
          animated: msg.animated
        });
        const out = result.buffer.buffer.slice(
          result.buffer.byteOffset,
          result.buffer.byteOffset + result.buffer.byteLength
        ) as ArrayBuffer;
        parentPort!.postMessage({ id: msg.id, ok: true, buffer: out, width: result.width, height: result.height }, [out]);
      } catch (e) {
        parentPort!.postMessage({ id: msg.id, ok: false, error: (e as Error).message });
      }
    })();
  });
}
