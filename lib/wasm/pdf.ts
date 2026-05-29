/**
 * Typed wrapper around the `pdf` wasm crate (lopdf), run in the worker pool.
 * PDF bytes cross as Uint8Array; page selections are 1-based "1,3,5-8" strings.
 */
import { runWasm } from '@/lib/worker/client';

const CRATE = 'pdf';

export function version(): Promise<string> {
  return runWasm<string>(CRATE, 'version', []);
}

export function pageCount(bytes: Uint8Array): Promise<number> {
  return runWasm<number>(CRATE, 'page_count', [bytes], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}

/** Merge an ordered list of PDFs into one (single worker call, correct for any N). */
export function mergePdfs(docs: Uint8Array[]): Promise<Uint8Array> {
  if (docs.length === 0) throw new Error('No PDFs to merge');
  // Pass the whole list as one arg; the wasm fn takes a js_sys::Array of Uint8Array.
  return runWasm<Uint8Array>(CRATE, 'merge_all', [docs]);
}

export function extractPages(bytes: Uint8Array, spec: string): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'extract_pages', [bytes, spec], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}

export function deletePages(bytes: Uint8Array, spec: string): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'delete_pages', [bytes, spec], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}

export function rotatePages(bytes: Uint8Array, spec: string, degrees: number): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'rotate_pages', [bytes, spec, degrees], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}

export function readMetadata(bytes: Uint8Array): Promise<string> {
  return runWasm<string>(CRATE, 'read_metadata', [bytes], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}
