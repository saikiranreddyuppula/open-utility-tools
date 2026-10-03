/* tslint:disable */
/* eslint-disable */

/**
 * Remove encryption using the user or owner password.
 */
export function decrypt_pdf(bytes: Uint8Array, password: string): Uint8Array;

/**
 * Delete the pages selected by `spec`; return new PDF.
 */
export function delete_pages(bytes: Uint8Array, spec: string): Uint8Array;

/**
 * Encrypt with the standard security handler (AES-128 R4, or AES-256 R6).
 */
export function encrypt_pdf(bytes: Uint8Array, user_pw: string, owner_pw: string, permissions: number, aes256: boolean): Uint8Array;

/**
 * Keep only the pages selected by `spec` (1-based "1,3,5-8"); return new PDF.
 */
export function extract_pages(bytes: Uint8Array, spec: string): Uint8Array;

/**
 * JSON `[{page, text}]` for the selected pages (empty spec = all).
 */
export function extract_text(bytes: Uint8Array, spec: string): string;

/**
 * Raw (still encoded) stream bytes of object `(id, 0)`.
 */
export function get_image_stream(bytes: Uint8Array, id: number): Uint8Array;

/**
 * True when the file has an /Encrypt dictionary (even if it opens without a password).
 */
export function is_encrypted(bytes: Uint8Array): boolean;

/**
 * JSON array describing every image XObject.
 */
export function list_images(bytes: Uint8Array): string;

/**
 * Merge an array of PDFs (each a Uint8Array) into one, preserving page order.
 * Uses the canonical lopdf recipe: renumber every doc into one object space,
 * collect all Page objects, then build a fresh Pages tree + Catalog. Correct for
 * any N (the previous incremental-append approach lost pages for N > 2).
 */
export function merge_all(docs: Array<any>): Uint8Array;

/**
 * Lossless clean-up; optionally strip metadata, thumbnails and the Info dictionary.
 */
export function optimize_pdf(bytes: Uint8Array, strip_metadata: boolean): Uint8Array;

/**
 * Number of pages in a PDF.
 */
export function page_count(bytes: Uint8Array): number;

/**
 * JSON `[{page, width, height, rotate}]` — visible size with `/Rotate` applied.
 */
export function page_info(bytes: Uint8Array): string;

/**
 * Read document info dictionary as "Key: Value" lines.
 */
export function read_metadata(bytes: Uint8Array): string;

/**
 * Rebuild the page list in `order` ("3,1,2,2": 1-based, duplicates allowed).
 */
export function reorder_pages(bytes: Uint8Array, order: string): Uint8Array;

/**
 * Replace image streams with JPEGs. `meta_json` = `[{id,width,height,gray}]`,
 * `jpegs` = one Uint8Array per entry, same order.
 */
export function replace_images(bytes: Uint8Array, meta_json: string, jpegs: Array<any>): Uint8Array;

/**
 * Rotate selected pages by `degrees` (90/180/270, multiples of 90). spec "" = all.
 */
export function rotate_pages(bytes: Uint8Array, spec: string, degrees: number): Uint8Array;

/**
 * Draw text stamps; `spec_json` is `{"items":[PdfTextStamp…]}`.
 */
export function stamp_text(bytes: Uint8Array, spec_json: string): Uint8Array;

export function start(): void;

export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly decrypt_pdf: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly delete_pages: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly encrypt_pdf: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => void;
    readonly extract_pages: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly extract_text: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly get_image_stream: (a: number, b: number, c: number, d: number) => void;
    readonly is_encrypted: (a: number, b: number, c: number) => void;
    readonly list_images: (a: number, b: number, c: number) => void;
    readonly merge_all: (a: number, b: number) => void;
    readonly optimize_pdf: (a: number, b: number, c: number, d: number) => void;
    readonly page_count: (a: number, b: number, c: number) => void;
    readonly page_info: (a: number, b: number, c: number) => void;
    readonly read_metadata: (a: number, b: number, c: number) => void;
    readonly reorder_pages: (a: number, b: number, c: number, d: number, e: number) => void;
    readonly replace_images: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly rotate_pages: (a: number, b: number, c: number, d: number, e: number, f: number) => void;
    readonly stamp_text: (a: number, b: number, c: number, d: number, e: number) => void;
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
