'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

interface Item {
  label: string;
  weight: number;
}

const SAMPLE = ['Common, 70', 'Uncommon, 20', 'Rare, 8', 'Legendary, 2'].join('\n');

/** Uniform float in [0, max) from 32 crypto bits. */
function randFloat(max: number): number {
  const buf = new Uint32Array(1);
  wc.getRandomValues(buf);
  return ((buf[0] ?? 0) / 4294967296) * max;
}

/** Smallest index i with cumulative[i] > target. */
function pick(cumulative: number[], target: number): number {
  let lo = 0;
  let hi = cumulative.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((cumulative[mid] ?? 0) > target) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

export default function WeightedRandomPicker() {
  const [raw, setRaw] = useState(SAMPLE);
  const [drawsStr, setDrawsStr] = useState('5');
  const [withReplacement, setWithReplacement] = useState(true);
  const [seed, setSeed] = useState(0);

  const parsed = useMemo<{ items: Item[] } | { error: string }>(() => {
    const lines = raw.split('\n').map((s) => s.trim()).filter((s) => s.length > 0);
    if (lines.length === 0) return { error: 'Enter at least one item (one per line).' };
    const items: Item[] = [];
    for (const line of lines) {
      const idx = line.lastIndexOf(',');
      let label = line;
      let weight = 1;
      if (idx >= 0) {
        const maybeWeight = line.slice(idx + 1).trim();
        const w = Number(maybeWeight);
        if (maybeWeight.length > 0 && Number.isFinite(w)) {
          label = line.slice(0, idx).trim();
          weight = w;
        }
      }
      if (!label) return { error: `Item with empty label: "${line}"` };
      if (weight < 0) return { error: `Negative weight not allowed: "${line}"` };
      items.push({ label, weight });
    }
    const total = items.reduce((a, b) => a + b.weight, 0);
    if (total <= 0) return { error: 'Total weight must be greater than zero.' };
    return { items };
  }, [raw]);

  const result = useMemo<
    | { error: string }
    | { draws: string[]; tally: { label: string; count: number; prob: number }[] }
  >(() => {
    void seed;
    if ('error' in parsed) return { error: parsed.error };
    const items = parsed.items;
    const n = Number.parseInt(drawsStr, 10);
    if (!Number.isFinite(n) || n < 1) return { error: 'Enter a positive number of draws.' };
    const draws = Math.min(n, 10000);

    if (!withReplacement && draws > items.length) {
      return {
        error: `Without replacement, draws (${draws}) cannot exceed the number of items (${items.length}).`,
      };
    }

    const totalWeight = items.reduce((a, b) => a + b.weight, 0);
    const counts = new Map<string, number>();
    const sequence: string[] = [];

    if (withReplacement) {
      const cumulative: number[] = [];
      let run = 0;
      for (const it of items) {
        run += it.weight;
        cumulative.push(run);
      }
      for (let d = 0; d < draws; d += 1) {
        const target = randFloat(run);
        const i = pick(cumulative, target);
        const chosen = items[i]?.label ?? items[items.length - 1]?.label ?? '';
        sequence.push(chosen);
        counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
      }
    } else {
      // Renormalize after each draw by removing the chosen item.
      const pool = items.map((it) => ({ ...it }));
      for (let d = 0; d < draws && pool.length > 0; d += 1) {
        const cumulative: number[] = [];
        let run = 0;
        for (const it of pool) {
          run += it.weight;
          cumulative.push(run);
        }
        if (run <= 0) break;
        const target = randFloat(run);
        const i = pick(cumulative, target);
        const chosen = pool[i]?.label ?? '';
        sequence.push(chosen);
        counts.set(chosen, (counts.get(chosen) ?? 0) + 1);
        pool.splice(i, 1);
      }
    }

    const tally = items.map((it) => ({
      label: it.label,
      count: counts.get(it.label) ?? 0,
      prob: (it.weight / totalWeight) * 100,
    }));

    return { draws: sequence, tally };
  }, [parsed, drawsStr, withReplacement, seed]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Weighted items">
          <Button variant="secondary" size="sm" onClick={() => setSeed((s) => s + 1)}>
            <RefreshCw className="size-3.5" /> Re-roll
          </Button>
        </PanelHeader>
        <Field label="One 'item, weight' per line (weight defaults to 1)">
          <Textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={6}
            spellCheck={false}
            className="font-mono text-sm"
          />
        </Field>
        <OptionsBar>
          <Field label="Draws">
            <Input
              type="number"
              min={1}
              value={drawsStr}
              onChange={(e) => setDrawsStr(e.target.value)}
              className="w-24 font-mono"
            />
          </Field>
          <Field label="With replacement">
            <Switch checked={withReplacement} onCheckedChange={setWithReplacement} />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <>
          <Panel>
            <PanelHeader title={`Drawn sequence (${result.draws.length})`}>
              <CopyButton value={() => result.draws.join('\n')} label="Copy all" />
            </PanelHeader>
            <div className="flex flex-wrap gap-2 p-3">
              {result.draws.map((d, i) => (
                <span key={i} className="rounded-md border bg-muted/30 px-2 py-1 font-mono text-xs">
                  {d}
                </span>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Tally & probabilities">
              <CopyButton
                value={() =>
                  result.tally
                    .map((t) => `${t.label}\t${t.count}\t${t.prob.toFixed(2)}%`)
                    .join('\n')
                }
                label="Copy"
              />
            </PanelHeader>
            <div className="max-h-[320px] divide-y overflow-auto">
              <div className="flex items-center gap-3 px-3 py-1.5 text-2xs font-medium text-muted-foreground">
                <span className="min-w-0 flex-1">Item</span>
                <span className="w-16 shrink-0 text-right">Count</span>
                <span className="w-24 shrink-0 text-right">Theoretical</span>
              </div>
              {result.tally.map((t) => (
                <div key={t.label} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                  <span className="min-w-0 flex-1 truncate">{t.label}</span>
                  <span className="w-16 shrink-0 text-right font-mono">{t.count}</span>
                  <span className="w-24 shrink-0 text-right font-mono text-muted-foreground">
                    {t.prob.toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
            <StatBar
              items={[
                `${result.tally.length} items`,
                `${result.draws.length} draws`,
                withReplacement ? 'with replacement' : 'without replacement',
              ]}
            />
          </Panel>
        </>
      )}
    </div>
  );
}
