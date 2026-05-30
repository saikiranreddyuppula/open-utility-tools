'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TextToolLayout } from '@/components/tools/text-tool';

type Style = 'pascal' | 'lower' | 'separate';

const STOP_WORDS = new Set<string>([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'to', 'in', 'on', 'at', 'for',
  'with', 'by', 'is', 'are', 'was', 'were', 'be', 'as', 'it', 'this', 'that',
  'from', 'into', 'over', 'so', 'if', 'then', 'than', 'too', 'very', 'just',
  'about', 'up', 'out', 'off', 'i', 'you', 'we', 'they', 'he', 'she',
]);

const SAMPLE = ['Learning to code in 2026', 'My best travel photos', 'The art of clean design'].join('\n');

function clean(phrase: string): string[] {
  // strip diacritics, then split into word tokens of letters/numbers
  const noAccents = phrase.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const matches = noAccents.match(/[\p{L}\p{N}]+/gu);
  return matches ?? [];
}

function capitalize(word: string): string {
  if (!word) return '';
  const first = word.charAt(0).toUpperCase();
  return first + word.slice(1).toLowerCase();
}

export default function HashtagGeneratorTool() {
  const [style, setStyle] = useState<Style>('pascal');
  const [maxLen, setMaxLen] = useState('30');
  const [dropStop, setDropStop] = useState(true);
  const [keepNumbers, setKeepNumbers] = useState(true);
  const [combine, setCombine] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const limit = Number(maxLen);
      const cap = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 0;

      const lines = input.split('\n');
      const out: string[] = [];
      const allTags: string[] = [];

      for (const line of lines) {
        if (!line.trim()) {
          out.push('');
          continue;
        }
        let words = clean(line);
        if (!keepNumbers) words = words.filter((w) => !/^\p{N}+$/u.test(w));
        if (dropStop) {
          const filtered = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
          // never empty the whole line out if every word is a stop-word
          if (filtered.length > 0) words = filtered;
        }
        if (words.length === 0) {
          out.push('');
          continue;
        }

        let tags: string[];
        if (style === 'separate') {
          tags = words.map((w) => `#${w.toLowerCase()}`);
        } else if (style === 'lower') {
          tags = [`#${words.join('').toLowerCase()}`];
        } else {
          tags = [`#${words.map(capitalize).join('')}`];
        }

        if (cap > 0) {
          tags = tags.map((t) => (t.length > cap ? t.slice(0, cap) : t));
        }

        for (const t of tags) allTags.push(t);
        out.push(tags.join(' '));
      }

      let result = out.join('\n');
      if (combine && allTags.length > 0) {
        const unique: string[] = [];
        const seen = new Set<string>();
        for (const t of allTags) {
          const key = t.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(t);
        }
        result += `\n\n--- Combined (${unique.length} unique) ---\n${unique.join(' ')}`;
      }
      return result;
    },
    [style, maxLen, dropStop, keepNumbers, combine]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[style, maxLen, dropStop, keepNumbers, combine]}
      sample={SAMPLE}
      inputLabel="Phrases (one per line)"
      outputLabel="Hashtags"
      downloadName="hashtags.txt"
      options={
        <>
          <Field label="Style">
            <Select value={style} onValueChange={(v) => setStyle(v as Style)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pascal">PascalCase #LikeThis</SelectItem>
                <SelectItem value="lower">lowercase #likethis</SelectItem>
                <SelectItem value="separate">Separate #per #word</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Max length (0 = none)">
            <Input
              className="h-8 w-24"
              value={maxLen}
              inputMode="numeric"
              onChange={(e) => setMaxLen(e.target.value)}
            />
          </Field>
          <Field label="Options">
            <div className="flex h-8 flex-wrap items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={dropStop} onCheckedChange={setDropStop} /> drop stop-words
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={keepNumbers} onCheckedChange={setKeepNumbers} /> keep numbers
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <Switch checked={combine} onCheckedChange={setCombine} /> combined block
              </label>
            </div>
          </Field>
        </>
      }
    />
  );
}
