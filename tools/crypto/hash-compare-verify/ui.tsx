'use client';

import { useCallback, useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type SourceMode = 'text' | 'file';

const enc = new TextEncoder();

// ---- Pure-JS MD5 (WebCrypto lacks MD5) ----
function md5(input: Uint8Array): Uint8Array {
  function rol(x: number, c: number): number {
    return (x << c) | (x >>> (32 - c));
  }
  const s: number[] = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9,
    14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K: number[] = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;

  const msgLen = input.length;
  const bitLen = msgLen * 8;
  const totalLen = ((msgLen + 8) >> 6) * 64 + 64;
  const data = new Uint8Array(totalLen);
  data.set(input);
  data[msgLen] = 0x80;
  // append length (little-endian, low 32 bits + high 32 bits)
  const lenLo = bitLen >>> 0;
  const lenHi = Math.floor(bitLen / 4294967296) >>> 0;
  for (let i = 0; i < 4; i++) {
    data[totalLen - 8 + i] = (lenLo >>> (8 * i)) & 0xff;
    data[totalLen - 4 + i] = (lenHi >>> (8 * i)) & 0xff;
  }

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const M = new Array<number>(16);
  for (let off = 0; off < totalLen; off += 64) {
    for (let i = 0; i < 16; i++) {
      const j = off + i * 4;
      M[i] =
        ((data[j] ?? 0) |
          ((data[j + 1] ?? 0) << 8) |
          ((data[j + 2] ?? 0) << 16) |
          ((data[j + 3] ?? 0) << 24)) >>>
        0;
    }
    let A = a0;
    let B = b0;
    let C = c0;
    let D = d0;
    for (let i = 0; i < 64; i++) {
      let f: number;
      let g: number;
      if (i < 16) {
        f = (B & C) | (~B & D);
        g = i;
      } else if (i < 32) {
        f = (D & B) | (~D & C);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = B ^ C ^ D;
        g = (3 * i + 5) % 16;
      } else {
        f = C ^ (B | ~D);
        g = (7 * i) % 16;
      }
      f = (f + A + (K[i] ?? 0) + (M[g] ?? 0)) >>> 0;
      A = D;
      D = C;
      C = B;
      B = (B + rol(f, s[i] ?? 0)) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  const out = new Uint8Array(16);
  const words = [a0, b0, c0, d0];
  for (let w = 0; w < 4; w++) {
    const val = words[w] ?? 0;
    for (let i = 0; i < 4; i++) out[w * 4 + i] = (val >>> (8 * i)) & 0xff;
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += (bytes[i] ?? 0).toString(16).padStart(2, '0');
  return s;
}

function normalize(s: string): string {
  return s.replace(/[\s:]/g, '').replace(/^0x/i, '').toLowerCase();
}

const ALGO_BY_LEN: Record<number, string> = {
  32: 'MD5',
  40: 'SHA-1',
  64: 'SHA-256',
  96: 'SHA-384',
  128: 'SHA-512',
};

const SUBTLE_NAME: Record<string, string> = {
  'SHA-1': 'SHA-1',
  'SHA-256': 'SHA-256',
  'SHA-384': 'SHA-384',
  'SHA-512': 'SHA-512',
};

async function computeHash(algo: string, data: Uint8Array): Promise<string> {
  if (algo === 'MD5') return toHex(md5(data));
  const name = SUBTLE_NAME[algo];
  if (!name) throw new Error(`Unsupported algorithm: ${algo}`);
  const buf = await wc.subtle.digest(name, data as unknown as ArrayBuffer);
  return toHex(new Uint8Array(buf));
}

// Constant-time-ish comparison of equal-length lowercase hex.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export default function HashCompareVerifyTool() {
  const [expected, setExpected] = useState('');
  const [mode, setMode] = useState<SourceMode>('text');
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileBytes, setFileBytes] = useState<Uint8Array | null>(null);
  const [computed, setComputed] = useState('');
  const [algo, setAlgo] = useState('');
  const [match, setMatch] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    setError(null);
    setComputed('');
    setMatch(null);
    setAlgo('');
    try {
      const exp = normalize(expected);
      if (!exp) throw new Error('Enter an expected checksum.');
      if (!/^[0-9a-f]+$/.test(exp)) throw new Error('Expected checksum is not valid hex.');
      const detected = ALGO_BY_LEN[exp.length];
      if (!detected) {
        throw new Error(
          `Cannot detect algorithm: ${exp.length} hex chars. Expected 32 (MD5), 40 (SHA-1), 64 (SHA-256), 96 (SHA-384), or 128 (SHA-512).`
        );
      }
      const data = mode === 'file' ? fileBytes : enc.encode(text);
      if (!data) throw new Error('Upload a file to hash.');
      const got = await computeHash(detected, data);
      setAlgo(detected);
      setComputed(got);
      setMatch(timingSafeEqual(got, exp));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [expected, mode, text, fileBytes]);

  const onFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        setFileBytes(new Uint8Array(reader.result));
        setFileName(file.name);
      } else {
        setError('Could not read file.');
      }
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsArrayBuffer(file);
  }, []);

  const expNorm = normalize(expected);
  const nibbleDiff = computed
    ? computed.split('').map((ch, i) => ({ ch, ok: ch === (expNorm[i] ?? '') }))
    : [];

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelHeader title="Expected checksum (hex)" />
        <Input
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          placeholder="e.g. 9e107d9d372bb6826bd81d3542a419d6"
          spellCheck={false}
          className="rounded-none border-0 font-mono text-xs shadow-none focus-visible:ring-0"
        />
      </Panel>

      <OptionsBar>
        <Field label="Source">
          <Tabs value={mode} onValueChange={(v) => setMode(v as SourceMode)}>
            <TabsList>
              <TabsTrigger value="text">Text</TabsTrigger>
              <TabsTrigger value="file">File</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Button type="button" onClick={() => void run()} disabled={busy}>
          {busy ? <Loader2 className="size-4 animate-spin" /> : null}
          {busy ? 'Hashing…' : 'Compare'}
        </Button>
      </OptionsBar>

      {mode === 'text' ? (
        <Panel>
          <PanelHeader title="Text (UTF-8)">
            <Button variant="ghost" size="sm" onClick={() => setText('The quick brown fox jumps over the lazy dog')}>
              Sample
            </Button>
          </PanelHeader>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type or paste content to hash…"
            spellCheck={false}
            className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title="File" />
          <div className="flex items-center gap-3 p-3">
            <label>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.target.value = '';
                }}
              />
              <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border bg-secondary px-3 py-1.5 text-sm">
                <Upload className="size-3.5" /> Choose file
              </span>
            </label>
            <span className="font-mono text-xs text-muted-foreground">
              {fileName ? `${fileName} (${(fileBytes?.length ?? 0).toLocaleString()} bytes)` : 'No file selected'}
            </span>
          </div>
        </Panel>
      )}

      <ErrorBanner error={error} />

      {computed && (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={computed} />
          </PanelHeader>
          <div className="space-y-3 p-3">
            <div
              className={
                match
                  ? 'text-center font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400'
                  : 'text-center font-mono text-sm font-semibold text-red-600 dark:text-red-400'
              }
            >
              {match ? `MATCH — ${algo}` : `NO MATCH — ${algo}`}
            </div>
            <div className="space-y-1">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">Computed hash</div>
              <div className="break-all font-mono text-xs leading-relaxed">
                {nibbleDiff.map((n, i) => (
                  <span
                    key={i}
                    className={n.ok ? '' : 'rounded-sm bg-red-500/20 text-red-600 dark:text-red-400'}
                  >
                    {n.ch}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">Expected (normalized)</div>
              <div className="break-all font-mono text-xs leading-relaxed text-muted-foreground">{expNorm}</div>
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
}
