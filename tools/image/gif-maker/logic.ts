/**
 * Pure-TypeScript animated GIF (GIF89a) encoder.
 *
 *  - colour quantisation to <= 256 colours (variance-based median cut with one k-means
 *    refinement pass; exact palette when the image has few colours)
 *  - optional Floyd-Steinberg (serpentine) dithering
 *  - LZW with variable code size and clear codes when the 4096-entry table fills
 *  - Graphic Control Extension (delay in 1/100 s, disposal, transparency)
 *  - NETSCAPE2.0 loop extension, local or one shared global colour table
 *  - optional frame differencing: unchanged pixels become transparent and each frame is
 *    cropped to the rectangle that changed
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface GifFrame {
  /** RGBA pixels, width * height * 4 bytes. */
  data: Uint8ClampedArray | Uint8Array;
  /** How long the frame is shown, in milliseconds. */
  delayMs: number;
}

export interface GifOptions {
  width: number;
  height: number;
  /** Total number of plays: 0 = forever, 1 = once, N = N times. */
  loop?: number;
  /** Floyd-Steinberg dithering (ignored when the colours fit exactly). */
  dither?: boolean;
  /** Palette sampling step: 1 looks at every pixel (best), larger is faster. */
  sampleStep?: number;
  /** 'local' builds one palette per frame, 'global' shares one palette (smaller, no colour flicker). */
  palette?: 'local' | 'global';
  /** Frame differencing (transparent unchanged pixels + cropped frames). */
  optimize?: boolean;
  /** Colour distance (0-255 Euclidean RGB) below which a pixel counts as unchanged. */
  tolerance?: number;
  /** Treat pixels with alpha < 128 as transparent. */
  transparent?: boolean;
  /** Upper bound for the palette size (2-256). */
  maxColors?: number;
  onProgress?: (done: number, total: number) => void;
  /** Return true to abort; encodeGif then rejects with an Error('cancelled'). */
  shouldCancel?: () => boolean;
}

export type FitMode = 'contain' | 'cover' | 'stretch';

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

class ByteSink {
  buf = new Uint8Array(1 << 16);
  len = 0;

  private ensure(extra: number): void {
    if (this.len + extra <= this.buf.length) return;
    let cap = this.buf.length * 2;
    while (cap < this.len + extra) cap *= 2;
    const next = new Uint8Array(cap);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  }

  byte(b: number): void {
    this.ensure(1);
    this.buf[this.len++] = b & 255;
  }

  u16(v: number): void {
    this.byte(v & 255);
    this.byte((v >> 8) & 255);
  }

  bytes(src: ArrayLike<number>, n = src.length): void {
    this.ensure(n);
    for (let i = 0; i < n; i++) this.buf[this.len + i] = src[i]! & 255;
    this.len += n;
  }

  ascii(s: string): void {
    for (let i = 0; i < s.length; i++) this.byte(s.charCodeAt(i));
  }

  result(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** Order of source frame indices for reverse / ping-pong playback. */
export function arrangeFrames(count: number, o: { reverse?: boolean; pingpong?: boolean }): number[] {
  const base = Array.from({ length: count }, (_, i) => (o.reverse ? count - 1 - i : i));
  if (o.pingpong && count > 2) {
    return base.concat(base.slice(1, -1).reverse());
  }
  return base;
}

/** Destination rectangle for drawing a w x h source into a dw x dh canvas. */
export function fitRect(
  w: number,
  h: number,
  dw: number,
  dh: number,
  mode: FitMode
): { dx: number; dy: number; dw: number; dh: number } {
  if (mode === 'stretch' || w <= 0 || h <= 0) return { dx: 0, dy: 0, dw, dh };
  const s = mode === 'contain' ? Math.min(dw / w, dh / h) : Math.max(dw / w, dh / h);
  const rw = w * s;
  const rh = h * s;
  return { dx: (dw - rw) / 2, dy: (dh - rh) / 2, dw: rw, dh: rh };
}

export interface Budget {
  pixels: number;
  level: 'ok' | 'warn' | 'block';
  message: string | null;
}

const WARN_PIXELS = 480 * 480 * 150; // about 35 million
const BLOCK_PIXELS = 480 * 480 * 450;

/** Judge whether width * height * frames is safe to hold in memory and encode. */
export function gifBudget(width: number, height: number, frames: number): Budget {
  const pixels = width * height * frames;
  if (pixels > BLOCK_PIXELS) {
    return {
      pixels,
      level: 'block',
      message: `${frames} frames at ${width}×${height} is too much for a browser tab (${(pixels / 1e6).toFixed(0)} megapixels in total). Reduce the width, the frame rate or the clip length.`,
    };
  }
  if (pixels > WARN_PIXELS) {
    return {
      pixels,
      level: 'warn',
      message: `${frames} frames at ${width}×${height} is heavy (${(pixels / 1e6).toFixed(0)} megapixels). Encoding may be slow and the GIF very large. Consider a smaller width or fewer frames.`,
    };
  }
  return { pixels, level: 'ok', message: null };
}

// ---------------------------------------------------------------------------
// Colour quantisation
// ---------------------------------------------------------------------------

const CELLS = 32768; // 5 bits per channel

interface Hist {
  count: Float64Array;
  r: Float64Array;
  g: Float64Array;
  b: Float64Array;
  total: number;
}

function newHist(): Hist {
  return {
    count: new Float64Array(CELLS),
    r: new Float64Array(CELLS),
    g: new Float64Array(CELLS),
    b: new Float64Array(CELLS),
    total: 0,
  };
}

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Accumulate pixels of `data` (inside `region`, skipping pixels not marked in `changed` and
 * transparent ones) into the 15-bit histogram. Also tracks distinct 24-bit colours so a
 * palette can be exact for flat artwork; `exact` becomes null once more than `maxExact` are seen.
 */
function addToHist(
  hist: Hist,
  exact: Map<number, number> | null,
  maxExact: number,
  data: ArrayLike<number>,
  width: number,
  region: Region,
  changed: Uint8Array | null,
  step: number,
  alphaCut: boolean
): Map<number, number> | null {
  const { count, r: sr, g: sg, b: sb } = hist;
  let ex = exact;
  let n = 0;
  for (let y = region.y; y < region.y + region.h; y++) {
    for (let x = region.x; x < region.x + region.w; x++) {
      const p = y * width + x;
      if (changed && !changed[p]) continue;
      const o = p * 4;
      if (alphaCut && data[o + 3]! < 128) continue;
      const r = data[o]!;
      const g = data[o + 1]!;
      const b = data[o + 2]!;
      if (ex) {
        const key = (r << 16) | (g << 8) | b;
        const c = ex.get(key);
        if (c === undefined) {
          if (ex.size >= maxExact) ex = null;
          else ex.set(key, 1);
        }
      }
      if (step > 1 && n++ % step !== 0) continue;
      const cell = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      count[cell] = count[cell]! + 1;
      sr[cell] = sr[cell]! + r;
      sg[cell] = sg[cell]! + g;
      sb[cell] = sb[cell]! + b;
      hist.total++;
    }
  }
  return ex;
}

interface Palette {
  /** n * 3 RGB bytes. */
  colors: Uint8Array;
  n: number;
  /** packed 24-bit colour -> index, when the palette is the exact set of colours. */
  exact: Map<number, number> | null;
  /** lazily filled 15-bit cell -> nearest palette index (0xFFFF = unset). */
  table: Uint16Array;
  hist: Hist | null;
}

function nearestInPalette(p: Palette, r: number, g: number, b: number): number {
  let best = 0;
  let bestD = Infinity;
  const c = p.colors;
  for (let i = 0; i < p.n; i++) {
    const dr = c[i * 3]! - r;
    const dg = c[i * 3 + 1]! - g;
    const db = c[i * 3 + 2]! - b;
    const d = dr * dr * 2 + dg * dg * 4 + db * db * 3; // perceptual-ish weights
    if (d < bestD) {
      bestD = d;
      best = i;
      if (d === 0) break;
    }
  }
  return best;
}

function lookup(p: Palette, r: number, g: number, b: number): number {
  const cell = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
  let idx = p.table[cell]!;
  if (idx === 0xffff) {
    const h = p.hist;
    let cr: number;
    let cg: number;
    let cb: number;
    if (h && h.count[cell]! > 0) {
      const n = h.count[cell]!;
      cr = h.r[cell]! / n;
      cg = h.g[cell]! / n;
      cb = h.b[cell]! / n;
    } else {
      cr = ((cell >> 10) << 3) | 4;
      cg = (((cell >> 5) & 31) << 3) | 4;
      cb = ((cell & 31) << 3) | 4;
    }
    idx = nearestInPalette(p, cr, cg, cb);
    p.table[cell] = idx;
  }
  return idx;
}

/** Index of the palette entry closest to the exact colour (r, g, b). */
function mapColour(p: Palette, r: number, g: number, b: number): number {
  if (p.exact) {
    const i = p.exact.get((r << 16) | (g << 8) | b);
    if (i !== undefined) return i;
  }
  return lookup(p, r, g, b);
}

function paletteFromExact(exact: Map<number, number>): Palette {
  const keys = Array.from(exact.keys()).sort((a, b) => a - b);
  const colors = new Uint8Array(keys.length * 3);
  const map = new Map<number, number>();
  keys.forEach((k, i) => {
    colors[i * 3] = (k >> 16) & 255;
    colors[i * 3 + 1] = (k >> 8) & 255;
    colors[i * 3 + 2] = k & 255;
    map.set(k, i);
  });
  return { colors, n: keys.length, exact: map, table: new Uint16Array(CELLS).fill(0xffff), hist: null };
}

/** Variance-based median cut over the occupied histogram cells, plus one Lloyd refinement. */
function paletteFromHist(hist: Hist, maxColors: number): Palette {
  const ids: number[] = [];
  for (let c = 0; c < CELLS; c++) if (hist.count[c]! > 0) ids.push(c);
  const m = ids.length;
  const w = new Float64Array(m);
  const cr = new Float64Array(m);
  const cg = new Float64Array(m);
  const cb = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const c = ids[i]!;
    const n = hist.count[c]!;
    w[i] = n;
    cr[i] = hist.r[c]! / n;
    cg[i] = hist.g[c]! / n;
    cb[i] = hist.b[c]! / n;
  }
  const chans = [cr, cg, cb];

  // Each box keeps its items sorted by every channel, so splitting never needs a new sort:
  // the other two orders are partitioned stably (k-d tree style).
  interface Box {
    orders: [Int32Array, Int32Array, Int32Array];
    sse: number;
    axis: number;
  }
  const sortedBy = (v: Float64Array): Int32Array => {
    const keys = new Float64Array(m);
    for (let i = 0; i < m; i++) keys[i] = Math.round(v[i]! * 8) * 65536 + i;
    keys.sort();
    const out = new Int32Array(m);
    for (let i = 0; i < m; i++) out[i] = keys[i]! % 65536;
    return out;
  };
  const stats = (orders: [Int32Array, Int32Array, Int32Array]): { sse: number; axis: number } => {
    let bestAxis = 0;
    let bestSse = -1;
    let total = 0;
    const items = orders[0];
    for (let a = 0; a < 3; a++) {
      const v = chans[a]!;
      let sw = 0;
      let s1 = 0;
      let s2 = 0;
      for (let q = 0; q < items.length; q++) {
        const i = items[q]!;
        const wi = w[i]!;
        sw += wi;
        s1 += wi * v[i]!;
        s2 += wi * v[i]! * v[i]!;
      }
      const sse = s2 - (s1 * s1) / sw;
      total += sse;
      if (sse > bestSse) {
        bestSse = sse;
        bestAxis = a;
      }
    }
    return { sse: total, axis: bestAxis };
  };

  const rootOrders: [Int32Array, Int32Array, Int32Array] = [sortedBy(cr), sortedBy(cg), sortedBy(cb)];
  const first = stats(rootOrders);
  const boxes: Box[] = [{ orders: rootOrders, sse: first.sse, axis: first.axis }];
  const side = new Uint8Array(m);
  while (boxes.length < maxColors) {
    let bi = -1;
    let best = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]!;
      if (b.orders[0].length > 1 && b.sse > best) {
        best = b.sse;
        bi = i;
      }
    }
    if (bi < 0) break;
    const box = boxes[bi]!;
    const v = chans[box.axis]!;
    const sorted = box.orders[box.axis]!;
    const len = sorted.length;
    // choose the split minimising the summed squared error along the axis
    let tw = 0;
    let t1 = 0;
    let t2 = 0;
    for (let q = 0; q < len; q++) {
      const i = sorted[q]!;
      tw += w[i]!;
      t1 += w[i]! * v[i]!;
      t2 += w[i]! * v[i]! * v[i]!;
    }
    let lw = 0;
    let l1 = 0;
    let l2 = 0;
    let bestCost = Infinity;
    let bestPos = 1;
    for (let p = 1; p < len; p++) {
      const i = sorted[p - 1]!;
      lw += w[i]!;
      l1 += w[i]! * v[i]!;
      l2 += w[i]! * v[i]! * v[i]!;
      const rw = tw - lw;
      if (lw <= 0 || rw <= 0) continue;
      const cost = l2 - (l1 * l1) / lw + (t2 - l2 - ((t1 - l1) * (t1 - l1)) / rw);
      if (cost < bestCost) {
        bestCost = cost;
        bestPos = p;
      }
    }
    for (let q = 0; q < len; q++) side[sorted[q]!] = q < bestPos ? 0 : 1;
    const parts: [Int32Array[], Int32Array[]] = [[], []];
    for (let a = 0; a < 3; a++) {
      const src = box.orders[a]!;
      const l = new Int32Array(bestPos);
      const r = new Int32Array(len - bestPos);
      let li = 0;
      let ri = 0;
      for (let q = 0; q < len; q++) {
        const i = src[q]!;
        if (side[i] === 0) l[li++] = i;
        else r[ri++] = i;
      }
      parts[0].push(l);
      parts[1].push(r);
    }
    const lo = parts[0] as unknown as [Int32Array, Int32Array, Int32Array];
    const ro = parts[1] as unknown as [Int32Array, Int32Array, Int32Array];
    const ls = stats(lo);
    const rs = stats(ro);
    boxes[bi] = { orders: lo, sse: ls.sse, axis: ls.axis };
    boxes.push({ orders: ro, sse: rs.sse, axis: rs.axis });
  }

  const k = boxes.length;
  const pr = new Float64Array(k);
  const pg = new Float64Array(k);
  const pb = new Float64Array(k);
  boxes.forEach((box, bi) => {
    let sw = 0;
    let a = 0;
    let b = 0;
    let c = 0;
    const items = box.orders[0];
    for (let q = 0; q < items.length; q++) {
      const i = items[q]!;
      sw += w[i]!;
      a += w[i]! * cr[i]!;
      b += w[i]! * cg[i]!;
      c += w[i]! * cb[i]!;
    }
    pr[bi] = a / sw;
    pg[bi] = b / sw;
    pb[bi] = c / sw;
  });

  // One Lloyd pass: reassign each cell to its nearest centre, recompute centres.
  if (k > 2 && m * k <= 1_500_000) {
    const sw = new Float64Array(k);
    const sr = new Float64Array(k);
    const sg = new Float64Array(k);
    const sb = new Float64Array(k);
    for (let i = 0; i < m; i++) {
      let best = 0;
      let bd = Infinity;
      for (let j = 0; j < k; j++) {
        const dr = pr[j]! - cr[i]!;
        const dg = pg[j]! - cg[i]!;
        const db = pb[j]! - cb[i]!;
        const d = dr * dr + dg * dg + db * db;
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      sw[best] = sw[best]! + w[i]!;
      sr[best] = sr[best]! + w[i]! * cr[i]!;
      sg[best] = sg[best]! + w[i]! * cg[i]!;
      sb[best] = sb[best]! + w[i]! * cb[i]!;
    }
    for (let j = 0; j < k; j++) {
      if (sw[j]! > 0) {
        pr[j] = sr[j]! / sw[j]!;
        pg[j] = sg[j]! / sw[j]!;
        pb[j] = sb[j]! / sw[j]!;
      }
    }
  }

  const colors = new Uint8Array(k * 3);
  for (let j = 0; j < k; j++) {
    colors[j * 3] = Math.round(pr[j]!);
    colors[j * 3 + 1] = Math.round(pg[j]!);
    colors[j * 3 + 2] = Math.round(pb[j]!);
  }
  return { colors, n: k, exact: null, table: new Uint16Array(CELLS).fill(0xffff), hist };
}

function buildPalette(hist: Hist, exact: Map<number, number> | null, maxColors: number): Palette {
  if (hist.total === 0) {
    return {
      colors: new Uint8Array([0, 0, 0]),
      n: 1,
      exact: null,
      table: new Uint16Array(CELLS).fill(0xffff),
      hist: null,
    };
  }
  if (exact && exact.size <= maxColors) return paletteFromExact(exact);
  return paletteFromHist(hist, maxColors);
}

/**
 * Map the pixels of `region` to palette indices (row-major inside the region).
 * Pixels not in `changed` or transparent get `transIdx`.
 */
function mapRegion(
  data: ArrayLike<number>,
  width: number,
  region: Region,
  changed: Uint8Array | null,
  pal: Palette,
  dither: boolean,
  transIdx: number,
  alphaCut: boolean
): Uint8Array {
  const { w, h } = region;
  const out = new Uint8Array(w * h);
  const skip = (p: number): boolean => {
    if (changed && !changed[p]) return true;
    return alphaCut && data[p * 4 + 3]! < 128;
  };

  if (!dither || pal.exact) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const p = (region.y + y) * width + region.x + x;
        out[y * w + x] =
          skip(p) ? transIdx : mapColour(pal, data[p * 4]!, data[p * 4 + 1]!, data[p * 4 + 2]!);
      }
    }
    return out;
  }

  // Floyd-Steinberg with serpentine scanning; error rows carry r,g,b per column.
  const stride = (w + 2) * 3;
  let cur = new Float32Array(stride);
  let nxt = new Float32Array(stride);
  const colors = pal.colors;
  for (let y = 0; y < h; y++) {
    const ltr = y % 2 === 0;
    nxt.fill(0);
    for (let s = 0; s < w; s++) {
      const x = ltr ? s : w - 1 - s;
      const p = (region.y + y) * width + region.x + x;
      if (skip(p)) {
        out[y * w + x] = transIdx;
        continue;
      }
      const e = (x + 1) * 3;
      let r = data[p * 4]! + cur[e]!;
      let g = data[p * 4 + 1]! + cur[e + 1]!;
      let b = data[p * 4 + 2]! + cur[e + 2]!;
      r = r < 0 ? 0 : r > 255 ? 255 : r;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      b = b < 0 ? 0 : b > 255 ? 255 : b;
      const idx = lookup(pal, Math.round(r), Math.round(g), Math.round(b));
      out[y * w + x] = idx;
      const er = r - colors[idx * 3]!;
      const eg = g - colors[idx * 3 + 1]!;
      const eb = b - colors[idx * 3 + 2]!;
      const fwd = ltr ? 1 : -1;
      // right/left neighbour 7/16, below-behind 3/16, below 5/16, below-ahead 1/16
      const a = (x + 1 + fwd) * 3;
      cur[a] = cur[a]! + (er * 7) / 16;
      cur[a + 1] = cur[a + 1]! + (eg * 7) / 16;
      cur[a + 2] = cur[a + 2]! + (eb * 7) / 16;
      const bb = (x + 1 - fwd) * 3;
      nxt[bb] = nxt[bb]! + (er * 3) / 16;
      nxt[bb + 1] = nxt[bb + 1]! + (eg * 3) / 16;
      nxt[bb + 2] = nxt[bb + 2]! + (eb * 3) / 16;
      nxt[e] = nxt[e]! + (er * 5) / 16;
      nxt[e + 1] = nxt[e + 1]! + (eg * 5) / 16;
      nxt[e + 2] = nxt[e + 2]! + (eb * 5) / 16;
      const c = (x + 1 + fwd) * 3;
      nxt[c] = nxt[c]! + er / 16;
      nxt[c + 1] = nxt[c + 1]! + eg / 16;
      nxt[c + 2] = nxt[c + 2]! + eb / 16;
    }
    const t = cur;
    cur = nxt;
    nxt = t;
  }
  return out;
}

// ---------------------------------------------------------------------------
// LZW
// ---------------------------------------------------------------------------

const HASH_BITS = 13;
const HASH_SIZE = 1 << HASH_BITS;

/**
 * GIF flavour of LZW: variable code width (min+1 .. 12 bits), a clear code first and whenever
 * the 4096-entry dictionary is full, end-of-information last. Output is packed in <= 255 byte
 * sub-blocks, preceded by the minimum code size and followed by a zero-length terminator.
 */
export function lzwEncode(pixels: Uint8Array, minCodeSize: number, out: ByteSink): void {
  const clear = 1 << minCodeSize;
  const eoi = clear + 1;
  out.byte(minCodeSize);

  const block = new Uint8Array(255);
  let blockLen = 0;
  let acc = 0;
  let accBits = 0;
  const putByte = (b: number) => {
    block[blockLen++] = b;
    if (blockLen === 255) {
      out.byte(255);
      out.bytes(block, 255);
      blockLen = 0;
    }
  };
  const emit = (code: number, size: number) => {
    acc |= code << accBits;
    accBits += size;
    while (accBits >= 8) {
      putByte(acc & 255);
      acc >>>= 8;
      accBits -= 8;
    }
  };

  const keys = new Int32Array(HASH_SIZE).fill(-1);
  const vals = new Int32Array(HASH_SIZE);
  let nextCode = eoi + 1;
  let codeSize = minCodeSize + 1;
  emit(clear, codeSize);

  let prefix = pixels[0]!;
  for (let i = 1; i < pixels.length; i++) {
    const k = pixels[i]!;
    const key = (prefix << 8) | k;
    let h = Math.imul(key, 0x9e3779b1) >>> (32 - HASH_BITS);
    let found = -1;
    while (keys[h]! !== -1) {
      if (keys[h] === key) {
        found = vals[h]!;
        break;
      }
      h = (h + 1) & (HASH_SIZE - 1);
    }
    if (found >= 0) {
      prefix = found;
      continue;
    }
    emit(prefix, codeSize);
    if (nextCode === 4096) {
      emit(clear, codeSize);
      keys.fill(-1);
      nextCode = eoi + 1;
      codeSize = minCodeSize + 1;
    } else {
      if (nextCode >= 1 << codeSize) codeSize++;
      keys[h] = key;
      vals[h] = nextCode++;
    }
    prefix = k;
  }
  emit(prefix, codeSize);
  emit(eoi, codeSize);
  if (accBits > 0) putByte(acc & 255);
  if (blockLen > 0) {
    out.byte(blockLen);
    out.bytes(block, blockLen);
  }
  out.byte(0);
}

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

function log2Ceil(n: number): number {
  let bits = 1;
  while (1 << bits < n) bits++;
  return bits;
}

interface EncodedFrame {
  region: Region;
  pixels: Uint8Array;
  palette: Uint8Array; // n * 3 (without padding)
  n: number;
  transIdx: number; // -1 when none
  delayMs: number;
  disposal: number;
  /** true when this frame uses the global colour table. */
  global: boolean;
}

/** Encode frames to a GIF89a byte array. Awaits between frames so the UI stays responsive. */
export async function encodeGif(frames: readonly GifFrame[], opts: GifOptions): Promise<Uint8Array> {
  const { width, height } = opts;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 65535 || height > 65535) {
    throw new Error('GIF dimensions must be whole numbers between 1 and 65535.');
  }
  if (frames.length === 0) throw new Error('Add at least one frame.');
  const npx = width * height;
  for (const f of frames) {
    if (f.data.length !== npx * 4) throw new Error('Frame data does not match the GIF dimensions.');
  }

  const loop = Math.max(0, Math.floor(opts.loop ?? 0));
  const dither = !!opts.dither;
  const step = Math.max(1, Math.floor(opts.sampleStep ?? 1));
  const paletteMode = opts.palette ?? 'local';
  const optimize = !!opts.optimize;
  const tol = Math.max(0, opts.tolerance ?? 6);
  const tolSq = tol * tol;
  const alphaCut = !!opts.transparent;
  const maxColorsOpt = Math.max(2, Math.min(256, Math.floor(opts.maxColors ?? 256)));

  const anyAlpha = alphaCut && frames.some((f) => {
    for (let i = 3; i < f.data.length; i += 4) if (f.data[i]! < 128) return true;
    return false;
  });
  // Transparent pixels need a reserved index; differencing also needs one.
  const needTrans = anyAlpha || optimize;
  const maxColors = needTrans ? Math.min(maxColorsOpt, 255) : maxColorsOpt;
  const useDiff = optimize && !anyAlpha;

  const full: Region = { x: 0, y: 0, w: width, h: height };

  // Shared palette over all frames.
  let globalPal: Palette | null = null;
  if (paletteMode === 'global') {
    const hist = newHist();
    let exact: Map<number, number> | null = new Map();
    for (let i = 0; i < frames.length; i++) {
      exact = addToHist(hist, exact, maxColors, frames[i]!.data, width, full, null, step, alphaCut);
      if (i % 4 === 3) await tick();
      if (opts.shouldCancel?.()) throw new Error('cancelled');
    }
    globalPal = buildPalette(hist, exact, maxColors);
  }

  const encoded: EncodedFrame[] = [];
  const ref = useDiff ? new Uint8Array(npx * 3) : null; // source colour at last write
  const changed = useDiff ? new Uint8Array(npx) : null;

  for (let fi = 0; fi < frames.length; fi++) {
    if (opts.shouldCancel?.()) throw new Error('cancelled');
    const fr = frames[fi]!;
    const data = fr.data;
    let region: Region = full;
    let mask: Uint8Array | null = null;

    if (useDiff && ref && changed && fi > 0) {
      let minX = width;
      let minY = height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const p = y * width + x;
          const dr = data[p * 4]! - ref[p * 3]!;
          const dg = data[p * 4 + 1]! - ref[p * 3 + 1]!;
          const db = data[p * 4 + 2]! - ref[p * 3 + 2]!;
          const diff = dr * dr + dg * dg + db * db > tolSq ? 1 : 0;
          changed[p] = diff;
          if (diff) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) {
        // Nothing changed: extend the previous frame instead of storing a duplicate.
        const prev = encoded[encoded.length - 1]!;
        prev.delayMs += fr.delayMs;
        opts.onProgress?.(fi + 1, frames.length);
        continue;
      }
      region = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
      mask = changed;
    }

    // Palette for this frame.
    let pal: Palette;
    if (globalPal) pal = globalPal;
    else {
      const hist = newHist();
      const exact = addToHist(hist, new Map(), maxColors, data, width, region, mask, step, alphaCut);
      pal = buildPalette(hist, exact, maxColors);
    }

    const transIdx = needTrans ? pal.n : -1;
    const pixels = mapRegion(data, width, region, mask, pal, dither, transIdx, alphaCut);

    if (ref) {
      for (let y = 0; y < region.h; y++) {
        for (let x = 0; x < region.w; x++) {
          const p = (region.y + y) * width + region.x + x;
          if (mask && !mask[p]) continue;
          ref[p * 3] = data[p * 4]!;
          ref[p * 3 + 1] = data[p * 4 + 1]!;
          ref[p * 3 + 2] = data[p * 4 + 2]!;
        }
      }
    }

    encoded.push({
      region,
      pixels,
      palette: pal.colors,
      n: pal.n,
      transIdx,
      delayMs: fr.delayMs,
      disposal: anyAlpha ? 2 : 1,
      global: !!globalPal,
    });
    opts.onProgress?.(fi + 1, frames.length);
    await tick();
  }

  // ---- serialise ----
  const out = new ByteSink();
  out.ascii('GIF89a');
  out.u16(width);
  out.u16(height);
  let gctBits = 0;
  if (globalPal) {
    gctBits = log2Ceil(globalPal.n + (needTrans ? 1 : 0));
    out.byte(0x80 | 0x70 | (gctBits - 1));
  } else {
    out.byte(0x70);
  }
  out.byte(0); // background colour index
  out.byte(0); // pixel aspect ratio
  if (globalPal) writeTable(out, globalPal.colors, globalPal.n, 1 << gctBits);

  if (encoded.length > 1 && loop !== 1) {
    out.byte(0x21);
    out.byte(0xff);
    out.byte(11);
    out.ascii('NETSCAPE2.0');
    out.byte(3);
    out.byte(1);
    out.u16(loop === 0 ? 0 : Math.min(65535, loop - 1));
    out.byte(0);
  }

  // Delays: round cumulatively so the total duration stays accurate; GIF stores 1/100 s.
  let cumMs = 0;
  let emittedCs = 0;
  encoded.forEach((f) => {
    cumMs += Math.max(0, f.delayMs);
    const wantEnd = Math.round(cumMs / 10);
    const cs = Math.min(65535, Math.max(2, wantEnd - emittedCs));
    emittedCs += cs;

    out.byte(0x21);
    out.byte(0xf9);
    out.byte(4);
    out.byte((f.disposal << 2) | (f.transIdx >= 0 ? 1 : 0));
    out.u16(cs);
    out.byte(f.transIdx >= 0 ? f.transIdx : 0);
    out.byte(0);

    out.byte(0x2c);
    out.u16(f.region.x);
    out.u16(f.region.y);
    out.u16(f.region.w);
    out.u16(f.region.h);
    const colourCount = f.n + (f.transIdx >= 0 ? 1 : 0);
    if (f.global) {
      out.byte(0);
    } else {
      const bits = log2Ceil(colourCount);
      out.byte(0x80 | (bits - 1));
      writeTable(out, f.palette, f.n, 1 << bits);
    }
    const bitsForCodes = f.global ? gctBits : log2Ceil(colourCount);
    lzwEncode(f.pixels, Math.max(2, bitsForCodes), out);
  });

  out.byte(0x3b);
  return out.result();
}

function writeTable(out: ByteSink, colors: Uint8Array, n: number, size: number): void {
  for (let i = 0; i < size; i++) {
    if (i < n) {
      out.byte(colors[i * 3]!);
      out.byte(colors[i * 3 + 1]!);
      out.byte(colors[i * 3 + 2]!);
    } else {
      out.byte(0);
      out.byte(0);
      out.byte(0);
    }
  }
}

// ---------------------------------------------------------------------------
// Minimal GIF reader for sanity checks / tests
// ---------------------------------------------------------------------------

export interface GifInfo {
  width: number;
  height: number;
  frames: number;
  loop: number | null; // NETSCAPE loop count (0 = forever) or null when absent
  delaysCs: number[];
  regions: Region[];
  hasGlobalTable: boolean;
}

/** Parse the structure of a GIF (no pixel decoding). Throws on malformed data. */
export function readGifInfo(bytes: Uint8Array): GifInfo {
  const sig = String.fromCharCode(...bytes.subarray(0, 6));
  if (sig !== 'GIF89a' && sig !== 'GIF87a') throw new Error('Not a GIF');
  const u16 = (o: number) => bytes[o]! | (bytes[o + 1]! << 8);
  const width = u16(6);
  const height = u16(8);
  const packed = bytes[10]!;
  let pos = 13;
  const hasGlobalTable = (packed & 0x80) !== 0;
  if (hasGlobalTable) pos += 3 * (1 << ((packed & 7) + 1));
  const info: GifInfo = { width, height, frames: 0, loop: null, delaysCs: [], regions: [], hasGlobalTable };
  const skipBlocks = () => {
    while (bytes[pos]! !== 0) pos += bytes[pos]! + 1;
    pos++;
  };
  for (;;) {
    const b = bytes[pos++];
    if (b === undefined) throw new Error('Truncated GIF');
    if (b === 0x3b) break;
    if (b === 0x21) {
      const label = bytes[pos++]!;
      if (label === 0xf9) {
        info.delaysCs.push(u16(pos + 2));
        pos += 1 + bytes[pos]! + 1;
      } else if (label === 0xff) {
        const len = bytes[pos]!;
        const id = String.fromCharCode(...bytes.subarray(pos + 1, pos + 1 + len));
        pos += len + 1;
        if (id === 'NETSCAPE2.0' && bytes[pos] === 3 && bytes[pos + 1] === 1) info.loop = u16(pos + 2);
        skipBlocks();
      } else {
        skipBlocks();
      }
    } else if (b === 0x2c) {
      const region = { x: u16(pos), y: u16(pos + 2), w: u16(pos + 4), h: u16(pos + 6) };
      const ip = bytes[pos + 8]!;
      pos += 9;
      if (ip & 0x80) pos += 3 * (1 << ((ip & 7) + 1));
      pos++; // min code size
      skipBlocks();
      info.frames++;
      info.regions.push(region);
    } else {
      throw new Error('Unexpected GIF block 0x' + b.toString(16));
    }
  }
  return info;
}
