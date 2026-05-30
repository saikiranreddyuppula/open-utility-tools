'use client';

import { useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';

const STOP_WORDS = new Set(['a', 'an', 'the', 'of', 'and', 'for', 'to']);

const SAMPLE = 'National Aeronautics and Space Administration';

export default function AcronymMakerTool() {
  const [skipStop, setSkipStop] = useState(true);
  const [keepSkipped, setKeepSkipped] = useState(false);
  const [upper, setUpper] = useState(true);
  const [dotted, setDotted] = useState(false);

  return (
    <TextToolLayout
      deps={[skipStop, keepSkipped, upper, dotted]}
      transform={(input) => {
        const phrase = input.trim();
        if (!phrase) return '';

        const words = phrase.split(/[\s_-]+/).filter((w) => /[A-Za-z0-9]/.test(w));
        if (words.length === 0) return 'No words to abbreviate.';

        const mapping: string[] = [];
        const letters: string[] = [];

        for (const word of words) {
          const firstChar = word.match(/[A-Za-z0-9]/);
          const letter = firstChar ? firstChar[0] : '';
          if (!letter) continue;
          const isStop = STOP_WORDS.has(word.toLowerCase());
          let contributes = true;
          if (skipStop && isStop && !keepSkipped) contributes = false;
          const shown = upper ? letter.toUpperCase() : letter;
          if (contributes) {
            letters.push(shown);
            mapping.push(`${word} → ${shown}`);
          } else {
            mapping.push(`${word} → (skipped)`);
          }
        }

        const acronym = letters.join('');
        const dottedVariant = letters.join('.') + (letters.length ? '.' : '');
        const primary = dotted ? dottedVariant : acronym;

        const out: string[] = [];
        out.push(`Acronym:  ${primary || '—'}`);
        out.push(`Plain:    ${acronym || '—'}`);
        out.push(`Dotted:   ${dottedVariant || '—'}`);
        out.push('');
        out.push('Mapping:');
        out.push(...mapping.map((m) => `  ${m}`));
        return out.join('\n');
      }}
      inputLabel="Phrase"
      outputLabel="Acronym"
      sample={SAMPLE}
      downloadName="acronym.txt"
      options={
        <>
          <Field label="Skip stop-words (a, the, of, and…)">
            <Switch checked={skipStop} onCheckedChange={setSkipStop} />
          </Field>
          <Field label="Keep skipped words' letters anyway">
            <Switch checked={keepSkipped} onCheckedChange={setKeepSkipped} />
          </Field>
          <Field label="Uppercase">
            <Switch checked={upper} onCheckedChange={setUpper} />
          </Field>
          <Field label="Dotted (initialism style)">
            <Switch checked={dotted} onCheckedChange={setDotted} />
          </Field>
        </>
      }
    />
  );
}
