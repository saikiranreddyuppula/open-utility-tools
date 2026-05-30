'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';

type Result =
  | { error: string }
  | {
      output: string;
      decimal: number;
      sign: string;
    };

function digitValue(ch: string): number {
  const idx = DIGITS.indexOf(ch.toLowerCase());
  return idx;
}

function parseToDecimal(s: string, base: number): { ok: true; value: number } | { ok: false; error: string } {
  let str = s.trim();
  if (str === '') return { ok: false, error: 'Enter a number to convert.' };
  let sign = 1;
  if (str.startsWith('-')) {
    sign = -1;
    str = str.slice(1);
  } else if (str.startsWith('+')) {
    str = str.slice(1);
  }
  const dotCount = (str.match(/\./g) ?? []).length;
  if (dotCount > 1) return { ok: false, error: 'Number can contain at most one radix point.' };
  const parts = str.split('.');
  const intPart = parts[0] ?? '';
  const fracPart = parts[1] ?? '';
  if (intPart === '' && fracPart === '') return { ok: false, error: 'Enter at least one digit.' };

  let intVal = 0;
  for (const ch of intPart) {
    const d = digitValue(ch);
    if (d < 0 || d >= base) return { ok: false, error: `Digit "${ch}" is not valid in base ${base}.` };
    intVal = intVal * base + d;
  }

  let fracVal = 0;
  let place = 1 / base;
  for (const ch of fracPart) {
    const d = digitValue(ch);
    if (d < 0 || d >= base) return { ok: false, error: `Digit "${ch}" is not valid in base ${base}.` };
    fracVal += d * place;
    place /= base;
  }

  return { ok: true, value: sign * (intVal + fracVal) };
}

function decimalToBase(value: number, base: number, maxFracDigits: number): string {
  const sign = value < 0 ? '-' : '';
  let v = Math.abs(value);
  let intPart = Math.floor(v);
  let frac = v - intPart;

  let intStr = '';
  if (intPart === 0) {
    intStr = '0';
  } else {
    while (intPart > 0) {
      const rem = intPart % base;
      intStr = (DIGITS[rem] ?? '?') + intStr;
      intPart = Math.floor(intPart / base);
    }
  }

  let fracStr = '';
  let count = 0;
  while (frac > 0 && count < maxFracDigits) {
    frac *= base;
    const d = Math.floor(frac);
    fracStr += DIGITS[d] ?? '?';
    frac -= d;
    count++;
  }

  return sign + intStr + (fracStr ? '.' + fracStr : '');
}

export default function FractionalBaseConverter() {
  const [value, setValue] = useState('1010.101');
  const [fromBase, setFromBase] = useState('2');
  const [toBase, setToBase] = useState('10');
  const [maxFrac, setMaxFrac] = useState('12');
  const [upper, setUpper] = useState(false);

  const result = useMemo<Result>(() => {
    const fb = Number(fromBase);
    const tb = Number(toBase);
    const mf = Number(maxFrac);
    if (!Number.isInteger(fb) || fb < 2 || fb > 36) return { error: 'Source base must be an integer 2..36.' };
    if (!Number.isInteger(tb) || tb < 2 || tb > 36) return { error: 'Target base must be an integer 2..36.' };
    if (!Number.isInteger(mf) || mf < 0 || mf > 64) return { error: 'Fractional digits must be 0..64.' };

    const parsed = parseToDecimal(value, fb);
    if (!parsed.ok) return { error: parsed.error };

    const out = decimalToBase(parsed.value, tb, mf);
    return {
      output: upper ? out.toUpperCase() : out,
      decimal: parsed.value,
      sign: parsed.value < 0 ? 'negative' : 'positive',
    };
  }, [value, fromBase, toBase, maxFrac, upper]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Number">
            <Input value={value} onChange={(e) => setValue(e.target.value)} className="font-mono" placeholder="1010.101" />
          </Field>
          <Field label="From base (2-36)">
            <Input value={fromBase} onChange={(e) => setFromBase(e.target.value)} inputMode="numeric" className="w-24" />
          </Field>
          <Field label="To base (2-36)">
            <Input value={toBase} onChange={(e) => setToBase(e.target.value)} inputMode="numeric" className="w-24" />
          </Field>
          <Field label="Max fractional digits">
            <Input value={maxFrac} onChange={(e) => setMaxFrac(e.target.value)} inputMode="numeric" className="w-24" />
          </Field>
          <Field label="Uppercase digits">
            <Switch checked={upper} onCheckedChange={setUpper} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`Base ${toBase} result`}>
            <CopyButton value={() => result.output} />
          </PanelHeader>
          <div className="p-4">
            <p className="break-all font-mono text-2xl font-semibold">{result.output}</p>
          </div>
          <StatBar
            items={[
              `Decimal cross-check: ${result.decimal}`,
              `Base ${fromBase} → base ${toBase}`,
              `Value is ${result.sign}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
