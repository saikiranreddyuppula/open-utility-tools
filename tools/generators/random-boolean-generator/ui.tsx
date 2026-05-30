'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type LabelSet = 'truefalse' | 'yesno' | 'onezero' | 'onoff' | 'headstails';

const LABELS: Record<LabelSet, [string, string]> = {
  truefalse: ['true', 'false'],
  yesno: ['yes', 'no'],
  onezero: ['1', '0'],
  onoff: ['on', 'off'],
  headstails: ['heads', 'tails'],
};

/** Uniform float in [0, 1) from crypto. */
function uniform(): number {
  const b = new Uint32Array(1);
  wc.getRandomValues(b);
  return (b[0] ?? 0) / 4294967296;
}

export default function RandomBooleanGeneratorTool() {
  const [count, setCount] = useState(20);
  const [prob, setProb] = useState(50);
  const [labelSet, setLabelSet] = useState<LabelSet>('truefalse');
  const [nonce, setNonce] = useState(0);

  const result = useMemo(() => {
    void nonce;
    const n = Math.max(1, Math.min(count, 1000));
    const threshold = prob / 100;
    const values: boolean[] = [];
    let trues = 0;
    for (let i = 0; i < n; i++) {
      const t = uniform() < threshold;
      if (t) trues++;
      values.push(t);
    }
    return { values, trues, falses: n - trues, n };
  }, [count, prob, nonce]);

  const labels = LABELS[labelSet];
  const trueLabel = labels[0];
  const falseLabel = labels[1];

  const lines = useMemo(
    () => result.values.map((v) => (v ? trueLabel : falseLabel)),
    [result, trueLabel, falseLabel]
  );

  const text = lines.join('\n');
  const expectedTrue = Math.round((prob / 100) * result.n * 100) / 100;
  const observedPct = result.n > 0 ? Math.round((result.trues / result.n) * 1000) / 10 : 0;

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Count">
          <Input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(Number(e.target.value) || 1, 1000)))}
            className="w-24 font-mono"
          />
        </Field>
        <Field label={`P(${trueLabel}): ${prob}%`} className="min-w-[220px] flex-1">
          <Slider
            value={[prob]}
            min={0}
            max={100}
            step={1}
            onValueChange={(v) => setProb(v[0] ?? 50)}
          />
        </Field>
        <Field label="Labels">
          <Select value={labelSet} onValueChange={(v) => setLabelSet(v as LabelSet)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="truefalse">true / false</SelectItem>
              <SelectItem value="yesno">yes / no</SelectItem>
              <SelectItem value="onezero">1 / 0</SelectItem>
              <SelectItem value="onoff">on / off</SelectItem>
              <SelectItem value="headstails">heads / tails</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setNonce((x) => x + 1)}>
            <RefreshCw className="size-3.5" /> Regenerate
          </Button>
        </div>
      </OptionsBar>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">{trueLabel}</div>
          <div className="font-mono text-lg">{result.trues}</div>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">{falseLabel}</div>
          <div className="font-mono text-lg">{result.falses}</div>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">
            Observed {trueLabel}
          </div>
          <div className="font-mono text-lg">{observedPct}%</div>
        </div>
        <div className="rounded-md border bg-muted/30 px-3 py-2">
          <div className="text-2xs uppercase tracking-wide text-muted-foreground">
            Expected {trueLabel}
          </div>
          <div className="font-mono text-lg">{expectedTrue}</div>
        </div>
      </div>

      <Panel>
        <PanelHeader title="Values">
          <CopyButton value={() => text} label="Copy all" disabled={!text} />
          <DownloadButton data={() => text} filename="booleans.txt" disabled={!text} />
        </PanelHeader>
        <div className="max-h-[360px] divide-y overflow-auto">
          {lines.map((line, i) => (
            <div key={i} className="flex items-center gap-3 px-3 py-1.5">
              <span className="w-10 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                {i + 1}
              </span>
              <code className="font-mono text-xs">{line}</code>
            </div>
          ))}
        </div>
        <StatBar
          items={[
            `${result.n.toLocaleString()} values`,
            `${trueLabel}: ${result.trues} (${observedPct}%)`,
            `target: ${prob}%`,
          ]}
        />
      </Panel>
    </div>
  );
}
