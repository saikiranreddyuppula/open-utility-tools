import { loadImaging } from './_wasm';

/** Target raster formats supported by {@link convert}. */
export type RasterFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'tiff' | 'ico';

/** Resampling filter used when {@link ConvertOptions.maxWidth}/`maxHeight` resize. */
export type ResizeFilter = 'nearest' | 'triangle' | 'catmullrom' | 'gaussian' | 'lanczos3';

export interface ConvertOptions {
  /** Output format. */
  format: RasterFormat;
  /** JPEG/WebP quality, 1–100. Default 85. */
  quality?: number;
  /** Max output width in px; 0 keeps the source width. Default 0. */
  maxWidth?: number;
  /** Max output height in px; 0 keeps the source height. Default 0. */
  maxHeight?: number;
  /** Resampling filter when resizing. Default `lanczos3`. */
  filter?: ResizeFilter;
  /** Hex background composited under alpha when the target has no alpha (e.g. JPEG). Default `#ffffff`. */
  background?: string;
}

/**
 * Decodes, optionally resizes, and re-encodes a raster image. Aspect ratio is
 * preserved when only one of `maxWidth`/`maxHeight` is set. Runs identically in
 * the browser, Node, and Bun (WASM-backed) and is deterministic across them.
 *
 * @param bytes - The source image bytes.
 * @param options - Output format and resize/quality options.
 * @returns The encoded output image bytes.
 * @throws If the source bytes are not a recognized image format.
 *
 * @example
 * ```ts
 * import { convert } from '@open-utility-tools/core/image/convert';
 * const webp = await convert(pngBytes, { format: 'webp', quality: 80, maxWidth: 400 });
 * ```
 */
export async function convert(bytes: Uint8Array, options: ConvertOptions): Promise<Uint8Array> {
  const wasm = await loadImaging();
  return wasm.convert(
    bytes,
    options.format,
    options.quality ?? 85,
    options.maxWidth ?? 0,
    options.maxHeight ?? 0,
    options.filter ?? 'lanczos3',
    options.background ?? '#ffffff',
    null,
  );
}
