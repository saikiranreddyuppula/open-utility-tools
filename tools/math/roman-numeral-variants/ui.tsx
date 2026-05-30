'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Style = 'standard' | 'additive' | 'vinculum';

const STYLE_LABELS: Record<Style, string> = {
  standard: 'Standard (subtractive)',
  additive: 'Additive (IIII)',
  vinculum: 'Vinculum (×1000)',
};

// Standard subtractive greedy mapping, 1–3999.
const STD: { v: number; s: string }[] = [
  { v: 1000, s: 'M' },
  { v: 900, s: 'CM' },
  { v: 500, s: 'D' },
  { v: 400, s: 'CD' },
  { v: 100, s: 'C' },
  { v: 90, s: 'XC' },
  { v: 50, s: 'L' },
  { v: 40, s: 'XL' },
  { v: 10, s: 'X' },
  { v: 9, s: 'IX' },
  { v: 5, s: 'V' },
  { v: 4, s: 'IV' },
  { v: 1, s: 'I' },
];

// Additive: no subtractive pairs (4 = IIII, 9 = VIIII, 40 = XXXX …).
const ADD: { v: number; s: string }[] = [
  { v: 1000, s: 'M' },
  { v: 500, s: 'D' },
  { v: 100, s: 'C' },
  { v: 50, s: 'L' },
  { v: 10, s: 'X' },
  { v: 5, s: 'V' },
  { v: 1, s: 'I' },
];

function toRomanBasic(n: number, table: { v: number; s: string }[]): string {
  let rem = n;
  let out = '';
  for (const { v, s } of table) {
    while (rem >= v) {
      out += s;
      rem -= v;
    }
  }
  return out;
}

const COMBINING_OVERLINE = '̅';

function overline(str: string): string {
  // Place a combining overline after each character.
  return Array.from(str)
    .map((ch) => ch + COMBINING_OVERLINE)
    .join('');
}

// Vinculum: thousands part rendered with an overline (×1000), remainder normal.
function toVinculum(n: number): string {
  const thousands = Math.floor(n / 1000);
  const rest = n % 1000;
  const restRoman = rest > 0 ? toRomanBasic(rest, STD) : '';
  if (thousands === 0) return restRoman;
  // Express the thousands count itself in Roman numerals, then overline it.
  const thouRoman = toRomanBasic(thousands, STD);
  return overline(thouRoman) + restRoman;
}

function encode(n: number, style: Style): string {
  switch (style) {
    case 'standard':
      return toRomanBasic(n, STD);
    case 'additive':
      return toRomanBasic(n, ADD);
    case 'vinculum':
      return toVinculum(n);
    default:
      return '';
  }
}

const VALS: Record<string, number> = {
  I: 1,
  V: 5,
  X: 10,
  L: 50,
  C: 100,
  D: 500,
  M: 1000,
};

// Decode a Roman string. Handles overlined chars (×1000) and both subtractive
// and additive conventions by the standard left-to-right rule.
function decode(raw: string): number | null {
  const trimmed = raw.trim().toUpperCase();
  if (!trimmed) return null;

  // Split into tokens of (letter, multiplier) where multiplier=1000 if overlined.
  const tokens: number[] = [];
  const chars = Array.from(trimmed);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === undefined) continue;
    if (ch === COMBINING_OVERLINE) continue; // handled with its base char
    const base = VALS[ch];
    if (base === undefined) return null;
    const next = chars[i + 1];
    const mult = next === COMBINING_OVERLINE ? 1000 : 1;
    tokens.push(base * mult);
  }
  if (tokens.length === 0) return null;

  let total = 0;
  for (let i = 0; i < tokens.length; i++) {
    const cur = tokens[i] ?? 0;
    const nxt = tokens[i + 1] ?? 0;
    if (cur < nxt) total -= cur;
    else total += cur;
  }
  return total;
}

function isRomanLike(s: string): boolean {
  // Any letter from the Roman alphabet (ignoring overlines) flags Roman input.
  return /[IVXLCDM]/i.test(s.replace(/[0-9\s]/g, ''));
}

export default function RomanNumeralVariantsTool() {
  const [style, setStyle] = useState<Style>('standard');
  const [input, setInput] = useState('2024');

  const result = useMemo(() => {
    const raw = input.trim();
    if (!raw) return { error: 'Enter an integer or a Roman numeral.' };

    let value: number;
    let primary: string;

    if (isRomanLike(raw)) {
      const dec = decode(raw);
      if (dec === null) return { error: 'Could not parse that Roman numeral.' };
      value = dec;
      primary = String(dec);
    } else {
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        return { error: 'Enter a whole number.' };
      }
      if (n <= 0) return { error: 'Roman numerals represent positive integers only.' };
      if (n > 3999999) return { error: 'Maximum supported value is 3,999,999.' };
      value = n;
      primary = encode(n, style);
    }

    if (value <= 0 || value > 3999999) {
      return { error: 'Value out of range (1–3,999,999).' };
    }

    const stdCapable = value <= 3999;
    const styles: { label: string; value: string }[] = [
      {
        label: STYLE_LABELS.standard,
        value: stdCapable ? toRomanBasic(value, STD) : '— (needs vinculum above 3999)',
      },
      {
        label: STYLE_LABELS.additive,
        value: stdCapable ? toRomanBasic(value, ADD) : '— (needs vinculum above 3999)',
      },
      { label: STYLE_LABELS.vinculum, value: toVinculum(value) },
    ];

    return { value, primary, styles };
  }, [style, input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Output style (for number → Roman)">
            <Tabs value={style} onValueChange={(v) => setStyle(v as Style)}>
              <TabsList>
                <TabsTrigger value="standard">Standard</TabsTrigger>
                <TabsTrigger value="additive">Additive</TabsTrigger>
                <TabsTrigger value="vinculum">Vinculum</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Integer or Roman numeral">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-56 font-mono"
              placeholder="2024 or MMXXIV"
              spellCheck={false}
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title="Result">
              <CopyButton value={() => result.primary} />
            </PanelHeader>
            <div className="flex items-center justify-between gap-2 p-4">
              <span className="text-sm text-muted-foreground">
                {isRomanLike(input.trim()) ? 'Decoded integer' : `${STYLE_LABELS[style]}`}
              </span>
              <span className="flex items-center gap-2 font-mono text-xl">
                <span>{result.primary}</span>
                <CopyButton value={result.primary} size="icon-sm" />
              </span>
            </div>
            <StatBar items={[`Value = ${result.value.toLocaleString()}`]} />
          </Panel>

          <Panel>
            <PanelHeader title="All styles">
              <CopyButton
                value={() => result.styles.map((s) => `${s.label}: ${s.value}`).join('\n')}
              />
            </PanelHeader>
            <div className="divide-y">
              {result.styles.map((s) => (
                <div key={s.label} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="text-sm text-muted-foreground">{s.label}</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span>{s.value}</span>
                    <CopyButton value={s.value} size="icon-sm" />
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
