'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

type Mode = 'validate' | 'compute';

interface Row {
  label: string;
  value: string;
}

interface Ok {
  rows: Row[];
}

interface Err {
  error: string;
}

/** Luhn sum over a full digit array (rightmost digit doubled second). */
function luhnSum(digits: number[]): number {
  let sum = 0;
  let dbl = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits[i] ?? 0;
    if (dbl) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    dbl = !dbl;
  }
  return sum;
}

function toDigits(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i] ?? '';
    out.push(ch.charCodeAt(0) - 48);
  }
  return out;
}

function detectNetwork(s: string): string {
  if (/^4\d{0,}$/.test(s)) return 'Visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]|7[01]|720))/.test(s)) return 'Mastercard';
  if (/^3[47]/.test(s)) return 'American Express';
  if (/^(6011|65|64[4-9]|622)/.test(s)) return 'Discover';
  if (/^3(0[0-5]|6|8)/.test(s)) return 'Diners Club';
  if (/^35/.test(s)) return 'JCB';
  if (/^(50|5[6-9]|6[^5])/.test(s)) return 'Maestro';
  return 'Unknown / non-card';
}

export default function LuhnValidatorTool() {
  const [mode, setMode] = useState<Mode>('validate');
  const [raw, setRaw] = useState('4539 1488 0343 6467');

  const result = useMemo<Ok | Err>(() => {
    const s = raw.replace(/[\s-]/g, '');
    if (!s) return { error: 'Enter a numeric string.' };
    if (!/^\d+$/.test(s)) return { error: 'Only digits, spaces, and dashes are allowed.' };

    const network = detectNetwork(s);

    if (mode === 'validate') {
      const sum = luhnSum(toDigits(s));
      const valid = sum % 10 === 0;
      return {
        rows: [
          { label: 'Result', value: valid ? 'VALID' : 'INVALID' },
          { label: 'Luhn sum', value: String(sum) },
          { label: 'Sum mod 10', value: String(sum % 10) },
          { label: 'Digits', value: String(s.length) },
          { label: 'Likely network', value: network },
        ],
      };
    }

    // compute: treat the whole input as the payload (without check digit),
    // append a 0 placeholder, compute the digit that makes the total a multiple of 10.
    const payload = toDigits(s);
    const sumWithZero = luhnSum([...payload, 0]);
    const check = (10 - (sumWithZero % 10)) % 10;
    return {
      rows: [
        { label: 'Payload', value: s },
        { label: 'Check digit', value: String(check) },
        { label: 'Complete number', value: `${s}${check}` },
        { label: 'Likely network', value: network },
      ],
    };
  }, [mode, raw]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="validate">Validate</TabsTrigger>
                <TabsTrigger value="compute">Compute check digit</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field
            label={mode === 'validate' ? 'Full number' : 'Number without check digit'}
            className="min-w-[280px] flex-1"
          >
            <Input
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              inputMode="numeric"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton value={() => result.rows.map((r) => `${r.label}: ${r.value}`).join('\n')} />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((r) => (
              <div
                key={r.label}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm text-muted-foreground">{r.label}</span>
                <span className="flex items-center gap-2 font-mono text-sm">
                  <span>{r.value}</span>
                  <CopyButton value={r.value} size="icon-sm" />
                </span>
              </div>
            ))}
          </div>
          <StatBar items={['Luhn (mod-10) checksum']} />
        </Panel>
      )}
    </div>
  );
}
