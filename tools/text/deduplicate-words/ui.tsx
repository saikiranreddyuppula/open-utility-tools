'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Checkbox } from '@/components/ui/checkbox';

type Mode = 'all' | 'consecutive';

const SAMPLE =
  'The the quick brown fox fox jumps over the lazy dog. The dog dog was not amused amused.';

export default function DeduplicateWordsTool() {
  const [mode, setMode] = useState<Mode>('consecutive');
  const [ci, setCi] = useState(true);
  const [ignorePunct, setIgnorePunct] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      // Split into alternating word / separator tokens, preserving original spacing.
      // A "word" is a maximal run of non-whitespace; separators are whitespace runs.
      const tokens = input.match(/\s+|\S+/g) ?? [];

      const norm = (w: string): string => {
        let s = w;
        if (ignorePunct) s = s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
        if (ci) s = s.toLowerCase();
        return s;
      };

      let removed = 0;
      const out: string[] = [];
      const seen = new Set<string>();
      let prevWordKey: string | null = null;
      let pendingSep: string | null = null;

      for (const tok of tokens) {
        const isWS = /^\s+$/.test(tok);
        if (isWS) {
          pendingSep = (pendingSep ?? '') + tok;
          continue;
        }
        const k = norm(tok);
        let drop = false;
        if (k !== '') {
          if (mode === 'all') {
            if (seen.has(k)) drop = true;
            else seen.add(k);
          } else {
            if (prevWordKey !== null && prevWordKey === k) drop = true;
          }
        }
        prevWordKey = k === '' ? prevWordKey : k;

        if (drop) {
          removed += 1;
          // Drop this word; also drop the separator that preceded it so we don't
          // leave a double space. Keep one separator boundary between kept words.
          pendingSep = null;
          continue;
        }
        if (out.length > 0 && pendingSep !== null) out.push(pendingSep);
        else if (out.length > 0 && pendingSep === null) out.push(' ');
        pendingSep = null;
        out.push(tok);
      }

      // Preserve trailing whitespace if any remained and nothing was dropped after it.
      const tail = pendingSep ?? '';
      const summary = `# removed ${removed} duplicate word${removed === 1 ? '' : 's'}`;
      const result = out.join('') + tail;
      return `${result}\n\n${summary}`;
    },
    [mode, ci, ignorePunct]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, ci, ignorePunct]}
      inputLabel="Text"
      outputLabel="Deduplicated"
      sample={SAMPLE}
      downloadName="deduped.txt"
      options={
        <>
          <Field label="Mode">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="dwmode"
                  checked={mode === 'consecutive'}
                  onChange={() => setMode('consecutive')}
                />
                consecutive only
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="radio"
                  name="dwmode"
                  checked={mode === 'all'}
                  onChange={() => setMode('all')}
                />
                all (keep first)
              </label>
            </div>
          </Field>
          <Field label="Options">
            <div className="flex h-8 items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={ci} onCheckedChange={(c) => setCi(c === true)} /> ignore case
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Checkbox checked={ignorePunct} onCheckedChange={(c) => setIgnorePunct(c === true)} /> ignore edge punctuation
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
