import { Worker } from 'node:worker_threads';
import * as os from 'node:os';
import * as path from 'node:path';
import { computeWorkerCount, type ImageProcessor, type ProcessRequest, type ProcessResult } from './image-processing';

interface PendingJob {
  req: ProcessRequest;
  resolve: (r: ProcessResult) => void;
  reject: (e: Error) => void;
  id: number;
}

interface WorkerReply {
  id: number;
  ok: boolean;
  buffer?: ArrayBuffer;
  width?: number;
  height?: number;
  error?: string;
}

/**
 * Runs image-processing jobs across a pool of worker threads so the Signal K server's main thread
 * stays responsive. Pool size defaults to n-1 CPUs (clamped to 1). Concurrent requests for the same
 * variant are coalesced (one job, shared result).
 */
export class WorkerPoolImageProcessor implements ImageProcessor {
  private readonly workers: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly queue: PendingJob[] = [];
  private readonly jobsByWorker = new Map<Worker, PendingJob>();
  private readonly inflight = new Map<string, Promise<ProcessResult>>();
  private nextId = 1;
  private dispatched = 0;

  constructor(
    size: number = computeWorkerCount(os.cpus().length),
    workerScript: string = path.join(__dirname, 'image-worker.js')
  ) {
    const count = Math.max(1, size);
    for (let i = 0; i < count; i++) {
      const w = new Worker(workerScript);
      w.on('message', (msg: WorkerReply) => this.onMessage(w, msg));
      w.on('error', (err: Error) => this.onError(w, err));
      this.workers.push(w);
      this.idle.push(w);
    }
  }

  get size(): number { return this.workers.length; }
  /** Number of jobs actually dispatched to a worker (coalesced duplicates do not increment this). */
  get dispatchedCount(): number { return this.dispatched; }

  process(req: ProcessRequest, coalesceKey?: string): Promise<ProcessResult> {
    if (coalesceKey && this.inflight.has(coalesceKey)) {
      return this.inflight.get(coalesceKey)!;
    }
    const promise = new Promise<ProcessResult>((resolve, reject) => {
      this.queue.push({ req, resolve, reject, id: this.nextId++ });
      this.pump();
    });
    if (coalesceKey) {
      this.inflight.set(coalesceKey, promise);
      const clear = (): void => { this.inflight.delete(coalesceKey); };
      promise.then(clear, clear);
    }
    return promise;
  }

  private pump(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.jobsByWorker.set(worker, job);
      this.dispatched++;
      const buf = job.req.buffer;
      const transfer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      worker.postMessage(
        { id: job.id, buffer: transfer, format: job.req.format, width: job.req.width, animated: job.req.animated },
        [transfer]
      );
    }
  }

  private onMessage(worker: Worker, msg: WorkerReply): void {
    const job = this.jobsByWorker.get(worker);
    this.jobsByWorker.delete(worker);
    this.idle.push(worker);
    if (job) {
      if (msg.ok && msg.buffer) {
        job.resolve({ buffer: Buffer.from(msg.buffer), width: msg.width ?? 0, height: msg.height ?? 0 });
      } else {
        job.reject(new Error(msg.error ?? 'Image processing failed'));
      }
    }
    this.pump();
  }

  private onError(worker: Worker, err: Error): void {
    const job = this.jobsByWorker.get(worker);
    this.jobsByWorker.delete(worker);
    if (job) job.reject(err);
    this.pump();
  }

  async destroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.terminate()));
  }
}
