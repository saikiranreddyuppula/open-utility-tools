'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'encode' | 'decode';
type Radix = 'hex' | 'dec' | 'bin';
type CpNotation = 'uplus' | 'backslash';

function toRadix(b: number, radix: Radix): string {
  if (radix === 'hex') return b.toString(16).toUpperCase().padStart(2, '0');
  if (radix === 'bin') return b.toString(2).padStart(8, '0');
  return b.toString();
}

function cpLabel(cp: number, notation: CpNotation): string {
  const h = cp.toString(16).toUpperCase().padStart(4, '0');
  return notation === 'uplus' ? `U+${h}` : `\\u${h}`;
}

interface CharRow {
  char: string;
  cp: number;
  byteCount: number;
  bytes: number[];
}

function inspect(text: string): CharRow[] {
  const enc = new TextEncoder();
  const rows: CharRow[] = [];
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0) ?? 0;
    const bytes = Array.from(enc.encode(ch));
    rows.push({ char: ch, cp, byteCount: bytes.length, bytes });
  }
  return rows;
}

function parseByteList(text: string): number[] {
  const tokens = text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const bytes: number[] = [];
  for (const tokRaw of tokens) {
    let tok = tokRaw;
    let value: number;
    if (/^0x[0-9a-fA-F]+$/.test(tok)) {
      value = parseInt(tok.slice(2), 16);
    } else if (/^[01]{8}$/.test(tok)) {
      value = parseInt(tok, 2);
    } else if (/^[0-9a-fA-F]{2}$/.test(tok)) {
      value = parseInt(tok, 16);
    } else if (/^\d+$/.test(tok)) {
      value = parseInt(tok, 10);
    } else {
      throw new Error(`Cannot parse byte token: "${tok}"`);
    }
    if (!Number.isFinite(value) || value < 0 || value > 255) {
      throw new Error(`Byte out of range (0-255): "${tok}"`);
    }
    bytes.push(value);
  }
  return bytes;
}

export default function Utf8ByteInspector() {
  const [mode, setMode] = useState<Mode>('encode');
  const [input, setInput] = useState('Héllo, 世界 😀');
  const [decodeInput, setDecodeInput] = useState('48 C3 A9 6C 6C 6F');
  const [radix, setRadix] = useState<Radix>('hex');
  const [notation, setNotation] = useState<CpNotation>('uplus');

  const encodeResult = useMemo(() => {
    const rows = inspect(input);
    const allBytes = rows.flatMap((r) => r.bytes);
    const spaceHex = allBytes.map((b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
    const arrHex = '[' + allBytes.map((b) => '0x' + b.toString(16).toUpperCase().padStart(2, '0')).join(', ') + ']';
    const arrDec = '[' + allBytes.join(', ') + ']';
    const binStr = allBytes.map((b) => b.toString(2).padStart(8, '0')).join(' ');
    return { rows, allBytes, spaceHex, arrHex, arrDec, binStr };
  }, [input]);

  const decodeResult = useMemo(() => {
    if (!decodeInput.trim()) return { text: '', error: null as string | null, byteCount: 0 };
    try {
      const bytes = parseByteList(decodeInput);
      const u8 = new Uint8Array(bytes);
      const decoder = new TextDecoder('utf-8', { fatal: true });
      const text = decoder.decode(u8);
      return { text, error: null, byteCount: bytes.length };
    } catch (e) {
      return {
        text: '',
        error:
          e instanceof Error && /utf|decode|code point|malformed/i.test(e.message)
            ? 'Invalid or overlong UTF-8 byte sequence.'
            : e instanceof Error
              ? e.message
              : 'Decode failed.',
        byteCount: 0,
      };
    }
  }, [decodeInput]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="encode">Text → Bytes</TabsTrigger>
                <TabsTrigger value="decode">Bytes → Text</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          {mode === 'encode' && (
            <>
              <Field label="Radix">
                <Select value={radix} onValueChange={(v) => setRadix(v as Radix)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hex">Hex</SelectItem>
                    <SelectItem value="dec">Decimal</SelectItem>
                    <SelectItem value="bin">Binary</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Code point">
                <Select value={notation} onValueChange={(v) => setNotation(v as CpNotation)}>
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="uplus">U+XXXX</SelectItem>
                    <SelectItem value="backslash">\uXXXX</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}
        </OptionsBar>
      </Panel>

      {mode === 'encode' ? (
        <>
          <Panel>
            <PanelHeader title="Input text" />
            <div className="p-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                spellCheck={false}
                rows={3}
                className="text-sm"
              />
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Per-character breakdown" />
            <div className="max-h-[360px] overflow-auto">
              <div className="flex items-center gap-3 border-b bg-muted/30 px-3 py-2 text-xs font-medium text-muted-foreground">
                <span className="w-10 shrink-0">Char</span>
                <span className="w-20 shrink-0">Code pt</span>
                <span className="w-12 shrink-0">Bytes</span>
                <span className="min-w-0 flex-1">{radix === 'bin' ? 'Binary' : radix === 'dec' ? 'Decimal' : 'Hex'}</span>
              </div>
              {encodeResult.rows.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Type text above.</div>
              ) : (
                encodeResult.rows.map((r, i) => (
                  <div key={i} className="flex items-center gap-3 border-b px-3 py-1.5 text-xs">
                    <span className="w-10 shrink-0 font-mono">{r.char === ' ' ? '␠' : r.char}</span>
                    <span className="w-20 shrink-0 font-mono text-muted-foreground">
                      {cpLabel(r.cp, notation)}
                    </span>
                    <span className="w-12 shrink-0 font-mono">{r.byteCount}</span>
                    <span className="min-w-0 flex-1 break-all font-mono">
                      {r.bytes.map((b) => toRadix(b, radix)).join(' ')}
                    </span>
                  </div>
                ))
              )}
            </div>
            <StatBar
              items={[
                `${encodeResult.rows.length} char(s)`,
                `${encodeResult.allBytes.length} byte(s)`,
              ]}
            />
          </Panel>

          <Panel>
            <PanelHeader title="Full byte stream" />
            <div className="space-y-2 p-3">
              {[
                { label: 'Hex (spaced)', value: encodeResult.spaceHex },
                { label: '0x array', value: encodeResult.arrHex },
                { label: 'Decimal array', value: encodeResult.arrDec },
                { label: 'Binary', value: encodeResult.binStr },
              ].map((o) => (
                <div key={o.label} className="rounded-md border bg-muted/30 px-3 py-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{o.label}</span>
                    <CopyButton value={o.value} size="icon-sm" />
                  </div>
                  <div className="break-all font-mono text-xs">{o.value || '(empty)'}</div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      ) : (
        <>
          <Panel>
            <PanelHeader title="UTF-8 byte list" />
            <div className="p-3">
              <div className="mb-1 text-xs text-muted-foreground">
                Accepts hex (<code>C3 A9</code> or <code>0xC3</code>), decimal, or 8-bit binary, separated by spaces/commas.
              </div>
              <Textarea
                value={decodeInput}
                onChange={(e) => setDecodeInput(e.target.value)}
                spellCheck={false}
                rows={4}
                className="font-mono text-sm"
              />
            </div>
          </Panel>
          {decodeResult.error ? (
            <ErrorBanner error={decodeResult.error} />
          ) : (
            <Panel>
              <PanelHeader title="Decoded text">
                <CopyButton value={() => decodeResult.text} />
              </PanelHeader>
              <div className="break-all p-3 font-mono text-sm">{decodeResult.text || '(empty)'}</div>
              <StatBar items={[`${decodeResult.byteCount} byte(s)`]} />
            </Panel>
          )}
        </>
      )}
    </div>
  );
}
