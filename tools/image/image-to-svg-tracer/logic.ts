/**
 * Raster -> SVG vectorizer.
 *
 * Pipeline:  pixels -> scalar field (ink-ness, or a 0/1 mask per colour layer) -> optional blur
 * -> marching squares with linear interpolation (sub-pixel, closed outer + hole contours)
 * -> speckle filter -> Ramer-Douglas-Peucker simplification
 * -> optional corner-aware cubic Bezier fitting (Schneider, "Graphics Gems")
 * -> compact SVG path data (relative commands, fill-rule evenodd).
 *
 * Framework-free so it can be unit-tested with bun.
 */

export interface RasterImage {
  width: number;
  height: number;
  /** RGBA bytes, width * height * 4. */
  data: ArrayLike<number>;
}

// ---------------------------------------------------------------------------
// Thresholding
// ---------------------------------------------------------------------------

/**
 * Otsu's method on a 256-bin histogram. Returns T such that values < T form the dark class.
 * On a plateau of equally good thresholds (e.g. a pure 0/255 image) the middle is used.
 */
export function otsuThreshold(hist: ArrayLike<number>): number {
  let total = 0;
  let sumAll = 0;
  for (let i = 0; i < 256; i++) {
    total += hist[i]!;
    sumAll += i * hist[i]!;
  }
  if (total === 0) return 128;
  let wB = 0;
  let sumB = 0;
  let best = -1;
  let start = 127;
  let end = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]!;
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t]!;
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best * (1 + 1e-9)) {
      best = between;
      start = t;
      end = t;
    } else if (between >= best * (1 - 1e-9)) {
      end = t;
    }
  }
  return Math.round((start + end) / 2) + 1;
}

export interface InkField {
  /** w * h, 0..255: how "inky" each pixel is (alpha-weighted). */
  field: Float32Array;
  /** histogram (256 bins) of the alpha-composited luminance. */
  hist: Uint32Array;
}

/**
 * Ink-ness of every pixel. Transparent pixels count as paper. With `invert`, light pixels are
 * the ink (transparent ones are then composited over black).
 */
export function inkField(img: RasterImage, invert: boolean): InkField {
  const n = img.width * img.height;
  const field = new Float32Array(n);
  const hist = new Uint32Array(256);
  const d = img.data;
  const bgL = invert ? 0 : 255;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const a = d[o + 3]! / 255;
    const l = 0.299 * d[o]! + 0.587 * d[o + 1]! + 0.114 * d[o + 2]!;
    const lp = a * l + (1 - a) * bgL;
    field[i] = invert ? lp : 255 - lp;
    hist[Math.min(255, Math.round(lp))] = hist[Math.min(255, Math.round(lp))]! + 1;
  }
  return { field, hist };
}

/** Iso-level in ink-field space for the luminance cut-off T (dark < T is ink; inverted: light >= T). */
export function inkLevel(threshold: number, invert: boolean): number {
  return invert ? threshold - 0.5 : 255.5 - threshold;
}

/** In-place separable [1 2 1]/4 blur, `passes` times. */
export function blurField(f: Float32Array, w: number, h: number, passes: number): void {
  if (passes <= 0 || w < 1 || h < 1) return;
  const tmp = new Float32Array(f.length);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        const l = f[row + (x > 0 ? x - 1 : 0)]!;
        const r = f[row + (x < w - 1 ? x + 1 : w - 1)]!;
        tmp[row + x] = (l + 2 * f[row + x]! + r) * 0.25;
      }
    }
    for (let y = 0; y < h; y++) {
      const up = (y > 0 ? y - 1 : 0) * w;
      const dn = (y < h - 1 ? y + 1 : h - 1) * w;
      const row = y * w;
      for (let x = 0; x < w; x++) {
        f[row + x] = (tmp[up + x]! + 2 * tmp[row + x]! + tmp[dn + x]!) * 0.25;
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Marching squares
// ---------------------------------------------------------------------------

export interface Contour {
  /** x0, y0, x1, y1, ... closed polygon (last point connects to the first). */
  pts: Float32Array;
  /** Signed area in px^2: positive for outer boundaries, negative for holes. */
  area: number;
  hole: boolean;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

// Cell corners clockwise (on screen): 0 TL, 1 TR, 2 BR, 3 BL. Edge k joins corner k and k+1:
// 0 = top, 1 = right, 2 = bottom, 3 = left. Segments run from an "exit" crossing (inside ->
// outside along the clockwise walk) to the next "enter" crossing, which keeps the ink on the
// right-hand side of the direction of travel.
const SEGMENTS: [number, number][][][] = (() => {
  const table: [number, number][][][] = [];
  for (let code = 0; code < 16; code++) {
    const inside = [code & 1, (code >> 1) & 1, (code >> 2) & 1, (code >> 3) & 1];
    const walk: { edge: number; exit: boolean }[] = [];
    for (let k = 0; k < 4; k++) {
      const a = inside[k]!;
      const b = inside[(k + 1) % 4]!;
      if (a !== b) walk.push({ edge: k, exit: a === 1 });
    }
    const variants: [number, number][][] = [];
    for (let v = 0; v < 2; v++) {
      // v = 0: saddle centre is outside (ink corners stay separate); v = 1: centre is ink (joined)
      const segs: [number, number][] = [];
      const n = walk.length;
      for (let i = 0; i < n; i++) {
        const cur = walk[i]!;
        if (!cur.exit) continue;
        let target: { edge: number; exit: boolean };
        if (n === 2 || v === 1) {
          // next enter after this exit in walk order
          let j = (i + 1) % n;
          while (walk[j]!.exit) j = (j + 1) % n;
          target = walk[j]!;
        } else {
          // previous enter before this exit
          let j = (i + n - 1) % n;
          while (walk[j]!.exit) j = (j + n - 1) % n;
          target = walk[j]!;
        }
        segs.push([cur.edge, target.edge]);
      }
      variants.push(segs);
    }
    table.push(variants);
  }
  return table;
})();

const PAD = -1e9;

/**
 * Trace the iso-contours of `field` (lw x lh, placed at (ox, oy) in image space) at `level`.
 * The field is treated as empty outside its bounds, so every contour is closed. Contours are
 * returned in image coordinates where pixel (i, j) has its centre at (i + 0.5, j + 0.5).
 */
export function contoursFromField(
  field: Float32Array,
  lw: number,
  lh: number,
  level: number,
  ox = 0,
  oy = 0,
  maxPoints = 4_000_000
): Contour[] {
  const W2 = lw + 2;
  const H2 = lh + 2;
  const P = new Float32Array(W2 * H2).fill(PAD);
  for (let y = 0; y < lh; y++) {
    P.set(field.subarray(y * lw, y * lw + lw), (y + 1) * W2 + 1);
  }

  const nEdges = 2 * W2 * H2;
  const next = new Int32Array(nEdges).fill(-1);
  const ex = new Float32Array(nEdges);
  const ey = new Float32Array(nEdges);

  const t01 = (va: number, vb: number): number =>
    va < -1e8 || vb < -1e8 ? 0.5 : (level - va) / (vb - va);

  // Edge id + position for crossing on edge k of cell (i, j); returns the id.
  const edge = (k: number, i: number, j: number): number => {
    let id: number;
    let x: number;
    let y: number;
    if (k === 0 || k === 2) {
      const jj = k === 0 ? j : j + 1;
      id = 2 * (jj * W2 + i);
      const t = t01(P[jj * W2 + i]!, P[jj * W2 + i + 1]!);
      x = ox + i - 0.5 + t;
      y = oy + jj - 0.5;
    } else {
      const ii = k === 1 ? i + 1 : i;
      id = 2 * (j * W2 + ii) + 1;
      const t = t01(P[j * W2 + ii]!, P[(j + 1) * W2 + ii]!);
      x = ox + ii - 0.5;
      y = oy + j - 0.5 + t;
    }
    ex[id] = x;
    ey[id] = y;
    return id;
  };

  for (let j = 0; j <= lh; j++) {
    for (let i = 0; i <= lw; i++) {
      const a = P[j * W2 + i]!;
      const b = P[j * W2 + i + 1]!;
      const c = P[(j + 1) * W2 + i + 1]!;
      const d = P[(j + 1) * W2 + i]!;
      const code = (a >= level ? 1 : 0) | (b >= level ? 2 : 0) | (c >= level ? 4 : 0) | (d >= level ? 8 : 0);
      if (code === 0 || code === 15) continue;
      let variant = 0;
      if (code === 5 || code === 10) {
        const avg = (Math.max(a, 0) + Math.max(b, 0) + Math.max(c, 0) + Math.max(d, 0)) / 4;
        variant = avg >= level ? 1 : 0;
      }
      for (const [from, to] of SEGMENTS[code]![variant]!) {
        next[edge(from, i, j)] = edge(to, i, j);
      }
    }
  }

  const out: Contour[] = [];
  let total = 0;
  const visited = new Uint8Array(nEdges);
  for (let start = 0; start < nEdges; start++) {
    if (next[start]! < 0 || visited[start]) continue;
    const xs: number[] = [];
    let id = start;
    do {
      visited[id] = 1;
      xs.push(ex[id]!, ey[id]!);
      id = next[id]!;
    } while (id !== start && id >= 0 && !visited[id]);
    total += xs.length / 2;
    if (total > maxPoints) throw new Error('This image is too complex to trace. Reduce the working size or use fewer colours.');
    const pts = Float32Array.from(xs);
    out.push(makeContour(pts));
  }
  return out;
}

function makeContour(pts: Float32Array): Contour {
  const n = pts.length / 2;
  let a = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = pts[2 * i]!;
    const y = pts[2 * i + 1]!;
    const j = (i + 1) % n;
    a += x * pts[2 * j + 1]! - pts[2 * j]! * y;
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const area = a / 2;
  return { pts, area, hole: area < 0, minX, minY, maxX, maxY };
}

/** Drop contours (outer or hole) whose area is below `minArea` px^2. */
export function removeSpeckles(contours: Contour[], minArea: number): Contour[] {
  if (minArea <= 0) return contours;
  return contours.filter((c) => Math.abs(c.area) >= minArea);
}

// ---------------------------------------------------------------------------
// Simplification (Ramer-Douglas-Peucker) and curve fitting (Schneider)
// ---------------------------------------------------------------------------

interface Poly {
  x: Float64Array;
  y: Float64Array;
}

function distSqToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const qx = ax + t * dx;
  const qy = ay + t * dy;
  return (px - qx) * (px - qx) + (py - qy) * (py - qy);
}

/** RDP on an open polyline; returns kept indices (always includes both ends). */
function rdpOpen(x: ArrayLike<number>, y: ArrayLike<number>, eps: number): number[] {
  const n = x.length;
  if (n <= 2) return Array.from({ length: n }, (_, i) => i);
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const e2 = eps * eps;
  const stack: number[] = [0, n - 1];
  while (stack.length) {
    const hi = stack.pop()!;
    const lo = stack.pop()!;
    let maxD = -1;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = distSqToSegment(x[i]!, y[i]!, x[lo]!, y[lo]!, x[hi]!, y[hi]!);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx >= 0 && maxD > e2) {
      keep[idx] = 1;
      stack.push(lo, idx, idx, hi);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(i);
  return out;
}

/** One [1 2 1]/4 pass along a closed polyline: removes the 1-px zigzag of sampled edges. */
export function smoothClosed(pts: Float32Array | Float64Array): Float64Array {
  const n = pts.length / 2;
  const out = new Float64Array(pts.length);
  if (n < 5) {
    out.set(pts);
    return out;
  }
  for (let i = 0; i < n; i++) {
    const a = (i + n - 1) % n;
    const b = (i + 1) % n;
    out[2 * i] = (pts[2 * a]! + 2 * pts[2 * i]! + pts[2 * b]!) * 0.25;
    out[2 * i + 1] = (pts[2 * a + 1]! + 2 * pts[2 * i + 1]! + pts[2 * b + 1]!) * 0.25;
  }
  return out;
}

/** RDP on a closed polygon: anchors at point 0 and the point farthest from it. */
export function simplifyClosed(pts: Float32Array | Float64Array, eps: number): Poly {
  const n = pts.length / 2;
  const x = new Float64Array(n);
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = pts[2 * i]!;
    y[i] = pts[2 * i + 1]!;
  }
  if (n < 4 || eps <= 0) return { x, y };
  let far = 0;
  let best = -1;
  for (let i = 1; i < n; i++) {
    const d = (x[i]! - x[0]!) ** 2 + (y[i]! - y[0]!) ** 2;
    if (d > best) {
      best = d;
      far = i;
    }
  }
  const h1x = Array.from(x.subarray(0, far + 1));
  const h1y = Array.from(y.subarray(0, far + 1));
  const h2x = Array.from(x.subarray(far)).concat([x[0]!]);
  const h2y = Array.from(y.subarray(far)).concat([y[0]!]);
  const k1 = rdpOpen(h1x, h1y, eps);
  const k2 = rdpOpen(h2x, h2y, eps);
  const ox: number[] = [];
  const oy: number[] = [];
  for (const i of k1) {
    ox.push(h1x[i]!);
    oy.push(h1y[i]!);
  }
  for (const i of k2.slice(1, -1)) {
    ox.push(h2x[i]!);
    oy.push(h2y[i]!);
  }
  return { x: Float64Array.from(ox), y: Float64Array.from(oy) };
}

type Seg = { c: false; x: number; y: number } | { c: true; x1: number; y1: number; x2: number; y2: number; x: number; y: number };

export interface Shape {
  startX: number;
  startY: number;
  segs: Seg[];
  hole: boolean;
}

interface Vec {
  x: number;
  y: number;
}

const vsub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
const vadd = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
const vmul = (a: Vec, s: number): Vec => ({ x: a.x * s, y: a.y * s });
const vdot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
const vlen = (a: Vec): number => Math.hypot(a.x, a.y);
function vnorm(a: Vec): Vec {
  const l = vlen(a);
  return l > 0 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

type Bez = [Vec, Vec, Vec, Vec];

function bezAt(b: Bez, t: number): Vec {
  const s = 1 - t;
  const b0 = s * s * s;
  const b1 = 3 * t * s * s;
  const b2 = 3 * t * t * s;
  const b3 = t * t * t;
  return {
    x: b0 * b[0].x + b1 * b[1].x + b2 * b[2].x + b3 * b[3].x,
    y: b0 * b[0].y + b1 * b[1].y + b2 * b[2].y + b3 * b[3].y,
  };
}

function bezD1(b: Bez, t: number): Vec {
  const s = 1 - t;
  const a0 = vmul(vsub(b[1], b[0]), 3);
  const a1 = vmul(vsub(b[2], b[1]), 3);
  const a2 = vmul(vsub(b[3], b[2]), 3);
  return vadd(vadd(vmul(a0, s * s), vmul(a1, 2 * s * t)), vmul(a2, t * t));
}

function bezD2(b: Bez, t: number): Vec {
  const a0 = vmul(vadd(vsub(b[2], vmul(b[1], 2)), b[0]), 6);
  const a1 = vmul(vadd(vsub(b[3], vmul(b[2], 2)), b[1]), 6);
  return vadd(vmul(a0, 1 - t), vmul(a1, t));
}

function chordParams(d: Vec[], first: number, last: number): number[] {
  const u = [0];
  for (let i = first + 1; i <= last; i++) u.push(u[u.length - 1]! + vlen(vsub(d[i]!, d[i - 1]!)));
  const total = u[u.length - 1]!;
  return total > 0 ? u.map((v) => v / total) : u.map((_, i) => i / Math.max(1, u.length - 1));
}

function generateBezier(d: Vec[], first: number, last: number, u: number[], t1: Vec, t2: Vec): Bez {
  const p0 = d[first]!;
  const p3 = d[last]!;
  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;
  for (let i = 0; i <= last - first; i++) {
    const t = u[i]!;
    const s = 1 - t;
    const b0 = s * s * s;
    const b1 = 3 * t * s * s;
    const b2 = 3 * t * t * s;
    const b3 = t * t * t;
    const a0 = vmul(t1, b1);
    const a1 = vmul(t2, b2);
    c00 += vdot(a0, a0);
    c01 += vdot(a0, a1);
    c11 += vdot(a1, a1);
    const tmp = vsub(d[first + i]!, vadd(vmul(p0, b0 + b1), vmul(p3, b2 + b3)));
    x0 += vdot(a0, tmp);
    x1 += vdot(a1, tmp);
  }
  const det = c00 * c11 - c01 * c01;
  const detX = x0 * c11 - x1 * c01;
  const detY = c00 * x1 - c01 * x0;
  const alphaL = det === 0 ? 0 : detX / det;
  const alphaR = det === 0 ? 0 : detY / det;
  const seg = vlen(vsub(p3, p0));
  const eps = 1e-6 * seg;
  if (alphaL < eps || alphaR < eps) {
    const dist = seg / 3;
    return [p0, vadd(p0, vmul(t1, dist)), vadd(p3, vmul(t2, dist)), p3];
  }
  return [p0, vadd(p0, vmul(t1, alphaL)), vadd(p3, vmul(t2, alphaR)), p3];
}

function reparam(b: Bez, d: Vec[], first: number, u: number[]): number[] {
  return u.map((t, i) => {
    const p = d[first + i]!;
    const q = bezAt(b, t);
    const q1 = bezD1(b, t);
    const q2 = bezD2(b, t);
    const diff = vsub(q, p);
    const num = vdot(diff, q1);
    const den = vdot(q1, q1) + vdot(diff, q2);
    if (den === 0) return t;
    const nt = t - num / den;
    return nt < 0 ? 0 : nt > 1 ? 1 : nt;
  });
}

function maxFitError(d: Vec[], first: number, last: number, b: Bez, u: number[]): { err: number; split: number } {
  let split = Math.floor((last - first + 1) / 2) + first;
  let maxD = 0;
  for (let i = first + 1; i < last; i++) {
    const p = bezAt(b, u[i - first]!);
    const v = vsub(p, d[i]!);
    const dd = vdot(v, v);
    if (dd >= maxD) {
      maxD = dd;
      split = i;
    }
  }
  return { err: maxD, split };
}

function fitCubic(d: Vec[], first: number, last: number, t1: Vec, t2: Vec, err2: number, out: Bez[], depth = 0): void {
  if (last - first === 1) {
    const dist = vlen(vsub(d[last]!, d[first]!)) / 3;
    out.push([d[first]!, vadd(d[first]!, vmul(t1, dist)), vadd(d[last]!, vmul(t2, dist)), d[last]!]);
    return;
  }
  let u = chordParams(d, first, last);
  let bez = generateBezier(d, first, last, u, t1, t2);
  let { err, split } = maxFitError(d, first, last, bez, u);
  if (err < err2) {
    out.push(bez);
    return;
  }
  if (err < err2 * 16) {
    for (let it = 0; it < 4; it++) {
      u = reparam(bez, d, first, u);
      bez = generateBezier(d, first, last, u, t1, t2);
      ({ err, split } = maxFitError(d, first, last, bez, u));
      if (err < err2) {
        out.push(bez);
        return;
      }
    }
  }
  if (depth > 40 || split <= first || split >= last) {
    out.push(bez);
    return;
  }
  const v1 = vsub(d[split - 1]!, d[split]!);
  const v2 = vsub(d[split]!, d[split + 1]!);
  const center = vnorm(vmul(vadd(v1, v2), 0.5));
  fitCubic(d, first, split, t1, center, err2, out, depth + 1);
  fitCubic(d, split, last, vmul(center, -1), t2, err2, out, depth + 1);
}

/** Insert points so no edge of the closed polyline is longer than `maxStep`; tags originals. */
function densify(p: Poly, maxStep: number): { d: Vec[]; orig: number[] } {
  const n = p.x.length;
  const d: Vec[] = [];
  const orig: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const ax = p.x[i]!;
    const ay = p.y[i]!;
    d.push({ x: ax, y: ay });
    orig.push(i);
    const len = Math.hypot(p.x[j]! - ax, p.y[j]! - ay);
    const k = Math.floor(len / maxStep);
    for (let s = 1; s <= k; s++) {
      const t = s / (k + 1);
      d.push({ x: ax + (p.x[j]! - ax) * t, y: ay + (p.y[j]! - ay) * t });
      orig.push(-1);
    }
  }
  return { d, orig };
}

/** Point at arclength `s` (may wrap) along the closed polyline starting from vertex i. */
function pointAlong(p: Poly, cum: Float64Array, total: number, i: number, s: number): Vec {
  const n = p.x.length;
  let pos = cum[i]! + s;
  pos = ((pos % total) + total) % total;
  // binary search the edge containing pos
  let lo = 0;
  let hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid]! <= pos) lo = mid;
    else hi = mid - 1;
  }
  const j = (lo + 1) % n;
  const segLen = lo === n - 1 ? total - cum[lo]! : cum[lo + 1]! - cum[lo]!;
  const t = segLen > 0 ? (pos - cum[lo]!) / segLen : 0;
  return { x: p.x[lo]! + (p.x[j]! - p.x[lo]!) * t, y: p.y[lo]! + (p.y[j]! - p.y[lo]!) * t };
}

/** Indices of vertices whose turning angle (measured `win` px either side) exceeds `angleDeg`. */
function detectCorners(p: Poly, win: number, angleDeg: number): number[] {
  const n = p.x.length;
  if (n < 3) return [];
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1]! + Math.hypot(p.x[i]! - p.x[i - 1]!, p.y[i]! - p.y[i - 1]!);
  const total = cum[n - 1]! + Math.hypot(p.x[0]! - p.x[n - 1]!, p.y[0]! - p.y[n - 1]!);
  if (total <= 0) return [];
  const w = Math.min(win, total / 4);
  const turn = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const P = { x: p.x[i]!, y: p.y[i]! };
    const A = pointAlong(p, cum, total, i, -w);
    const B = pointAlong(p, cum, total, i, w);
    const u = vnorm(vsub(P, A));
    const v = vnorm(vsub(B, P));
    const c = Math.max(-1, Math.min(1, vdot(u, v)));
    turn[i] = (Math.acos(c) * 180) / Math.PI;
  }
  const edgeLen = (i: number): number => {
    const j = (i + 1) % n;
    return Math.hypot(p.x[j]! - p.x[i]!, p.y[j]! - p.y[i]!);
  };
  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    if (turn[i]! < angleDeg) continue;
    // keep only the sharpest vertex within `w` px (arclength) of itself
    let isMax = true;
    for (const dir of [1, -1] as const) {
      let j = i;
      let acc = 0;
      for (let step = 0; step < n && isMax; step++) {
        const nj = (j + dir + n) % n;
        acc += dir === 1 ? edgeLen(j) : edgeLen(nj);
        if (acc > w) break;
        j = nj;
        if (turn[j]! > turn[i]! || (turn[j]! === turn[i]! && j < i)) isMax = false;
      }
      if (!isMax) break;
    }
    if (isMax) corners.push(i);
  }
  return corners;
}

/**
 * Rounded or chamfered corners (an artefact of sampling a sharp corner on a pixel grid) are
 * replaced by the intersection of the two straight edges that meet there, so squares stay
 * square. Only short clusters (<= `span` px of outline) between longer edges are snapped.
 * Returns the new polygon and the indices of the corner vertices in it.
 */
function snapCorners(p: Poly, win: number, span: number, angleDeg: number): { poly: Poly; corners: number[] } {
  const n = p.x.length;
  const corners0 = detectCorners(p, win, angleDeg);
  if (corners0.length === 0 || n < 5) return { poly: p, corners: corners0 };
  const edge = (i: number): number => {
    const a = (i + n) % n;
    const b = (a + 1) % n;
    return Math.hypot(p.x[b]! - p.x[a]!, p.y[b]! - p.y[a]!);
  };
  const consumed = new Uint8Array(n);
  const repAt = new Map<number, { x: number; y: number }>(); // start index of cluster -> new vertex
  const cornerStarts: number[] = [];
  for (const c of corners0) {
    if (consumed[c]) continue;
    let s = c;
    let acc = 0;
    for (;;) {
      const len = edge(s - 1);
      if (len <= 1.6 && acc + len <= span && !consumed[(s - 1 + n) % n]) {
        acc += len;
        s = (s - 1 + n) % n;
      } else break;
    }
    let e = c;
    acc = 0;
    for (;;) {
      const len = edge(e);
      if (len <= 1.6 && acc + len <= span && !consumed[(e + 1) % n]) {
        acc += len;
        e = (e + 1) % n;
      } else break;
    }
    let nx = p.x[c]!;
    let ny = p.y[c]!;
    let snapped = false;
    if (s !== e) {
      const a = (s - 1 + n) % n;
      const b = (e + 1) % n;
      const d1x = p.x[s]! - p.x[a]!;
      const d1y = p.y[s]! - p.y[a]!;
      const d2x = p.x[b]! - p.x[e]!;
      const d2y = p.y[b]! - p.y[e]!;
      const cross = d1x * d2y - d1y * d2x;
      const l1 = Math.hypot(d1x, d1y);
      const l2 = Math.hypot(d2x, d2y);
      if (l1 > 0 && l2 > 0 && Math.abs(cross) / (l1 * l2) > 0.2) {
        const t = ((p.x[e]! - p.x[s]!) * d2y - (p.y[e]! - p.y[s]!) * d2x) / cross;
        const ix = p.x[s]! + t * d1x;
        const iy = p.y[s]! + t * d1y;
        if (Math.hypot(ix - p.x[c]!, iy - p.y[c]!) <= span * 1.5) {
          nx = ix;
          ny = iy;
          snapped = true;
        }
      }
      if (!snapped) {
        // edges do not meet in a usable corner (e.g. the cap of a thin line): keep the vertex as it is
        s = c;
        e = c;
      }
    }
    // mark the cluster
    for (let k = s; ; k = (k + 1) % n) {
      consumed[k] = 1;
      if (k === e) break;
    }
    repAt.set(s, { x: nx, y: ny });
    cornerStarts.push(s);
  }
  const ox: number[] = [];
  const oy: number[] = [];
  const corners: number[] = [];
  for (let i = 0; i < n; i++) {
    const rep = repAt.get(i);
    if (rep) {
      corners.push(ox.length);
      ox.push(rep.x);
      oy.push(rep.y);
    } else if (!consumed[i]) {
      ox.push(p.x[i]!);
      oy.push(p.y[i]!);
    }
  }
  return { poly: { x: Float64Array.from(ox), y: Float64Array.from(oy) }, corners };
}

export interface FitOptions {
  /** Maximum deviation of the curve from the traced outline, in px. */
  tolerance: number;
  /** Turning angle (degrees) above which a vertex is kept as a sharp corner. */
  cornerAngle: number;
}

/** Unit tangent at one end of an open polyline, measured over a window to ignore pixel jitter. */
function windowTangent(piece: Vec[], atStart: boolean, window: number): Vec {
  const n = piece.length;
  const end = atStart ? piece[0]! : piece[n - 1]!;
  let acc = 0;
  let prev = end;
  for (let k = 1; k < n; k++) {
    const q = atStart ? piece[k]! : piece[n - 1 - k]!;
    acc += vlen(vsub(q, prev));
    prev = q;
    if (acc >= window) return vnorm(vsub(q, end));
  }
  return vnorm(vsub(prev, end));
}

/** Fit a closed contour with straight lines and cubic Beziers, keeping sharp corners. */
export function fitContour(pts: Float32Array, o: FitOptions): Shape | null {
  const pre = simplifyClosed(smoothClosed(pts), Math.max(0.05, Math.min(0.4, o.tolerance * 0.3)));
  if (pre.x.length < 3) return null;
  const win = Math.max(2, Math.min(10, 2.5 * o.tolerance + 1));
  const { poly, corners } = snapCorners(pre, win, 2.4, o.cornerAngle);
  const { d, orig } = densify(poly, 2.5);
  const m = d.length;
  const cornerSet = new Set(corners);
  const cornerIdx: number[] = [];
  for (let k = 0; k < m; k++) if (orig[k]! >= 0 && cornerSet.has(orig[k]!)) cornerIdx.push(k);

  const fitTol = o.tolerance * 0.7;
  const err2 = fitTol * fitTol;
  const tanWin = Math.max(2.5, Math.min(6, 3 * o.tolerance));
  const beziers: Bez[] = [];

  if (cornerIdx.length === 0) {
    // smooth closed outline: one piece, central tangent at the start so the join is G1
    const half: Vec[] = [];
    for (let k = 0, acc = 0; k < m && acc < tanWin; k++) {
      half.push(d[k]!);
      acc += vlen(vsub(d[(k + 1) % m]!, d[k]!));
    }
    const back: Vec[] = [d[0]!];
    for (let k = 1, acc = 0; k < m && acc < tanWin; k++) {
      back.push(d[m - k]!);
      acc += vlen(vsub(d[(m - k) % m]!, d[(m - k - 1 + m) % m]!));
    }
    const fwd = windowTangent(half, true, tanWin);
    const bwd = windowTangent(back, true, tanWin);
    const t = vnorm(vsub(fwd, bwd));
    const piece = d.concat([d[0]!]);
    fitCubic(piece, 0, piece.length - 1, t, vmul(t, -1), err2, beziers);
  } else {
    for (let c = 0; c < cornerIdx.length; c++) {
      const a = cornerIdx[c]!;
      const b = cornerIdx[(c + 1) % cornerIdx.length]!;
      const piece: Vec[] = [];
      for (let k = a; ; k = (k + 1) % m) {
        piece.push(d[k]!);
        if (k === b && piece.length > 1) break;
        if (piece.length > m + 1) break;
      }
      if (piece.length < 2) continue;
      const t1 = windowTangent(piece, true, tanWin);
      const t2 = windowTangent(piece, false, tanWin);
      fitCubic(piece, 0, piece.length - 1, t1, t2, err2, beziers);
    }
  }
  if (beziers.length === 0) return null;

  const start = beziers[0]![0];
  const lineTol = Math.max(0.1, o.tolerance * 0.3);
  const segs: Seg[] = [];
  for (const b of beziers) {
    const chord = vsub(b[3], b[0]);
    const cl = vlen(chord);
    let straight = false;
    if (cl > 0) {
      const dev1 = Math.abs((b[1].x - b[0].x) * chord.y - (b[1].y - b[0].y) * chord.x) / cl;
      const dev2 = Math.abs((b[2].x - b[0].x) * chord.y - (b[2].y - b[0].y) * chord.x) / cl;
      straight = dev1 <= lineTol && dev2 <= lineTol;
    }
    if (straight) segs.push({ c: false, x: b[3].x, y: b[3].y });
    else segs.push({ c: true, x1: b[1].x, y1: b[1].y, x2: b[2].x, y2: b[2].y, x: b[3].x, y: b[3].y });
  }
  return { startX: start.x, startY: start.y, segs, hole: false };
}

/** Straight-edged polygon version of a contour (corner snapping + RDP). */
export function polygonShape(pts: Float32Array, tolerance: number, cornerAngle = 55): Shape | null {
  const pre = simplifyClosed(smoothClosed(pts), Math.max(0.05, Math.min(0.3, tolerance * 0.3)));
  if (pre.x.length < 3) return null;
  const win = Math.max(2, Math.min(10, 2.5 * tolerance + 1));
  const { poly } = snapCorners(pre, win, 2.4, cornerAngle);
  const flat = new Float64Array(poly.x.length * 2);
  for (let i = 0; i < poly.x.length; i++) {
    flat[2 * i] = poly.x[i]!;
    flat[2 * i + 1] = poly.y[i]!;
  }
  const p = simplifyClosed(flat, tolerance);
  const n = p.x.length;
  if (n < 3) return null;
  const segs: Seg[] = [];
  for (let i = 1; i < n; i++) segs.push({ c: false, x: p.x[i]!, y: p.y[i]! });
  return { startX: p.x[0]!, startY: p.y[0]!, segs, hole: false };
}

// ---------------------------------------------------------------------------
// SVG path writing
// ---------------------------------------------------------------------------

function fmtScaled(n: number, p: number): string {
  if (n === 0) return '0';
  if (p === 0) return String(n);
  const neg = n < 0;
  const a = Math.abs(n);
  const f = 10 ** p;
  const ip = Math.floor(a / f);
  const fp = String(a % f).padStart(p, '0').replace(/0+$/, '');
  const s = fp ? (ip ? `${ip}.${fp}` : `.${fp}`) : String(ip);
  return neg ? '-' + s : s;
}

export interface PathStats {
  d: string;
  shapes: number;
  nodes: number;
}

/**
 * Compact path data: absolute `M`, then relative `l h v c`, then `z`. Coordinates are rounded to
 * `precision` decimals; deltas are computed between rounded positions so rounding never drifts.
 */
export function shapesToPath(shapes: Shape[], precision: number): PathStats {
  const f = 10 ** precision;
  const q = (v: number): number => Math.round(v * f);
  let out = '';
  let nodes = 0;
  let count = 0;
  for (const s of shapes) {
    let cx = q(s.startX);
    let cy = q(s.startY);
    const parts: string[] = [];
    let last = '';
    let segCount = 0;
    const push = (cmd: string, nums: number[]) => {
      let str = cmd === last ? '' : cmd;
      for (let i = 0; i < nums.length; i++) {
        const t = fmtScaled(nums[i]!, precision);
        const needSep = i > 0 || cmd === last;
        str += (needSep && !t.startsWith('-') ? ' ' : '') + t;
      }
      last = cmd;
      parts.push(str);
    };
    const sx0 = q(s.startX);
    const sy0 = q(s.startY);
    const lastSeg = s.segs[s.segs.length - 1];
    for (const g of s.segs) {
      // a closing straight line back to the start is implied by `z`
      if (g === lastSeg && !g.c && q(g.x) === sx0 && q(g.y) === sy0) continue;
      if (g.c) {
        const x1 = q(g.x1) - cx;
        const y1 = q(g.y1) - cy;
        const x2 = q(g.x2) - cx;
        const y2 = q(g.y2) - cy;
        const x = q(g.x) - cx;
        const y = q(g.y) - cy;
        if (x === 0 && y === 0 && x1 === 0 && y1 === 0 && x2 === 0 && y2 === 0) continue;
        push('c', [x1, y1, x2, y2, x, y]);
        cx += x;
        cy += y;
      } else {
        const x = q(g.x) - cx;
        const y = q(g.y) - cy;
        if (x === 0 && y === 0) continue;
        if (y === 0) push('h', [x]);
        else if (x === 0) push('v', [y]);
        else push('l', [x, y]);
        cx += x;
        cy += y;
      }
      segCount++;
    }
    if (segCount < 2) continue; // degenerate sliver
    out += `M${fmtScaled(sx0, precision)} ${fmtScaled(sy0, precision)}` + parts.join('') + 'z';
    nodes += cx === sx0 && cy === sy0 ? segCount : segCount + 1;
    count++;
  }
  return { d: out, shapes: count, nodes };
}

// ---------------------------------------------------------------------------
// Colour quantisation (k-means on a 15-bit histogram)
// ---------------------------------------------------------------------------

export interface Quantized {
  /** k x [r, g, b] */
  palette: [number, number, number][];
  /** one entry per pixel: palette index, or 255 for transparent */
  labels: Uint8Array;
  /** pixels per palette entry */
  counts: number[];
  /**
   * Anti-aliased edge pixels are a blend of two palette colours: `labels` holds the dominant
   * one, `labels2` the other and `weight2` (0..255) the share of the other (never above half).
   */
  labels2: Uint8Array;
  weight2: Uint8Array;
}

export const TRANSPARENT = 255;

/**
 * Reduce an image to at most `k` colours. Seeds are picked weighted-farthest-first (so small but
 * distinct colours such as a logo accent survive), then refined with Lloyd iterations over the
 * 32768-cell colour histogram. Pixels with alpha < 128 get the TRANSPARENT label.
 */
export function quantizeColours(img: RasterImage, k: number): Quantized {
  const n = img.width * img.height;
  const d = img.data;
  const count = new Float64Array(32768);
  const sr = new Float64Array(32768);
  const sg = new Float64Array(32768);
  const sb = new Float64Array(32768);
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (d[o + 3]! < 128) continue;
    const r = d[o]!;
    const g = d[o + 1]!;
    const b = d[o + 2]!;
    const c = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    count[c] = count[c]! + 1;
    sr[c] = sr[c]! + r;
    sg[c] = sg[c]! + g;
    sb[c] = sb[c]! + b;
  }
  const ids: number[] = [];
  for (let c = 0; c < 32768; c++) if (count[c]! > 0) ids.push(c);
  const m = ids.length;
  const w = new Float64Array(m);
  const cr = new Float64Array(m);
  const cg = new Float64Array(m);
  const cb = new Float64Array(m);
  for (let i = 0; i < m; i++) {
    const c = ids[i]!;
    w[i] = count[c]!;
    cr[i] = sr[c]! / w[i]!;
    cg[i] = sg[c]! / w[i]!;
    cb[i] = sb[c]! / w[i]!;
  }
  const labels = new Uint8Array(n).fill(TRANSPARENT);
  const labels2 = new Uint8Array(n).fill(TRANSPARENT);
  const weight2 = new Uint8Array(n);
  if (m === 0) return { palette: [], labels, counts: [], labels2, weight2 };

  const kk = Math.max(1, Math.min(k, m, 64));
  const cx = new Float64Array(kk);
  const cy = new Float64Array(kk);
  const cz = new Float64Array(kk);
  const minD = new Float64Array(m).fill(Infinity);
  let first = 0;
  for (let i = 1; i < m; i++) if (w[i]! > w[first]!) first = i;
  let chosen = 0;
  const addCenter = (i: number) => {
    cx[chosen] = cr[i]!;
    cy[chosen] = cg[i]!;
    cz[chosen] = cb[i]!;
    for (let j = 0; j < m; j++) {
      const dd = (cr[j]! - cr[i]!) ** 2 + (cg[j]! - cg[i]!) ** 2 + (cb[j]! - cb[i]!) ** 2;
      if (dd < minD[j]!) minD[j] = dd;
    }
    chosen++;
  };
  addCenter(first);
  while (chosen < kk) {
    let bi = -1;
    let bv = 0;
    for (let j = 0; j < m; j++) {
      const v = w[j]! * minD[j]!;
      if (v > bv) {
        bv = v;
        bi = j;
      }
    }
    if (bi < 0) break;
    addCenter(bi);
  }

  const assign = new Int32Array(m);
  for (let it = 0; it < 10; it++) {
    const tw = new Float64Array(chosen);
    const tr = new Float64Array(chosen);
    const tg = new Float64Array(chosen);
    const tb = new Float64Array(chosen);
    for (let i = 0; i < m; i++) {
      let best = 0;
      let bd = Infinity;
      for (let j = 0; j < chosen; j++) {
        const dd = (cr[i]! - cx[j]!) ** 2 + (cg[i]! - cy[j]!) ** 2 + (cb[i]! - cz[j]!) ** 2;
        if (dd < bd) {
          bd = dd;
          best = j;
        }
      }
      assign[i] = best;
      tw[best] = tw[best]! + w[i]!;
      tr[best] = tr[best]! + w[i]! * cr[i]!;
      tg[best] = tg[best]! + w[i]! * cg[i]!;
      tb[best] = tb[best]! + w[i]! * cb[i]!;
    }
    let moved = 0;
    for (let j = 0; j < chosen; j++) {
      if (tw[j]! <= 0) continue;
      const nx = tr[j]! / tw[j]!;
      const ny = tg[j]! / tw[j]!;
      const nz = tb[j]! / tw[j]!;
      moved += Math.abs(nx - cx[j]!) + Math.abs(ny - cy[j]!) + Math.abs(nz - cz[j]!);
      cx[j] = nx;
      cy[j] = ny;
      cz[j] = nz;
    }
    if (moved < 0.01) break;
  }

  // final assignment of cells, then of pixels
  const cellLabel = new Int16Array(32768).fill(-1);
  const counts = new Array<number>(chosen).fill(0);
  for (let i = 0; i < m; i++) {
    let best = 0;
    let bd = Infinity;
    for (let j = 0; j < chosen; j++) {
      const dd = (cr[i]! - cx[j]!) ** 2 + (cg[i]! - cy[j]!) ** 2 + (cb[i]! - cz[j]!) ** 2;
      if (dd < bd) {
        bd = dd;
        best = j;
      }
    }
    cellLabel[ids[i]!] = best;
    counts[best] = counts[best]! + w[i]!;
  }
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (d[o + 3]! < 128) continue;
    labels[i] = cellLabel[((d[o]! >> 3) << 10) | ((d[o + 1]! >> 3) << 5) | (d[o + 2]! >> 3)]!;
  }
  const palette: [number, number, number][] = [];
  for (let j = 0; j < chosen; j++) palette.push([Math.round(cx[j]!), Math.round(cy[j]!), Math.round(cz[j]!)]);
  if (chosen > 2) cleanBlendedEdges(img, labels, labels2, weight2, palette);
  const recount = new Array<number>(chosen).fill(0);
  for (let i = 0; i < n; i++) {
    const l = labels[i]!;
    if (l !== TRANSPARENT) recount[l] = recount[l]! + 1;
  }
  return { palette, labels, counts: recount, labels2, weight2 };
}

/**
 * Anti-aliased edges contain blends of two palette colours that k-means may assign to a third,
 * unrelated colour (a green fringe around a dark stroke on white, say). Pixels that are far from
 * their own palette colour are re-assigned to the better end of the best blend between the
 * colours found nearby (pixels that are close to their palette entry vote as "core" pixels).
 */
function cleanBlendedEdges(
  img: RasterImage,
  labels: Uint8Array,
  labels2: Uint8Array,
  weight2: Uint8Array,
  palette: [number, number, number][]
): void {
  const w = img.width;
  const h = img.height;
  const d = img.data;
  const n = w * h;
  const coreSq = 28 * 28;
  const core = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const l = labels[i]!;
    if (l === TRANSPARENT) continue;
    const c = palette[l]!;
    const dr = d[i * 4]! - c[0];
    const dg = d[i * 4 + 1]! - c[1];
    const db = d[i * 4 + 2]! - c[2];
    if (dr * dr + dg * dg + db * db <= coreSq) core[i] = 1;
  }
  const next = labels.slice();
  const cand: number[] = [];
  const R = 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (core[i] || labels[i] === TRANSPARENT) continue;
      cand.length = 0;
      for (let yy = Math.max(0, y - R); yy <= Math.min(h - 1, y + R); yy++) {
        for (let xx = Math.max(0, x - R); xx <= Math.min(w - 1, x + R); xx++) {
          const j = yy * w + xx;
          if (core[j]) {
            const l = labels[j]!;
            if (cand.indexOf(l) < 0) cand.push(l);
          }
        }
      }
      if (cand.length < 2 || cand.length > 6) continue;
      const pr = d[i * 4]!;
      const pg = d[i * 4 + 1]!;
      const pb = d[i * 4 + 2]!;
      let bestRes = Infinity;
      let bestLabel = labels[i]!;
      let otherLabel = TRANSPARENT;
      let otherShare = 0;
      for (let a = 0; a < cand.length; a++) {
        for (let b = a + 1; b < cand.length; b++) {
          const ca = palette[cand[a]!]!;
          const cb = palette[cand[b]!]!;
          const vx = cb[0] - ca[0];
          const vy = cb[1] - ca[1];
          const vz = cb[2] - ca[2];
          const len2 = vx * vx + vy * vy + vz * vz;
          let t = len2 > 0 ? ((pr - ca[0]) * vx + (pg - ca[1]) * vy + (pb - ca[2]) * vz) / len2 : 0;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          const ex = ca[0] + t * vx - pr;
          const ey = ca[1] + t * vy - pg;
          const ez = ca[2] + t * vz - pb;
          const res = ex * ex + ey * ey + ez * ez;
          if (res < bestRes) {
            bestRes = res;
            bestLabel = t < 0.5 ? cand[a]! : cand[b]!;
            otherLabel = t < 0.5 ? cand[b]! : cand[a]!;
            otherShare = t < 0.5 ? t : 1 - t;
          }
        }
      }
      if (bestRes > 48 * 48) continue; // not explained by a blend of nearby colours: leave as is
      next[i] = bestLabel;
      labels2[i] = otherLabel;
      weight2[i] = Math.round(otherShare * 255);
    }
  }
  labels.set(next);
}

// ---------------------------------------------------------------------------
// Tracing orchestration
// ---------------------------------------------------------------------------

export type TraceMode = 'bw' | 'color';

export interface TraceOptions {
  mode: TraceMode;
  /** B/W: luminance cut-off 1-255 (dark < T is ink) or 'auto' for Otsu. */
  threshold?: number | 'auto';
  /** B/W: trace light shapes on a dark ground. */
  invert?: boolean;
  /** Colour: number of colours, 2-16. */
  colors?: number;
  /** Colour: 'stacked' paints cumulative layers (no gaps), 'separate' paints disjoint regions. */
  stacking?: 'stacked' | 'separate';
  /** 0 (coarse, 3 px tolerance) .. 100 (fine, 0.1 px tolerance). */
  detail?: number;
  /** Fit cubic Beziers instead of straight segments. */
  curves?: boolean;
  /** Corner threshold in degrees (curves only). */
  cornerAngle?: number;
  /** Ignore regions and holes smaller than this many px^2. */
  speckle?: number;
  /** Blur passes applied before tracing (0 = none). */
  blur?: number;
  /** Drop the background (B/W: paper; colour: the most common border colour). */
  transparentBg?: boolean;
  ink?: string;
  paper?: string;
  /** Decimals kept in path coordinates (default 2 for small images, else 1). */
  precision?: number;
  /** Size attributes of the produced SVG (default = pixel size of the input). */
  outWidth?: number;
  outHeight?: number;
  /** Return true to abort; traceImage then rejects with Error('cancelled'). */
  shouldCancel?: () => boolean;
}

export interface TraceLayer {
  color: string;
  d: string;
  shapes: number;
  nodes: number;
  holes: number;
}

export interface TraceResult {
  svg: string;
  width: number;
  height: number;
  layers: TraceLayer[];
  /** number of <path> elements */
  paths: number;
  /** number of closed sub-paths (outer shapes + holes) */
  shapes: number;
  nodes: number;
  holes: number;
  /** palette used (colour mode) */
  palette: string[];
  toleranceUsed: number;
  /** B/W mode: the luminance cut-off that was applied (Otsu result when 'auto'). */
  thresholdUsed: number | null;
}

export function toleranceFromDetail(detail: number): number {
  const t = Math.max(0, Math.min(100, detail)) / 100;
  return 0.1 * Math.pow(30, 1 - t);
}

function hex(rgb: [number, number, number]): string {
  return '#' + rgb.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function normHex(s: string | undefined, fallback: string): string {
  if (!s) return fallback;
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s.trim());
  if (!m) return fallback;
  let h = m[1]!.toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return '#' + h;
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

interface LayerSpec {
  color: string;
  contours: Contour[];
}

function layerPath(
  contours: Contour[],
  o: { curves: boolean; tolerance: number; cornerAngle: number; precision: number }
): { d: string; shapes: number; nodes: number; holes: number } {
  const shapes: Shape[] = [];
  for (const c of contours) {
    const s = o.curves
      ? fitContour(c.pts, { tolerance: o.tolerance, cornerAngle: o.cornerAngle })
      : polygonShape(c.pts, o.tolerance, o.cornerAngle);
    if (!s) continue;
    s.hole = c.hole;
    shapes.push(s);
  }
  // outer shapes first, then holes (purely cosmetic: evenodd does not care about order)
  shapes.sort((a, b) => Number(a.hole) - Number(b.hole));
  const holes = shapes.filter((s) => s.hole).length;
  const p = shapesToPath(shapes, o.precision);
  return { d: p.d, shapes: p.shapes, nodes: p.nodes, holes };
}

/** Trace an RGBA image into an SVG document. */
export async function traceImage(
  img: RasterImage,
  opts: TraceOptions,
  onProgress?: (done: number, total: number, label: string) => void
): Promise<TraceResult> {
  const w = img.width;
  const h = img.height;
  if (!(w > 0 && h > 0) || img.data.length < w * h * 4) throw new Error('The image has no pixels to trace.');
  const detail = opts.detail ?? 60;
  const tolerance = toleranceFromDetail(detail);
  const curves = opts.curves ?? true;
  const cornerAngle = opts.cornerAngle ?? 55;
  const speckle = Math.max(0, opts.speckle ?? 4);
  const precision = opts.precision ?? (Math.max(w, h) <= 256 ? 2 : 1);
  const fitOpts = { curves, tolerance, cornerAngle, precision };
  const specs: LayerSpec[] = [];
  const palette: string[] = [];
  let thresholdUsed: number | null = null;
  const checkCancel = () => {
    if (opts.shouldCancel?.()) throw new Error('cancelled');
  };

  if (opts.mode === 'bw') {
    const invert = !!opts.invert;
    const { field, hist } = inkField(img, invert);
    const T = opts.threshold === undefined || opts.threshold === 'auto' ? otsuThreshold(hist) : Math.max(1, Math.min(255, opts.threshold));
    thresholdUsed = T;
    const level = inkLevel(T, invert);
    blurField(field, w, h, opts.blur ?? 0);
    onProgress?.(0, 1, 'Tracing');
    const contours = removeSpeckles(contoursFromField(field, w, h, level), speckle);
    specs.push({ color: normHex(opts.ink, '#000000'), contours });
    if (!opts.transparentBg) {
      // paper is painted as the bottom layer below
      palette.push(normHex(opts.paper, '#ffffff'));
    }
    palette.push(normHex(opts.ink, '#000000'));
  } else {
    const k = Math.max(2, Math.min(16, Math.round(opts.colors ?? 6)));
    onProgress?.(0, 1, 'Reducing colours');
    await tick();
    checkCancel();
    const q = quantizeColours(img, k);
    const kk = q.palette.length;
    const { labels } = q;
    // background = most common colour along the border
    let bgLabel = -1;
    if (kk > 0) {
      const edge = new Array<number>(kk).fill(0);
      let transparentEdge = 0;
      const bump = (i: number) => {
        const l = labels[i]!;
        if (l === TRANSPARENT) transparentEdge++;
        else edge[l] = edge[l]! + 1;
      };
      for (let x = 0; x < w; x++) {
        bump(x);
        bump((h - 1) * w + x);
      }
      for (let y = 1; y < h - 1; y++) {
        bump(y * w);
        bump(y * w + w - 1);
      }
      let best = 0;
      for (let j = 1; j < kk; j++) if (edge[j]! > edge[best]!) best = j;
      if (edge[best]! > transparentEdge) bgLabel = best;
    }
    const dropBg = !!opts.transparentBg && bgLabel >= 0;
    // draw order: background first (when kept), then by area, largest first
    const order = Array.from({ length: kk }, (_, i) => i)
      .filter((i) => !(dropBg && i === bgLabel))
      .sort((a, b) => {
        if (a === bgLabel) return -1;
        if (b === bgLabel) return 1;
        return q.counts[b]! - q.counts[a]!;
      });
    const stacked = (opts.stacking ?? 'stacked') === 'stacked';
    const passes = opts.blur ?? 0;
    const margin = passes + 2;

    for (let li = 0; li < order.length; li++) {
      onProgress?.(li, order.length, 'Tracing colour layers');
      await tick();
      checkCancel();
      const member = new Uint8Array(kk);
      if (stacked) for (let j = li; j < order.length; j++) member[order[j]!] = 1;
      else member[order[li]!] = 1;
      let minX = w;
      let minY = h;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const l = labels[y * w + x]!;
          if (l !== TRANSPARENT && member[l]) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
      if (maxX < 0) continue;
      const x0 = Math.max(0, minX - margin);
      const y0 = Math.max(0, minY - margin);
      const x1 = Math.min(w, maxX + 1 + margin);
      const y1 = Math.min(h, maxY + 1 + margin);
      const lw = x1 - x0;
      const lh = y1 - y0;
      const local = new Float32Array(lw * lh);
      for (let y = 0; y < lh; y++) {
        for (let x = 0; x < lw; x++) {
          const gi = (y0 + y) * w + x0 + x;
          const l = labels[gi]!;
          if (l === TRANSPARENT) continue;
          const l2 = q.labels2[gi]!;
          const w2 = l2 !== TRANSPARENT ? q.weight2[gi]! / 255 : 0;
          local[y * lw + x] = (member[l] ? 1 - w2 : 0) + (l2 !== TRANSPARENT && member[l2] ? w2 : 0);
        }
      }
      blurField(local, lw, lh, passes);
      const contours = removeSpeckles(contoursFromField(local, lw, lh, 0.5, x0, y0), speckle);
      const col = hex(q.palette[order[li]!]!);
      specs.push({ color: col, contours });
      palette.push(col);
    }
  }

  // ---- fit + assemble ----
  const layers: TraceLayer[] = [];
  let svgBody = '';
  const paperColor = normHex(opts.paper, '#ffffff');
  if (opts.mode === 'bw' && !opts.transparentBg) {
    svgBody += `<rect width="${w}" height="${h}" fill="${paperColor}"/>`;
  }
  for (let i = 0; i < specs.length; i++) {
    onProgress?.(i, specs.length, 'Fitting curves');
    if (i % 2 === 1) await tick();
    checkCancel();
    const spec = specs[i]!;
    const lp = layerPath(spec.contours, fitOpts);
    if (lp.shapes === 0) continue;
    layers.push({ color: spec.color, d: lp.d, shapes: lp.shapes, nodes: lp.nodes, holes: lp.holes });
    svgBody += `<path fill="${spec.color}" fill-rule="evenodd" d="${lp.d}"/>`;
  }
  const ow = opts.outWidth ?? w;
  const oh = opts.outHeight ?? h;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${ow}" height="${oh}" viewBox="0 0 ${w} ${h}">` + svgBody + '</svg>';
  return {
    svg,
    width: w,
    height: h,
    layers,
    paths: layers.length,
    shapes: layers.reduce((s, l) => s + l.shapes, 0),
    nodes: layers.reduce((s, l) => s + l.nodes, 0),
    holes: layers.reduce((s, l) => s + l.holes, 0),
    palette,
    toleranceUsed: tolerance,
    thresholdUsed,
  };
}
