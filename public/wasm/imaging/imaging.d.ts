/* tslint:disable */
/* eslint-disable */

/**
 * Options struct passed from JS as plain args (kept primitive for a stable ABI).
 */
export function convert(bytes: Uint8Array, target_format: string, quality: number, max_width: number, max_height: number, filter: string, background: string, on_progress: Function): Uint8Array;

/**
 * Build a multi-resolution .ico (16/32/48/256) from one source image — the
 * favicon use case. Returns ICO bytes.
 */
export function make_multi_ico(bytes: Uint8Array, sizes_csv: string): Uint8Array;

/**
 * Probe an image's dimensions + detected format without fully decoding pixels.
 * Returns "WIDTHxHEIGHT FORMAT" or throws.
 */
export function probe(bytes: Uint8Array): string;

export function start(): void;

export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly convert: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number, k: number, l: number, m: number) => void;
    readonly make_multi_ico: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly probe: (a: number, b: number, c: number) => void;
    readonly start: () => void;
    readonly version: (a: number) => void;
    readonly __wbindgen_export: (a: number) => void;
    readonly __wbindgen_export2: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export3: (a: number, b: number) => number;
    readonly __wbindgen_export4: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_add_to_stack_pointer: (a: number) => number;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
