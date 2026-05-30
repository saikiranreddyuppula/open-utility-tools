'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

/** Federal Reserve district / type keyed by the first two digits of the RTN. */
function decodeDistrict(first2: number): string {
  if (first2 === 0) return 'United States Government';
  if (first2 >= 1 && first2 <= 12) return `Federal Reserve District ${first2}`;
  if (first2 >= 21 && first2 <= 32) return `Thrift institution (district ${first2 - 20})`;
  if (first2 >= 61 && first2 <= 72) return 'Electronic transaction (ACH / EFT)';
  if (first2 === 80) return 'Traveler’s checks';
  return 'Unassigned / non-standard prefix';
}

interface Ok {
  ok: true;
  valid: boolean;
  weighted: number;
  digits: number[];
  district: string;
  routing: string;
}
interface Err {
  ok: false;
  error: string;
}

export default function AbaRoutingValidatorTool() {
  const [input, setInput] = useState('021000021');

  const result = useMemo<Ok | Err>(() => {
    const cleaned = input.replace(/[\s-]/g, '');
    if (!cleaned) return { ok: false, error: 'Enter a 9-digit routing number.' };
    if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'Routing numbers contain only digits.' };
    if (cleaned.length !== 9) {
      return { ok: false, error: `Routing numbers are exactly 9 digits (got ${cleaned.length}).` };
    }
    const digits: number[] = [];
    for (let i = 0; i < 9; i++) {
      const c = cleaned.charCodeAt(i) - 48;
      digits.push(c);
    }
    const d = (i: number): number => digits[i] ?? 0;
    const weighted =
      3 * (d(0) + d(3) + d(6)) + 7 * (d(1) + d(4) + d(7)) + 1 * (d(2) + d(5) + d(8));
    const valid = weighted !== 0 && weighted % 10 === 0;
    const first2 = d(0) * 10 + d(1);
    return {
      ok: true,
      valid,
      weighted,
      digits,
      district: decodeDistrict(first2),
      routing: cleaned,
    };
  }, [input]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Routing number" className="min-w-[260px] flex-1">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="021000021"
              inputMode="numeric"
              className="font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Result">
            <CopyButton
              value={() =>
                `${result.routing}: ${result.valid ? 'VALID' : 'INVALID'} (weighted sum ${result.weighted})`
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div
              className={
                'flex items-center justify-between rounded-md border px-3 py-2 ' +
                (result.valid ? 'bg-emerald-500/10' : 'bg-destructive/10')
              }
            >
              <span className="text-sm text-muted-foreground">Checksum</span>
              <span className="font-mono text-sm font-semibold">
                {result.valid ? 'VALID' : 'INVALID'}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-sm text-muted-foreground">Weighted sum</span>
              <span className="flex items-center gap-2 font-mono text-sm">
                <span>{result.weighted}</span>
                <CopyButton value={String(result.weighted)} size="icon-sm" />
              </span>
            </div>
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 sm:col-span-2">
              <span className="text-sm text-muted-foreground">Federal Reserve prefix</span>
              <span className="font-mono text-sm">{result.district}</span>
            </div>
          </div>
          <div className="px-3 pb-3">
            <div className="rounded-md border bg-muted/20 p-3 font-mono text-xs leading-relaxed">
              <div className="mb-1 text-muted-foreground">
                3×(d1+d4+d7) + 7×(d2+d5+d8) + 1×(d3+d6+d9)
              </div>
              <div className="break-all">
                3×({result.digits[0]}+{result.digits[3]}+{result.digits[6]}) + 7×(
                {result.digits[1]}+{result.digits[4]}+{result.digits[7]}) + 1×(
                {result.digits[2]}+{result.digits[5]}+{result.digits[8]}) = {result.weighted}
              </div>
            </div>
          </div>
          <StatBar
            items={[
              `mod 10 = ${result.weighted % 10}`,
              `9 digits`,
              result.valid ? 'divisible by 10' : 'not divisible by 10',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
