/// <reference lib="webworker" />
/**
 * Generic WASM worker. Loads any crate from /wasm/<crate>/<crate>.js at runtime
 * (bundler-ignored so it works under Next static export + Turbopack), caches the
 * instantiated module, and dispatches function calls by name.
 */
import type {
  WorkerRequest,
  WasmRunRequest,
  WorkerResponse,
} from './protocol';

// Each crate's wasm-pack (--target web) module: a default init() + named exports.
type WasmModule = {
  default: (init?: unknown) => Promise<unknown>;
  [fn: string]: unknown;
};

const moduleCache = new Map<string, Promise<WasmModule>>();

function post(msg: WorkerResponse, transfer?: Transferable[]) {
  (self as DedicatedWorkerGlobalScope).postMessage(
    msg,
    transfer ? { transfer } : {}
  );
}

function loadCrate(crate: string): Promise<WasmModule> {
  let mod = moduleCache.get(crate);
  if (!mod) {
    mod = (async () => {
      // Native runtime import of a static asset — NOT bundled. The wasm-pack
      // glue fetches <crate>_bg.wasm relative to its own URL.
      const url = `/wasm/${crate}/${crate}.js`;
      const m = (await import(
        /* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ url
      )) as WasmModule;
      await m.default();
      return m;
    })();
    moduleCache.set(crate, mod);
  }
  return mod;
}

/** Collect Transferable ArrayBuffers from a result for zero-copy postMessage. */
function transferables(value: unknown): Transferable[] {
  if (value instanceof ArrayBuffer) return [value];
  if (ArrayBuffer.isView(value)) return [value.buffer as ArrayBuffer];
  return [];
}

async function handleRun(req: WasmRunRequest) {
  try {
    const mod = await loadCrate(req.crate);
    const fn = mod[req.fn];
    if (typeof fn !== 'function') {
      throw new Error(`wasm export "${req.fn}" not found in crate "${req.crate}"`);
    }
    const args = [...req.args];
    if (req.withProgress) {
      args.push((ratio: number | null, stage?: string) =>
        post({ type: 'progress', id: req.id, ratio, stage })
      );
    }
    const result = await (fn as (...a: unknown[]) => unknown)(...args);
    post({ type: 'result', id: req.id, ok: true, result }, transferables(result));
  } catch (err) {
    post({
      type: 'result',
      id: req.id,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

self.addEventListener('message', (ev: MessageEvent<WorkerRequest>) => {
  const msg = ev.data;
  if (msg.type === 'run') {
    void handleRun(msg);
  }
  // 'cancel' is best-effort: wasm calls are synchronous within the worker, so
  // cancellation primarily prevents queued work in the pool (handled there).
});

post({ type: 'ready' });
