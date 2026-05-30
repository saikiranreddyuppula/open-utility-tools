'use client';

import { useMemo, useState } from 'react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { Textarea } from '@/components/ui/textarea';

const SAMPLE = 'Hello 👋 world 🌍! Great job 👍🏽 team 👨‍👩‍👧‍👦 — ship it 🚀🚀 to 🇺🇸 then 🎉.';

const EMOJI_CHAR =
  '(?:' +
  '[\\u{1F300}-\\u{1FAFF}]' +
  '|[\\u{1F000}-\\u{1F0FF}]' +
  '|[\\u{2600}-\\u{27BF}]' +
  '|[\\u{1F1E6}-\\u{1F1FF}]' +
  '|[\\u{2190}-\\u{21FF}]' +
  '|[\\u{2B00}-\\u{2BFF}]' +
  '|[\\u{2300}-\\u{23FF}]' +
  '|[\\u{FE00}-\\u{FE0F}]' +
  '|[\\u{1F3FB}-\\u{1F3FF}]' +
  '|\\u{20E3}' +
  '|[\\u{0023}\\u{002A}\\u{0030}-\\u{0039}](?=\\u{FE0F}?\\u{20E3})' +
  ')';

function buildRegex(): RegExp {
  const cluster = `${EMOJI_CHAR}(?:\\u{200D}${EMOJI_CHAR}|${EMOJI_CHAR})*`;
  return new RegExp(cluster, 'gu');
}

function codePoints(s: string): string {
  return Array.from(s)
    .map((c) => 'U+' + (c.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0'))
    .join(' ');
}

interface FreqRow {
  emoji: string;
  count: number;
  cps: string;
}

export default function EmojiExtractorTool() {
  const [text, setText] = useState(SAMPLE);

  const { ordered, freq, totalOccurrences, uniqueCount } = useMemo(() => {
    const re = buildRegex();
    const matches = text.match(re) ?? [];
    const map = new Map<string, number>();
    for (const m of matches) {
      map.set(m, (map.get(m) ?? 0) + 1);
    }
    const rows: FreqRow[] = Array.from(map.entries())
      .map(([emoji, count]) => ({ emoji, count, cps: codePoints(emoji) }))
      .sort((a, b) => b.count - a.count);
    return {
      ordered: matches,
      freq: rows,
      totalOccurrences: matches.length,
      uniqueCount: map.size,
    };
  }, [text]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Input" />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste text with emoji…"
          spellCheck={false}
          className="min-h-32 resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <StatBar items={[`${uniqueCount} unique`, `${totalOccurrences} total`]} />
      </Panel>

      <Panel>
        <PanelHeader title="Emoji in order">
          <CopyButton value={() => ordered.join('')} />
        </PanelHeader>
        <div className="min-h-12 break-words p-3 text-2xl leading-relaxed">
          {ordered.length > 0 ? ordered.join(' ') : (
            <span className="text-sm text-muted-foreground">No emoji found.</span>
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Frequency">
          <CopyButton
            value={() => freq.map((r) => `${r.emoji}\t${r.count}\t${r.cps}`).join('\n')}
          />
        </PanelHeader>
        <OptionsBar>
          <Field label="">
            <span className="text-xs text-muted-foreground">
              emoji · count · code points
            </span>
          </Field>
        </OptionsBar>
        <div className="max-h-[420px] divide-y overflow-auto">
          {freq.map((r) => (
            <div key={r.emoji} className="flex items-center gap-3 px-3 py-2">
              <span className="w-10 shrink-0 text-2xl leading-none">{r.emoji}</span>
              <span className="w-12 shrink-0 text-right font-mono text-sm tabular-nums">{r.count}</span>
              <code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                {r.cps}
              </code>
              <CopyButton value={r.emoji} size="icon-sm" />
            </div>
          ))}
          {freq.length === 0 && (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No emoji to summarize.
            </div>
          )}
        </div>
        <StatBar items={[`${freq.length} unique emoji`]} />
      </Panel>
    </div>
  );
}
