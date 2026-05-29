'use client';

import { useMemo, useState } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { Panel, PanelHeader } from '@/components/tools/panel';

const enc = new TextEncoder();

function stats(text: string) {
  const chars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;
  const words = (text.trim().match(/\S+/g) ?? []).length;
  const lines = text === '' ? 0 : text.split(/\r?\n/).length;
  const sentences = (text.match(/[.!?]+(\s|$)/g) ?? []).length;
  const paragraphs = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;
  const bytes = enc.encode(text).length;
  const readingMin = words / 200;
  const speakingMin = words / 130;
  return { chars, charsNoSpaces, words, lines, sentences, paragraphs, bytes, readingMin, speakingMin };
}

function fmtTime(min: number): string {
  if (min < 1 / 60) return '0s';
  const totalSec = Math.round(min * 60);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

const SAMPLE =
  'The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs!\n\nSphinx of black quartz, judge my vow.';

export default function WordCountTool() {
  const [input, setInput] = useState('');
  const s = useMemo(() => stats(input), [input]);

  const cells: { label: string; value: string }[] = [
    { label: 'Words', value: s.words.toLocaleString() },
    { label: 'Characters', value: s.chars.toLocaleString() },
    { label: 'Characters (no spaces)', value: s.charsNoSpaces.toLocaleString() },
    { label: 'Sentences', value: s.sentences.toLocaleString() },
    { label: 'Paragraphs', value: s.paragraphs.toLocaleString() },
    { label: 'Lines', value: s.lines.toLocaleString() },
    { label: 'Bytes (UTF-8)', value: s.bytes.toLocaleString() },
    { label: 'Reading time', value: fmtTime(s.readingMin) },
    { label: 'Speaking time', value: fmtTime(s.speakingMin) },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-3">
            <div className="font-mono text-lg font-semibold tabular">{c.value}</div>
            <div className="text-2xs text-muted-foreground">{c.label}</div>
          </div>
        ))}
      </div>

      <Panel>
        <PanelHeader title="Text">
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setInput(SAMPLE)}
          >
            Sample
          </button>
          <button
            className="rounded px-1.5 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setInput('')}
          >
            Clear
          </button>
        </PanelHeader>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type or paste text to analyze…"
          spellCheck={false}
          className="min-h-56 resize-y rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
      </Panel>
    </div>
  );
}
