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

interface ActiveDispatch {
  job: PendingJob;
  timer: NodeJS.Timeout;
}

interface WorkerReply {
  id: number;
  ok: boolean;
  buffer?: ArrayBuffer;
  width?: number;
  height?: number;
  error?: string;
}

const DEFAULT_JOB_TIMEOUT_MS = 30_000;

/**
 * Runs image-processing jobs across a pool of worker threads so the Signal K server's main thread
 * stays responsive. Pool size defaults to n-1 CPUs (clamped to 1). Concurrent requests for the same
 * variant are coalesced (one job, shared result).
 *
 * Resilience (hardened after security review): a worker that dies — native crash, OOM, or hard
 * exit — is detected via BOTH 'error' and 'exit', its in-flight job is rejected, and a replacement
 * worker is spawned so the pool never silently shrinks to zero and wedges all image serving. A
 * per-job timeout rejects (and replaces) a worker that hangs, so an HTTP request can never block
 * forever on a stuck decode.
 */
export class WorkerPoolImageProcessor implements ImageProcessor {
  private readonly workers: Worker[] = [];
  private readonly idle: Worker[] = [];
  private readonly jobsByWorker = new Map<Worker, ActiveDispatch>();
  private readonly dead = new WeakSet<Worker>();
  private readonly queue: PendingJob[] = [];
  private readonly inflight = new Map<string, Promise<ProcessResult>>();
  private readonly targetSize: number;
  private readonly jobTimeoutMs: number;
  private readonly workerScript: string;
  private nextId = 1;
  private dispatched = 0;
  private destroyed = false;

  constructor(
    size: number = computeWorkerCount(os.cpus().length),
    workerScript: string = path.join(__dirname, 'image-worker.js'),
    jobTimeoutMs: number = DEFAULT_JOB_TIMEOUT_MS
  ) {
    this.targetSize = Math.max(1, size);
    this.workerScript = workerScript;
    this.jobTimeoutMs = jobTimeoutMs;
    for (let i = 0; i < this.targetSize; i++) {
      this.spawnWorker();
    }
  }

  get size(): number { return this.workers.length; }
  /** Number of jobs actually dispatched to a worker (coalesced duplicates do not increment this). */
  get dispatchedCount(): number { return this.dispatched; }

  process(req: ProcessRequest, coalesceKey?: string): Promise<ProcessResult> {
    if (this.destroyed) return Promise.reject(new Error('Image processor has been shut down'));
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

  private spawnWorker(): void {
    if (this.destroyed) return;
    const worker = new Worker(this.workerScript);
    worker.on('message', (msg: WorkerReply) => this.onMessage(worker, msg));
    worker.on('error', (err: Error) => this.failWorker(worker, err));
    worker.on('exit', (code: number) => {
      // A clean idle exit shouldn't happen; any unexpected death (code!=0 or while holding a job) is
      // treated as a crash so the pool self-heals. 'error' may also have fired — `dead` dedupes.
      if (this.destroyed) return;
      if (code !== 0 || this.jobsByWorker.has(worker)) {
        this.failWorker(worker, new Error(`Image worker exited unexpectedly (code ${code})`));
      }
    });
    this.workers.push(worker);
    this.idle.push(worker);
  }

  private removeWorker(worker: Worker): void {
    const wi = this.workers.indexOf(worker);
    if (wi >= 0) this.workers.splice(wi, 1);
    const ii = this.idle.indexOf(worker);
    if (ii >= 0) this.idle.splice(ii, 1);
  }

  /** A worker is dead or wedged: reject its job, drop it, and spawn a replacement. Idempotent. */
  private failWorker(worker: Worker, error: Error): void {
    if (this.dead.has(worker)) return;
    this.dead.add(worker);
    const active = this.jobsByWorker.get(worker);
    if (active) {
      clearTimeout(active.timer);
      this.jobsByWorker.delete(worker);
      active.job.reject(error);
    }
    this.removeWorker(worker);
    void worker.terminate().catch(() => undefined);
    if (!this.destroyed) {
      this.spawnWorker();
      this.pump();
    }
  }

  private pump(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      this.dispatched++;
      const timer = setTimeout(() => {
        this.failWorker(worker, new Error('Image processing timed out'));
      }, this.jobTimeoutMs);
      if (typeof timer.unref === 'function') timer.unref();
      this.jobsByWorker.set(worker, { job, timer });
      const buf = job.req.buffer;
      const transfer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
      worker.postMessage(
        { id: job.id, buffer: transfer, format: job.req.format, width: job.req.width, animated: job.req.animated },
        [transfer]
      );
    }
  }

  private onMessage(worker: Worker, msg: WorkerReply): void {
    const active = this.jobsByWorker.get(worker);
    this.jobsByWorker.delete(worker);
    if (active) clearTimeout(active.timer);
    if (!this.dead.has(worker)) this.idle.push(worker);
    if (active) {
      if (msg.ok && msg.buffer) {
        active.job.resolve({ buffer: Buffer.from(msg.buffer), width: msg.width ?? 0, height: msg.height ?? 0 });
      } else {
        active.job.reject(new Error(msg.error ?? 'Image processing failed'));
      }
    }
    this.pump();
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    for (const { timer } of this.jobsByWorker.values()) clearTimeout(timer);
    await Promise.all(this.workers.map((w) => w.terminate().catch(() => undefined)));
  }
}
