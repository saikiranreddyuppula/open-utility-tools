/* tslint:disable */
/* eslint-disable */

/**
 * Delete the pages selected by `spec`; return new PDF.
 */
export function delete_pages(bytes: Uint8Array, spec: string): Uint8Array;

/**
 * Keep only the pages selected by `spec` (1-based "1,3,5-8"); return new PDF.
 */
export function extract_pages(bytes: Uint8Array, spec: string): Uint8Array;

/**
 * Merge an array of PDFs (each a Uint8Array) into one, preserving page order.
 * Uses the canonical lopdf recipe: renumber every doc into one object space,
 * collect all Page objects, then build a fresh Pages tree + Catalog. Correct for
 * any N (the previous incremental-append approach lost pages for N > 2).
 */
export function merge_all(docs: Array<any>): Uint8Array;

/**
 * Number of pages in a PDF.
 */
export function page_count(bytes: Uint8Array): number;

/**
 * Read document info dictionary as "Key: Value" lines.
 */
export function read_metadata(bytes: Uint8Array): string;

/**
 * Rotate selected pages by `degrees` (90/180/270, multiples of 90). spec "" = all.
 */
export function rotate_pages(bytes: Uint8Array, spec: string, degrees: number): Uint8Array;

export function start(): void;

export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly delete_pages: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly extract_pages: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly merge_all: (a: number, b: number) => void;
    readonly page_count: (a: number, b: number, c: number) => void;
    readonly read_metadata: (a: number, b: number, c: number) => void;
    readonly rotate_pages: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly start: () => void;
    readonly version: (a: number) => void;
    readonly __wbindgen_export: (a: number, b: number, c: number) => void;
    readonly __wbindgen_export2: (a: number) => void;
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
