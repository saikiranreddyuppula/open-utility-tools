'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

const B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function randomBase32(bytes: number): string {
  const buf = new Uint8Array(bytes);
  wc.getRandomValues(buf);
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | (buf[i] ?? 0);
    bits += 8;
    while (bits >= 5) {
      out += B32_ALPHABET.charAt((value >>> (bits - 5)) & 31);
      bits -= 5;
    }
  }
  if (bits > 0) out += B32_ALPHABET.charAt((value << (5 - bits)) & 31);
  return out;
}

function isValidBase32(s: string): boolean {
  const clean = s.replace(/=+$/, '').toUpperCase();
  if (clean.length === 0) return false;
  for (const ch of clean) {
    if (!B32_ALPHABET.includes(ch)) return false;
  }
  return true;
}

// ----- Minimal QR encoder (byte mode, EC level M) supporting versions 1-10 -----

const GF_EXP = new Uint8Array(512);
const GF_LOG = new Uint8Array(256);
(function initGF() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x;
    GF_LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255] ?? 0;
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return GF_EXP[((GF_LOG[a] ?? 0) + (GF_LOG[b] ?? 0)) % 255] ?? 0;
}

// Monic generator polynomial with `degree` coefficients (leading term implicit).
function rsGenerator(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j] ?? 0, root);
      if (j + 1 < result.length) result[j] = (result[j] ?? 0) ^ (result[j + 1] ?? 0);
    }
    root = gfMul(root, 2);
  }
  return result;
}

function rsEncode(data: number[], ecLen: number): number[] {
  const divisor = rsGenerator(ecLen);
  const res = new Array<number>(ecLen).fill(0);
  for (const d of data) {
    const factor = d ^ (res[0] ?? 0);
    res.shift();
    res.push(0);
    for (let i = 0; i < res.length; i++) {
      res[i] = (res[i] ?? 0) ^ gfMul(divisor[i] ?? 0, factor);
    }
  }
  return res;
}

// EC level M capacity and block structure for versions 1..10.
interface VerInfo {
  version: number;
  totalCodewords: number;
  ecPerBlock: number;
  group1Blocks: number;
  group1Data: number;
  group2Blocks: number;
  group2Data: number;
}

const VERSIONS_M: VerInfo[] = [
  { version: 1, totalCodewords: 26, ecPerBlock: 10, group1Blocks: 1, group1Data: 16, group2Blocks: 0, group2Data: 0 },
  { version: 2, totalCodewords: 44, ecPerBlock: 16, group1Blocks: 1, group1Data: 28, group2Blocks: 0, group2Data: 0 },
  { version: 3, totalCodewords: 70, ecPerBlock: 26, group1Blocks: 1, group1Data: 44, group2Blocks: 0, group2Data: 0 },
  { version: 4, totalCodewords: 100, ecPerBlock: 18, group1Blocks: 2, group1Data: 32, group2Blocks: 0, group2Data: 0 },
  { version: 5, totalCodewords: 134, ecPerBlock: 24, group1Blocks: 2, group1Data: 43, group2Blocks: 0, group2Data: 0 },
  { version: 6, totalCodewords: 172, ecPerBlock: 16, group1Blocks: 4, group1Data: 27, group2Blocks: 0, group2Data: 0 },
  { version: 7, totalCodewords: 196, ecPerBlock: 18, group1Blocks: 4, group1Data: 31, group2Blocks: 0, group2Data: 0 },
  { version: 8, totalCodewords: 242, ecPerBlock: 22, group1Blocks: 2, group1Data: 38, group2Blocks: 2, group2Data: 39 },
  { version: 9, totalCodewords: 292, ecPerBlock: 22, group1Blocks: 3, group1Data: 36, group2Blocks: 2, group2Data: 37 },
  { version: 10, totalCodewords: 346, ecPerBlock: 26, group1Blocks: 4, group1Data: 43, group2Blocks: 1, group2Data: 44 },
];

const ALIGN_POS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
  7: [6, 22, 38],
  8: [6, 24, 42],
  9: [6, 26, 46],
  10: [6, 28, 50],
};

function dataCapacity(v: VerInfo): number {
  return v.group1Blocks * v.group1Data + v.group2Blocks * v.group2Data;
}

function pickVersion(byteLen: number): VerInfo | null {
  for (const v of VERSIONS_M) {
    // 4-bit mode + count indicator (8 bits for v1-9, 16 for v10) + data + 4 terminator
    const countBits = v.version >= 10 ? 16 : 8;
    const totalBits = 4 + countBits + byteLen * 8;
    const capacityBits = dataCapacity(v) * 8;
    if (totalBits + 4 <= capacityBits) return v;
  }
  return null;
}

function buildBitstream(bytes: number[], v: VerInfo): number[] {
  const countBits = v.version >= 10 ? 16 : 8;
  const bits: number[] = [];
  const push = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(0b0100, 4); // byte mode
  push(bytes.length, countBits);
  for (const b of bytes) push(b, 8);
  const capacityBits = dataCapacity(v) * 8;
  // terminator
  const term = Math.min(4, capacityBits - bits.length);
  for (let i = 0; i < term; i++) bits.push(0);
  while (bits.length % 8 !== 0) bits.push(0);
  // pad bytes
  const padBytes = [0xec, 0x11];
  let p = 0;
  while (bits.length < capacityBits) {
    push(padBytes[p % 2] ?? 0xec, 8);
    p++;
  }
  // to codewords
  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let val = 0;
    for (let j = 0; j < 8; j++) val = (val << 1) | (bits[i + j] ?? 0);
    codewords.push(val);
  }
  return codewords;
}

function interleave(dataCodewords: number[], v: VerInfo): number[] {
  const blocks: { data: number[]; ec: number[] }[] = [];
  let offset = 0;
  const groups: { count: number; size: number }[] = [
    { count: v.group1Blocks, size: v.group1Data },
    { count: v.group2Blocks, size: v.group2Data },
  ];
  for (const g of groups) {
    for (let b = 0; b < g.count; b++) {
      const data = dataCodewords.slice(offset, offset + g.size);
      offset += g.size;
      blocks.push({ data, ec: rsEncode(data, v.ecPerBlock) });
    }
  }
  const result: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.data.length));
  for (let i = 0; i < maxData; i++) {
    for (const blk of blocks) {
      if (i < blk.data.length) result.push(blk.data[i] ?? 0);
    }
  }
  for (let i = 0; i < v.ecPerBlock; i++) {
    for (const blk of blocks) result.push(blk.ec[i] ?? 0);
  }
  return result;
}

type Grid = Int8Array[]; // -1 unset, 0/1 set; function module marked via reserved

function buildMatrix(finalCodewords: number[], v: VerInfo): boolean[][] {
  const size = 17 + v.version * 4;
  const modules: Grid = [];
  const reserved: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    modules.push(new Int8Array(size).fill(-1));
    reserved.push(new Array<boolean>(size).fill(false));
  }
  const set = (r: number, c: number, val: boolean, isFn: boolean) => {
    const row = modules[r];
    const rr = reserved[r];
    if (!row || !rr) return;
    row[c] = val ? 1 : 0;
    if (isFn) rr[c] = true;
  };

  const placeFinder = (r0: number, c0: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = r0 + r;
        const cc = c0 + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inSquare =
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4);
        set(rr, cc, inSquare, true);
      }
    }
  };
  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // timing patterns
  for (let i = 8; i < size - 8; i++) {
    set(6, i, i % 2 === 0, true);
    set(i, 6, i % 2 === 0, true);
  }
  // dark module
  set(size - 8, 8, true, true);

  // alignment patterns
  const positions = ALIGN_POS[v.version] ?? [];
  for (const pr of positions) {
    for (const pc of positions) {
      const rr = reserved[pr];
      if (!rr || rr[pc]) continue; // overlaps finder
      for (let r = -2; r <= 2; r++) {
        for (let c = -2; c <= 2; c++) {
          const isDark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
          set(pr + r, pc + c, isDark, true);
        }
      }
    }
  }

  // reserve format info areas
  for (let i = 0; i < 9; i++) {
    const rr = reserved[8];
    if (rr && !rr[i]) set(8, i, false, true);
    const ri = reserved[i];
    if (ri && !ri[8]) set(i, 8, false, true);
  }
  for (let i = 0; i < 8; i++) {
    set(8, size - 1 - i, false, true);
    set(size - 1 - i, 8, false, true);
  }

  // place data with zig-zag
  const dataBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let i = 7; i >= 0; i--) dataBits.push((cw >>> i) & 1);
  }
  let bitIdx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    const c = col === 6 ? col - 1 : col; // skip timing column
    for (let i = 0; i < size; i++) {
      const row = upward ? size - 1 - i : i;
      for (let j = 0; j < 2; j++) {
        const cc = c - j;
        const rr = reserved[row];
        if (rr && !rr[cc]) {
          const bit = dataBits[bitIdx] ?? 0;
          bitIdx++;
          set(row, cc, bit === 1, false);
        }
      }
    }
    upward = !upward;
  }

  // apply mask pattern 0 and place format bits for mask 0 / level M
  const out: boolean[][] = [];
  for (let r = 0; r < size; r++) {
    const row: boolean[] = [];
    const modRow = modules[r];
    const resRow = reserved[r];
    for (let c = 0; c < size; c++) {
      let val = (modRow?.[c] ?? 0) === 1;
      if (resRow && !resRow[c]) {
        if ((r + c) % 2 === 0) val = !val; // mask pattern 0: (i+j) mod 2 == 0
      }
      row.push(val);
    }
    out.push(row);
  }

  // Format information: EC level M (10) + mask 0 (000). The BCH-encoded,
  // mask-XORed 15-bit value for level=M, mask=0 is 0x5412 (binary 101010000010010).
  // `getBit(x, i)` returns bit i counting from the LSB (i=0). The MSB is bit 14.
  const fmt = 0x5412;
  const getBit = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0;
  const setOut = (r: number, c: number, val: boolean) => {
    const row = out[r];
    if (row) row[c] = val;
  };
  // First copy: along top-left, bits 0..14 (LSB first).
  for (let i = 0; i <= 5; i++) setOut(8, i, getBit(fmt, i));
  setOut(8, 7, getBit(fmt, 6));
  setOut(8, 8, getBit(fmt, 7));
  setOut(7, 8, getBit(fmt, 8));
  for (let i = 9; i < 15; i++) setOut(14 - i, 8, getBit(fmt, i));
  // Second copy: bits 0..7 down column 8 from the bottom (bottom-left block),
  // and bits 8..14 along row 8 toward the right edge (top-right block).
  for (let i = 0; i < 8; i++) setOut(size - 1 - i, 8, getBit(fmt, i));
  for (let i = 8; i < 15; i++) setOut(8, size - 15 + i, getBit(fmt, i));
  setOut(size - 8, 8, true); // dark module

  return out;
}

function encodeQR(text: string): { matrix: boolean[][]; version: number } {
  const bytes = Array.from(new TextEncoder().encode(text));
  const v = pickVersion(bytes.length);
  if (!v) throw new Error('Content too long for QR (max ~270 bytes). Shorten the label/issuer.');
  const codewords = buildBitstream(bytes, v);
  const finalCw = interleave(codewords, v);
  const matrix = buildMatrix(finalCw, v);
  return { matrix, version: v.version };
}

// ----- otpauth URI assembly -----

type OtpType = 'totp' | 'hotp';
type Algo = 'SHA1' | 'SHA256' | 'SHA512';

function buildUri(opts: {
  type: OtpType;
  account: string;
  issuer: string;
  secret: string;
  algorithm: Algo;
  digits: string;
  period: string;
  counter: string;
}): string {
  const label = opts.issuer
    ? `${encodeURIComponent(opts.issuer)}:${encodeURIComponent(opts.account)}`
    : encodeURIComponent(opts.account);
  const params: string[] = [];
  params.push(`secret=${encodeURIComponent(opts.secret.replace(/=+$/, '').toUpperCase())}`);
  if (opts.issuer) params.push(`issuer=${encodeURIComponent(opts.issuer)}`);
  params.push(`algorithm=${opts.algorithm}`);
  params.push(`digits=${opts.digits}`);
  if (opts.type === 'totp') params.push(`period=${opts.period}`);
  else params.push(`counter=${opts.counter}`);
  return `otpauth://${opts.type}/${label}?${params.join('&')}`;
}

export default function OtpUriBuilder() {
  const [type, setType] = useState<OtpType>('totp');
  const [account, setAccount] = useState('alice@example.com');
  const [issuer, setIssuer] = useState('Acme Corp');
  const [secret, setSecret] = useState('JBSWY3DPEHPK3PXP');
  const [algorithm, setAlgorithm] = useState<Algo>('SHA1');
  const [digits, setDigits] = useState('6');
  const [period, setPeriod] = useState('30');
  const [counter, setCounter] = useState('0');
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const built = useMemo(() => {
    if (!account.trim()) return { error: 'Account label is required.' as string };
    if (!isValidBase32(secret)) {
      return { error: 'Secret must be valid Base32 (A-Z, 2-7).' as string };
    }
    const uri = buildUri({ type, account, issuer, secret, algorithm, digits, period, counter });
    try {
      const { matrix, version } = encodeQR(uri);
      return { uri, matrix, version };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'QR generation failed.' };
    }
  }, [type, account, issuer, secret, algorithm, digits, period, counter]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || 'error' in built || !built.matrix) return;
    const matrix = built.matrix;
    const n = matrix.length;
    const quiet = 4;
    const scale = 8;
    const dim = (n + quiet * 2) * scale;
    canvas.width = dim;
    canvas.height = dim;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, dim, dim);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < n; r++) {
      const row = matrix[r];
      if (!row) continue;
      for (let c = 0; c < n; c++) {
        if (row[c]) {
          ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
        }
      }
    }
  }, [built]);

  const downloadPng = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'otpauth-qr.png';
    a.click();
  };

  const uri = 'error' in built ? '' : built.uri;

  return (
    <div className="flex flex-col gap-4">
      <OptionsBar>
        <Field label="Type">
          <Select value={type} onValueChange={(v) => setType(v as OtpType)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="totp">TOTP</SelectItem>
              <SelectItem value="hotp">HOTP</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Account / label">
          <Input value={account} onChange={(e) => setAccount(e.target.value)} className="w-52" />
        </Field>
        <Field label="Issuer">
          <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} className="w-40" />
        </Field>
        <Field label="Base32 secret">
          <div className="flex items-center gap-1.5">
            <Input
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              className="w-56 font-mono"
            />
            <Button
              variant="secondary"
              size="icon-sm"
              title="Generate random 20-byte secret"
              onClick={() => setSecret(randomBase32(20))}
            >
              <RefreshCw className="size-3.5" />
            </Button>
          </div>
        </Field>
        <Field label="Algorithm">
          <Select value={algorithm} onValueChange={(v) => setAlgorithm(v as Algo)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="SHA1">SHA1</SelectItem>
              <SelectItem value="SHA256">SHA256</SelectItem>
              <SelectItem value="SHA512">SHA512</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Digits">
          <Select value={digits} onValueChange={setDigits}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6</SelectItem>
              <SelectItem value="8">8</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {type === 'totp' ? (
          <Field label="Period (s)">
            <Input
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              inputMode="numeric"
              className="w-20 font-mono"
            />
          </Field>
        ) : (
          <Field label="Counter">
            <Input
              value={counter}
              onChange={(e) => setCounter(e.target.value)}
              inputMode="numeric"
              className="w-20 font-mono"
            />
          </Field>
        )}
      </OptionsBar>

      {'error' in built ? (
        <ErrorBanner error={built.error} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel>
            <PanelHeader title="otpauth URI">
              <CopyButton value={() => uri} disabled={!uri} />
            </PanelHeader>
            <div className="p-3">
              <code className="block break-all font-mono text-sm">{uri}</code>
            </div>
            <StatBar items={[`${uri.length} chars`, `QR version ${built.version}`]} />
          </Panel>
          <Panel>
            <PanelHeader title="QR code">
              <Button variant="ghost" size="sm" onClick={downloadPng}>
                Download PNG
              </Button>
            </PanelHeader>
            <div className="flex flex-col items-center gap-2 p-4">
              <canvas ref={canvasRef} className="h-auto max-w-full rounded border" />
              <p className="text-2xs text-muted-foreground">
                Scan with Google Authenticator, Authy, 1Password, etc.
              </p>
            </div>
          </Panel>
        </div>
      )}
    </div>
  );
}
