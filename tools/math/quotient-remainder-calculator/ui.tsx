'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

// Parse an integer string into BigInt (allows leading +/- and surrounding spaces).
function parseBig(s: string): bigint | null {
  const t = s.trim();
  if (!/^[+-]?\d+$/.test(t)) return null;
  try {
    return BigInt(t);
  } catch {
    return null;
  }
}

function babs(n: bigint): bigint {
  return n < 0n ? -n : n;
}

export default function QuotientRemainderCalculator() {
  const [aStr, setAStr] = useState('17');
  const [bStr, setBStr] = useState('5');

  const result = useMemo(() => {
    const a = parseBig(aStr);
    const b = parseBig(bStr);
    if (a === null || b === null) {
      return { error: 'Enter valid integers (digits only, optional leading sign).' };
    }
    if (b === 0n) {
      return { error: 'The divisor cannot be zero.' };
    }

    // Truncated division (JavaScript BigInt / and % truncate toward zero).
    const qTrunc = a / b;
    const rTrunc = a % b;

    // Euclidean division: 0 <= r < |b|.
    let rEuclid = a % b;
    let qEuclid = a / b;
    if (rEuclid < 0n) {
      if (b > 0n) {
        rEuclid += b;
        qEuclid -= 1n;
      } else {
        rEuclid -= b; // b negative => -b positive
        qEuclid += 1n;
      }
    }

    // Floored division: remainder takes sign of divisor.
    let qFloor = a / b;
    let rFloor = a % b;
    if (rFloor !== 0n && (rFloor < 0n) !== (b < 0n)) {
      qFloor -= 1n;
      rFloor += b;
    }

    const divisible = rTrunc === 0n;
    const identity = `${a} = (${qTrunc}) × (${b}) + (${rTrunc})`;
    const identityCheck = qTrunc * b + rTrunc;

    const rows: { label: string; value: string; note?: string }[] = [
      {
        label: 'Quotient (truncated)',
        value: qTrunc.toString(),
        note: 'rounds toward zero',
      },
      {
        label: 'Remainder (truncated)',
        value: rTrunc.toString(),
        note: 'same sign as dividend',
      },
      {
        label: 'Quotient (floored)',
        value: qFloor.toString(),
        note: 'rounds toward −∞',
      },
      {
        label: 'Remainder (floored)',
        value: rFloor.toString(),
        note: 'same sign as divisor',
      },
      {
        label: 'Quotient (Euclidean)',
        value: qEuclid.toString(),
        note: '0 ≤ r < |b|',
      },
      {
        label: 'Remainder (Euclidean)',
        value: rEuclid.toString(),
        note: `0 ≤ r < ${babs(b).toString()}`,
      },
    ];

    return {
      rows,
      divisible,
      identity,
      identityOk: identityCheck === a,
      a: a.toString(),
      b: b.toString(),
    };
  }, [aStr, bStr]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Dividend (a)">
            <Input
              value={aStr}
              onChange={(e) => setAStr(e.target.value)}
              inputMode="numeric"
              className="w-40 font-mono"
            />
          </Field>
          <Field label="Divisor (b)">
            <Input
              value={bStr}
              onChange={(e) => setBStr(e.target.value)}
              inputMode="numeric"
              className="w-40 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Division results">
            <CopyButton
              value={() =>
                [
                  ...result.rows.map((r) => `${r.label}: ${r.value}`),
                  `Divisible: ${result.divisible ? 'yes' : 'no'}`,
                  `Identity: ${result.identity}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="mx-3 mt-3 rounded-md border bg-muted/30 px-3 py-2 font-mono text-sm break-all">
            {result.identity}
          </div>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            {result.rows.map((row) => (
              <div
                key={row.label}
                className="flex flex-col gap-1 rounded-md border bg-muted/30 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm text-muted-foreground">{row.label}</span>
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <span className="break-all">{row.value}</span>
                    <CopyButton value={row.value} size="icon-sm" />
                  </span>
                </div>
                {row.note && <span className="text-2xs text-muted-foreground">{row.note}</span>}
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `${result.a} ÷ ${result.b}`,
              result.divisible ? 'Divides evenly' : 'Has a remainder',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
