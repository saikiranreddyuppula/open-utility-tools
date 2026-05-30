'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

// Subset of ISO 3166-1 alpha-2 codes commonly used for BIC country fields.
const COUNTRIES = [
  'US', 'GB', 'DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'CH', 'AT',
  'SE', 'NO', 'DK', 'FI', 'IE', 'PT', 'PL', 'CZ', 'GR', 'LU',
  'CA', 'AU', 'JP', 'CN', 'IN', 'BR', 'MX', 'ZA', 'SG', 'HK',
  'AE', 'SA', 'TR', 'RU', 'KR', 'NZ',
] as const;

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

type Format = '8' | '11';

// Mulberry32 — small deterministic PRNG seeded from a 32-bit integer.
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(rng: () => number, chars: string): string {
  const i = Math.floor(rng() * chars.length);
  return chars[Math.min(i, chars.length - 1)] ?? chars[0] ?? 'A';
}

function buildOne(
  rng: () => number,
  opts: {
    format: Format;
    fixedBank: string;
    fixedCountry: string;
    branchXxx: boolean;
  }
): string {
  let bank = opts.fixedBank.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  while (bank.length < 4) bank += pick(rng, UPPER);

  let country = opts.fixedCountry;
  if (!country) {
    const idx = Math.floor(rng() * COUNTRIES.length);
    country = COUNTRIES[Math.min(idx, COUNTRIES.length - 1)] ?? 'US';
  }

  // Location code: 2 alphanumerics. Second char must not be '0' or '1'
  // (those are reserved for test/passive flags in the BIC spec).
  const loc0 = pick(rng, ALNUM);
  const validSecond = ALNUM.replace(/[01]/g, '');
  const loc1 = pick(rng, validSecond);
  const location = loc0 + loc1;

  let code = bank + country + location;
  if (opts.format === '11') {
    const branch = opts.branchXxx ? 'XXX' : pick(rng, ALNUM) + pick(rng, ALNUM) + pick(rng, ALNUM);
    code += branch;
  }
  return code;
}

export default function BicSwiftTestGeneratorTool() {
  const [count, setCount] = useState(10);
  const [format, setFormat] = useState<Format>('11');
  const [fixedCountry, setFixedCountry] = useState<string>('');
  const [fixedBank, setFixedBank] = useState('');
  const [branchXxx, setBranchXxx] = useState(true);
  const [asJson, setAsJson] = useState(false);
  const [seed, setSeed] = useState('');
  const [nonce, setNonce] = useState(0);

  const result = useMemo(() => {
    const n = Math.max(1, Math.min(count, 500));
    const bankClean = fixedBank.toUpperCase().replace(/[^A-Z]/g, '');
    if (fixedBank && bankClean.length > 4) {
      return { error: 'Fixed bank code may be at most 4 letters (A-Z).' };
    }
    const seedNum = seed.trim()
      ? hashSeed(seed.trim())
      : (wc.getRandomValues(new Uint32Array(1))[0] ?? 1) ^ nonce;
    const rng = makeRng(seedNum >>> 0);
    const codes: string[] = [];
    for (let i = 0; i < n; i++) {
      codes.push(buildOne(rng, { format, fixedBank: bankClean, fixedCountry, branchXxx }));
    }
    const text = asJson
      ? JSON.stringify(codes, null, 2)
      : codes.join('\n');
    return { codes, text };
  }, [count, format, fixedCountry, fixedBank, branchXxx, asJson, seed, nonce]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(Number(e.target.value) || 1, 500)))}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Length">
          <Select value={format} onValueChange={(v) => setFormat(v as Format)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="8">8 chars (primary)</SelectItem>
              <SelectItem value="11">11 chars (+branch)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Country" hint="blank = random">
          <Select value={fixedCountry || 'random'} onValueChange={(v) => setFixedCountry(v === 'random' ? '' : v)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="random">Random</SelectItem>
              {COUNTRIES.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Fixed bank" hint="0-4 letters, blank = random">
          <Input
            value={fixedBank}
            onChange={(e) => setFixedBank(e.target.value)}
            placeholder="DEUT"
            maxLength={4}
            className="w-24 font-mono uppercase"
          />
        </Field>
        {format === '11' && (
          <Field label="Branch">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={branchXxx} onCheckedChange={setBranchXxx} id="branch" />
              <Label htmlFor="branch" className="text-xs text-muted-foreground">
                {branchXxx ? 'XXX (primary office)' : 'random'}
              </Label>
            </div>
          </Field>
        )}
        <Field label="Seed" hint="blank = random">
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            placeholder="optional"
            className="w-28 font-mono"
          />
        </Field>
        <Field label="JSON">
          <div className="flex h-9 items-center gap-2">
            <Switch checked={asJson} onCheckedChange={setAsJson} id="json" />
            <Label htmlFor="json" className="text-xs text-muted-foreground">array</Label>
          </div>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setNonce((x) => x + 1)}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </OptionsBar>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Test BIC / SWIFT codes">
            <CopyButton value={() => result.text} label="Copy all" />
            <DownloadButton data={() => result.text} filename={asJson ? 'bic-codes.json' : 'bic-codes.txt'} />
          </PanelHeader>
          <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs whitespace-pre-wrap">{result.text}</pre>
          <StatBar
            items={[
              `${result.codes.length} codes`,
              `${format}-char`,
              'syntactically valid test data — not assigned to real institutions',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
