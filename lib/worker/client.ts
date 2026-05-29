/**
 * Main-thread client for the generic WASM worker, plus a small worker pool.
 *
 * `runWasm(crate, fn, args, opts)` spins up (and reuses) a singleton pool, runs
 * the call off the UI thread, streams progress, and resolves with the result.
 * For batch workloads use `getPool()` directly to spread items across workers.
 */
import type {
  ProgressFn,
  WorkerRequest,
  WorkerResponse,
} from './protocol';

export interface RunOptions {
  signal?: AbortSignal;
  onProgress?: ProgressFn;
  /** ArrayBuffers/typed arrays to transfer (zero-copy) to the worker. */
  transfer?: Transferable[];
  /** Append a progress callback as the wasm fn's last arg. */
  withProgress?: boolean;
}

interface Pending {
  resolve: (v: unknown) => void;
  reject: (e: Error) => void;
  onProgress?: ProgressFn;
}

function createWorker(): Worker {
  // Bundled as a separate chunk by Turbopack/webpack via new URL(import.meta.url).
  return new Worker(new URL('./wasm.worker.ts', import.meta.url), {
    type: 'module',
  });
}

class WasmWorker {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, Pending>();
  busy = 0;

  constructor() {
    this.worker = createWorker();
    this.worker.addEventListener('message', this.onMessage);
  }

  private onMessage = (ev: MessageEvent<WorkerResponse>) => {
    const msg = ev.data;
    if (msg.type === 'ready') return;
    const p = this.pending.get(msg.id);
    if (!p) return;
    if (msg.type === 'progress') {
      p.onProgress?.(msg.ratio, msg.stage);
      return;
    }
    // result
    this.pending.delete(msg.id);
    this.busy--;
    if (msg.ok) p.resolve(msg.result);
    else p.reject(new Error(msg.error));
  };

  run<T>(
    crate: string,
    fn: string,
    args: unknown[],
    opts: RunOptions = {}
  ): Promise<T> {
    const id = ++this.seq;
    this.busy++;
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        onProgress: opts.onProgress,
      });

      if (opts.signal) {
        if (opts.signal.aborted) {
          this.pending.delete(id);
          this.busy--;
          reject(new DOMException('Aborted', 'AbortError'));
          return;
        }
        opts.signal.addEventListener(
          'abort',
          () => {
            const pend = this.pending.get(id);
            if (pend) {
              this.pending.delete(id);
              this.busy--;
              this.post({ type: 'cancel', id });
              pend.reject(new DOMException('Aborted', 'AbortError'));
            }
          },
          { once: true }
        );
      }

      const req: WorkerRequest = {
        type: 'run',
        id,
        crate,
        fn,
        args,
        withProgress: opts.withProgress,
      };
      this.post(req, opts.transfer);
    });
  }

  private post(msg: WorkerRequest, transfer?: Transferable[]) {
    this.worker.postMessage(msg, transfer ?? []);
  }

  terminate() {
    this.worker.terminate();
    this.pending.clear();
  }
}

export class WorkerPool {
  private workers: WasmWorker[] = [];
  private size: number;

  constructor(size?: number) {
    const hc =
      typeof navigator !== 'undefined' && navigator.hardwareConcurrency
        ? navigator.hardwareConcurrency
        : 4;
    this.size = Math.max(1, Math.min(size ?? hc, 16));
  }

  private pick(): WasmWorker {
    if (this.workers.length < this.size) {
      const w = new WasmWorker();
      this.workers.push(w);
      return w;
    }
    return this.workers.reduce((a, b) => (b.busy < a.busy ? b : a));
  }

  run<T>(
    crate: string,
    fn: string,
    args: unknown[],
    opts?: RunOptions
  ): Promise<T> {
    return this.pick().run<T>(crate, fn, args, opts);
  }

  terminate() {
    for (const w of this.workers) w.terminate();
    this.workers = [];
  }
}

let singleton: WorkerPool | null = null;

/** Shared pool for one-off calls and batch work. */
export function getPool(): WorkerPool {
  if (!singleton) singleton = new WorkerPool();
  return singleton;
}

/** Convenience: run a single wasm call on the shared pool. */
export function runWasm<T = unknown>(
  crate: string,
  fn: string,
  args: unknown[],
  opts?: RunOptions
): Promise<T> {
  return getPool().run<T>(crate, fn, args, opts);
}
