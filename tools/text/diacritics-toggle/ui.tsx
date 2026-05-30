'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Mode = 'strip' | 'slug' | 'report';

// Letters NFD does not decompose into base + combining marks.
const SPECIAL: Record<string, string> = {
  'ø': 'o',
  'Ø': 'O',
  'æ': 'ae',
  'Æ': 'AE',
  'œ': 'oe',
  'Œ': 'OE',
  'ß': 'ss',
  'ẞ': 'SS',
  'ł': 'l',
  'Ł': 'L',
  'đ': 'd',
  'Đ': 'D',
  'þ': 'th',
  'Þ': 'Th',
  'ð': 'd',
  'Ð': 'D',
  'ı': 'i',
  'İ': 'I',
  'ŋ': 'ng',
  'Ŋ': 'NG',
};

function fold(input: string): { out: string; changes: Array<{ from: string; to: string }> } {
  const changes: Array<{ from: string; to: string }> = [];
  let out = '';
  for (const ch of input) {
    const special = SPECIAL[ch];
    if (special !== undefined) {
      out += special;
      changes.push({ from: ch, to: special });
      continue;
    }
    const folded = ch.normalize('NFD').replace(/[̀-ͯ]/g, '');
    out += folded;
    if (folded !== ch) changes.push({ from: ch, to: folded });
  }
  return { out, changes };
}

export default function DiacriticsToggleTool() {
  const [mode, setMode] = useState<Mode>('strip');

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const { out, changes } = fold(input);

      if (mode === 'report') {
        if (changes.length === 0) return '# No characters needed folding.';
        const seen = new Map<string, { to: string; count: number }>();
        for (const c of changes) {
          const prev = seen.get(c.from);
          if (prev) prev.count += 1;
          else seen.set(c.from, { to: c.to, count: 1 });
        }
        const rows: string[] = [];
        for (const [from, info] of seen) {
          const cp = (from.codePointAt(0) ?? 0).toString(16).toUpperCase().padStart(4, '0');
          rows.push(`${from} (U+${cp}) -> ${info.to}   ×${info.count}`);
        }
        return `${changes.length} character(s) changed:\n\n${rows.join('\n')}`;
      }

      if (mode === 'slug') {
        return out
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '');
      }

      return out;
    },
    [mode]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode]}
      inputLabel="Text"
      outputLabel={mode === 'report' ? 'Changes' : 'Result'}
      sample={'Café — naïve résumé, smörgåsbord, Łódź, Straße, Æsop, Ǿ, ñoño, Þór.'}
      downloadName="folded.txt"
      options={
        <Field label="Mode">
          <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
            <SelectTrigger className="h-8 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="strip">Strip diacritics → ASCII</SelectItem>
              <SelectItem value="slug">ASCII-fold for slug / username</SelectItem>
              <SelectItem value="report">Report changed characters</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      }
    />
  );
}
