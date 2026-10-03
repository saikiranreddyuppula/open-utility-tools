/**
 * QR Code encoder (ISO/IEC 18004, model 2): versions 1-40, numeric / alphanumeric / byte
 * modes (UTF-8, optional ECI), error correction L/M/Q/H, Reed-Solomon over GF(256),
 * all 8 masks with penalty scoring, BCH format & version information.
 *
 * Plus payload builders (Wi-Fi, vCard, mailto, ...) and SVG / path rendering helpers.
 * Framework-free so it can be unit-tested with bun.
 */

export type EcLevel = 'L' | 'M' | 'Q' | 'H';
export type QrMode = 'numeric' | 'alphanumeric' | 'byte';

export const EC_LEVELS: readonly EcLevel[] = ['L', 'M', 'Q', 'H'];

const ECL_INDEX: Record<EcLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };
/** 2-bit codes placed in the format information (L=01, M=00, Q=11, H=10). */
const ECL_FORMAT_BITS: Record<EcLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

/** Error-correction codewords per block, indexed [ecl][version] (index 0 unused). */
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

/** Number of error-correction blocks, indexed [ecl][version] (index 0 unused). */
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

export const ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

export const MIN_VERSION = 1;
export const MAX_VERSION = 40;

// ---------------------------------------------------------------------------
// GF(256) arithmetic, primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D)
// ---------------------------------------------------------------------------

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]!;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[GF_LOG[a]! + GF_LOG[b]!]!;
}

/** Coefficients (highest degree first, leading 1 omitted) of prod_{i<degree} (x - 2^i). */
function rsGeneratorPoly(degree: number): number[] {
  const result: number[] = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < degree) result[j] = result[j]! ^ result[j + 1]!;
    }
    root = gfMul(root, 2);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result: number[] = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    for (let i = 0; i < divisor.length; i++) result[i] = result[i]! ^ gfMul(divisor[i]!, factor);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Capacity helpers
// ---------------------------------------------------------------------------

function alignmentPositions(version: number): number[] {
  if (version === 1) return [];
  const numAlign = Math.floor(version / 7) + 2;
  const size = version * 4 + 17;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (numAlign * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

/** Number of data+EC bits available in a symbol (all modules that are not function patterns). */
function numRawDataModules(version: number): number {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const numAlign = Math.floor(version / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

export function numDataCodewords(version: number, ecl: EcLevel): number {
  const e = ECL_INDEX[ecl];
  return (
    Math.floor(numRawDataModules(version) / 8) -
    ECC_CODEWORDS_PER_BLOCK[e]![version]! * NUM_ERROR_CORRECTION_BLOCKS[e]![version]!
  );
}

function charCountBits(mode: QrMode, version: number): number {
  const range = version <= 9 ? 0 : version <= 26 ? 1 : 2;
  switch (mode) {
    case 'numeric':
      return [10, 12, 14][range]!;
    case 'alphanumeric':
      return [9, 11, 13][range]!;
    case 'byte':
      return [8, 16, 16][range]!;
  }
}

/** Payload bit length (excluding mode indicator / count field) of `count` characters or bytes. */
function dataBitLength(mode: QrMode, count: number): number {
  switch (mode) {
    case 'numeric':
      return Math.floor(count / 3) * 10 + (count % 3 === 0 ? 0 : count % 3 === 1 ? 4 : 7);
    case 'alphanumeric':
      return Math.floor(count / 2) * 11 + (count % 2) * 6;
    case 'byte':
      return count * 8;
  }
}

/** Largest character/byte count of `mode` that fits in version/ecl (considering an ECI header). */
export function maxCharsFor(mode: QrMode, version: number, ecl: EcLevel, eci = false): number {
  const capBits = numDataCodewords(version, ecl) * 8;
  const overhead = (eci ? 12 : 0) + 4 + charCountBits(mode, version);
  let lo = 0;
  let hi = 8000;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (overhead + dataBitLength(mode, mid) <= capBits) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function detectMode(text: string): QrMode {
  if (/^[0-9]*$/.test(text)) return 'numeric';
  for (const ch of text) if (ALPHANUMERIC_CHARSET.indexOf(ch) < 0) return 'byte';
  return 'alphanumeric';
}

// ---------------------------------------------------------------------------
// Encoder
// ---------------------------------------------------------------------------

export interface QrOptions {
  ecl?: EcLevel;
  /** Smallest version to consider (default 1). */
  minVersion?: number;
  /** Largest version to consider (default 40). */
  maxVersion?: number;
  /** Force a mode ('auto' picks the most compact single mode). */
  mode?: 'auto' | QrMode;
  /** Emit an ECI header declaring UTF-8 (only for byte mode). */
  eci?: boolean;
  /** Force a mask 0-7 (default: lowest penalty). */
  mask?: number;
  /** Raise the EC level while the data still fits in the chosen version. */
  boostEcl?: boolean;
}

export interface QrCode {
  version: number;
  size: number;
  ecl: EcLevel;
  mode: QrMode;
  mask: number;
  eci: boolean;
  /** size*size, row-major, 1 = dark module. */
  modules: Uint8Array;
  /** size*size, 1 = function pattern (finder, timing, alignment, format, version). */
  isFunction: Uint8Array;
  /** Data codewords (before EC, after padding). */
  dataCodewords: number[];
  /** EC codewords concatenated block by block (before interleaving). */
  eccCodewords: number[];
  /** Final interleaved codeword sequence. */
  codewords: number[];
  /** Bits used by mode indicator(s), count field and payload (excl. terminator/padding). */
  usedBits: number;
  /** Total data capacity in bits for the chosen version / ecl. */
  capacityBits: number;
  /** Number of payload bytes (UTF-8) or characters. */
  charCount: number;
}

function appendBits(bb: number[], val: number, len: number): void {
  for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1);
}

function encodePayload(bb: number[], text: string, bytes: Uint8Array, mode: QrMode): void {
  switch (mode) {
    case 'numeric': {
      for (let i = 0; i < text.length; ) {
        const n = Math.min(3, text.length - i);
        appendBits(bb, parseInt(text.substr(i, n), 10), n * 3 + 1);
        i += n;
      }
      return;
    }
    case 'alphanumeric': {
      let i = 0;
      for (; i + 2 <= text.length; i += 2) {
        const v =
          ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)) * 45 +
          ALPHANUMERIC_CHARSET.indexOf(text.charAt(i + 1));
        appendBits(bb, v, 11);
      }
      if (i < text.length) appendBits(bb, ALPHANUMERIC_CHARSET.indexOf(text.charAt(i)), 6);
      return;
    }
    case 'byte': {
      for (const b of bytes) appendBits(bb, b, 8);
      return;
    }
  }
}

function addEccAndInterleave(
  data: readonly number[],
  version: number,
  ecl: EcLevel
): { ecc: number[]; all: number[] } {
  const e = ECL_INDEX[ecl];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e]![version]!;
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e]![version]!;
  const rawCodewords = Math.floor(numRawDataModules(version) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  const eccBlocks: number[][] = [];
  const divisor = rsGeneratorPoly(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, divisor);
    eccBlocks.push(ecc);
    if (i < numShortBlocks) dat.push(0); // placeholder so all blocks line up; skipped below
    blocks.push(dat.concat(ecc));
  }

  const all: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) all.push(block[i]!);
    });
  }
  return { ecc: eccBlocks.flat(), all };
}

class Grid {
  readonly size: number;
  readonly modules: Uint8Array;
  readonly isFunction: Uint8Array;

  constructor(readonly version: number) {
    this.size = version * 4 + 17;
    this.modules = new Uint8Array(this.size * this.size);
    this.isFunction = new Uint8Array(this.size * this.size);
    this.drawFunctionPatterns();
  }

  private setFunction(x: number, y: number, dark: boolean): void {
    const i = y * this.size + x;
    this.modules[i] = dark ? 1 : 0;
    this.isFunction[i] = 1;
  }

  private drawFunctionPatterns(): void {
    const size = this.size;
    for (let i = 0; i < size; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(size - 4, 3);
    this.drawFinder(3, size - 4);
    const pos = alignmentPositions(this.version);
    const n = pos.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        this.drawAlignment(pos[i]!, pos[j]!);
      }
    }
    this.drawFormatBits('L', 0); // reserve the area; rewritten once the mask is known
    this.drawVersion();
  }

  private drawFinder(cx: number, cy: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < this.size && y >= 0 && y < this.size) {
          this.setFunction(x, y, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  private drawAlignment(cx: number, cy: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  drawFormatBits(ecl: EcLevel, mask: number): void {
    const data = (ECL_FORMAT_BITS[ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;
    const size = this.size;
    for (let i = 0; i <= 5; i++) this.setFunction(8, i, bit(i));
    this.setFunction(8, 7, bit(6));
    this.setFunction(8, 8, bit(7));
    this.setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this.setFunction(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.setFunction(8, size - 15 + i, bit(i));
    this.setFunction(8, size - 8, true); // always-dark module
  }

  private drawVersion(): void {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, bit);
      this.setFunction(b, a, bit);
    }
  }

  drawCodewords(data: readonly number[]): void {
    const size = this.size;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          const idx = y * size + x;
          if (!this.isFunction[idx] && i < data.length * 8) {
            this.modules[idx] = (data[i >>> 3]! >>> (7 - (i & 7))) & 1;
            i++;
          }
        }
      }
    }
  }

  applyMask(mask: number): void {
    const size = this.size;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let invert: boolean;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0;
            break;
          case 1:
            invert = y % 2 === 0;
            break;
          case 2:
            invert = x % 3 === 0;
            break;
          case 3:
            invert = (x + y) % 3 === 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          case 7:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            throw new Error('Invalid mask');
        }
        const idx = y * size + x;
        if (!this.isFunction[idx] && invert) this.modules[idx] = this.modules[idx]! ^ 1;
      }
    }
  }

  penaltyScore(): number {
    const size = this.size;
    const m = this.modules;
    let result = 0;

    const addHistory = (runLen: number, hist: number[]) => {
      if (hist[0] === 0) runLen += size; // light border before the first run
      hist.pop();
      hist.unshift(runLen);
    };
    const countPatterns = (hist: number[]): number => {
      const n = hist[1]!;
      const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n;
      return (
        (core && hist[0]! >= n * 4 && hist[6]! >= n ? 1 : 0) +
        (core && hist[6]! >= n * 4 && hist[0]! >= n ? 1 : 0)
      );
    };
    const terminateAndCount = (color: number, runLen: number, hist: number[]): number => {
      if (color) {
        addHistory(runLen, hist);
        runLen = 0;
      }
      runLen += size; // light border after the last run
      addHistory(runLen, hist);
      return countPatterns(hist);
    };

    for (let pass = 0; pass < 2; pass++) {
      for (let a = 0; a < size; a++) {
        let runColor = 0;
        let runLen = 0;
        const hist = [0, 0, 0, 0, 0, 0, 0];
        for (let b = 0; b < size; b++) {
          const v = pass === 0 ? m[a * size + b]! : m[b * size + a]!;
          if (v === runColor) {
            runLen++;
            if (runLen === 5) result += 3;
            else if (runLen > 5) result++;
          } else {
            addHistory(runLen, hist);
            if (!runColor) result += countPatterns(hist) * 40;
            runColor = v;
            runLen = 1;
          }
        }
        result += terminateAndCount(runColor, runLen, hist) * 40;
      }
    }

    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        const c = m[y * size + x]!;
        if (c === m[y * size + x + 1] && c === m[(y + 1) * size + x] && c === m[(y + 1) * size + x + 1]) {
          result += 3;
        }
      }
    }

    let dark = 0;
    for (let i = 0; i < m.length; i++) dark += m[i]!;
    const total = size * size;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    result += k * 10;
    return result;
  }
}

/** Encode `text` (UTF-8) as a QR code symbol. Throws a descriptive Error when it cannot fit. */
export function encodeQr(text: string, opts: QrOptions = {}): QrCode {
  const ecl: EcLevel = opts.ecl ?? 'M';
  const minVersion = Math.max(MIN_VERSION, Math.min(MAX_VERSION, Math.floor(opts.minVersion ?? 1)));
  const maxVersion = Math.max(minVersion, Math.min(MAX_VERSION, Math.floor(opts.maxVersion ?? 40)));
  const bytes = new TextEncoder().encode(text);

  let mode: QrMode;
  if (!opts.mode || opts.mode === 'auto') mode = detectMode(text);
  else {
    mode = opts.mode;
    if (mode === 'numeric' && !/^[0-9]*$/.test(text)) {
      throw new Error('Numeric mode only supports the digits 0-9.');
    }
    if (mode === 'alphanumeric') {
      for (const ch of text) {
        if (ALPHANUMERIC_CHARSET.indexOf(ch) < 0) {
          throw new Error(`Alphanumeric mode cannot encode "${ch}" (only 0-9, A-Z, space and $%*+-./:).`);
        }
      }
    }
  }
  const eci = !!opts.eci && mode === 'byte';
  const count = mode === 'byte' ? bytes.length : text.length;
  const payloadBits = dataBitLength(mode, count);

  const usedFor = (v: number) => (eci ? 12 : 0) + 4 + charCountBits(mode, v) + payloadBits;

  let version = -1;
  for (let v = minVersion; v <= maxVersion; v++) {
    if (usedFor(v) <= numDataCodewords(v, ecl) * 8) {
      version = v;
      break;
    }
  }
  if (version < 0) {
    const cap = maxCharsFor(mode, maxVersion, ecl, eci);
    const unit = mode === 'byte' ? 'bytes' : 'characters';
    throw new Error(
      `Content is too long for a QR code at error correction ${ecl}${maxVersion < 40 ? ` (max version ${maxVersion})` : ''}: ` +
        `${count} ${unit}, the limit is ${cap}. Shorten it or choose a lower error correction level.`
    );
  }

  let finalEcl = ecl;
  if (opts.boostEcl) {
    for (const cand of EC_LEVELS) {
      if (ECL_INDEX[cand] > ECL_INDEX[finalEcl] && usedFor(version) <= numDataCodewords(version, cand) * 8) {
        finalEcl = cand;
      }
    }
  }

  // Assemble the bit stream.
  const used = usedFor(version);
  const bb: number[] = [];
  if (eci) {
    appendBits(bb, 0x7, 4);
    appendBits(bb, 26, 8); // ECI 000026 = UTF-8
  }
  appendBits(bb, mode === 'numeric' ? 0x1 : mode === 'alphanumeric' ? 0x2 : 0x4, 4);
  appendBits(bb, count, charCountBits(mode, version));
  encodePayload(bb, text, bytes, mode);

  const capacityBits = numDataCodewords(version, finalEcl) * 8;
  appendBits(bb, 0, Math.min(4, capacityBits - bb.length));
  appendBits(bb, 0, (8 - (bb.length % 8)) % 8);
  for (let pad = 0xec; bb.length < capacityBits; pad ^= 0xec ^ 0x11) appendBits(bb, pad, 8);

  const dataCodewords: number[] = new Array<number>(bb.length / 8).fill(0);
  bb.forEach((b, i) => {
    dataCodewords[i >>> 3] = dataCodewords[i >>> 3]! | (b << (7 - (i & 7)));
  });

  const { ecc, all } = addEccAndInterleave(dataCodewords, version, finalEcl);

  const grid = new Grid(version);
  grid.drawCodewords(all);

  let bestMask = opts.mask !== undefined && opts.mask >= 0 && opts.mask <= 7 ? Math.floor(opts.mask) : -1;
  if (bestMask < 0) {
    let minPenalty = Infinity;
    for (let m = 0; m < 8; m++) {
      grid.applyMask(m);
      grid.drawFormatBits(finalEcl, m);
      const p = grid.penaltyScore();
      if (p < minPenalty) {
        bestMask = m;
        minPenalty = p;
      }
      grid.applyMask(m); // XOR again = undo
    }
  }
  grid.applyMask(bestMask);
  grid.drawFormatBits(finalEcl, bestMask);

  return {
    version,
    size: grid.size,
    ecl: finalEcl,
    mode,
    mask: bestMask,
    eci,
    modules: grid.modules,
    isFunction: grid.isFunction,
    dataCodewords,
    eccCodewords: ecc,
    codewords: all,
    usedBits: used,
    capacityBits,
    charCount: count,
  };
}

// ---------------------------------------------------------------------------
// Payload builders
// ---------------------------------------------------------------------------

/** Escape the characters that are special in the WIFI: payload format. */
export function escapeWifi(s: string): string {
  return s.replace(/([\\;,:"])/g, '\\$1');
}

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass';

export function wifiPayload(f: {
  ssid: string;
  password: string;
  security: WifiSecurity;
  hidden: boolean;
}): string {
  let s = `WIFI:T:${f.security};S:${escapeWifi(f.ssid)};`;
  if (f.security !== 'nopass' && f.password) s += `P:${escapeWifi(f.password)};`;
  if (f.hidden) s += 'H:true;';
  return s + ';';
}

export function mailtoPayload(f: { to: string; subject: string; body: string }): string {
  const params: string[] = [];
  if (f.subject) params.push(`subject=${encodeURIComponent(f.subject)}`);
  if (f.body) params.push(`body=${encodeURIComponent(f.body)}`);
  return `mailto:${f.to.trim()}${params.length ? '?' + params.join('&') : ''}`;
}

/** Strip visual separators from a phone number, keeping a leading + and digits (and * # , ;). */
export function cleanPhone(s: string): string {
  return s.replace(/[\s().\-/]/g, '');
}

export function telPayload(number: string): string {
  return `tel:${cleanPhone(number)}`;
}

export function smsPayload(f: { number: string; message: string }): string {
  return `SMSTO:${cleanPhone(f.number)}:${f.message}`;
}

/** Escape a vCard 3.0 TEXT value (RFC 2426): backslash, comma, semicolon, newline. */
export function escapeVCard(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

export function vcardPayload(f: {
  firstName: string;
  lastName: string;
  org: string;
  title: string;
  phone: string;
  email: string;
  url: string;
}): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  lines.push(`N:${escapeVCard(f.lastName)};${escapeVCard(f.firstName)};;;`);
  const fn = [f.firstName, f.lastName].filter((x) => x.trim()).join(' ');
  lines.push(`FN:${escapeVCard(fn || f.org)}`);
  if (f.org) lines.push(`ORG:${escapeVCard(f.org)}`);
  if (f.title) lines.push(`TITLE:${escapeVCard(f.title)}`);
  if (f.phone) lines.push(`TEL;TYPE=CELL:${cleanPhone(f.phone)}`);
  if (f.email) lines.push(`EMAIL;TYPE=INTERNET:${f.email.trim()}`);
  if (f.url) lines.push(`URL:${f.url.trim()}`);
  lines.push('END:VCARD');
  return lines.join('\r\n');
}

export function geoPayload(latStr: string, lonStr: string): string {
  const lat = Number(latStr.trim());
  const lon = Number(lonStr.trim());
  if (latStr.trim() === '' || lonStr.trim() === '' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error('Latitude and longitude must be numbers.');
  }
  if (lat < -90 || lat > 90) throw new Error('Latitude must be between -90 and 90.');
  if (lon < -180 || lon > 180) throw new Error('Longitude must be between -180 and 180.');
  return `geo:${lat},${lon}`;
}

// ---------------------------------------------------------------------------
// Colours
// ---------------------------------------------------------------------------

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(rgb: [number, number, number]): number {
  const lin = rgb.map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

export function contrastRatio(a: string, b: string): number {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return 21;
  const la = relativeLuminance(ca);
  const lb = relativeLuminance(cb);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Warnings about foreground/background choice (empty when fine). */
export function colourWarnings(fg: string, bg: string): string[] {
  const out: string[] = [];
  const cf = parseHex(fg);
  const cb = parseHex(bg);
  if (!cf || !cb) return out;
  const ratio = contrastRatio(fg, bg);
  if (relativeLuminance(cf) > relativeLuminance(cb)) {
    out.push('Light code on a dark background (inverted). Many scanners cannot read inverted QR codes.');
  }
  if (ratio < 1.5) out.push(`Contrast ${ratio.toFixed(1)}:1 is far too low. The code will not scan.`);
  else if (ratio < 3) out.push(`Low contrast (${ratio.toFixed(1)}:1). Use a darker foreground or lighter background.`);
  return out;
}

// ---------------------------------------------------------------------------
// Rendering: SVG path data
// ---------------------------------------------------------------------------

export type ModuleStyle = 'square' | 'rounded' | 'dots';

/** A square of modules (in matrix coordinates) knocked out of the code for a centre logo. */
export interface LogoBox {
  x: number;
  y: number;
  size: number;
}

function num(n: number): string {
  return String(parseFloat(n.toFixed(3)));
}

/** True when the 7x7 finder pattern (eye) covers module (x, y). */
function inEye(x: number, y: number, size: number): boolean {
  return (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
}

function roundedRectCw(x: number, y: number, w: number, h: number, r: number): string {
  const iw = w - 2 * r;
  const ih = h - 2 * r;
  return (
    `M${num(x + r)} ${num(y)}h${num(iw)}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(r)}` +
    `v${num(ih)}a${num(r)} ${num(r)} 0 0 1 ${num(-r)} ${num(r)}` +
    `h${num(-iw)}a${num(r)} ${num(r)} 0 0 1 ${num(-r)} ${num(-r)}` +
    `v${num(-ih)}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(-r)}z`
  );
}

function roundedRectCcw(x: number, y: number, w: number, h: number, r: number): string {
  const iw = w - 2 * r;
  const ih = h - 2 * r;
  return (
    `M${num(x + r)} ${num(y)}a${num(r)} ${num(r)} 0 0 0 ${num(-r)} ${num(r)}` +
    `v${num(ih)}a${num(r)} ${num(r)} 0 0 0 ${num(r)} ${num(r)}` +
    `h${num(iw)}a${num(r)} ${num(r)} 0 0 0 ${num(r)} ${num(-r)}` +
    `v${num(-ih)}a${num(r)} ${num(r)} 0 0 0 ${num(-r)} ${num(-r)}` +
    `h${num(-iw)}z`
  );
}

/**
 * One SVG path (`d` attribute) for every dark module, in module units offset by `quiet`.
 * Fill with the default non-zero rule. Modules inside `clear` are left out.
 */
export function qrPathData(
  qr: Pick<QrCode, 'size' | 'modules'>,
  style: ModuleStyle,
  quiet: number,
  clear?: LogoBox | null
): string {
  const size = qr.size;
  const dark = (x: number, y: number): boolean => {
    if (x < 0 || y < 0 || x >= size || y >= size) return false;
    if (clear && x >= clear.x && x < clear.x + clear.size && y >= clear.y && y < clear.y + clear.size) {
      return false;
    }
    return qr.modules[y * size + x] === 1;
  };
  const parts: string[] = [];

  if (style === 'square') {
    for (let y = 0; y < size; y++) {
      let x = 0;
      while (x < size) {
        if (!dark(x, y)) {
          x++;
          continue;
        }
        let end = x;
        while (end < size && dark(end, y)) end++;
        parts.push(`M${x + quiet} ${y + quiet}h${end - x}v1h${x - end}z`);
        x = end;
      }
    }
    return parts.join('');
  }

  // Eyes (finder patterns) are drawn as nested rounded squares so they stay recognisable.
  const eyes: [number, number][] = [
    [0, 0],
    [size - 7, 0],
    [0, size - 7],
  ];
  for (const [ex, ey] of eyes) {
    const ox = ex + quiet;
    const oy = ey + quiet;
    const outerR = style === 'dots' ? 2.2 : 1.8;
    parts.push(roundedRectCw(ox, oy, 7, 7, outerR));
    parts.push(roundedRectCcw(ox + 1, oy + 1, 5, 5, outerR - 1 > 0.4 ? outerR - 1 : 0.4));
    parts.push(roundedRectCw(ox + 2, oy + 2, 3, 3, style === 'dots' ? 1.2 : 0.9));
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inEye(x, y, size) || !dark(x, y)) continue;
      const px = x + quiet;
      const py = y + quiet;
      if (style === 'dots') {
        const r = 0.42;
        const cx = px + 0.5;
        parts.push(
          `M${num(cx - r)} ${num(py + 0.5)}a${r} ${r} 0 1 0 ${num(2 * r)} 0a${r} ${r} 0 1 0 ${num(-2 * r)} 0z`
        );
        continue;
      }
      // rounded: round every convex corner (both adjacent sides empty)
      const up = dark(x, y - 1);
      const down = dark(x, y + 1);
      const left = dark(x - 1, y);
      const right = dark(x + 1, y);
      const R = 0.45;
      const tl = !up && !left ? R : 0;
      const tr = !up && !right ? R : 0;
      const br = !down && !right ? R : 0;
      const bl = !down && !left ? R : 0;
      let d = `M${num(px + tl)} ${num(py)}h${num(1 - tl - tr)}`;
      if (tr) d += `a${R} ${R} 0 0 1 ${R} ${R}`;
      d += `v${num(1 - tr - br)}`;
      if (br) d += `a${R} ${R} 0 0 1 ${-R} ${R}`;
      d += `h${num(-(1 - br - bl))}`;
      if (bl) d += `a${R} ${R} 0 0 1 ${-R} ${-R}`;
      d += `v${num(-(1 - bl - tl))}`;
      if (tl) d += `a${R} ${R} 0 0 1 ${R} ${-R}`;
      parts.push(d + 'z');
    }
  }
  return parts.join('');
}

// ---------------------------------------------------------------------------
// Logo placement
// ---------------------------------------------------------------------------

/**
 * Pick a centred square of modules to replace with a logo. The box covers at most
 * `areaFraction` of the symbol and stays clear of the finder patterns, timing lines and
 * format / version information (it may cover alignment patterns, which decoders tolerate).
 * Returns null when the symbol is too small to hold a logo.
 */
export function planLogoBox(qr: Pick<QrCode, 'size'>, areaFraction: number): LogoBox | null {
  const n = qr.size;
  let box = Math.floor(Math.sqrt(Math.max(0, areaFraction)) * n);
  if ((n - box) % 2 !== 0) box -= 1;
  // Columns / rows 0-8 and n-9..n-1 hold finders, separators, format info and timing.
  const maxBox = n - 18;
  if (box > maxBox) box = maxBox % 2 === n % 2 ? maxBox : maxBox - 1;
  if (box < 5) return null;
  const start = (n - box) / 2;
  return { x: start, y: start, size: box };
}

export interface LogoSpec {
  box: LogoBox;
  /** data: URL of the logo bitmap (already downscaled by the caller). */
  href: string;
  /** natural width / height of the logo. */
  aspect: number;
}

/** Inner rectangle (module units, including quiet zone) the logo image is drawn into. */
export function logoImageRect(
  spec: Pick<LogoSpec, 'box' | 'aspect'>,
  quiet: number
): { x: number; y: number; w: number; h: number } {
  const pad = Math.max(0.5, spec.box.size * 0.08);
  const inner = spec.box.size - 2 * pad;
  const a = spec.aspect > 0 && Number.isFinite(spec.aspect) ? spec.aspect : 1;
  const w = a >= 1 ? inner : inner * a;
  const h = a >= 1 ? inner / a : inner;
  const cx = spec.box.x + spec.box.size / 2 + quiet;
  const cy = spec.box.y + spec.box.size / 2 + quiet;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export interface SvgOptions {
  quiet: number;
  style: ModuleStyle;
  fg: string;
  /** background colour; empty string = transparent (no background rect). */
  bg: string;
  /** pixel width/height attributes (the viewBox stays in module units). */
  sizePx?: number;
  logo?: LogoSpec | null;
}

function xmlAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

export function qrToSvg(qr: Pick<QrCode, 'size' | 'modules'>, o: SvgOptions): string {
  const total = qr.size + 2 * o.quiet;
  const d = qrPathData(qr, o.style, o.quiet, o.logo?.box ?? null);
  const px = o.sizePx && o.sizePx > 0 ? ` width="${o.sizePx}" height="${o.sizePx}"` : '';
  const crisp = o.style === 'square' ? ' shape-rendering="crispEdges"' : '';
  let svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${total} ${total}"${px}>` +
    (o.bg ? `<rect width="${total}" height="${total}" fill="${xmlAttr(o.bg)}"/>` : '') +
    `<path fill="${xmlAttr(o.fg)}"${crisp} d="${d}"/>`;
  if (o.logo) {
    const r = logoImageRect(o.logo, o.quiet);
    svg +=
      `<image x="${num(r.x)}" y="${num(r.y)}" width="${num(r.w)}" height="${num(r.h)}" ` +
      `preserveAspectRatio="xMidYMid meet" href="${xmlAttr(o.logo.href)}" xlink:href="${xmlAttr(o.logo.href)}"/>`;
  }
  return svg + '</svg>';
}
