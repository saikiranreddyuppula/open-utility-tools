/**
 * Typed wrapper around the `imaging` wasm crate (decode/resize/convert), run in
 * the worker pool off the UI thread with progress reporting.
 */
import { runWasm, type RunOptions } from '@/lib/worker/client';

const CRATE = 'imaging';

export type RasterFormat = 'png' | 'jpeg' | 'webp' | 'gif' | 'bmp' | 'tiff' | 'ico';

export interface ConvertOptions {
  format: RasterFormat;
  quality?: number; // 1..100 (jpeg)
  maxWidth?: number; // 0 = keep
  maxHeight?: number; // 0 = keep
  filter?: 'nearest' | 'triangle' | 'catmullrom' | 'gaussian' | 'lanczos3';
  background?: string; // hex, for alpha→opaque (jpeg)
}

export const FORMAT_INFO: Record<
  RasterFormat,
  { label: string; mime: string; ext: string; lossy: boolean; alpha: boolean }
> = {
  png: { label: 'PNG', mime: 'image/png', ext: 'png', lossy: false, alpha: true },
  jpeg: { label: 'JPEG', mime: 'image/jpeg', ext: 'jpg', lossy: true, alpha: false },
  webp: { label: 'WebP', mime: 'image/webp', ext: 'webp', lossy: false, alpha: true },
  gif: { label: 'GIF', mime: 'image/gif', ext: 'gif', lossy: false, alpha: true },
  bmp: { label: 'BMP', mime: 'image/bmp', ext: 'bmp', lossy: false, alpha: false },
  tiff: { label: 'TIFF', mime: 'image/tiff', ext: 'tiff', lossy: false, alpha: true },
  ico: { label: 'ICO', mime: 'image/x-icon', ext: 'ico', lossy: false, alpha: true },
};

export function version(): Promise<string> {
  return runWasm<string>(CRATE, 'version', []);
}

/** Returns "WIDTHxHEIGHT FORMAT". */
export function probe(bytes: Uint8Array): Promise<string> {
  return runWasm<string>(CRATE, 'probe', [bytes], { transfer: [bytes.buffer as ArrayBuffer] });
}

export function convert(
  bytes: Uint8Array,
  opts: ConvertOptions,
  run?: RunOptions
): Promise<Uint8Array> {
  const args = [
    bytes,
    opts.format,
    opts.quality ?? 85,
    opts.maxWidth ?? 0,
    opts.maxHeight ?? 0,
    opts.filter ?? 'lanczos3',
    opts.background ?? '#ffffff',
  ];
  return runWasm<Uint8Array>(CRATE, 'convert', args, {
    withProgress: true,
    transfer: [bytes.buffer as ArrayBuffer],
    ...run,
  });
}

/** Multi-resolution .ico (e.g. "16,32,48,256"). */
export function makeMultiIco(bytes: Uint8Array, sizes = '16,32,48,256'): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'make_multi_ico', [bytes, sizes], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}
