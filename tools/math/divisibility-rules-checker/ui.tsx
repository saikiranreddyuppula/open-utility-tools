'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface CheckRow {
  d: number;
  divisible: boolean;
  remainder: string;
  rule: string;
  detail: string;
}

function digits(absStr: string): number[] {
  return absStr.split('').map((c) => Number(c));
}

function digitSum(absStr: string): number {
  return digits(absStr).reduce((a, b) => a + b, 0);
}

function alternatingSum(absStr: string): number {
  // 11 rule: alternate +/- from the rightmost digit.
  const ds = digits(absStr);
  let sum = 0;
  for (let i = ds.length - 1, sign = 1; i >= 0; i--, sign = -sign) {
    sum += sign * (ds[i] ?? 0);
  }
  return sum;
}

function lastK(absStr: string, k: number): string {
  return absStr.length <= k ? absStr : absStr.slice(absStr.length - k);
}

type Result =
  | { error: string }
  | { rows: CheckRow[]; n: bigint };

export default function DivisibilityRulesChecker() {
  const [input, setInput] = useState('123456');

  const result = useMemo<Result>(() => {
    const t = input.trim();
    if (t === '') return { error: 'Enter an integer.' };
    if (!/^[+-]?\d+$/.test(t)) return { error: 'Enter a whole number (digits only).' };

    let n: bigint;
    try {
      n = BigInt(t);
    } catch {
      return { error: 'Could not parse the number.' };
    }

    const abs = n < 0n ? -n : n;
    const absStr = abs.toString();
    const lastDigit = Number(absStr.slice(-1) || '0');

    const dsum = digitSum(absStr);
    const altsum = alternatingSum(absStr);

    const rows: CheckRow[] = [
      {
        d: 2,
        divisible: n % 2n === 0n,
        remainder: (n % 2n).toString(),
        rule: 'Last digit is even (0,2,4,6,8)',
        detail: `last digit = ${lastDigit}`,
      },
      {
        d: 3,
        divisible: n % 3n === 0n,
        remainder: (n % 3n).toString(),
        rule: 'Digit sum divisible by 3',
        detail: `digit sum = ${dsum}`,
      },
      {
        d: 4,
        divisible: n % 4n === 0n,
        remainder: (n % 4n).toString(),
        rule: 'Last two digits divisible by 4',
        detail: `last two = ${lastK(absStr, 2)}`,
      },
      {
        d: 5,
        divisible: n % 5n === 0n,
        remainder: (n % 5n).toString(),
        rule: 'Last digit is 0 or 5',
        detail: `last digit = ${lastDigit}`,
      },
      {
        d: 6,
        divisible: n % 6n === 0n,
        remainder: (n % 6n).toString(),
        rule: 'Divisible by both 2 and 3',
        detail: `÷2: ${n % 2n === 0n ? 'yes' : 'no'}, ÷3: ${n % 3n === 0n ? 'yes' : 'no'}`,
      },
      {
        d: 7,
        divisible: n % 7n === 0n,
        remainder: (n % 7n).toString(),
        rule: 'Drop last digit, subtract 2× it; repeat',
        detail: sevenRule(abs),
      },
      {
        d: 8,
        divisible: n % 8n === 0n,
        remainder: (n % 8n).toString(),
        rule: 'Last three digits divisible by 8',
        detail: `last three = ${lastK(absStr, 3)}`,
      },
      {
        d: 9,
        divisible: n % 9n === 0n,
        remainder: (n % 9n).toString(),
        rule: 'Digit sum divisible by 9',
        detail: `digit sum = ${dsum}`,
      },
      {
        d: 10,
        divisible: n % 10n === 0n,
        remainder: (n % 10n).toString(),
        rule: 'Last digit is 0',
        detail: `last digit = ${lastDigit}`,
      },
      {
        d: 11,
        divisible: n % 11n === 0n,
        remainder: (n % 11n).toString(),
        rule: 'Alternating digit sum divisible by 11',
        detail: `alt sum = ${altsum}`,
      },
      {
        d: 12,
        divisible: n % 12n === 0n,
        remainder: (n % 12n).toString(),
        rule: 'Divisible by both 3 and 4',
        detail: `÷3: ${n % 3n === 0n ? 'yes' : 'no'}, ÷4: ${n % 4n === 0n ? 'yes' : 'no'}`,
      },
      {
        d: 13,
        divisible: n % 13n === 0n,
        remainder: (n % 13n).toString(),
        rule: 'Drop last digit, add 4× it; repeat',
        detail: thirteenRule(abs),
      },
    ];

    return { rows, n };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Integer">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              inputMode="numeric"
              placeholder="123456"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title={`Divisibility of ${result.n.toString()}`}>
            <CopyButton
              value={() =>
                result.rows
                  .map((r) => `${r.d}: ${r.divisible ? 'divisible' : `remainder ${r.remainder}`}`)
                  .join('\n')
              }
            />
          </PanelHeader>
          <div className="divide-y">
            {result.rows.map((r) => (
              <div key={r.d} className="flex items-center gap-3 px-3 py-2">
                <code className="w-8 shrink-0 text-right font-mono text-sm font-semibold">{r.d}</code>
                <span
                  className={
                    r.divisible
                      ? 'w-24 shrink-0 text-sm font-medium text-emerald-600 dark:text-emerald-400'
                      : 'w-24 shrink-0 text-sm text-muted-foreground'
                  }
                >
                  {r.divisible ? 'divisible' : `rem ${r.remainder}`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs">{r.rule}</span>
                  <span className="block font-mono text-2xs text-muted-foreground">{r.detail}</span>
                </span>
              </div>
            ))}
          </div>
          <StatBar items={[`${result.rows.filter((r) => r.divisible).length} of 12 divisors`]} />
        </Panel>
      )}
    </div>
  );
}

function sevenRule(abs: bigint): string {
  // Worked one iteration of the "double the last digit, subtract" trick.
  if (abs < 10n) return `${abs} (single digit)`;
  const last = abs % 10n;
  const rest = abs / 10n;
  const next = rest - 2n * last;
  return `${rest} − 2×${last} = ${next}`;
}

function thirteenRule(abs: bigint): string {
  // Worked one iteration of the "4× last digit, add" trick.
  if (abs < 10n) return `${abs} (single digit)`;
  const last = abs % 10n;
  const rest = abs / 10n;
  const next = rest + 4n * last;
  return `${rest} + 4×${last} = ${next}`;
}
