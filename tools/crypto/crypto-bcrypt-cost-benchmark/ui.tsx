'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';

interface RowOut {
  cost: number;
  ms: number;
  underTarget: boolean;
  recommended: boolean;
}
interface Ok {
  ok: true;
  rows: RowOut[];
  recommended: number | null;
  targetMs: number;
}
interface Err {
  ok: false;
  error: string;
}

const MIN_COST = 4;
const MAX_COST = 18;

function fmtMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(3)} ms`;
  if (ms < 1000) return `${ms.toFixed(1)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export default function BcryptCostBenchmarkTool() {
  const [knownMs, setKnownMs] = useState('60');
  const [knownCost, setKnownCost] = useState('10');
  const [targetMs, setTargetMs] = useState('250');

  const result = useMemo<Ok | Err>(() => {
    const baseMs = Number(knownMs);
    const baseCost = Number(knownCost);
    const target = Number(targetMs);
    if (!Number.isFinite(baseMs) || baseMs <= 0) return { ok: false, error: 'Enter a positive measured time (ms).' };
    if (!Number.isFinite(baseCost) || !Number.isInteger(baseCost) || baseCost < MIN_COST || baseCost > MAX_COST) {
      return { ok: false, error: `Known cost must be an integer ${MIN_COST}–${MAX_COST}.` };
    }
    if (!Number.isFinite(target) || target <= 0) return { ok: false, error: 'Enter a positive target time (ms).' };

    // Each +1 to cost doubles the work (cost N → 2^N rounds).
    const msAtCost = (cost: number): number => baseMs * Math.pow(2, cost - baseCost);

    // Highest cost whose estimated time is still <= target.
    let recommended: number | null = null;
    for (let c = MAX_COST; c >= MIN_COST; c--) {
      if (msAtCost(c) <= target) {
        recommended = c;
        break;
      }
    }

    const rows: RowOut[] = [];
    for (let c = MIN_COST; c <= MAX_COST; c++) {
      const ms = msAtCost(c);
      rows.push({
        cost: c,
        ms,
        underTarget: ms <= target,
        recommended: recommended !== null && c === recommended,
      });
    }
    return { ok: true, rows, recommended, targetMs: target };
  }, [knownMs, knownCost, targetMs]);

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Measured time (ms)" hint="one hash at the known cost">
            <Input value={knownMs} onChange={(e) => setKnownMs(e.target.value)} inputMode="decimal" className="w-32 font-mono" />
          </Field>
          <Field label="At cost factor">
            <Input value={knownCost} onChange={(e) => setKnownCost(e.target.value)} inputMode="numeric" className="w-28 font-mono" />
          </Field>
          <Field label="Target time (ms)" hint="max acceptable per hash">
            <Input value={targetMs} onChange={(e) => setTargetMs(e.target.value)} inputMode="decimal" className="w-32 font-mono" />
          </Field>
        </OptionsBar>
      </Panel>

      {!result.ok ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Estimated time per cost factor">
            <CopyButton
              value={() => result.rows.map((r) => `cost ${r.cost}\t${fmtMs(r.ms)}`).join('\n')}
            />
          </PanelHeader>
          <div className="max-h-[460px] divide-y overflow-auto">
            {result.rows.map((r) => (
              <div
                key={r.cost}
                className={
                  'flex items-center gap-3 px-3 py-2 ' +
                  (r.recommended ? 'bg-emerald-500/10' : r.underTarget ? '' : 'opacity-60')
                }
              >
                <code className="w-20 shrink-0 font-mono text-xs">cost {r.cost}</code>
                <span className="w-28 shrink-0 font-mono text-sm">{fmtMs(r.ms)}</span>
                <span className="min-w-0 flex-1 text-xs text-muted-foreground">
                  {r.recommended
                    ? '★ recommended — highest cost under target'
                    : r.underTarget
                      ? 'under target'
                      : 'exceeds target'}
                </span>
                <CopyButton value={String(r.cost)} size="icon-sm" />
              </div>
            ))}
          </div>
          <StatBar
            items={[
              `target ${fmtMs(result.targetMs)}`,
              result.recommended !== null
                ? `recommended cost = ${result.recommended}`
                : 'even cost 4 exceeds target — measure on faster hardware or raise target',
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
