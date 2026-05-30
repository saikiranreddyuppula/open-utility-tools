'use client';

import { useMemo, useState } from 'react';

import { CopyButton } from '@/components/tools/copy-button';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const SAMPLE = `An old silent pond
A frog jumps into the pond
Splash! Silence again`;

function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length === 0) return 0;
  const groups = w.match(/[aeiouy]+/g) ?? [];
  let count = groups.length;
  if (w.endsWith('e') && !w.endsWith('le') && count > 1) count -= 1;
  return Math.max(1, count);
}

function lineSyllables(line: string): number {
  const words = line.match(/[A-Za-z']+/g) ?? [];
  let total = 0;
  for (const word of words) total += countSyllables(word);
  return total;
}

interface LineResult {
  text: string;
  count: number;
  target: number;
  delta: number;
}

export default function HaikuCheckerTool() {
  const [text, setText] = useState(SAMPLE);
  const [pattern, setPattern] = useState('5-7-5');

  const targets = useMemo<number[]>(() => {
    const parts = pattern
      .split(/[-,\s]+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    const nums: number[] = [];
    for (const p of parts) {
      const n = Number(p);
      if (Number.isFinite(n) && n > 0) nums.push(Math.round(n));
    }
    return nums.length > 0 ? nums : [5, 7, 5];
  }, [pattern]);

  const { lines, overall } = useMemo(() => {
    const nonEmpty = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    const used = nonEmpty.slice(0, targets.length);
    const results: LineResult[] = used.map((line, i) => {
      const target = targets[i] ?? 0;
      const count = lineSyllables(line);
      return { text: line, count, target, delta: count - target };
    });
    const allPass =
      results.length === targets.length && results.every((r) => r.delta === 0);
    return { lines: results, overall: allPass };
  }, [text, targets]);

  const copyValue = () =>
    lines
      .map(
        (r, i) =>
          `Line ${i + 1}: ${r.count}/${r.target} syllables — ${
            r.delta === 0 ? 'OK' : r.delta > 0 ? `${r.delta} too many` : `${-r.delta} too few`
          }`,
      )
      .join('\n');

  return (
    <div className="space-y-4">
      <OptionsBar>
        <Field label="Target pattern" className="min-w-[200px]">
          <Input
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="5-7-5"
            className="font-mono"
          />
        </Field>
        <Field label="Resolved" className="min-w-[120px]">
          <span className="font-mono text-sm">{targets.join('-')}</span>
        </Field>
      </OptionsBar>

      <Panel>
        <PanelHeader title="Poem (one line per row)" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Line one…\nLine two…\nLine three…'}
          spellCheck={false}
          className="min-h-[120px] resize-y rounded-none border-0 font-mono focus-visible:ring-0"
        />
      </Panel>

      <Panel>
        <PanelHeader title="Check">
          {lines.length > 0 && <CopyButton value={copyValue} />}
        </PanelHeader>
        {lines.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Enter at least one line.
          </div>
        ) : (
          <div className="divide-y">
            {lines.map((r, i) => (
              <div key={`${i}-${r.text}`} className="flex items-center gap-3 px-3 py-2">
                <Badge variant={r.delta === 0 ? 'default' : 'destructive'}>
                  {r.delta === 0 ? 'OK' : r.delta > 0 ? `+${r.delta}` : `${r.delta}`}
                </Badge>
                <span className="min-w-0 flex-1 truncate text-sm">{r.text}</span>
                <span className="shrink-0 font-mono text-sm">
                  {r.count}
                  <span className="text-muted-foreground"> / {r.target}</span>
                </span>
              </div>
            ))}
          </div>
        )}
        <StatBar
          items={[
            overall ? `Matches ${targets.join('-')} ✓` : `Does not match ${targets.join('-')}`,
            `${lines.length} of ${targets.length} lines`,
          ]}
        />
      </Panel>
    </div>
  );
}
