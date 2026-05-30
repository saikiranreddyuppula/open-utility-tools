'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';

interface FieldRow {
  label: string;
  value: string;
}

// Difference (in 100-ns intervals) between the Gregorian UUID epoch
// (1582-10-15 00:00:00 UTC) and the Unix epoch (1970-01-01).
const GREGORIAN_OFFSET_100NS = 122192928000000000n;

function normalize(raw: string): string {
  let s = raw.trim().toLowerCase();
  s = s.replace(/^urn:uuid:/, '');
  s = s.replace(/[{}]/g, '');
  return s;
}

function variantName(byte: number): string {
  // The variant lives in the top bits of the 9th byte (clock_seq_hi).
  if ((byte & 0x80) === 0x00) return 'NCS (0xx) — reserved';
  if ((byte & 0xc0) === 0x80) return 'RFC 4122 (10x)';
  if ((byte & 0xe0) === 0xc0) return 'Microsoft (110)';
  return 'Reserved (111)';
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return 'out of range';
  return d.toISOString();
}

interface Parsed {
  canonical: string;
  hex32: string;
  version: number;
  variant: string;
  rows: FieldRow[];
  binary: string;
}

function parse(raw: string): Parsed {
  const s = normalize(raw);
  const dashed = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s);
  const bare = /^[0-9a-f]{32}$/.test(s);
  if (!dashed && !bare) {
    throw new Error('Not a valid UUID. Expected 8-4-4-4-12 hex (with optional braces/urn).');
  }
  const hex32 = s.replace(/-/g, '');

  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex32.slice(i * 2, i * 2 + 2), 16);
  }

  const canonical = `${hex32.slice(0, 8)}-${hex32.slice(8, 12)}-${hex32.slice(12, 16)}-${hex32.slice(16, 20)}-${hex32.slice(20)}`;
  const version = ((bytes[6] ?? 0) & 0xf0) >> 4;
  const variant = variantName(bytes[8] ?? 0);

  const rows: FieldRow[] = [
    { label: 'Version', value: String(version) },
    { label: 'Variant', value: variant },
  ];

  const fullHex = BigInt('0x' + hex32);

  if (version === 1 || version === 6) {
    // Reassemble the 60-bit timestamp.
    let ts: bigint;
    if (version === 1) {
      const timeLow = BigInt('0x' + hex32.slice(0, 8));
      const timeMid = BigInt('0x' + hex32.slice(8, 12));
      const timeHi = BigInt('0x' + hex32.slice(12, 16)) & 0x0fffn;
      ts = (timeHi << 48n) | (timeMid << 32n) | timeLow;
    } else {
      // v6: time is stored most-significant-first across the same fields.
      const timeHigh = BigInt('0x' + hex32.slice(0, 8));
      const timeMid = BigInt('0x' + hex32.slice(8, 12));
      const timeLow = BigInt('0x' + hex32.slice(12, 16)) & 0x0fffn;
      ts = (timeHigh << 28n) | (timeMid << 12n) | timeLow;
    }
    const unix100ns = ts - GREGORIAN_OFFSET_100NS;
    const ms = Number(unix100ns / 10000n);
    rows.push({ label: 'Timestamp', value: fmtDate(ms) });
    rows.push({ label: 'Raw 60-bit ticks', value: ts.toString() });

    const clockSeq = ((bytes[8] ?? 0) & 0x3f) * 256 + (bytes[9] ?? 0);
    rows.push({ label: 'Clock sequence', value: String(clockSeq) });

    const node = hex32.slice(20);
    const mac = (node.match(/../g) ?? []).join(':');
    rows.push({ label: 'Node (MAC)', value: mac });
    const multicast = ((bytes[10] ?? 0) & 0x01) === 0x01;
    rows.push({
      label: 'Node type',
      value: multicast ? 'multicast / randomized' : 'unicast (real MAC)',
    });
  } else if (version === 7) {
    const tsMs = fullHex >> 80n; // top 48 bits = Unix ms
    const ms = Number(tsMs);
    rows.push({ label: 'Timestamp (Unix ms)', value: tsMs.toString() });
    rows.push({ label: 'Timestamp', value: fmtDate(ms) });
  } else if (version === 4) {
    rows.push({ label: 'Source', value: 'Random (122 random bits)' });
  } else if (version === 3 || version === 5) {
    rows.push({
      label: 'Source',
      value: version === 3 ? 'Name-based (MD5)' : 'Name-based (SHA-1)',
    });
  }

  // 128-bit binary breakdown.
  let binary = '';
  for (let i = 0; i < 16; i++) {
    binary += (bytes[i] ?? 0).toString(2).padStart(8, '0');
    if (i % 2 === 1 && i < 15) binary += ' ';
  }

  return { canonical, hex32, version, variant, rows, binary };
}

const SAMPLE = '018f3b2a-1c4e-7d8a-9b3c-2a1f5e6d7c8b';

export default function UuidInspectorTool() {
  const [input, setInput] = useState(SAMPLE);

  const result = useMemo<{ data: Parsed } | { error: string } | null>(() => {
    if (!input.trim()) return null;
    try {
      return { data: parse(input) };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Failed to parse UUID.' };
    }
  }, [input]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="UUID" className="flex-1">
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 123e4567-e89b-12d3-a456-426614174000"
              className="font-mono"
            />
            <button
              type="button"
              className="shrink-0 rounded px-2 py-1 text-2xs text-muted-foreground hover:bg-muted"
              onClick={() => setInput(SAMPLE)}
            >
              Sample
            </button>
          </div>
        </Field>
      </OptionsBar>

      {result && 'error' in result && <ErrorBanner error={result.error} />}

      {result && 'data' in result && (
        <>
          <Panel>
            <PanelHeader title={`UUID v${result.data.version} — field breakdown`} />
            <div className="divide-y">
              {result.data.rows.map((r) => (
                <div key={r.label} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-40 shrink-0 text-xs text-muted-foreground">
                    {r.label}
                  </span>
                  <code className="min-w-0 flex-1 break-all font-mono text-xs">
                    {r.value}
                  </code>
                  <CopyButton value={r.value} size="icon-sm" />
                </div>
              ))}
            </div>
            <StatBar items={[result.data.variant, `version ${result.data.version}`]} />
          </Panel>

          <Panel>
            <PanelHeader title="Representations" />
            <div className="divide-y">
              {[
                { label: 'Canonical', value: result.data.canonical },
                { label: 'Uppercase', value: result.data.canonical.toUpperCase() },
                { label: 'No dashes', value: result.data.hex32 },
                { label: 'URN', value: `urn:uuid:${result.data.canonical}` },
              ].map((r) => (
                <div key={r.label} className="flex items-center gap-3 px-3 py-2">
                  <span className="w-28 shrink-0 text-xs text-muted-foreground">
                    {r.label}
                  </span>
                  <code className="min-w-0 flex-1 break-all font-mono text-xs">
                    {r.value}
                  </code>
                  <CopyButton value={r.value} size="icon-sm" />
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Raw 128 bits (binary)" />
            <code className="block break-all p-3 font-mono text-2xs leading-relaxed">
              {result.data.binary}
            </code>
          </Panel>
        </>
      )}
      <p className="px-1 text-2xs text-muted-foreground">
        Pure local parsing. Timestamps for v1/v6 use the Gregorian epoch (1582-10-15); v7 uses
        Unix milliseconds.
      </p>
    </div>
  );
}
