/**
 * Typed message protocol between the main thread and the generic WASM worker.
 *
 * The worker lazy-loads any crate under /wasm/<crate>/ on demand, calls an
 * exported function by name with the provided args, and streams progress back.
 * ArrayBuffers in `args`/`result` are transferred (zero-copy).
 */

export interface WasmRunRequest {
  type: 'run';
  /** Correlates request ↔ progress ↔ result. */
  id: number;
  /** Crate name = folder under public/wasm (e.g. "core", "imaging"). */
  crate: string;
  /** Exported wasm function name. */
  fn: string;
  /** Serializable args. Uint8Array/ArrayBuffer should be in `transfer`. */
  args: unknown[];
  /**
   * If true, the worker appends a progress callback as the final argument the
   * wasm function receives, forwarding calls as WasmProgress messages.
   */
  withProgress?: boolean;
}

export interface WasmCancelRequest {
  type: 'cancel';
  id: number;
}

export type WorkerRequest = WasmRunRequest | WasmCancelRequest;

export interface WasmReadyMessage {
  type: 'ready';
}

export interface WasmProgressMessage {
  type: 'progress';
  id: number;
  /** 0..1, or null for indeterminate. */
  ratio: number | null;
  stage?: string;
}

export interface WasmResultOk {
  type: 'result';
  id: number;
  ok: true;
  result: unknown;
}

export interface WasmResultErr {
  type: 'result';
  id: number;
  ok: false;
  error: string;
  code?: string;
}

export type WorkerResponse =
  | WasmReadyMessage
  | WasmProgressMessage
  | WasmResultOk
  | WasmResultErr;

export type ProgressFn = (ratio: number | null, stage?: string) => void;
