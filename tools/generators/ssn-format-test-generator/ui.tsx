'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const wc = (globalThis as unknown as { crypto: Crypto }).crypto;

type Sep = 'dash' | 'space' | 'none';
type Output = 'lines' | 'json';

/** Mulberry32 seeded PRNG: deterministic when a seed is supplied. */
function makeRng(seedText: string): () => number {
  if (!seedText.trim()) {
    return () => {
      const a = new Uint32Array(1);
      wc.getRandomValues(a);
      return (a[0] ?? 0) / 4294967296;
    };
  }
  let h = 1779033703 ^ seedText.length;
  for (let i = 0; i < seedText.length; i += 1) {
    h = Math.imul(h ^ seedText.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function intIn(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pad(n: number, w: number): string {
  return String(n).padStart(w, '0');
}

/** Pick a never-issued area number. */
function area(rng: () => number, itin: boolean): string {
  if (itin) {
    // ITIN-style: 9xx where the group is 70-88, 90-92, 94-99 — but for a pure
    // "never a real SSN" placeholder we simply use the 900-999 block.
    return pad(intIn(rng, 900, 999), 3);
  }
  // Never-issued areas: 000, 666, or 900-999.
  const bucket = intIn(rng, 0, 2);
  if (bucket === 0) return '000';
  if (bucket === 1) return '666';
  return pad(intIn(rng, 900, 999), 3);
}

export default function SsnFormatTestGenerator() {
  const [count, setCount] = useState('10');
  const [sep, setSep] = useState<Sep>('dash');
  const [itin, setItin] = useState(false);
  const [seedText, setSeedText] = useState('');
  const [output, setOutput] = useState<Output>('lines');
  const [reroll, setReroll] = useState(0);

  const result = useMemo(() => {
    void reroll;
    const n = Math.min(1000, Math.max(1, Math.round(Number(count) || 1)));
    const rng = makeRng(seedText);
    const glue = sep === 'dash' ? '-' : sep === 'space' ? ' ' : '';

    const items: string[] = [];
    for (let i = 0; i < n; i += 1) {
      const a = area(rng, itin);
      const group = pad(intIn(rng, 1, 99), 2); // never 00
      const serial = pad(intIn(rng, 1, 9999), 4); // never 0000
      items.push([a, group, serial].join(glue));
    }
    return items;
  }, [count, sep, itin, seedText, reroll]);

  const text = useMemo(
    () => (output === 'json' ? JSON.stringify(result, null, 2) : result.join('\n')),
    [output, result],
  );

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Count" className="w-24">
          <Input
            type="number"
            min={1}
            max={1000}
            value={count}
            onChange={(e) => setCount(e.target.value)}
            className="font-mono"
          />
        </Field>
        <Field label="Separator">
          <Select value={sep} onValueChange={(v) => setSep(v as Sep)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="dash">Dash (-)</SelectItem>
              <SelectItem value="space">Space</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Output">
          <Select value={output} onValueChange={(v) => setOutput(v as Output)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lines">One per line</SelectItem>
              <SelectItem value="json">JSON array</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Seed (optional)" className="w-40">
          <Input
            value={seedText}
            onChange={(e) => setSeedText(e.target.value)}
            placeholder="deterministic"
            className="font-mono"
          />
        </Field>
        <Field label="ITIN-style 9xx">
          <div className="flex h-9 items-center gap-2">
            <Switch id="ssn-itin" checked={itin} onCheckedChange={setItin} />
            <Label htmlFor="ssn-itin" className="text-xs">
              Force 900–999
            </Label>
          </div>
        </Field>
        <div className="ml-auto flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setReroll((r) => r + 1)}>
            <RefreshCw className="size-3.5" />
            Regenerate
          </Button>
        </div>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Test numbers">
          <CopyButton value={() => text} label="Copy all" disabled={!text} />
          <DownloadButton
            data={() => text}
            filename={output === 'json' ? 'ssn-test.json' : 'ssn-test.txt'}
            disabled={!text}
          />
        </PanelHeader>
        {output === 'json' ? (
          <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs">{text}</pre>
        ) : (
          <div className="max-h-[420px] divide-y overflow-auto">
            {result.map((v, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-1.5">
                <span className="w-8 shrink-0 text-right font-mono text-2xs text-muted-foreground tabular">
                  {i + 1}
                </span>
                <code className="min-w-0 flex-1 truncate font-mono text-xs">{v}</code>
                <CopyButton value={v} size="icon-sm" />
              </div>
            ))}
          </div>
        )}
        <StatBar
          items={[
            `${result.length} generated`,
            seedText.trim() ? 'deterministic (seeded)' : 'random',
            'never-issued ranges — not real SSNs',
          ]}
        />
      </Panel>

      <p className="px-1 text-2xs text-muted-foreground">
        These numbers use area codes (000, 666, 900–999), groups, and serials that the
        US Social Security Administration never issues, so they cannot correspond to any
        real person. Use only as placeholder QA/test data.
      </p>
    </div>
  );
}
