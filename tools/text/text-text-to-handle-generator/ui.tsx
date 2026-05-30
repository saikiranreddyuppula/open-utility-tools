'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { TextToolLayout } from '@/components/tools/text-tool';

type Sep = 'none' | 'dot' | 'underscore' | 'dash';

const SEP_CHAR: Record<Sep, string> = {
  none: '',
  dot: '.',
  underscore: '_',
  dash: '-',
};

// Lowercase, strip diacritics, keep only [a-z0-9] words.
function tokenize(input: string): string[] {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function truncate(s: string, max: number): string {
  return max > 0 && s.length > max ? s.slice(0, max) : s;
}

export default function HandleGeneratorTool() {
  const [sep, setSep] = useState<Sep>('none');
  const [maxLen, setMaxLen] = useState('20');
  const [withNumbers, setWithNumbers] = useState(true);

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      const words = tokenize(input);
      if (words.length === 0) throw new Error('No usable letters or digits found in the input.');

      const sc = SEP_CHAR[sep];
      const max = (() => {
        const n = parseInt(maxLen, 10);
        return Number.isFinite(n) && n > 0 ? n : 0;
      })();

      const first = words[0] ?? '';
      const last = words[words.length - 1] ?? '';

      const bases: string[] = [];
      const push = (v: string) => {
        const t = truncate(v, max);
        if (t && !bases.includes(t)) bases.push(t);
      };

      push(words.join(sc)); // full joined
      if (words.length >= 2) {
        push(first + sc + last); // first + last
        push((first[0] ?? '') + sc + last); // initial + last
        push(first + sc + (last[0] ?? '')); // first + last initial
        push(words.map((w) => w[0] ?? '').join('')); // initials
      }
      push(first); // just first word

      const handles: string[] = [];
      const suffixes = withNumbers ? ['', '7', '99', '_x', '2026'] : [''];
      for (const base of bases) {
        for (const suf of suffixes) {
          const h = truncate(base + suf, max);
          if (h && !handles.includes(h)) handles.push(h);
        }
      }

      return handles.map((h) => '@' + h).join('\n');
    },
    [sep, maxLen, withNumbers]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[sep, maxLen, withNumbers]}
      inputLabel="Name or phrase"
      outputLabel="Handle suggestions"
      sample={'Ada Lovelace'}
      inputPlaceholder="e.g. Ada Lovelace"
      downloadName="handles.txt"
      options={
        <>
          <Field label="Separator">
            <Select value={sep} onValueChange={(v) => setSep(v as Sep)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (adalovelace)</SelectItem>
                <SelectItem value="dot">Dot (ada.lovelace)</SelectItem>
                <SelectItem value="underscore">Underscore (ada_lovelace)</SelectItem>
                <SelectItem value="dash">Dash (ada-lovelace)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Max length">
            <Input
              value={maxLen}
              onChange={(e) => setMaxLen(e.target.value)}
              inputMode="numeric"
              className="w-24 font-mono"
              placeholder="0 = none"
            />
          </Field>
          <Field label="Numeric suffixes">
            <div className="flex h-9 items-center gap-2">
              <Switch checked={withNumbers} onCheckedChange={setWithNumbers} id="hg-num" />
              <Label htmlFor="hg-num" className="text-xs text-muted-foreground">
                Add variants
              </Label>
            </div>
          </Field>
        </>
      }
    />
  );
}
