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

// ---------------------------------------------------------------------------
// Page geometry, stamping, reordering, text, encryption & image optimisation.
// Every wrapper below TRANSFERS the input buffer to the worker — pass a fresh
// copy (`bytes.slice()`) if you need the bytes again afterwards.
// ---------------------------------------------------------------------------

/** Visible page geometry in PDF points, with the page's /Rotate already applied. */
export interface PdfPageInfo {
  /** 1-based page number. */
  page: number;
  /** Visible width/height (CropBox, or MediaBox) after rotation, in points. */
  width: number;
  height: number;
  /** Effective /Rotate (0, 90, 180, 270), inherited attributes resolved. */
  rotate: number;
}

export async function pageInfo(bytes: Uint8Array): Promise<PdfPageInfo[]> {
  const json = await runWasm<string>(CRATE, 'page_info', [bytes], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
  return JSON.parse(json) as PdfPageInfo[];
}

export type PdfStandardFont =
  | 'Helvetica'
  | 'Helvetica-Bold'
  | 'Times-Roman'
  | 'Times-Bold'
  | 'Courier'
  | 'Courier-Bold';

/** One piece of text drawn on one page. */
export interface PdfTextStamp {
  /** 1-based page number. */
  page: number;
  /** WinAnsi (Latin-1-ish) text; unsupported characters are replaced with "?". */
  text: string;
  /**
   * Anchor position in the page's VISIBLE coordinate space (rotation already
   * applied, origin = bottom-left of the visible box, units = points).
   * `y` is the text baseline.
   */
  x: number;
  y: number;
  /** Horizontal alignment of the text relative to `x`. */
  anchor: 'left' | 'center' | 'right';
  font: PdfStandardFont;
  /** Font size in points. */
  size: number;
  /** RGB, each 0..1. */
  color: [number, number, number];
  /** 0..1 fill opacity. */
  opacity: number;
  /** Counter-clockwise rotation in degrees around (x, y). */
  rotation: number;
  /** Draw above existing page content ("over") or beneath it ("under"). */
  layer: 'over' | 'under';
}

/** Draw text stamps (page numbers, headers/footers, watermarks) onto pages. */
export function stampText(bytes: Uint8Array, stamps: PdfTextStamp[]): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'stamp_text', [bytes, JSON.stringify({ items: stamps })], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}

/**
 * Rebuild the page list in a new order. `order` is a comma-separated list of
 * 1-based page numbers, e.g. "3,1,2". Duplicates are allowed (the page is
 * copied); pages not listed are dropped.
 */
export function reorderPages(bytes: Uint8Array, order: string): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'reorder_pages', [bytes, order], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}

export interface PdfPageText {
  page: number;
  text: string;
}

/** Extract the text layer. `spec` is a page selection like "1,3-5"; empty = all pages. */
export async function extractText(bytes: Uint8Array, spec = ''): Promise<PdfPageText[]> {
  const json = await runWasm<string>(CRATE, 'extract_text', [bytes, spec], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
  return JSON.parse(json) as PdfPageText[];
}

/** True when the file has an /Encrypt dictionary (password or permissions protected). */
export function isEncrypted(bytes: Uint8Array): Promise<boolean> {
  return runWasm<boolean>(CRATE, 'is_encrypted', [bytes], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}

/** Standard-security-handler permission flags (OR together the ones to ALLOW). */
export const PDF_PERMISSION = {
  print: 4,
  modify: 8,
  copy: 16,
  annotate: 32,
  fillForms: 256,
  accessibility: 512,
  assemble: 1024,
  printHighQuality: 2048,
} as const;

/**
 * Encrypt with the standard security handler. `aes256` selects AES-256 (PDF 2.0,
 * R6); otherwise AES-128 (R4). `permissions` = OR of PDF_PERMISSION values to allow.
 * An empty user password means "opens without a password, restrictions apply".
 */
export function encryptPdf(
  bytes: Uint8Array,
  userPassword: string,
  ownerPassword: string,
  permissions: number,
  aes256: boolean,
): Promise<Uint8Array> {
  return runWasm<Uint8Array>(
    CRATE,
    'encrypt_pdf',
    [bytes, userPassword, ownerPassword, permissions, aes256],
    { transfer: [bytes.buffer as ArrayBuffer] },
  );
}

/** Remove encryption given the user or owner password (empty string for owner-only restrictions). */
export function decryptPdf(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'decrypt_pdf', [bytes, password], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}

export interface PdfImageInfo {
  /** Indirect object number of the image XObject (generation assumed 0). */
  id: number;
  /** First page (1-based) the image appears on, or 0 if unreferenced. */
  page: number;
  width: number;
  height: number;
  /** Last filter in the stream's /Filter chain, e.g. "DCTDecode", "FlateDecode", "" if none. */
  filter: string;
  /** "DeviceRGB", "DeviceGray", "DeviceCMYK", "ICCBased", "Indexed", … */
  colorSpace: string;
  /** Number of colour components implied by the colour space (1, 3, 4) or 0 if unknown. */
  components: number;
  bitsPerComponent: number;
  /** Encoded stream length in bytes. */
  length: number;
  hasSMask: boolean;
  isMask: boolean;
  /** True when /DecodeParms has a /Predictor > 1. */
  hasPredictor: boolean;
}

export async function listImages(bytes: Uint8Array): Promise<PdfImageInfo[]> {
  const json = await runWasm<string>(CRATE, 'list_images', [bytes], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
  return JSON.parse(json) as PdfImageInfo[];
}

/**
 * Raw image stream bytes. DCTDecode → a complete JPEG file. FlateDecode →
 * the zlib-compressed sample data (inflate it yourself; mind predictors).
 */
export function getImageStream(bytes: Uint8Array, id: number): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'get_image_stream', [bytes, id], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}

/** A JPEG that replaces image object `id` (sets DCTDecode, size, colour space; drops DecodeParms). */
export interface PdfImageReplacement {
  id: number;
  jpeg: Uint8Array;
  width: number;
  height: number;
  /** true → DeviceGray, false → DeviceRGB. */
  gray: boolean;
}

export function replaceImages(
  bytes: Uint8Array,
  replacements: PdfImageReplacement[],
): Promise<Uint8Array> {
  const meta = JSON.stringify(
    replacements.map((r) => ({ id: r.id, width: r.width, height: r.height, gray: r.gray })),
  );
  // Second arg: JSON metadata; third: js_sys::Array of JPEG Uint8Arrays (same order).
  return runWasm<Uint8Array>(
    CRATE,
    'replace_images',
    [bytes, meta, replacements.map((r) => r.jpeg)],
    { transfer: [bytes.buffer as ArrayBuffer] },
  );
}

/**
 * Lossless structural clean-up: drop unreferenced objects and empty streams,
 * Flate-compress uncompressed streams, optionally strip XMP metadata,
 * thumbnails and the Info dictionary.
 */
export function optimizePdf(bytes: Uint8Array, stripMetadata: boolean): Promise<Uint8Array> {
  return runWasm<Uint8Array>(CRATE, 'optimize_pdf', [bytes, stripMetadata], {
    transfer: [bytes.buffer as ArrayBuffer],
  });
}
