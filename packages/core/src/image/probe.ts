import { loadImaging } from './_wasm';

/** Decoded dimensions and format of a raster image. */
export interface ImageInfo {
  width: number;
  height: number;
  /** Upper-cased container format, e.g. `PNG`, `JPEG`, `WEBP`, `GIF`. */
  format: string;
}

/**
 * Inspects raster image bytes and returns its dimensions and format, decoding
 * the header only. Runs identically in the browser, Node, and Bun (WASM-backed).
 *
 * @param bytes - The encoded image (PNG, JPEG, WebP, GIF, BMP, TIFF, ICO).
 * @returns The image's width, height, and format.
 * @throws If the bytes are not a recognized image format.
 *
 * @example
 * ```ts
 * import { probe } from '@open-utility-tools/core/image/probe';
 * const info = await probe(new Uint8Array(await file.arrayBuffer()));
 * // → { width: 1200, height: 630, format: 'PNG' }
 * ```
 */
export async function probe(bytes: Uint8Array): Promise<ImageInfo> {
  const wasm = await loadImaging();
  const raw = wasm.probe(bytes); // "1200x630 PNG"
  const match = /^(\d+)x(\d+)\s+(\S+)$/.exec(raw);
  if (!match) throw new Error(`Unexpected probe result: ${raw}`);
  return { width: Number(match[1]), height: Number(match[2]), format: match[3]! };
}
