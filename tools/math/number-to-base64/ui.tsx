'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type Mode = 'encode' | 'decode';
type Order = 'big' | 'little';

function intToBytes(n: bigint): number[] {
  if (n === 0n) return [0];
  const out: number[] = [];
  let v = n;
  while (v > 0n) {
    out.unshift(Number(v & 0xffn));
    v >>= 8n;
  }
  return out; // big-endian
}

function bytesToInt(bytes: number[]): bigint {
  let v = 0n;
  for (const b of bytes) {
    v = (v << 8n) | BigInt(b & 0xff);
  }
  return v;
}

function bytesToBase64(bytes: number[], urlSafe: boolean, padding: boolean): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b & 0xff);
  let b64 = btoa(bin);
  if (urlSafe) b64 = b64.replace(/\+/g, '-').replace(/\//g, '_');
  if (!padding) b64 = b64.replace(/=+$/, '');
  return b64;
}

function base64ToBytes(b64: string): number[] | null {
  let s = b64.trim().replace(/-/g, '+').replace(/_/g, '/');
  // restore padding
  const rem = s.length % 4;
  if (rem === 1) return null;
  if (rem > 0) s += '='.repeat(4 - rem);
  try {
    const bin = atob(s);
    const out: number[] = [];
    for (let i = 0; i < bin.length; i += 1) out.push(bin.charCodeAt(i) & 0xff);
    return out;
  } catch {
    return null;
  }
}

function hex(bytes: number[]): string {
  return bytes.map((b) => (b & 0xff).toString(16).padStart(2, '0')).join(' ');
}

interface Ok {
  ok: true;
  rows: { label: string; value: string }[];
  primary: string;
  stats: string[];
}

interface Err {
  ok: false;
  error: string;
}

export default function NumberToBase64Tool() {
  const [mode, setMode] = useState<Mode>('encode');
  const [numRaw, setNumRaw] = useState('1234567890');
  const [b64Raw, setB64Raw] = useState('SZYC0g');
  const [order, setOrder] = useState<Order>('big');
  const [widthRaw, setWidthRaw] = useState('');
  const [urlSafe, setUrlSafe] = useState(false);
  const [padding, setPadding] = useState(true);

  const result = useMemo<Ok | Err>(() => {
    if (mode === 'encode') {
      const s = numRaw.trim();
      if (!/^\d+$/.test(s)) return { ok: false, error: 'Enter a non-negative integer.' };
      let n: bigint;
      try {
        n = BigInt(s);
      } catch {
        return { ok: false, error: 'Could not parse the integer.' };
      }
      let bytes = intToBytes(n);

      const w = widthRaw.trim();
      if (w !== '') {
        const width = Number(w);
        if (!Number.isFinite(width) || width < 1 || width > 256 || !Number.isInteger(width)) {
          return { ok: false, error: 'Byte width must be an integer between 1 and 256.' };
        }
        if (bytes.length > width) {
          return { ok: false, error: `Number needs ${bytes.length} bytes but width is ${width}. Increase the width.` };
        }
        while (bytes.length < width) bytes.unshift(0);
      }

      // bytes is big-endian; reverse for little-endian output
      const ordered = order === 'little' ? [...bytes].reverse() : bytes;
      const b64 = bytesToBase64(ordered, urlSafe, padding);

      return {
        ok: true,
        primary: b64,
        rows: [
          { label: 'Base64', value: b64 },
          { label: 'Hex bytes', value: hex(ordered) },
          { label: 'Byte count', value: String(ordered.length) },
        ],
        stats: [
          `Alphabet: ${urlSafe ? 'URL-safe' : 'standard'}`,
          `Padding: ${padding ? 'on' : 'off'}`,
          `Order: ${order === 'big' ? 'big-endian' : 'little-endian'}`,
        ],
      };
    }

    // decode
    const bytes = base64ToBytes(b64Raw);
    if (bytes === null) return { ok: false, error: 'Invalid Base64 input.' };
    if (bytes.length === 0) return { ok: false, error: 'Enter a Base64 string to decode.' };
    // bytes are as stored; interpret per order to recover big-endian
    const beBytes = order === 'little' ? [...bytes].reverse() : bytes;
    const n = bytesToInt(beBytes);
    return {
      ok: true,
      primary: n.toString(),
      rows: [
        { label: 'Integer', value: n.toString() },
        { label: 'Hex bytes', value: hex(bytes) },
        { label: 'Byte count', value: String(bytes.length) },
      ],
      stats: [`Order: ${order === 'big' ? 'big-endian' : 'little-endian'}`, `Decoded ${bytes.length} bytes`],
    };
  }, [mode, numRaw, b64Raw, order, widthRaw, urlSafe, padding]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Encode</TabsTrigger>
                <TabsTrigger value="decode">Decode</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'encode' ? (
            <>
              <Field label="Integer">
                <Input value={numRaw} onChange={(e) => setNumRaw(e.target.value)} inputMode="numeric" className="w-48 font-mono" />
              </Field>
              <Field label="Byte width (optional)">
                <Input value={widthRaw} onChange={(e) => setWidthRaw(e.target.value)} inputMode="numeric" placeholder="auto" className="w-28 font-mono" />
              </Field>
            </>
          ) : (
            <Field label="Base64">
              <Input value={b64Raw} onChange={(e) => setB64Raw(e.target.value)} className="w-64 font-mono" />
            </Field>
          )}
          <Field label="Byte order">
            <Select value={order} onValueChange={(v) => setOrder(v as Order)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="big">Big-endian</SelectItem>
                <SelectItem value="little">Little-endian</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === 'encode' && (
            <>
              <Field label="URL-safe">
                <Switch checked={urlSafe} onCheckedChange={setUrlSafe} />
              </Field>
              <Field label="Padding (=)">
                <Switch checked={padding} onCheckedChange={setPadding} />
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.primary} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div key={r.label} className="flex items-center justify-between gap-2 rounded-md border bg-muted/30 px-3 py-2">
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex min-w-0 items-center gap-2 font-mono text-sm">
                  <span className="truncate">{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={result.stats} />
        </Panel>
      )}
    </div>
  );
}
