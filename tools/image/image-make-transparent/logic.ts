/**
 * Colour-key background removal: CIELAB distance maps, scanline flood fill, soft edges and defringing.
 * Pure TypeScript operating on RGBA byte arrays (ImageData-like) so it can be unit-tested outside the browser.
 */

export type Rgb = [number, number, number];
export type Mode = 'flood' | 'global';

/** Distance maps store ΔE in steps of 1/DQ so that they fit in one byte per pixel. */
export const DQ = 2;
export const MAX_PIXELS = 40_000_000;

export interface Target {
  /** pixel the user clicked; null = colour-only target (flood starts from every matching edge pixel) */
  x: number | null;
  y: number | null;
  color: Rgb;
}

export interface Settings {
  mode: Mode;
  /** ΔE (CIE76) below which a pixel counts as background */
  tolerance: number;
  /** extra ΔE over which alpha ramps from 0 to full */
  feather: number;
  defringe: boolean;
}

export const DEFAULT_SETTINGS: Settings = { mode: 'flood', tolerance: 10, feather: 25, defringe: true };

export interface Hooks {
  /** return true to abort an async computation (throws CancelledError at the next yield) */
  shouldCancel?: () => boolean;
}

export class CancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'CancelledError';
  }
}

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Returns a function that yields to the event loop only when ~12 ms have passed since the last yield. */
function makeYielder(h?: Hooks): () => Promise<void> {
  let last = nowMs();
  return async () => {
    if (h?.shouldCancel?.()) throw new CancelledError();
    if (nowMs() - last > 12) {
      await new Promise<void>((r) => setTimeout(r, 0));
      last = nowMs();
      if (h?.shouldCancel?.()) throw new CancelledError();
    }
  };
}

const CHUNK = 1 << 19;

// ---------------------------------------------------------------------------------------------
// Colour maths
// ---------------------------------------------------------------------------------------------

const LIN: Float32Array = (() => {
  const t = new Float32Array(256);
  for (let i = 0; i < 256; i++) {
    const c = i / 255;
    t[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  return t;
})();

const F_STEPS = 4096;
const F_MAX = 1.2;
const F_TAB: Float32Array = (() => {
  const t = new Float32Array(F_STEPS + 2);
  for (let i = 0; i < t.length; i++) {
    const v = (i / F_STEPS) * F_MAX;
    t[i] = v > 216 / 24389 ? Math.cbrt(v) : (24389 / 27 * v + 16) / 116;
  }
  return t;
})();

function fLab(t: number): number {
  const x = (t / F_MAX) * F_STEPS;
  if (x >= F_STEPS) return F_TAB[F_STEPS]!;
  const i = x | 0;
  const fr = x - i;
  return F_TAB[i]! + (F_TAB[i + 1]! - F_TAB[i]!) * fr;
}

const XN = 0.95047;
const YN = 1.0;
const ZN = 1.08883;

/** sRGB (0..255) -> CIELAB (D65). */
export function srgbToLab(r: number, g: number, b: number): [number, number, number] {
  const lr = LIN[r & 255]!;
  const lg = LIN[g & 255]!;
  const lb = LIN[b & 255]!;
  const X = 0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb;
  const Y = 0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb;
  const Z = 0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb;
  const fx = fLab(X / XN);
  const fy = fLab(Y / YN);
  const fz = fLab(Z / ZN);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIE76 colour difference between two sRGB colours. 0 = identical, ~100 = black vs white. */
export function colorDistance(a: Rgb, b: Rgb): number {
  const [l1, a1, b1] = srgbToLab(a[0], a[1], a[2]);
  const [l2, a2, b2] = srgbToLab(b[0], b[1], b[2]);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

function view32(rgba: Uint8Array | Uint8ClampedArray): Uint32Array | null {
  if (rgba.byteOffset % 4 !== 0) return null;
  return new Uint32Array(rgba.buffer, rgba.byteOffset, rgba.byteLength >> 2);
}

function fillDistance(
  rgba: Uint8Array | Uint8ClampedArray,
  p32: Uint32Array | null,
  lab0: [number, number, number],
  out: Uint8Array,
  start: number,
  end: number
): void {
  const [l0, a0, b0] = lab0;
  let lastP = -1;
  let lastD = 0;
  for (let i = start; i < end; i++) {
    const o = i << 2;
    const p = p32 ? p32[i]! : -2 - i;
    if (p === lastP) {
      out[i] = lastD;
      continue;
    }
    let d: number;
    if (rgba[o + 3]! < 8) {
      d = 0;
    } else {
      const lr = LIN[rgba[o]!]!;
      const lg = LIN[rgba[o + 1]!]!;
      const lb = LIN[rgba[o + 2]!]!;
      const fx = fLab((0.4124564 * lr + 0.3575761 * lg + 0.1804375 * lb) / XN);
      const fy = fLab((0.2126729 * lr + 0.7151522 * lg + 0.072175 * lb) / YN);
      const fz = fLab((0.0193339 * lr + 0.119192 * lg + 0.9503041 * lb) / ZN);
      const dl = 116 * fy - 16 - l0;
      const da = 500 * (fx - fy) - a0;
      const db = 200 * (fy - fz) - b0;
      const e = Math.sqrt(dl * dl + da * da + db * db) * DQ;
      d = e >= 255 ? 255 : (e + 0.5) | 0;
    }
    out[i] = d;
    lastP = p;
    lastD = d;
  }
}

/**
 * Per-pixel ΔE to `key`, quantised to 1/DQ and clamped to 255. Pixels that are already
 * (almost) fully transparent count as background (distance 0) so that fills can pass through them.
 */
export function buildDistanceMap(rgba: Uint8Array | Uint8ClampedArray, key: Rgb): Uint8Array {
  const n = rgba.length >> 2;
  const out = new Uint8Array(n);
  fillDistance(rgba, view32(rgba), srgbToLab(key[0], key[1], key[2]), out, 0, n);
  return out;
}

export async function buildDistanceMapAsync(rgba: Uint8Array | Uint8ClampedArray, key: Rgb, hooks?: Hooks): Promise<Uint8Array> {
  const n = rgba.length >> 2;
  const out = new Uint8Array(n);
  const p32 = view32(rgba);
  const lab0 = srgbToLab(key[0], key[1], key[2]);
  const y = makeYielder(hooks);
  for (let s = 0; s < n; s += CHUNK) {
    fillDistance(rgba, p32, lab0, out, s, Math.min(n, s + CHUNK));
    await y();
  }
  return out;
}

/** Small LRU of distance maps for one image (each map costs 1 byte per pixel). */
export class DistanceCache {
  private maps = new Map<string, Uint8Array>();
  constructor(private rgba: Uint8Array | Uint8ClampedArray, private limit = 6) {}
  get(color: Rgb): Uint8Array {
    const k = `${color[0]},${color[1]},${color[2]}`;
    const hit = this.maps.get(k);
    if (hit) {
      this.maps.delete(k);
      this.maps.set(k, hit);
      return hit;
    }
    const m = buildDistanceMap(this.rgba, color);
    this.maps.set(k, m);
    while (this.maps.size > this.limit) {
      const first = this.maps.keys().next().value;
      if (first === undefined) break;
      this.maps.delete(first);
    }
    return m;
  }
  async getAsync(color: Rgb, hooks?: Hooks): Promise<Uint8Array> {
    const k = `${color[0]},${color[1]},${color[2]}`;
    const hit = this.maps.get(k);
    if (hit) return this.get(color);
    const m = await buildDistanceMapAsync(this.rgba, color, hooks);
    this.maps.set(k, m);
    while (this.maps.size > this.limit) {
      const first = this.maps.keys().next().value;
      if (first === undefined) break;
      this.maps.delete(first);
    }
    return m;
  }
  clear(): void {
    this.maps.clear();
  }
}

// ---------------------------------------------------------------------------------------------
// Flood fill (explicit stack, scanline spans, 4-connected)
// ---------------------------------------------------------------------------------------------

export interface FloodFill {
  seed(idx: number): void;
  /** process up to `maxSpans` spans; returns true when the fill is complete */
  run(maxSpans: number): boolean;
  readonly marked: number;
}

export function createFloodFill(width: number, height: number, dist: Uint8Array, thr: number, visited: Uint8Array): FloodFill {
  let stack = new Int32Array(1 << 14);
  let sp = 0;
  let marked = 0;
  const push = (v: number) => {
    if (sp === stack.length) {
      const bigger = new Int32Array(stack.length * 2);
      bigger.set(stack);
      stack = bigger;
    }
    stack[sp++] = v;
  };
  return {
    seed(s: number) {
      if (s >= 0 && s < width * height && !visited[s] && dist[s]! <= thr) push(s);
    },
    run(maxSpans: number): boolean {
      let spans = 0;
      while (sp > 0) {
        if (spans++ >= maxSpans) return false;
        const p = stack[--sp]!;
        if (visited[p] || dist[p]! > thr) continue;
        const y = (p / width) | 0;
        const row = y * width;
        const x = p - row;
        let xl = x;
        while (xl > 0 && !visited[row + xl - 1] && dist[row + xl - 1]! <= thr) xl--;
        let xr = x;
        while (xr < width - 1 && !visited[row + xr + 1] && dist[row + xr + 1]! <= thr) xr++;
        for (let i = xl; i <= xr; i++) visited[row + i] = 1;
        marked += xr - xl + 1;
        for (let dy = -1; dy <= 1; dy += 2) {
          const ny = y + dy;
          if (ny < 0 || ny >= height) continue;
          const nrow = ny * width;
          let inRun = false;
          for (let xi = xl; xi <= xr; xi++) {
            const idx = nrow + xi;
            const ok = !visited[idx] && dist[idx]! <= thr;
            if (ok && !inRun) {
              push(idx);
              inRun = true;
            } else if (!ok) {
              inRun = false;
            }
          }
        }
      }
      return true;
    },
    get marked() {
      return marked;
    },
  };
}

/**
 * Mark every pixel reachable from `seeds` through pixels with dist <= thr (4-connected, explicit stack,
 * scanline spans). `visited` receives 1s and must be zeroed by the caller. Returns the number of pixels marked.
 */
export function floodFill(width: number, height: number, dist: Uint8Array, thr: number, seeds: ArrayLike<number>, visited: Uint8Array): number {
  const f = createFloodFill(width, height, dist, thr, visited);
  for (let i = 0; i < seeds.length; i++) f.seed(seeds[i]!);
  f.run(Infinity);
  return f.marked;
}

// ---------------------------------------------------------------------------------------------
// Alpha computation
// ---------------------------------------------------------------------------------------------

export interface AlphaResult {
  /** 255 = keep, 0 = fully removed */
  alpha: Uint8Array;
  /** index of the target responsible for each pixel's alpha (255 = none) */
  owner: Uint8Array;
}

function borderSeeds(width: number, height: number, dist: Uint8Array, thr: number): number[] {
  const seeds: number[] = [];
  for (let x = 0; x < width; x++) {
    if (dist[x]! <= thr) seeds.push(x);
    const b = (height - 1) * width + x;
    if (dist[b]! <= thr) seeds.push(b);
  }
  for (let y = 1; y < height - 1; y++) {
    const l = y * width;
    if (dist[l]! <= thr) seeds.push(l);
    const r = l + width - 1;
    if (dist[r]! <= thr) seeds.push(r);
  }
  return seeds;
}

interface Ramp {
  core: number;
  outer: number;
  span: number;
}

function rampOf(s: Settings): Ramp {
  const core = Math.max(0, Math.round(s.tolerance * DQ));
  const outer = Math.min(254, core + Math.max(0, Math.round(s.feather * DQ)));
  return { core, outer, span: outer - core };
}

/** Lower alpha[i] (and record the owner) for pixels in [i0,i1) that are close enough to the target colour. */
function rampRange(
  dist: Uint8Array,
  r: Ramp,
  alpha: Uint8Array,
  owner: Uint8Array,
  ti: number,
  i0: number,
  i1: number,
  visited: Uint8Array | null
): void {
  for (let i = i0; i < i1; i++) {
    if (visited && !visited[i]) continue;
    const d = dist[i]!;
    if (d > r.outer) continue;
    const a = d <= r.core ? 0 : r.span <= 0 ? 255 : Math.round(((d - r.core) / r.span) * 255);
    if (a < alpha[i]!) {
      alpha[i] = a;
      owner[i] = ti;
    }
  }
}

function seedsFor(t: Target, width: number, height: number, dist: Uint8Array, core: number): number[] {
  return t.x !== null && t.y !== null ? [t.y * width + t.x] : borderSeeds(width, height, dist, core);
}

export function computeAlpha(width: number, height: number, targets: Target[], s: Settings, cache: DistanceCache): AlphaResult {
  const n = width * height;
  const alpha = new Uint8Array(n).fill(255);
  const owner = new Uint8Array(n).fill(255);
  const r = rampOf(s);
  let visited: Uint8Array | null = null;
  targets.slice(0, 254).forEach((t, ti) => {
    const dist = cache.get(t.color);
    if (s.mode === 'global') {
      rampRange(dist, r, alpha, owner, ti, 0, n, null);
      return;
    }
    if (!visited) visited = new Uint8Array(n);
    else visited.fill(0);
    floodFill(width, height, dist, r.outer, seedsFor(t, width, height, dist, r.core), visited);
    rampRange(dist, r, alpha, owner, ti, 0, n, visited);
  });
  return { alpha, owner };
}

export async function computeAlphaAsync(
  width: number,
  height: number,
  targets: Target[],
  s: Settings,
  cache: DistanceCache,
  hooks?: Hooks
): Promise<AlphaResult> {
  const n = width * height;
  const y = makeYielder(hooks);
  const alpha = new Uint8Array(n).fill(255);
  const owner = new Uint8Array(n).fill(255);
  const r = rampOf(s);
  let visited: Uint8Array | null = null;
  const list = targets.slice(0, 254);
  for (let ti = 0; ti < list.length; ti++) {
    const t = list[ti]!;
    const dist = await cache.getAsync(t.color, hooks);
    let vis: Uint8Array | null = null;
    if (s.mode !== 'global') {
      if (!visited) visited = new Uint8Array(n);
      else visited.fill(0);
      vis = visited;
      const f = createFloodFill(width, height, dist, r.outer, vis);
      for (const sd of seedsFor(t, width, height, dist, r.core)) f.seed(sd);
      while (!f.run(300)) await y();
    }
    for (let st = 0; st < n; st += CHUNK) {
      rampRange(dist, r, alpha, owner, ti, st, Math.min(n, st + CHUNK), vis);
      await y();
    }
  }
  return { alpha, owner };
}

/**
 * "Colour to alpha": the smallest opacity at which pixel `p` can be explained as a foreground colour
 * blended over background `bg`, assuming the foreground may be any colour. 0 = identical to bg.
 */
export function colorToAlpha(r: number, g: number, b: number, bg: Rgb): number {
  let amax = 0;
  const px = [r, g, b];
  for (let c = 0; c < 3; c++) {
    const p = px[c]!;
    const k = bg[c]!;
    let a = 0;
    if (p > k) a = k >= 255 ? 0 : (p - k) / (255 - k);
    else if (p < k) a = k <= 0 ? 0 : (k - p) / k;
    if (a > amax) amax = a;
  }
  return amax;
}

function applyRange(
  rgba: Uint8Array | Uint8ClampedArray,
  res: AlphaResult,
  targets: Target[],
  defringe: boolean,
  out: Uint8ClampedArray,
  i0: number,
  i1: number
): void {
  for (let i = i0; i < i1; i++) {
    const a = res.alpha[i]!;
    if (a === 255) continue;
    const o = i << 2;
    let af = a / 255;
    if (defringe && a > 0) {
      const t = targets[res.owner[i]!];
      if (t) {
        const cta = colorToAlpha(rgba[o]!, rgba[o + 1]!, rgba[o + 2]!, t.color);
        if (cta < af) af = cta;
        if (af > 0.004) {
          const k = Math.max(af, 0.02);
          out[o] = t.color[0] + (rgba[o]! - t.color[0]) / k;
          out[o + 1] = t.color[1] + (rgba[o + 1]! - t.color[1]) / k;
          out[o + 2] = t.color[2] + (rgba[o + 2]! - t.color[2]) / k;
        }
      }
    }
    out[o + 3] = Math.round(rgba[o + 3]! * af);
  }
}

/**
 * Build the output pixels: the alpha plane is multiplied in. With `defringe`, partially transparent
 * edge pixels are un-blended from the background colour (and never more opaque than the pixel can
 * physically be), which removes the light/dark halo left by anti-aliased edges.
 * Pass `into` (same length as `rgba`) to reuse a buffer.
 */
export function applyAlpha(
  rgba: Uint8Array | Uint8ClampedArray,
  res: AlphaResult,
  targets: Target[],
  defringe: boolean,
  into?: Uint8ClampedArray
): Uint8ClampedArray {
  const out = into && into.length === rgba.length ? into : new Uint8ClampedArray(rgba.length);
  out.set(rgba);
  applyRange(rgba, res, targets, defringe, out, 0, rgba.length >> 2);
  return out;
}

export async function applyAlphaAsync(
  rgba: Uint8Array | Uint8ClampedArray,
  res: AlphaResult,
  targets: Target[],
  defringe: boolean,
  hooks?: Hooks,
  into?: Uint8ClampedArray
): Promise<Uint8ClampedArray> {
  const out = into && into.length === rgba.length ? into : new Uint8ClampedArray(rgba.length);
  out.set(rgba);
  const n = rgba.length >> 2;
  const y = makeYielder(hooks);
  for (let s = 0; s < n; s += CHUNK) {
    applyRange(rgba, res, targets, defringe, out, s, Math.min(n, s + CHUNK));
    await y();
  }
  return out;
}

export function removeBackground(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  targets: Target[],
  s: Settings,
  cache?: DistanceCache
): Uint8ClampedArray {
  if (targets.length === 0) return new Uint8ClampedArray(rgba);
  const c = cache ?? new DistanceCache(rgba);
  return applyAlpha(rgba, computeAlpha(width, height, targets, s, c), targets, s.defringe);
}

export interface RemovalResult {
  pixels: Uint8ClampedArray;
  /** pixels whose alpha is exactly 0 after removal */
  transparent: number;
}

/** Cooperative (yielding, cancellable) version of removeBackground that also counts transparent pixels. */
export async function removeBackgroundAsync(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  targets: Target[],
  s: Settings,
  cache: DistanceCache,
  hooks?: Hooks,
  into?: Uint8ClampedArray
): Promise<RemovalResult> {
  const n = width * height;
  if (targets.length === 0) {
    const out = into && into.length === rgba.length ? into : new Uint8ClampedArray(rgba.length);
    out.set(rgba);
    let clear = 0;
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i] === 0) clear++;
    return { pixels: out, transparent: clear };
  }
  const res = await computeAlphaAsync(width, height, targets, s, cache, hooks);
  const pixels = await applyAlphaAsync(rgba, res, targets, s.defringe, hooks, into);
  let transparent = 0;
  for (let i = 0; i < n; i++) if (pixels[i * 4 + 3] === 0) transparent++;
  return { pixels, transparent };
}

// ---------------------------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------------------------

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Bounding box of pixels with alpha > threshold, or null if the image is fully transparent. */
export function contentBounds(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, threshold = 0): Box | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < height; y++) {
    const row = y * width * 4;
    let rowHit = false;
    for (let x = 0; x < width; x++) {
      if (rgba[row + x * 4 + 3]! > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        rowHit = true;
      }
    }
    if (rowHit) {
      if (y < minY) minY = y;
      maxY = y;
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

export function cropRgba(rgba: Uint8Array | Uint8ClampedArray, width: number, box: Box): Uint8ClampedArray {
  const out = new Uint8ClampedArray(box.w * box.h * 4);
  for (let y = 0; y < box.h; y++) {
    const s = ((box.y + y) * width + box.x) * 4;
    out.set(rgba.subarray(s, s + box.w * 4), y * box.w * 4);
  }
  return out;
}

export function toHex(c: Rgb): string {
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function parseHex(s: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return null;
  const v = parseInt(m[1]!, 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/**
 * Guess a solid background from the image border: the most common (coarsely quantised) colour,
 * accepted when it covers at least `minShare` of the sampled border pixels.
 */
export function detectBackground(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  minShare = 0.6
): { color: Rgb; share: number } | null {
  const counts = new Map<number, { n: number; r: number; g: number; b: number }>();
  let total = 0;
  const sample = (x: number, y: number) => {
    const o = (y * width + x) * 4;
    if (rgba[o + 3]! < 8) return;
    total++;
    const key = ((rgba[o]! >> 3) << 10) | ((rgba[o + 1]! >> 3) << 5) | (rgba[o + 2]! >> 3);
    const e = counts.get(key);
    if (e) {
      e.n++;
      e.r += rgba[o]!;
      e.g += rgba[o + 1]!;
      e.b += rgba[o + 2]!;
    } else counts.set(key, { n: 1, r: rgba[o]!, g: rgba[o + 1]!, b: rgba[o + 2]! });
  };
  const stepX = Math.max(1, (width / 400) | 0);
  const stepY = Math.max(1, (height / 400) | 0);
  for (let x = 0; x < width; x += stepX) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += stepY) {
    sample(0, y);
    sample(width - 1, y);
  }
  if (total === 0) return null;
  let best: { n: number; r: number; g: number; b: number } | null = null;
  for (const e of counts.values()) if (!best || e.n > best.n) best = e;
  if (!best) return null;
  const color: Rgb = [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
  // count everything within a small ΔE of the winner, not just its quantisation bucket
  let near = 0;
  for (const e of counts.values()) {
    const c: Rgb = [Math.round(e.r / e.n), Math.round(e.g / e.n), Math.round(e.b / e.n)];
    if (colorDistance(c, color) <= 8) near += e.n;
  }
  const share = near / total;
  return share >= minShare ? { color, share } : null;
}
