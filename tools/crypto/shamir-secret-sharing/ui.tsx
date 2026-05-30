'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

// GF(256) tables using the AES reduction polynomial 0x11b, generator 3.
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    // multiply by 3 (x^? generator) in GF(256)
    let next = x << 1;
    if (x & 0x80) next ^= 0x11b;
    next ^= x; // *3 = *2 XOR *1
    x = next & 0xff;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255] ?? 0;
})();

function gmul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  const la = LOG[a] ?? 0;
  const lb = LOG[b] ?? 0;
  return EXP[la + lb] ?? 0;
}

function gdiv(a: number, b: number): number {
  if (b === 0) throw new Error('Division by zero in GF(256).');
  if (a === 0) return 0;
  const la = LOG[a] ?? 0;
  const lb = LOG[b] ?? 0;
  return EXP[(la - lb + 255) % 255] ?? 0;
}

// Evaluate polynomial with given coefficients (coeffs[0] = constant term) at x.
function evalPoly(coeffs: number[], x: number): number {
  let result = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) {
    result = gmul(result, x) ^ (coeffs[i] ?? 0);
  }
  return result & 0xff;
}

function toHexByte(n: number): string {
  return n.toString(16).padStart(2, '0');
}

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += toHexByte(bytes[i] ?? 0);
  return s;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/[^0-9a-fA-F]/g, '');
  if (clean.length % 2 !== 0) throw new Error('Hex string has an odd length.');
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

type SecretFmt = 'utf8' | 'hex';

function secretToBytes(secret: string, fmt: SecretFmt): Uint8Array {
  if (fmt === 'hex') return hexToBytes(secret);
  return new TextEncoder().encode(secret);
}

function bytesToSecret(bytes: Uint8Array, fmt: SecretFmt): string {
  if (fmt === 'hex') return bytesToHex(bytes);
  return new TextDecoder().decode(bytes);
}

// Each share is "<x>-<hex-of-y-bytes>". x in 1..255.
function split(secret: Uint8Array, n: number, k: number): string[] {
  const shares: string[] = [];
  const yByX: number[][] = [];
  for (let i = 0; i < n; i++) yByX.push([]);

  for (let b = 0; b < secret.length; b++) {
    const coeffs = new Array<number>(k);
    coeffs[0] = secret[b] ?? 0;
    const rand = new Uint8Array(k - 1);
    wc.getRandomValues(rand);
    for (let c = 1; c < k; c++) coeffs[c] = rand[c - 1] ?? 0;
    for (let i = 0; i < n; i++) {
      const x = i + 1;
      const row = yByX[i];
      if (row) row.push(evalPoly(coeffs, x));
    }
  }

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const ys = yByX[i] ?? [];
    shares.push(`${toHexByte(x)}-${bytesToHex(Uint8Array.from(ys))}`);
  }
  return shares;
}

function combine(shares: string[]): Uint8Array {
  const parsed = shares
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const dash = s.indexOf('-');
      if (dash < 0) throw new Error(`Share "${s}" is missing its index prefix.`);
      const xHex = s.slice(0, dash);
      const yHex = s.slice(dash + 1);
      const x = parseInt(xHex, 16);
      if (!Number.isFinite(x) || x < 1 || x > 255) {
        throw new Error(`Share has an invalid index "${xHex}".`);
      }
      return { x, y: hexToBytes(yHex) };
    });

  if (parsed.length < 2) throw new Error('Provide at least two shares to reconstruct.');
  const firstLen = parsed[0]?.y.length ?? 0;
  for (const p of parsed) {
    if (p.y.length !== firstLen) {
      throw new Error('All shares must have the same length.');
    }
  }

  const secret = new Uint8Array(firstLen);
  for (let b = 0; b < firstLen; b++) {
    // Lagrange interpolation at x = 0.
    let acc = 0;
    for (let i = 0; i < parsed.length; i++) {
      const pi = parsed[i];
      if (!pi) continue;
      let num = 1;
      let den = 1;
      for (let j = 0; j < parsed.length; j++) {
        if (i === j) continue;
        const pj = parsed[j];
        if (!pj) continue;
        num = gmul(num, pj.x); // (0 - x_j) = x_j in GF(256)
        den = gmul(den, pi.x ^ pj.x);
      }
      const yi = pi.y[b] ?? 0;
      acc ^= gmul(yi, gdiv(num, den));
    }
    secret[b] = acc & 0xff;
  }
  return secret;
}

type Mode = 'split' | 'combine';

const SAMPLE_SECRET = 'correct horse battery staple';

export default function ShamirSecretSharingTool() {
  const [mode, setMode] = useState<Mode>('split');
  const [fmt, setFmt] = useState<SecretFmt>('utf8');
  const [secret, setSecret] = useState(SAMPLE_SECRET);
  const [nStr, setNStr] = useState('5');
  const [kStr, setKStr] = useState('3');
  const [sharesInput, setSharesInput] = useState('');
  const [splitOut, setSplitOut] = useState<string[]>([]);
  const [genError, setGenError] = useState<string | null>(null);

  const doSplit = () => {
    try {
      const n = parseInt(nStr, 10);
      const k = parseInt(kStr, 10);
      if (!Number.isInteger(n) || !Number.isInteger(k)) {
        throw new Error('N and K must be whole numbers.');
      }
      if (k < 2) throw new Error('Threshold K must be at least 2.');
      if (n < k) throw new Error('Total shares N must be ≥ threshold K.');
      if (n > 255) throw new Error('N cannot exceed 255 (GF(256) limit).');
      const bytes = secretToBytes(secret, fmt);
      if (bytes.length === 0) throw new Error('Secret is empty.');
      if (bytes.length > 4096) throw new Error('Secret is too large (max 4096 bytes).');
      setSplitOut(split(bytes, n, k));
      setGenError(null);
    } catch (e) {
      setSplitOut([]);
      setGenError(e instanceof Error ? e.message : 'Failed to split secret.');
    }
  };

  const combined = useMemo<{ value: string } | { error: string } | null>(() => {
    if (mode !== 'combine') return null;
    const lines = sharesInput.split(/[\n,]+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return null;
    try {
      const bytes = combine(lines);
      return { value: bytesToSecret(bytes, fmt) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to reconstruct.' };
    }
  }, [mode, sharesInput, fmt]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Mode">
          <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <TabsList>
              <TabsTrigger value="split">Split</TabsTrigger>
              <TabsTrigger value="combine">Combine</TabsTrigger>
            </TabsList>
          </Tabs>
        </Field>
        <Field label="Secret format">
          <Select value={fmt} onValueChange={(v) => setFmt(v as SecretFmt)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utf8">UTF-8 text</SelectItem>
              <SelectItem value="hex">Hex</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {mode === 'split' && (
          <>
            <Field label="Total shares (N)">
              <Input
                value={nStr}
                onChange={(e) => setNStr(e.target.value)}
                inputMode="numeric"
                className="w-24"
              />
            </Field>
            <Field label="Threshold (K)">
              <Input
                value={kStr}
                onChange={(e) => setKStr(e.target.value)}
                inputMode="numeric"
                className="w-24"
              />
            </Field>
            <Button onClick={doSplit}>Split</Button>
          </>
        )}
      </OptionsBar>

      {mode === 'split' ? (
        <>
          <Panel>
            <PanelHeader title="Secret">
              <button
                type="button"
                className="rounded px-2 py-1 text-2xs text-muted-foreground hover:bg-muted"
                onClick={() => {
                  setFmt('utf8');
                  setSecret(SAMPLE_SECRET);
                }}
              >
                Sample
              </button>
            </PanelHeader>
            <Textarea
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              spellCheck={false}
              placeholder={fmt === 'hex' ? 'deadbeef…' : 'Your secret text'}
              className="min-h-20 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </Panel>

          {genError && <ErrorBanner error={genError} />}

          {splitOut.length > 0 && (
            <Panel>
              <PanelHeader title={`Shares (need K=${kStr} to reconstruct)`}>
                <CopyButton value={splitOut.join('\n')} />
              </PanelHeader>
              <div className="divide-y">
                {splitOut.map((s, i) => (
                  <div key={s} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-12 shrink-0 text-2xs text-muted-foreground">
                      #{i + 1}
                    </span>
                    <code className="min-w-0 flex-1 break-all font-mono text-xs">
                      {s}
                    </code>
                    <CopyButton value={s} size="icon-sm" />
                  </div>
                ))}
              </div>
              <StatBar items={[`${splitOut.length} shares`, `threshold ${kStr}`]} />
            </Panel>
          )}
        </>
      ) : (
        <>
          <Panel>
            <PanelHeader title="Shares (one per line, or comma-separated)" />
            <Textarea
              value={sharesInput}
              onChange={(e) => setSharesInput(e.target.value)}
              spellCheck={false}
              placeholder={'01-…\n03-…\n05-…'}
              className="min-h-32 resize-y rounded-none border-0 bg-transparent font-mono text-xs shadow-none focus-visible:ring-0 dark:bg-transparent"
            />
          </Panel>

          {combined && 'error' in combined && <ErrorBanner error={combined.error} />}

          {combined && 'value' in combined && (
            <Panel>
              <PanelHeader title="Reconstructed secret">
                <CopyButton value={combined.value} />
              </PanelHeader>
              <code className="block break-all p-3 font-mono text-sm">
                {combined.value}
              </code>
            </Panel>
          )}
        </>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        GF(256) Shamir scheme, computed entirely in your browser. Combining fewer than K valid
        shares yields garbage by design.
      </p>
    </div>
  );
}
