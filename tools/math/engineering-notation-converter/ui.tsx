'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';

// SI prefix indexed by exponent/3, offset so index 0 -> exponent 0 (no prefix).
const PREFIXES: { exp: number; symbol: string; name: string }[] = [
  { exp: -24, symbol: 'y', name: 'yocto' },
  { exp: -21, symbol: 'z', name: 'zepto' },
  { exp: -18, symbol: 'a', name: 'atto' },
  { exp: -15, symbol: 'f', name: 'femto' },
  { exp: -12, symbol: 'p', name: 'pico' },
  { exp: -9, symbol: 'n', name: 'nano' },
  { exp: -6, symbol: 'µ', name: 'micro' },
  { exp: -3, symbol: 'm', name: 'milli' },
  { exp: 0, symbol: '', name: '(none)' },
  { exp: 3, symbol: 'k', name: 'kilo' },
  { exp: 6, symbol: 'M', name: 'mega' },
  { exp: 9, symbol: 'G', name: 'giga' },
  { exp: 12, symbol: 'T', name: 'tera' },
  { exp: 15, symbol: 'P', name: 'peta' },
  { exp: 18, symbol: 'E', name: 'exa' },
  { exp: 21, symbol: 'Z', name: 'zetta' },
  { exp: 24, symbol: 'Y', name: 'yotta' },
];

function prefixFor(exp: number): { symbol: string; name: string } | null {
  const hit = PREFIXES.find((p) => p.exp === exp);
  return hit ?? null;
}

function trimNum(s: string): string {
  // Remove trailing zeros after a decimal point.
  if (!s.includes('.')) return s;
  return s.replace(/\.?0+$/, '');
}

type Result =
  | { error: string }
  | {
      sign: string;
      mantissa: string;
      exp: number;
      engineering: string;
      prefixed: string;
      scientific: string;
    };

export default function EngineeringNotationConverter() {
  const [value, setValue] = useState('47000');
  const [unit, setUnit] = useState('Ω');
  const [sig, setSig] = useState(3);

  const result = useMemo<Result>(() => {
    const t = value.trim();
    if (t === '') return { error: 'Enter a number.' };
    const x = Number(t);
    if (!Number.isFinite(x)) return { error: 'Enter a valid finite number.' };

    if (x === 0) {
      const z = (0).toFixed(Math.max(0, sig - 1));
      return {
        sign: '',
        mantissa: z,
        exp: 0,
        engineering: `${z}×10^0`,
        prefixed: unit.trim() ? `${z} ${unit.trim()}` : z,
        scientific: `${z}×10^0`,
      };
    }

    const sign = x < 0 ? '-' : '';
    const ax = Math.abs(x);

    // Engineering exponent: largest multiple of 3 keeping mantissa in [1, 1000).
    let exp = Math.floor(Math.log10(ax) / 3) * 3;
    let mantissaNum = ax / Math.pow(10, exp);
    // Guard against floating-point edge cases pushing mantissa out of range.
    if (mantissaNum >= 1000) {
      mantissaNum /= 1000;
      exp += 3;
    } else if (mantissaNum < 1) {
      mantissaNum *= 1000;
      exp -= 3;
    }

    const decimals = Math.max(0, sig - (Math.floor(Math.log10(mantissaNum)) + 1));
    const mantissaStr = trimNum(mantissaNum.toFixed(decimals));

    const engineering = `${sign}${mantissaStr}×10^${exp}`;

    const pre = prefixFor(exp);
    const u = unit.trim();
    let prefixed: string;
    if (pre && pre.symbol) {
      prefixed = `${sign}${mantissaStr} ${pre.symbol}${u}`;
    } else if (pre) {
      prefixed = u ? `${sign}${mantissaStr} ${u}` : `${sign}${mantissaStr}`;
    } else {
      prefixed = `${engineering}${u ? ` ${u}` : ''} (no SI prefix for 10^${exp})`;
    }

    // Plain scientific (single leading digit) for comparison.
    const sciExp = Math.floor(Math.log10(ax));
    const sciMant = ax / Math.pow(10, sciExp);
    const sciDecimals = Math.max(0, sig - 1);
    const scientific = `${sign}${trimNum(sciMant.toFixed(sciDecimals))}×10^${sciExp}`;

    return { sign, mantissa: mantissaStr, exp, engineering, prefixed, scientific };
  }, [value, unit, sig]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Number">
            <Input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="font-mono" />
          </Field>
          <Field label="Unit (optional)">
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Ω" className="w-24" />
          </Field>
          <Field label={`Significant figures: ${sig}`} className="min-w-[200px]">
            <Slider value={[sig]} min={1} max={10} step={1} onValueChange={(v) => setSig(v[0] ?? 3)} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() =>
                `Engineering: ${result.engineering}\nPrefixed: ${result.prefixed}\nScientific: ${result.scientific}`
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-3">
            <Out label="Engineering notation" value={result.engineering} />
            <Out label="SI-prefixed form" value={result.prefixed} />
            <Out label="Scientific notation" value={result.scientific} />
          </div>
          <StatBar items={[`Exponent = ${result.exp} (multiple of 3)`, `Mantissa = ${result.mantissa}`]} />
        </Panel>
      )}
    </div>
  );
}

function Out({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2">
      <span className="text-2xs text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2 font-mono text-sm font-semibold">
        <span className="min-w-0 break-all">{value}</span>
        <CopyButton value={value} size="icon-sm" />
      </span>
    </div>
  );
}
