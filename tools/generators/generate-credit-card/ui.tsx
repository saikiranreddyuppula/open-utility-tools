'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const webcrypto = (
  globalThis as unknown as {
    crypto: {
      getRandomValues<T extends ArrayBufferView>(a: T): T;
      randomUUID(): string;
    };
  }
).crypto;

type Brand = 'visa' | 'mastercard' | 'amex' | 'discover';

interface BrandSpec {
  label: string;
  prefixes: string[];
  length: number;
  cvvLength: number;
}

const BRANDS: Record<Brand, BrandSpec> = {
  visa: { label: 'Visa', prefixes: ['4'], length: 16, cvvLength: 3 },
  mastercard: {
    label: 'Mastercard',
    prefixes: ['51', '52', '53', '54', '55', '2221', '2720'],
    length: 16,
    cvvLength: 3,
  },
  amex: { label: 'American Express', prefixes: ['34', '37'], length: 15, cvvLength: 4 },
  discover: { label: 'Discover', prefixes: ['6011', '65', '644', '645', '646', '647', '648', '649'], length: 16, cvvLength: 3 },
};

/** Random integer in [0, max). */
function randInt(max: number): number {
  if (max <= 0) return 0;
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let value = 0;
  do {
    webcrypto.getRandomValues(buf);
    value = buf[0] ?? 0;
  } while (value >= limit);
  return value % max;
}

function randomDigit(): string {
  return String(randInt(10));
}

/** Luhn check digit for a numeric string of body digits (without the check digit). */
function luhnCheckDigit(body: string): number {
  let sum = 0;
  // The check digit will be appended, so the rightmost body digit is at an even
  // position from the right (doubled).
  let double = true;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    let d = Number(body[i] ?? '0');
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return (10 - (sum % 10)) % 10;
}

function generateCard(spec: BrandSpec): string {
  const prefix = spec.prefixes[randInt(spec.prefixes.length)] ?? spec.prefixes[0] ?? '';
  let body = prefix;
  // Fill up to length - 1 (last digit is the Luhn check digit).
  while (body.length < spec.length - 1) {
    body += randomDigit();
  }
  return body + String(luhnCheckDigit(body));
}

function groupNumber(num: string, isAmex: boolean): string {
  if (isAmex) {
    // 4-6-5 grouping for 15-digit Amex.
    return `${num.slice(0, 4)} ${num.slice(4, 10)} ${num.slice(10)}`.trim();
  }
  return (num.match(/.{1,4}/g) ?? [num]).join(' ');
}

function generateExpiry(): string {
  const now = new Date();
  // 1-5 years into the future.
  const yearsAhead = 1 + randInt(5);
  const month = 1 + randInt(12);
  const year = now.getFullYear() + yearsAhead;
  return `${String(month).padStart(2, '0')}/${String(year).slice(-2)}`;
}

function generateCvv(len: number): string {
  let out = '';
  for (let i = 0; i < len; i += 1) out += randomDigit();
  return out;
}

interface Card {
  number: string;
  grouped: string;
  expiry: string;
  cvv: string;
}

export default function CreditCardTool() {
  const [brand, setBrand] = useState<Brand>('visa');
  const [count, setCount] = useState(5);
  const [withExpiry, setWithExpiry] = useState(true);
  const [withCvv, setWithCvv] = useState(true);
  const [cards, setCards] = useState<Card[]>([]);

  const safeCount = Number.isFinite(count) ? Math.min(1000, Math.max(1, Math.floor(count))) : 5;

  const regen = useCallback(() => {
    const spec = BRANDS[brand] ?? BRANDS.visa;
    const isAmex = brand === 'amex';
    const next: Card[] = Array.from({ length: safeCount }, () => {
      const number = generateCard(spec);
      return {
        number,
        grouped: groupNumber(number, isAmex),
        expiry: generateExpiry(),
        cvv: generateCvv(spec.cvvLength),
      };
    });
    setCards(next);
  }, [brand, safeCount]);

  useEffect(() => {
    regen();
  }, [regen]);

  const lineFor = (c: Card): string => {
    const parts = [c.number];
    if (withExpiry) parts.push(c.expiry);
    if (withCvv) parts.push(c.cvv);
    return parts.join(' | ');
  };

  const allText = cards.map(lineFor).join('\n');

  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
        For testing only. These are randomly generated, Luhn-valid numbers with no real account
        behind them. Never use them for fraud or real transactions.
      </div>

      <OptionsBar>
        <Field label="Brand">
          <Select value={brand} onValueChange={(v) => setBrand(v as Brand)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BRANDS) as Brand[]).map((b) => (
                <SelectItem key={b} value={b}>
                  {BRANDS[b]?.label ?? b}
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
            value={Number.isFinite(count) ? count : 1}
            onChange={(e) => {
              const n = Number(e.target.value);
              setCount(Number.isFinite(n) ? Math.min(1000, Math.max(1, Math.floor(n))) : 1);
            }}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Include">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withExpiry} onCheckedChange={(v) => setWithExpiry(v === true)} />
              <span>Expiry</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={withCvv} onCheckedChange={(v) => setWithCvv(v === true)} />
              <span>CVV</span>
            </label>
          </div>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={regen}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Test cards">
          <CopyButton value={() => allText} label="Copy all" disabled={!allText} />
          <DownloadButton data={() => allText} filename="test-cards.txt" disabled={!allText} />
        </PanelHeader>
        <div className="max-h-[420px] divide-y overflow-auto">
          {cards.map((c, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-1.5">
              <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                {i + 1}
              </span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs">
                {c.grouped}
                {withExpiry ? <span className="text-muted-foreground">{`  exp ${c.expiry}`}</span> : null}
                {withCvv ? <span className="text-muted-foreground">{`  cvv ${c.cvv}`}</span> : null}
              </code>
              <CopyButton value={lineFor(c)} size="icon-sm" />
            </div>
          ))}
        </div>
        <StatBar
          items={[`${cards.length.toLocaleString()} generated`, BRANDS[brand]?.label ?? brand]}
        />
      </Panel>
    </div>
  );
}
