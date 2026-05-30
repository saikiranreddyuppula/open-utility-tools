'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Style = 'e164' | 'national' | 'dashed' | 'dotted' | 'spaced';
type OutFmt = 'lines' | 'json' | 'csv';

interface Country {
  code: string;
  name: string;
  dial: string;
  /** total national significant digits */
  nsn: number;
  /** Build the national-significant-number digit string from a digit-picker fn. */
  build: (d: (n: number) => string) => string;
}

// Reserved/fictional blocks used where the country defines them (US 555-01xx).
// Others use clearly-random digits suitable only for QA/test data.
const COUNTRIES: Country[] = [
  {
    code: 'US',
    name: 'United States (+1)',
    dial: '+1',
    nsn: 10,
    build: (d) => `${d(1)}${d(1)}${d(1)}555${'01'}${d(1)}${d(1)}`, // NPA + 555-01xx fictional
  },
  {
    code: 'GB',
    name: 'United Kingdom (+44)',
    dial: '+44',
    nsn: 10,
    build: (d) => `7700900${d(1)}${d(1)}${d(1)}`, // Ofcom drama reserved range 07700 900xxx
  },
  {
    code: 'IN',
    name: 'India (+91)',
    dial: '+91',
    nsn: 10,
    build: (d) => `9${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}`,
  },
  {
    code: 'DE',
    name: 'Germany (+49)',
    dial: '+49',
    nsn: 10,
    build: (d) => `15${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}`,
  },
  {
    code: 'FR',
    name: 'France (+33)',
    dial: '+33',
    nsn: 9,
    build: (d) => `6${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}`,
  },
  {
    code: 'AU',
    name: 'Australia (+61)',
    dial: '+61',
    nsn: 9,
    build: (d) => `4${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}`,
  },
  {
    code: 'JP',
    name: 'Japan (+81)',
    dial: '+81',
    nsn: 10,
    build: (d) => `90${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}`,
  },
  {
    code: 'BR',
    name: 'Brazil (+55)',
    dial: '+55',
    nsn: 11,
    build: (d) => `119${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}${d(1)}`,
  },
];

const COUNTRY_MAP: Record<string, Country> = Object.fromEntries(
  COUNTRIES.map((c) => [c.code, c])
);

/** mulberry32 deterministic PRNG seeded from a 32-bit integer. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function groupDigits(nsn: string): string[] {
  // Group into chunks of 3 then a final 4 where possible for readability.
  const groups: string[] = [];
  let rest = nsn;
  if (rest.length > 4) {
    while (rest.length > 4) {
      groups.push(rest.slice(0, 3));
      rest = rest.slice(3);
    }
  }
  groups.push(rest);
  return groups;
}

function formatNumber(c: Country, nsn: string, style: Style): string {
  const groups = groupDigits(nsn);
  switch (style) {
    case 'e164':
      return `${c.dial}${nsn}`;
    case 'national': {
      const first = groups[0] ?? nsn;
      const rest = groups.slice(1).join('-');
      return rest ? `(${first}) ${rest}` : `(${first})`;
    }
    case 'dashed':
      return groups.join('-');
    case 'dotted':
      return groups.join('.');
    case 'spaced':
      return `${c.dial} ${groups.join(' ')}`;
    default:
      return `${c.dial}${nsn}`;
  }
}

export default function PhoneNumberFormatGeneratorTool() {
  const [country, setCountry] = useState('US');
  const [count, setCount] = useState(10);
  const [style, setStyle] = useState<Style>('national');
  const [withExt, setWithExt] = useState(false);
  const [seed, setSeed] = useState('');
  const [outFmt, setOutFmt] = useState<OutFmt>('lines');
  const [nonce, setNonce] = useState(0);

  const records = useMemo(() => {
    const c = COUNTRY_MAP[country] ?? COUNTRIES[0];
    if (!c) return [] as { number: string; ext: string }[];
    const n = Math.max(1, Math.min(count, 1000));

    const rngNum = seed.trim()
      ? mulberry32((hashSeed(seed.trim()) + nonce) >>> 0)
      : () => {
          const b = new Uint32Array(1);
          wc.getRandomValues(b);
          return (b[0] ?? 0) / 4294967296;
        };

    const digit = (k: number): string => {
      let s = '';
      for (let i = 0; i < k; i++) s += Math.floor(rngNum() * 10).toString();
      return s;
    };

    const out: { number: string; ext: string }[] = [];
    for (let i = 0; i < n; i++) {
      const nsn = c.build(digit);
      const formatted = formatNumber(c, nsn, style);
      const ext = withExt ? `x${digit(3)}` : '';
      out.push({ number: ext ? `${formatted} ${ext}` : formatted, ext });
    }
    return out;
  }, [country, count, style, withExt, seed, nonce]);

  const text = useMemo(() => {
    switch (outFmt) {
      case 'lines':
        return records.map((r) => r.number).join('\n');
      case 'json':
        return JSON.stringify(
          records.map((r) => ({ phone: r.number })),
          null,
          2
        );
      case 'csv': {
        const header = withExt ? 'phone,extension' : 'phone';
        const body = records
          .map((r) =>
            withExt ? `"${r.number}","${r.ext}"` : `"${r.number}"`
          )
          .join('\n');
        return `${header}\n${body}`;
      }
      default:
        return records.map((r) => r.number).join('\n');
    }
  }, [records, outFmt, withExt]);

  const ext = outFmt === 'json' ? 'json' : outFmt === 'csv' ? 'csv' : 'txt';

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Country">
          <Select value={country} onValueChange={setCountry}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(Number(e.target.value) || 1, 1000)))}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Style">
          <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="e164">E.164 (+CC…)</SelectItem>
              <SelectItem value="national">National (parens)</SelectItem>
              <SelectItem value="dashed">Dashed</SelectItem>
              <SelectItem value="dotted">Dotted</SelectItem>
              <SelectItem value="spaced">Spaced (intl)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Output">
          <Select value={outFmt} onValueChange={(v) => setOutFmt(v as OutFmt)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lines">One per line</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Seed" hint="optional, deterministic">
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="w-28 font-mono"
            placeholder="random"
          />
        </Field>
        <Field label="Extension">
          <Select value={withExt ? 'yes' : 'no'} onValueChange={(v) => setWithExt(v === 'yes')}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">none</SelectItem>
              <SelectItem value="yes">include</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setNonce((x) => x + 1)}>
            <RefreshCw className="size-3.5" /> Regenerate
          </Button>
        </div>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Phone numbers (test/fake)">
          <CopyButton value={() => text} label="Copy all" disabled={!text} />
          <DownloadButton data={() => text} filename={`phone-numbers.${ext}`} disabled={!text} />
        </PanelHeader>
        <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs">{text}</pre>
        <StatBar
          items={[
            `${records.length.toLocaleString()} numbers`,
            seed.trim() ? `seed: ${seed.trim()}` : 'crypto random',
            'fictional / QA use only',
          ]}
        />
      </Panel>
    </div>
  );
}
