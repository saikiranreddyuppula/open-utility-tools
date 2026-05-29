'use client';

import { useMemo, useState } from 'react';

import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { ErrorBanner } from '@/components/tools/error-banner';

const FLAGS = ['g', 'i', 'm', 's', 'u', 'y'] as const;

interface MatchInfo {
  match: string;
  index: number;
  groups: string[];
}

export default function RegexTesterTool() {
  const [pattern, setPattern] = useState('\\b(\\w+)@(\\w+\\.\\w+)\\b');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('Contact ada@math.org or linus@kernel.dev for info.');

  const { matches, error } = useMemo(() => {
    if (!pattern) return { matches: [] as MatchInfo[], error: null };
    let re: RegExp;
    try {
      re = new RegExp(pattern, flags.includes('g') ? flags : flags + 'g');
    } catch (e) {
      return { matches: [], error: e instanceof Error ? e.message : 'Invalid regex' };
    }
    const out: MatchInfo[] = [];
    let m: RegExpExecArray | null;
    let guard = 0;
    while ((m = re.exec(text)) !== null && guard++ < 10000) {
      out.push({ match: m[0], index: m.index, groups: m.slice(1).map((g) => g ?? '') });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return { matches: out, error: null };
  }, [pattern, flags, text]);

  const highlighted = useMemo(() => {
    if (error || matches.length === 0) return null;
    const parts: React.ReactNode[] = [];
    let last = 0;
    matches.forEach((m, i) => {
      if (m.index > last) parts.push(text.slice(last, m.index));
      parts.push(
        <mark key={i} className="rounded bg-[color-mix(in_oklch,var(--warning)_40%,transparent)] px-0.5">
          {m.match}
        </mark>
      );
      last = m.index + m.match.length;
    });
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }, [matches, text, error]);

  const toggleFlag = (f: string) =>
    setFlags((prev) => (prev.includes(f) ? prev.replace(f, '') : prev + f));

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Pattern" className="flex-1">
          <div className="flex items-center gap-1 font-mono">
            <span className="text-muted-foreground">/</span>
            <Input value={pattern} onChange={(e) => setPattern(e.target.value)} className="flex-1 font-mono" />
            <span className="text-muted-foreground">/{flags}</span>
          </div>
        </Field>
        <Field label="Flags">
          <div className="flex h-8 items-center gap-1">
            {FLAGS.map((f) => (
              <button
                key={f}
                onClick={() => toggleFlag(f)}
                className={`size-7 rounded-md border font-mono text-xs ${
                  flags.includes(f)
                    ? 'border-primary/40 bg-primary/10 text-foreground'
                    : 'border-border text-muted-foreground hover:bg-accent'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </Field>
      </OptionsBar>

      {error && <ErrorBanner error={error} />}

      <Panel>
        <PanelHeader title="Test string" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          className="min-h-28 resize-y rounded-none border-0 bg-transparent font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        {highlighted && (
          <div className="border-t bg-muted/30 p-3 font-mono text-xs whitespace-pre-wrap break-words">
            {highlighted}
          </div>
        )}
        <StatBar items={[`${matches.length} match${matches.length === 1 ? '' : 'es'}`]} />
      </Panel>

      {matches.length > 0 && (
        <Panel>
          <PanelHeader title="Matches" />
          <div className="max-h-64 divide-y overflow-auto">
            {matches.map((m, i) => (
              <div key={i} className="px-3 py-1.5 font-mono text-xs">
                <span className="text-muted-foreground">#{i + 1} @{m.index}: </span>
                <span className="font-medium">{m.match}</span>
                {m.groups.length > 0 && (
                  <span className="text-muted-foreground">
                    {' '}
                    [{m.groups.map((g, gi) => `$${gi + 1}=${g}`).join(', ')}]
                  </span>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}
