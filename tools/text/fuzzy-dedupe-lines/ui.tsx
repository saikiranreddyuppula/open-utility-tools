'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Field } from '@/components/tools/panel';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TextToolLayout } from '@/components/tools/text-tool';

type Keep = 'first' | 'last';

const SAMPLE = [
  'Hello World',
  'hello   world',
  'Hello, world!',
  'Café Olé',
  'Cafe Ole',
  'Totally unique line',
  'TOTALLY UNIQUE LINE',
].join('\n');

export default function FuzzyDedupeLinesTool() {
  const [lower, setLower] = useState(true);
  const [collapseWs, setCollapseWs] = useState(true);
  const [stripPunct, setStripPunct] = useState(true);
  const [ignoreAccents, setIgnoreAccents] = useState(true);
  const [keep, setKeep] = useState<Keep>('first');

  const normalize = useCallback(
    (line: string): string => {
      let s = line;
      if (lower) s = s.toLowerCase();
      if (ignoreAccents) {
        s = s.normalize('NFD').replace(/[̀-ͯ]/g, '');
      }
      if (stripPunct) {
        // Drop anything that is not a letter, number, or whitespace.
        s = s.replace(/[^\p{L}\p{N}\s]/gu, '');
      }
      if (collapseWs) {
        s = s.trim().replace(/\s+/g, ' ');
      }
      return s;
    },
    [lower, collapseWs, stripPunct, ignoreAccents]
  );

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const lines = input.split('\n');

      // For "keep last", reverse so the last occurrence becomes the first seen,
      // then reverse the kept result back to original order.
      const ordered = keep === 'last' ? [...lines].reverse() : lines;
      const seen = new Set<string>();
      const kept: string[] = [];
      let removed = 0;

      for (const line of ordered) {
        const key = normalize(line);
        if (seen.has(key)) {
          removed += 1;
          continue;
        }
        seen.add(key);
        kept.push(line);
      }

      const result = keep === 'last' ? kept.reverse() : kept;
      const header = `# kept ${result.length} line(s), removed ${removed} fuzzy duplicate(s)`;
      return `${header}\n${result.join('\n')}`;
    },
    [keep, normalize]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[lower, collapseWs, stripPunct, ignoreAccents, keep]}
      sample={SAMPLE}
      downloadName="deduped.txt"
      options={
        <>
          <Field label="Keep">
            <Tabs value={keep} onValueChange={(v) => setKeep(v as Keep)}>
              <TabsList>
                <TabsTrigger value="first">First</TabsTrigger>
                <TabsTrigger value="last">Last</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Normalize keys by">
            <div className="flex h-8 flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={lower} onCheckedChange={setLower} /> lowercase
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={collapseWs} onCheckedChange={setCollapseWs} /> collapse spaces
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={stripPunct} onCheckedChange={setStripPunct} /> strip punctuation
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={ignoreAccents} onCheckedChange={setIgnoreAccents} /> ignore accents
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
