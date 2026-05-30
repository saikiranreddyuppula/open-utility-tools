'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Brand = 'visa' | 'mastercard' | 'amex' | 'discover';

interface BrandSpec {
  label: string;
  prefixes: string[];
  length: number;
  cvvLen: number;
}

const BRANDS: Record<Brand, BrandSpec> = {
  visa: { label: 'Visa', prefixes: ['4'], length: 16, cvvLen: 3 },
  mastercard: { label: 'Mastercard', prefixes: ['51', '52', '53', '54', '55', '2221', '2720'], length: 16, cvvLen: 3 },
  amex: { label: 'American Express', prefixes: ['34', '37'], length: 15, cvvLen: 4 },
  discover: { label: 'Discover', prefixes: ['6011', '65', '644', '645', '646', '647', '648', '649'], length: 16, cvvLen: 3 },
};

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

function hashSeed(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Compute the Luhn check digit for a digit string missing its last digit. */
function luhnCheckDigit(partial: string): number {
  let sum = 0;
  // The check digit will be at the rightmost position, so existing digits are
  // doubled at alternating positions starting from the rightmost partial digit.
  let double = true;
  for (let i = partial.length - 1; i >= 0; i--) {
    const ch = partial[i] ?? '0';
    let d = ch.charCodeAt(0) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

function genCard(spec: BrandSpec, rng: () => number): string {
  const prefix = spec.prefixes[Math.floor(rng() * spec.prefixes.length)] ?? spec.prefixes[0] ?? '4';
  let digits = prefix;
  while (digits.length < spec.length - 1) {
    digits += String(Math.floor(rng() * 10));
  }
  digits += String(luhnCheckDigit(digits));
  return digits;
}

function formatCard(num: string, brand: Brand): string {
  if (brand === 'amex') {
    // 4-6-5 grouping
    return `${num.slice(0, 4)} ${num.slice(4, 10)} ${num.slice(10)}`.trim();
  }
  return (num.match(/.{1,4}/g) ?? [num]).join(' ');
}

interface Card {
  number: string;
  display: string;
  expiry: string;
  cvv: string;
}

export default function FakeCreditCardLuhnSet() {
  const [brand, setBrand] = useState<Brand>('visa');
  const [count, setCount] = useState('10');
  const [seed, setSeed] = useState('');
  const [spaced, setSpaced] = useState(true);
  const [nonce, setNonce] = useState(0);

  const result = useMemo(() => {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 500) {
      return { error: 'Count must be a whole number between 1 and 500.' };
    }
    const spec = BRANDS[brand];
    const baseSeed = seed.trim()
      ? hashSeed(seed.trim())
      : (() => {
          const r = new Uint32Array(1);
          wc.getRandomValues(r);
          return (r[0] ?? 1) ^ nonce;
        })();
    const rng = mulberry32(baseSeed || 1);

    const cards: Card[] = [];
    for (let i = 0; i < n; i++) {
      const number = genCard(spec, rng);
      const month = 1 + Math.floor(rng() * 12);
      const year = 26 + Math.floor(rng() * 7); // 2026-2032
      const expiry = `${String(month).padStart(2, '0')}/${String(year).padStart(2, '0')}`;
      let cvv = '';
      for (let c = 0; c < spec.cvvLen; c++) cvv += String(Math.floor(rng() * 10));
      cards.push({
        number,
        display: spaced ? formatCard(number, brand) : number,
        expiry,
        cvv,
      });
    }

    const csv = ['number,expiry,cvv,brand', ...cards.map((c) => `${c.number},${c.expiry},${c.cvv},${spec.label}`)].join('\n');
    const text = cards.map((c) => `${c.display}  exp ${c.expiry}  cvv ${c.cvv}`).join('\n');
    return { cards, csv, text, label: spec.label };
  }, [brand, count, seed, spaced, nonce]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Brand">
          <Select value={brand} onValueChange={(v) => setBrand(v as Brand)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BRANDS) as Brand[]).map((b) => (
                <SelectItem key={b} value={b}>
                  {BRANDS[b].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={500}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Seed" hint="empty = random">
          <Input
            value={seed}
            onChange={(e) => setSeed(e.target.value)}
            className="w-36 font-mono"
            placeholder="optional"
          />
        </Field>
        <Field label="Grouping">
          <div className="flex h-8 items-center gap-2">
            <Switch checked={spaced} onCheckedChange={setSpaced} id="cc-spaced" />
            <Label htmlFor="cc-spaced" className="text-xs text-muted-foreground">
              {spaced ? 'Spaced' : 'Plain'}
            </Label>
          </div>
        </Field>
        <div className="ml-auto flex items-end">
          <button
            type="button"
            onClick={() => setNonce((x) => x + 1)}
            className="inline-flex h-8 items-center rounded-md border bg-secondary px-3 text-xs font-medium hover:bg-secondary/80"
          >
            Regenerate
          </button>
        </div>
      </OptionsBar>

      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        Test data only. These pass the Luhn check but are not real cards and cannot process payments.
      </div>

      {'error' in result ? (
        <Panel>
          <div className="p-3 text-sm text-destructive">{result.error}</div>
        </Panel>
      ) : (
        <Panel>
          <PanelHeader title={`${result.label} test cards`}>
            <CopyButton value={() => result.text} label="Copy all" />
            <DownloadButton data={() => result.csv} filename="test-cards.csv" />
          </PanelHeader>
          <div className="max-h-[440px] divide-y overflow-auto">
            {result.cards.map((c, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                  {i + 1}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{c.display}</code>
                <code className="shrink-0 font-mono text-2xs text-muted-foreground">exp {c.expiry}</code>
                <code className="shrink-0 font-mono text-2xs text-muted-foreground">cvv {c.cvv}</code>
                <CopyButton value={`${c.number} ${c.expiry} ${c.cvv}`} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar items={[`${result.cards.length} cards`, 'Luhn-valid']} />
        </Panel>
      )}
    </div>
  );
}
