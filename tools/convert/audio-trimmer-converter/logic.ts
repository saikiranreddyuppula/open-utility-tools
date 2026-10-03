/**
 * Audio editing maths, resampling, WAV writer, waveform peaks and container sniffing.
 * Pure TypeScript (no DOM / Web Audio) so it can be unit-tested with bun.
 */

export type Channels = Float32Array[];
export type BitDepth = 16 | 24 | 32;

/* ------------------------------------------------------------------ */
/* Time helpers                                                        */
/* ------------------------------------------------------------------ */

/** Seconds -> "m:ss.mmm" (or "h:mm:ss.mmm" from one hour up). */
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds * 1000));
  const ms = total % 1000;
  const s = Math.floor(total / 1000) % 60;
  const m = Math.floor(total / 60000) % 60;
  const h = Math.floor(total / 3600000);
  const mmm = String(ms).padStart(3, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${ss}.${mmm}`;
  return `${m}:${ss}.${mmm}`;
}

/** "1:23.456", "01:02:03.5", "83.4" or "83.4s" -> seconds. Returns null if unparsable. */
export function parseClock(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/,/g, '.').replace(/s$/, '');
  if (!s) return null;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(s);
  if (!m) return null;
  const sec = Number(m[3]);
  if (sec >= 60) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + sec;
}

/* ------------------------------------------------------------------ */
/* Sample maths                                                        */
/* ------------------------------------------------------------------ */

export function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

export function gainToDb(gain: number): number {
  return gain > 0 ? 20 * Math.log10(gain) : -Infinity;
}

export function peakOf(ch: Channels): number {
  let peak = 0;
  for (const c of ch) {
    for (let i = 0; i < c.length; i++) {
      const v = Math.abs(c[i] ?? 0);
      if (v > peak) peak = v;
    }
  }
  return peak;
}

/** Linear gain that brings `peak` to `targetDb` dBFS. 1 for silence. */
export function normalizeGain(peak: number, targetDb = -1): number {
  if (!(peak > 0)) return 1;
  return dbToGain(targetDb) / peak;
}

/** Copy of frames [startFrame, endFrame) of every channel (indices clamped). */
export function sliceChannels(ch: Channels, startFrame: number, endFrame: number): Channels {
  return ch.map((c) => {
    const a = Math.max(0, Math.min(c.length, Math.floor(startFrame)));
    const b = Math.max(a, Math.min(c.length, Math.floor(endFrame)));
    return c.slice(a, b);
  });
}

/** Average all channels into one. */
export function mixToMono(ch: Channels): Channels {
  const first = ch[0];
  if (!first) return [];
  if (ch.length === 1) return [first.slice()];
  const out = new Float32Array(first.length);
  const n = ch.length;
  for (let i = 0; i < out.length; i++) {
    let sum = 0;
    for (let c = 0; c < n; c++) sum += ch[c]?.[i] ?? 0;
    out[i] = sum / n;
  }
  return [out];
}

export function reverseChannels(ch: Channels): Channels {
  return ch.map((c) => c.slice().reverse());
}

/** In-place gain. */
export function applyGain(ch: Channels, gain: number): void {
  if (gain === 1) return;
  for (const c of ch) for (let i = 0; i < c.length; i++) c[i] = (c[i] ?? 0) * gain;
}

/**
 * In-place linear fades. Fade-in gain at frame i is i/F; fade-out gain at the frame j
 * positions from the end is j/F, so the very first and last frames are silent.
 */
export function applyFades(ch: Channels, sampleRate: number, fadeInMs: number, fadeOutMs: number): void {
  for (const c of ch) {
    const n = c.length;
    const fin = Math.min(n, Math.max(0, Math.round((fadeInMs / 1000) * sampleRate)));
    const fout = Math.min(n, Math.max(0, Math.round((fadeOutMs / 1000) * sampleRate)));
    for (let i = 0; i < fin; i++) c[i] = (c[i] ?? 0) * (i / fin);
    for (let j = 0; j < fout; j++) {
      const idx = n - 1 - j;
      c[idx] = (c[idx] ?? 0) * (j / fout);
    }
  }
}

export interface EditOptions {
  startFrame: number;
  endFrame: number;
  mono: boolean;
  reverse: boolean;
  fadeInMs: number;
  fadeOutMs: number;
  normalize: boolean;
  normalizeDb: number;
  gainDb: number;
}

/** Stage 1: cut the selection out, optional mono mix-down and reversal. Never mutates the source. */
export function prepareSegment(src: Channels, o: Pick<EditOptions, 'startFrame' | 'endFrame' | 'mono' | 'reverse'>): Channels {
  let seg = sliceChannels(src, o.startFrame, o.endFrame);
  if (o.mono && seg.length > 1) seg = mixToMono(seg);
  if (o.reverse) {
    for (const c of seg) c.reverse();
  }
  return seg;
}

/** Stage 2 (in place, after any resampling): fades, then gain or peak normalisation. */
export function finishSegment(
  seg: Channels,
  sampleRate: number,
  o: Pick<EditOptions, 'fadeInMs' | 'fadeOutMs' | 'normalize' | 'normalizeDb' | 'gainDb'>
): { gain: number; peakOut: number } {
  applyFades(seg, sampleRate, o.fadeInMs, o.fadeOutMs);
  const gain = o.normalize ? normalizeGain(peakOf(seg), o.normalizeDb) : dbToGain(o.gainDb);
  applyGain(seg, gain);
  return { gain, peakOut: peakOf(seg) };
}

/* ------------------------------------------------------------------ */
/* WAV writer                                                          */
/* ------------------------------------------------------------------ */

export function wavBytesPerSample(depth: BitDepth): number {
  return depth / 8;
}

const MAX_RIFF = 0xffffffff - 4096;

function channelMask(n: number): number {
  switch (n) {
    case 1:
      return 0x4;
    case 2:
      return 0x3;
    case 3:
      return 0x7;
    case 4:
      return 0x33;
    case 5:
      return 0x37;
    case 6:
      return 0x3f;
    case 8:
      return 0x63f;
    default:
      return n >= 31 ? 0 : (1 << n) - 1;
  }
}

/** Header size for the layout encodeWav() will choose. */
export function wavHeaderSize(channels: number, depth: BitDepth): number {
  const extensible = channels > 2;
  const fmt = extensible ? 40 : depth === 32 ? 18 : 16;
  const fact = depth === 32 ? 12 : 0;
  return 12 + (8 + fmt) + fact + 8;
}

export function wavFileSize(frames: number, channels: number, depth: BitDepth): number {
  const data = frames * channels * wavBytesPerSample(depth);
  return wavHeaderSize(channels, depth) + data + (data % 2);
}

export interface WavOptions {
  /** TPDF dither before rounding to 16 bit. */
  dither?: boolean;
  /** Uniform [0,1) source for dither (defaults to Math.random). */
  random?: () => number;
}

/**
 * RIFF/WAVE writer. 16 and 24 bit are integer PCM (format 1), 32 bit is IEEE float
 * (format 3, with the 'fact' chunk). More than two channels use WAVE_FORMAT_EXTENSIBLE.
 */
export function encodeWav(channels: Channels, sampleRate: number, depth: BitDepth, opts: WavOptions = {}): Uint8Array {
  const nch = channels.length;
  if (nch < 1) throw new Error('No audio channels to encode.');
  if (nch > 32) throw new Error('At most 32 channels are supported.');
  const frames = channels[0]?.length ?? 0;
  for (const c of channels) if (c.length !== frames) throw new Error('Channels have different lengths.');
  if (!Number.isInteger(sampleRate) || sampleRate < 1) throw new Error('Invalid sample rate.');
  const bps = wavBytesPerSample(depth);
  const dataBytes = frames * nch * bps;
  if (dataBytes + 128 > MAX_RIFF) throw new Error('The result would exceed the 4 GB limit of the WAV format. Select a shorter range.');

  const extensible = nch > 2;
  const isFloat = depth === 32;
  const fmtSize = extensible ? 40 : isFloat ? 18 : 16;
  const header = wavHeaderSize(nch, depth);
  const pad = dataBytes % 2;
  const total = header + dataBytes + pad;
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  const ascii = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i++) out[off + i] = s.charCodeAt(i);
  };

  ascii(0, 'RIFF');
  dv.setUint32(4, total - 8, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  dv.setUint32(16, fmtSize, true);
  dv.setUint16(20, extensible ? 0xfffe : isFloat ? 3 : 1, true);
  dv.setUint16(22, nch, true);
  dv.setUint32(24, sampleRate, true);
  dv.setUint32(28, sampleRate * nch * bps, true);
  dv.setUint16(32, nch * bps, true);
  dv.setUint16(34, depth, true);
  let p = 36;
  if (fmtSize >= 18) {
    dv.setUint16(p, extensible ? 22 : 0, true);
    p += 2;
  }
  if (extensible) {
    dv.setUint16(p, depth, true);
    dv.setUint32(p + 2, channelMask(nch), true);
    // KSDATAFORMAT_SUBTYPE_PCM / _IEEE_FLOAT: {0000000x-0000-0010-8000-00aa00389b71}
    dv.setUint16(p + 6, isFloat ? 3 : 1, true);
    const tail = [0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71];
    tail.forEach((b, i) => {
      out[p + 8 + i] = b;
    });
    p += 22;
  }
  if (isFloat) {
    ascii(p, 'fact');
    dv.setUint32(p + 4, 4, true);
    dv.setUint32(p + 8, frames, true);
    p += 12;
  }
  ascii(p, 'data');
  dv.setUint32(p + 4, dataBytes, true);
  p += 8;

  const rnd = opts.random ?? Math.random;
  const dither = depth === 16 && opts.dither === true;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < nch; c++) {
      const s = channels[c]?.[i] ?? 0;
      if (depth === 32) {
        dv.setFloat32(p, s, true);
      } else if (depth === 16) {
        // x * 2^(n-1), the inverse of what decoders do (int / 2^(n-1)), so WAV -> float -> WAV is bit exact.
        let v = s * 32768;
        if (dither) v += rnd() - rnd();
        v = Math.round(v);
        dv.setInt16(p, v > 32767 ? 32767 : v < -32768 ? -32768 : v, true);
      } else {
        let v = Math.round(s * 8388608);
        v = v > 8388607 ? 8388607 : v < -8388608 ? -8388608 : v;
        out[p] = v & 0xff;
        out[p + 1] = (v >> 8) & 0xff;
        out[p + 2] = (v >> 16) & 0xff;
      }
      p += bps;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Waveform peaks                                                      */
/* ------------------------------------------------------------------ */

export interface Peaks {
  min: Float32Array;
  max: Float32Array;
}

/** Min/max over `buckets` equal slices of frames [startFrame, endFrame), all channels combined. */
export function computePeaks(ch: Channels, startFrame: number, endFrame: number, buckets: number): Peaks {
  const first = ch[0];
  const total = first?.length ?? 0;
  const a = Math.max(0, Math.min(total, Math.floor(startFrame)));
  const b = Math.max(a, Math.min(total, Math.floor(endFrame)));
  const n = Math.max(1, Math.floor(buckets));
  const min = new Float32Array(n);
  const max = new Float32Array(n);
  const len = b - a;
  if (len <= 0) return { min, max };
  for (let k = 0; k < n; k++) {
    const i0 = a + Math.floor((k * len) / n);
    let i1 = a + Math.floor(((k + 1) * len) / n);
    if (i1 <= i0) i1 = Math.min(b, i0 + 1);
    let lo = Infinity;
    let hi = -Infinity;
    for (const c of ch) {
      for (let i = i0; i < i1; i++) {
        const v = c[i] ?? 0;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
    min[k] = lo === Infinity ? 0 : lo;
    max[k] = hi === -Infinity ? 0 : hi;
  }
  return { min, max };
}

/** Collapse (or stretch) precomputed buckets to `cols` drawing columns. */
export function peaksToColumns(p: Peaks, cols: number): Peaks {
  const n = p.min.length;
  const c = Math.max(1, Math.floor(cols));
  const min = new Float32Array(c);
  const max = new Float32Array(c);
  for (let x = 0; x < c; x++) {
    const b0 = Math.floor((x * n) / c);
    let b1 = Math.floor(((x + 1) * n) / c);
    if (b1 <= b0) b1 = Math.min(n, b0 + 1);
    let lo = Infinity;
    let hi = -Infinity;
    for (let b = b0; b < b1; b++) {
      const l = p.min[b] ?? 0;
      const h = p.max[b] ?? 0;
      if (l < lo) lo = l;
      if (h > hi) hi = h;
    }
    min[x] = lo === Infinity ? 0 : lo;
    max[x] = hi === -Infinity ? 0 : hi;
  }
  return { min, max };
}

/* ------------------------------------------------------------------ */
/* Resampling (windowed-sinc, exact rational polyphase)               */
/* ------------------------------------------------------------------ */

function gcd(a: number, b: number): number {
  let x = a;
  let y = b;
  while (y) [x, y] = [y, x % y];
  return x;
}

function bessel0(x: number): number {
  let sum = 1;
  let term = 1;
  const q = (x * x) / 4;
  for (let k = 1; k < 60; k++) {
    term *= q / (k * k);
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
}

export interface ResamplePlan {
  from: number;
  to: number;
  /** output step, in input samples, is M/L */
  M: number;
  L: number;
  half: number;
  taps: number;
  kernels: Float32Array;
}

const KAISER_BETA = 9;
const SINC_ZEROS = 16;
const CUTOFF_MARGIN = 0.93;

export function makeResamplePlan(from: number, to: number): ResamplePlan {
  const g = gcd(from, to);
  const L = to / g;
  const M = from / g;
  const c = Math.min(1, to / from) * CUTOFF_MARGIN;
  const half = Math.max(2, Math.ceil(SINC_ZEROS / c));
  const taps = half * 2;
  const kernels = new Float32Array(L * taps);
  const i0b = bessel0(KAISER_BETA);
  for (let p = 0; p < L; p++) {
    const frac = p / L;
    let sum = 0;
    const row = p * taps;
    for (let k = 0; k < taps; k++) {
      const t = k - half + 1 - frac;
      const u = t / half;
      const w = Math.abs(u) < 1 ? bessel0(KAISER_BETA * Math.sqrt(1 - u * u)) / i0b : 0;
      const x = Math.PI * c * t;
      const s = Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x;
      const v = c * s * w;
      kernels[row + k] = v;
      sum += v;
    }
    for (let k = 0; k < taps; k++) kernels[row + k] = (kernels[row + k] ?? 0) / sum;
  }
  return { from, to, M, L, half, taps, kernels };
}

export function resampledLength(frames: number, from: number, to: number): number {
  return Math.max(1, Math.round((frames * to) / from));
}

/** Compute output frames [outStart, outEnd) into `out` (so callers can chunk and yield). */
export function resampleRange(plan: ResamplePlan, input: Float32Array, outStart: number, outEnd: number, out: Float32Array): void {
  const { M, L, half, taps, kernels } = plan;
  const n = input.length;
  for (let j = outStart; j < outEnd; j++) {
    const num = j * M;
    const phase = num % L;
    const n0 = (num - phase) / L;
    const base = n0 - half + 1;
    const row = phase * taps;
    let acc = 0;
    if (base >= 0 && base + taps <= n) {
      for (let k = 0; k < taps; k++) acc += (input[base + k] ?? 0) * (kernels[row + k] ?? 0);
    } else {
      for (let k = 0; k < taps; k++) {
        const idx = base + k;
        if (idx >= 0 && idx < n) acc += (input[idx] ?? 0) * (kernels[row + k] ?? 0);
      }
    }
    out[j] = acc;
  }
}

export function resample(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input.slice();
  const plan = makeResamplePlan(from, to);
  const out = new Float32Array(resampledLength(input.length, from, to));
  resampleRange(plan, input, 0, out.length, out);
  return out;
}

/* ------------------------------------------------------------------ */
/* Container sniffing (native sample rate)                             */
/* ------------------------------------------------------------------ */

export interface Sniffed {
  container: string;
  sampleRate: number | null;
}

const ADTS_RATES = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
const MPEG_RATES: Record<number, number[]> = {
  3: [44100, 48000, 32000],
  2: [22050, 24000, 16000],
  0: [11025, 12000, 8000],
};

function ascii4(b: Uint8Array, off: number): string {
  return String.fromCharCode(b[off] ?? 0, b[off + 1] ?? 0, b[off + 2] ?? 0, b[off + 3] ?? 0);
}

function u32be(b: Uint8Array, off: number): number {
  return ((b[off] ?? 0) * 16777216) + ((b[off + 1] ?? 0) << 16) + ((b[off + 2] ?? 0) << 8) + (b[off + 3] ?? 0);
}

function u32le(b: Uint8Array, off: number): number {
  return (b[off] ?? 0) + ((b[off + 1] ?? 0) << 8) + ((b[off + 2] ?? 0) << 16) + (b[off + 3] ?? 0) * 16777216;
}

function sniffWav(b: Uint8Array): number | null {
  let p = 12;
  while (p + 8 <= b.length) {
    const id = ascii4(b, p);
    const size = u32le(b, p + 4);
    if (id === 'fmt ') return u32le(b, p + 12);
    p += 8 + size + (size % 2);
  }
  return null;
}

function mp4Boxes(b: Uint8Array, start: number, end: number): { type: string; off: number; size: number }[] {
  const out: { type: string; off: number; size: number }[] = [];
  let p = start;
  while (p + 8 <= end) {
    let size = u32be(b, p);
    const type = ascii4(b, p + 4);
    if (size === 1) size = u32be(b, p + 12);
    if (size === 0) size = end - p;
    if (size < 8 || p + size > end) break;
    out.push({ type, off: p, size });
    p += size;
  }
  return out;
}

function sniffMp4(b: Uint8Array): number | null {
  const find = (start: number, end: number, type: string) => mp4Boxes(b, start, end).find((x) => x.type === type);
  const moov = find(0, b.length, 'moov');
  if (!moov) return null;
  for (const trak of mp4Boxes(b, moov.off + 8, moov.off + moov.size).filter((x) => x.type === 'trak')) {
    const mdia = find(trak.off + 8, trak.off + trak.size, 'mdia');
    if (!mdia) continue;
    const hdlr = find(mdia.off + 8, mdia.off + mdia.size, 'hdlr');
    if (!hdlr || ascii4(b, hdlr.off + 16) !== 'soun') continue;
    const minf = find(mdia.off + 8, mdia.off + mdia.size, 'minf');
    const stbl = minf && find(minf.off + 8, minf.off + minf.size, 'stbl');
    const stsd = stbl && find(stbl.off + 8, stbl.off + stbl.size, 'stsd');
    if (!stsd) continue;
    const entry = stsd.off + 16;
    const rate = ((b[entry + 32] ?? 0) << 8) | (b[entry + 33] ?? 0);
    if (rate > 0) return rate;
  }
  return null;
}

function sniffOgg(b: Uint8Array): number | null {
  const nseg = b[26] ?? 0;
  const pkt = 27 + nseg;
  if (ascii4(b, pkt + 1) === 'vorb') return u32le(b, pkt + 12);
  if (ascii4(b, pkt) === 'Opus') return 48000;
  return null;
}

function sniffFlac(b: Uint8Array): number | null {
  const o = 8;
  return ((b[o + 10] ?? 0) << 12) | ((b[o + 11] ?? 0) << 4) | ((b[o + 12] ?? 0) >> 4);
}

function sniffMpegFrames(b: Uint8Array): { container: string; sampleRate: number } | null {
  let p = 0;
  if (ascii4(b, 0).startsWith('ID3')) {
    p = 10 + (((b[6] ?? 0) & 0x7f) << 21) + (((b[7] ?? 0) & 0x7f) << 14) + (((b[8] ?? 0) & 0x7f) << 7) + ((b[9] ?? 0) & 0x7f);
  }
  const limit = Math.min(b.length - 4, p + 262144);
  for (; p < limit; p++) {
    if (b[p] !== 0xff) continue;
    const b1 = b[p + 1] ?? 0;
    const b2 = b[p + 2] ?? 0;
    if ((b1 & 0xf6) === 0xf0) {
      const rate = ADTS_RATES[(b2 >> 2) & 0xf];
      if (rate) return { container: 'aac', sampleRate: rate };
    } else if ((b1 & 0xe0) === 0xe0 && ((b1 >> 1) & 3) !== 0) {
      const ver = (b1 >> 3) & 3;
      const bitrate = (b2 >> 4) & 0xf;
      const rate = MPEG_RATES[ver]?.[(b2 >> 2) & 3];
      if (rate && bitrate !== 0xf && bitrate !== 0) return { container: 'mp3', sampleRate: rate };
    }
  }
  return null;
}

function sniffMatroska(b: Uint8Array): number | null {
  const limit = Math.min(b.length, 1 << 20);
  const text = new TextDecoder('latin1').decode(b.subarray(0, limit));
  if (text.includes('A_OPUS')) return 48000;
  const codec = text.search(/A_(VORBIS|AAC|MPEG|FLAC|PCM|AC3|EAC3)/);
  const from = codec >= 0 ? codec : 0;
  for (let i = from; i < Math.min(limit - 10, from + 1024); i++) {
    if (b[i] !== 0xb5) continue;
    const len = b[i + 1];
    if (len !== 0x84 && len !== 0x88) continue;
    const dv = new DataView(b.buffer, b.byteOffset + i + 2, len === 0x84 ? 4 : 8);
    const v = len === 0x84 ? dv.getFloat32(0, false) : dv.getFloat64(0, false);
    if (v >= 8000 && v <= 192000) return Math.round(v);
  }
  return null;
}

/** Best-effort native sample rate of an encoded audio/video file. null when unknown. */
export function sniffAudio(b: Uint8Array): Sniffed {
  if (b.length < 16) return { container: 'unknown', sampleRate: null };
  const head = ascii4(b, 0);
  if (head === 'RIFF' && ascii4(b, 8) === 'WAVE') return { container: 'wav', sampleRate: sniffWav(b) };
  if (head === 'fLaC') return { container: 'flac', sampleRate: sniffFlac(b) };
  if (head === 'OggS') return { container: 'ogg', sampleRate: sniffOgg(b) };
  if (ascii4(b, 4) === 'ftyp') {
    const r = sniffMp4(b);
    // HE-AAC signals the core rate in 'stsd' but decodes at twice that.
    return { container: 'mp4', sampleRate: r !== null && r < 32000 ? r * 2 : r };
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return { container: 'webm', sampleRate: sniffMatroska(b) };
  const f = sniffMpegFrames(b);
  if (f) return { container: f.container, sampleRate: f.container === 'aac' && f.sampleRate < 32000 ? f.sampleRate * 2 : f.sampleRate };
  return { container: 'unknown', sampleRate: null };
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function decodedBytes(frames: number, channels: number): number {
  return frames * channels * 4;
}

export function outputName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName).trim() || 'audio';
  return `${base}-trimmed.wav`;
}

/** Peak |sample| over frames [startFrame, endFrame), optionally of the mono mix-down. */
export function peakInRange(ch: Channels, startFrame: number, endFrame: number, mono: boolean): number {
  const first = ch[0];
  if (!first) return 0;
  const a = Math.max(0, Math.floor(startFrame));
  const b = Math.min(first.length, Math.floor(endFrame));
  let peak = 0;
  if (mono && ch.length > 1) {
    const n = ch.length;
    for (let i = a; i < b; i++) {
      let sum = 0;
      for (let c = 0; c < n; c++) sum += ch[c]?.[i] ?? 0;
      const v = Math.abs(sum / n);
      if (v > peak) peak = v;
    }
    return peak;
  }
  for (const c of ch) {
    for (let i = a; i < b; i++) {
      const v = Math.abs(c[i] ?? 0);
      if (v > peak) peak = v;
    }
  }
  return peak;
}
