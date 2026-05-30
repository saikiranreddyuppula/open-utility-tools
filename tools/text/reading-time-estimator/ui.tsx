'use client';

import { useMemo, useState } from 'react';
import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';

const SAMPLE =
  'The quick brown fox jumps over the lazy dog. This sample paragraph is here so you can immediately ' +
  'see an estimate of how long it takes to read silently versus how long it would take to speak the ' +
  'same words out loud at a comfortable presentation pace. Replace it with your own article, script, ' +
  'or speech to get a tailored reading and speaking time.';

function countWords(text: string): number {
  const m = text.trim().match(/[^\s]+/g);
  return m ? m.length : 0;
}

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s';
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export default function ReadingTimeEstimator() {
  const [text, setText] = useState(SAMPLE);
  const [readWpm, setReadWpm] = useState('238');
  const [speakWpm, setSpeakWpm] = useState('130');

  const result = useMemo(() => {
    const words = countWords(text);
    const chars = text.length;
    const charsNoSpace = text.replace(/\s/g, '').length;

    const rw = Number(readWpm);
    const sw = Number(speakWpm);
    if (!Number.isFinite(rw) || rw <= 0) return { error: 'Reading speed must be a positive number.' };
    if (!Number.isFinite(sw) || sw <= 0) return { error: 'Speaking speed must be a positive number.' };

    if (words === 0) return { error: 'Enter some text to estimate reading time.' };

    const readSec = (words / rw) * 60;
    const speakSec = (words / sw) * 60;

    const speeds: { label: string; wpm: number }[] = [
      { label: 'Slow', wpm: 150 },
      { label: 'Average', wpm: 238 },
      { label: 'Fast', wpm: 350 },
    ];
    const table = speeds.map((s) => ({
      label: s.label,
      wpm: s.wpm,
      time: fmt((words / s.wpm) * 60),
    }));

    return { words, chars, charsNoSpace, readSec, speakSec, table, rw, sw };
  }, [text, readWpm, speakWpm]);

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Text" />
        <div className="p-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            rows={6}
            placeholder="Paste your article or script…"
          />
        </div>
        <OptionsBar className="rounded-none border-x-0 border-b-0">
          <Field label="Reading speed (wpm)">
            <Input
              value={readWpm}
              onChange={(e) => setReadWpm(e.target.value)}
              inputMode="numeric"
              className="w-28 font-mono"
            />
          </Field>
          <Field label="Speaking speed (wpm)">
            <Input
              value={speakWpm}
              onChange={(e) => setSpeakWpm(e.target.value)}
              inputMode="numeric"
              className="w-28 font-mono"
            />
          </Field>
        </OptionsBar>
      </Panel>

      {'error' in result ? (
        <ErrorBanner error={result.error} />
      ) : (
        <Panel>
          <PanelHeader title="Estimate">
            <CopyButton
              value={() =>
                [
                  `Words: ${result.words}`,
                  `Reading time (${result.rw} wpm): ${fmt(result.readSec)}`,
                  `Speaking time (${result.sw} wpm): ${fmt(result.speakSec)}`,
                ].join('\n')
              }
            />
          </PanelHeader>
          <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2">
            <div className="rounded-md border bg-muted/30 px-3 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                Reading silently
              </div>
              <div className="font-mono text-2xl font-semibold">{fmt(result.readSec)}</div>
              <div className="text-xs text-muted-foreground">at {result.rw} wpm</div>
            </div>
            <div className="rounded-md border bg-muted/30 px-3 py-3">
              <div className="text-2xs uppercase tracking-wide text-muted-foreground">
                Speaking aloud
              </div>
              <div className="font-mono text-2xl font-semibold">{fmt(result.speakSec)}</div>
              <div className="text-xs text-muted-foreground">at {result.sw} wpm</div>
            </div>
          </div>

          <div className="px-3 pb-3">
            <div className="overflow-hidden rounded-md border">
              <div className="flex items-center bg-muted/40 px-3 py-1.5 text-2xs font-semibold uppercase tracking-wide text-muted-foreground">
                <span className="flex-1">Reading speed</span>
                <span className="w-20 text-right">wpm</span>
                <span className="w-28 text-right">Time</span>
              </div>
              {result.table.map((r) => (
                <div
                  key={r.label}
                  className="flex items-center border-t px-3 py-1.5 text-sm"
                >
                  <span className="flex-1">{r.label}</span>
                  <span className="w-20 text-right font-mono">{r.wpm}</span>
                  <span className="w-28 text-right font-mono">{r.time}</span>
                </div>
              ))}
            </div>
          </div>
          <StatBar
            items={[
              `words = ${result.words}`,
              `chars = ${result.chars}`,
              `chars (no spaces) = ${result.charsNoSpace}`,
            ]}
          />
        </Panel>
      )}
    </div>
  );
}
