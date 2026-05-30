'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type Mode = 'interleave' | 'sidebyside' | 'roundrobin';
type Uneven = 'shortest' | 'pad' | 'continue';

export default function InterleaveLinesTool() {
  const [a, setA] = useState('Alice\nBob\nCarol');
  const [b, setB] = useState('30\n25\n41\n19');
  const [c, setC] = useState('');
  const [mode, setMode] = useState<Mode>('interleave');
  const [uneven, setUneven] = useState<Uneven>('continue');
  const [sep, setSep] = useState(', ');
  const [fill, setFill] = useState('');

  const result = useMemo<{ ok: true; lines: string[] } | { ok: false; error: string }>(() => {
    const split = (s: string): string[] => (s.length === 0 ? [] : s.split('\n'));
    const lists: string[][] = [split(a), split(b)];
    if (c.trim().length > 0) lists.push(split(c));

    const nonEmpty = lists.filter((l) => l.length > 0);
    if (nonEmpty.length === 0) return { ok: false, error: 'Enter at least one non-empty list.' };

    const lengths = nonEmpty.map((l) => l.length);
    const minLen = Math.min(...lengths);
    const maxLen = Math.max(...lengths);

    const cell = (list: string[], i: number): string | null => {
      const v = list[i];
      if (v !== undefined) return v;
      if (uneven === 'pad') return fill;
      return null; // continue: skip absent; shortest: handled by bound
    };

    const bound = uneven === 'shortest' ? minLen : maxLen;
    const out: string[] = [];

    if (mode === 'sidebyside') {
      for (let i = 0; i < bound; i += 1) {
        const parts: string[] = [];
        for (const list of nonEmpty) {
          const v = cell(list, i);
          if (v === null) continue;
          parts.push(v);
        }
        if (parts.length > 0) out.push(parts.join(sep));
      }
    } else {
      // interleave and roundrobin behave the same for 2+ lists: take index i
      // from each list in turn before advancing i.
      for (let i = 0; i < bound; i += 1) {
        for (const list of nonEmpty) {
          const v = cell(list, i);
          if (v === null) continue;
          out.push(v);
        }
      }
    }

    return { ok: true, lines: out };
  }, [a, b, c, mode, uneven, sep, fill]);

  const text = result.ok ? result.lines.join('\n') : '';

  return (
    <div className="space-y-4">
      <Panel>
        <OptionsBar>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="interleave">Interleave (A1, B1, A2…)</SelectItem>
                <SelectItem value="sidebyside">Side-by-side per row</SelectItem>
                <SelectItem value="roundrobin">Round-robin all lists</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Unequal lengths">
            <Select value={uneven} onValueChange={(v) => setUneven(v as Uneven)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shortest">Stop at shortest</SelectItem>
                <SelectItem value="pad">Pad with fill</SelectItem>
                <SelectItem value="continue">Continue (skip missing)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {mode === 'sidebyside' && (
            <Field label="Join separator">
              <Input className="w-28" value={sep} onChange={(e) => setSep(e.target.value)} />
            </Field>
          )}
          {uneven === 'pad' && (
            <Field label="Fill string">
              <Input className="w-28" value={fill} onChange={(e) => setFill(e.target.value)} placeholder="(empty)" />
            </Field>
          )}
        </OptionsBar>
      </Panel>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel>
          <PanelHeader title="List A" />
          <Textarea
            value={a}
            onChange={(e) => setA(e.target.value)}
            spellCheck={false}
            className="min-h-[220px] resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
        <Panel>
          <PanelHeader title="List B" />
          <Textarea
            value={b}
            onChange={(e) => setB(e.target.value)}
            spellCheck={false}
            className="min-h-[220px] resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
        <Panel>
          <PanelHeader title="List C (optional)" />
          <Textarea
            value={c}
            onChange={(e) => setC(e.target.value)}
            spellCheck={false}
            className="min-h-[220px] resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </Panel>
      </div>

      {result.ok ? (
        <Panel>
          <PanelHeader title="Merged">
            <CopyButton value={() => text} disabled={!text} />
            <DownloadButton data={() => text} filename="interleaved.txt" disabled={!text} label="Download" />
          </PanelHeader>
          <Textarea
            value={text}
            readOnly
            spellCheck={false}
            placeholder="Result appears here…"
            className="min-h-[220px] resize-y rounded-none border-0 bg-transparent font-mono shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
          <StatBar items={[`${result.lines.length} output line(s)`]} />
        </Panel>
      ) : (
        <ErrorBanner error={result.error} />
      )}
    </div>
  );
}
