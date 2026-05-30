'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SortMode = 'natural' | 'lexicographic' | 'length';

const LOCALES: { value: string; label: string }[] = [
  { value: 'en', label: 'English (en)' },
  { value: 'de', label: 'German (de)' },
  { value: 'fr', label: 'French (fr)' },
  { value: 'es', label: 'Spanish (es)' },
  { value: 'sv', label: 'Swedish (sv)' },
  { value: 'tr', label: 'Turkish (tr)' },
  { value: 'zh', label: 'Chinese (zh)' },
  { value: 'ja', label: 'Japanese (ja)' },
];

const SAMPLE = ['file10', 'file2', 'file1', 'File20', 'file3', 'img12', 'img2', 'img100'].join('\n');

export default function NaturalSortLinesTool() {
  const [mode, setMode] = useState<SortMode>('natural');
  const [descending, setDescending] = useState(false);
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [locale, setLocale] = useState('en');
  const [stripLeading, setStripLeading] = useState(true);
  const [useField, setUseField] = useState(false);
  const [delimiter, setDelimiter] = useState(',');
  const [fieldIndex, setFieldIndex] = useState('0');

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      const lines = input.split('\n');

      const fieldIdx = (() => {
        const n = Number(fieldIndex);
        return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
      })();

      const delim = delimiter.length > 0 ? delimiter : ',';

      // The comparison key for a given line.
      const keyOf = (line: string): string => {
        let value = line;
        if (useField) {
          const parts = value.split(delim);
          value = parts[fieldIdx] ?? '';
        }
        if (stripLeading) value = value.replace(/^\s+/, '');
        return value;
      };

      let collator: Intl.Collator;
      try {
        collator = new Intl.Collator(locale || 'en', {
          numeric: mode === 'natural',
          sensitivity: caseSensitive ? 'variant' : 'accent',
        });
      } catch {
        collator = new Intl.Collator('en', {
          numeric: mode === 'natural',
          sensitivity: caseSensitive ? 'variant' : 'accent',
        });
      }

      // Decorate-sort-undecorate for a stable sort (Array.sort is stable in
      // modern engines, but we keep the original index as a tie-breaker to
      // guarantee stability regardless).
      const decorated = lines.map((line, index) => ({ line, index, key: keyOf(line) }));

      decorated.sort((a, b) => {
        let cmp: number;
        if (mode === 'length') {
          // Compare by code-point length, ties broken by collation.
          const la = [...a.key].length;
          const lb = [...b.key].length;
          cmp = la === lb ? collator.compare(a.key, b.key) : la - lb;
        } else if (mode === 'lexicographic') {
          const ka = caseSensitive ? a.key : a.key.toLowerCase();
          const kb = caseSensitive ? b.key : b.key.toLowerCase();
          cmp = ka < kb ? -1 : ka > kb ? 1 : 0;
        } else {
          cmp = collator.compare(a.key, b.key);
        }
        if (cmp !== 0) return descending ? -cmp : cmp;
        // Stable tie-breaker: preserve original order (never reversed).
        return a.index - b.index;
      });

      return decorated.map((d) => d.line).join('\n');
    },
    [mode, descending, caseSensitive, locale, stripLeading, useField, delimiter, fieldIndex]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, descending, caseSensitive, locale, stripLeading, useField, delimiter, fieldIndex]}
      inputLabel="Lines to sort"
      outputLabel="Sorted lines"
      sample={SAMPLE}
      downloadName="sorted.txt"
      options={
        <>
          <Field label="Mode">
            <Select value={mode} onValueChange={(v) => setMode(v as SortMode)}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="natural">Natural / numeric</SelectItem>
                <SelectItem value="lexicographic">Lexicographic (plain)</SelectItem>
                <SelectItem value="length">By line length</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Locale">
            <Select value={locale} onValueChange={(v) => setLocale(v)}>
              <SelectTrigger className="w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LOCALES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Direction">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="ns-desc"
                checked={descending}
                onCheckedChange={(v) => setDescending(v === true)}
              />
              <Label htmlFor="ns-desc" className="text-xs font-normal">
                Descending
              </Label>
            </div>
          </Field>
          <Field label="Case">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="ns-case"
                checked={caseSensitive}
                onCheckedChange={(v) => setCaseSensitive(v === true)}
              />
              <Label htmlFor="ns-case" className="text-xs font-normal">
                Case-sensitive
              </Label>
            </div>
          </Field>
          <Field label="Whitespace">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="ns-strip"
                checked={stripLeading}
                onCheckedChange={(v) => setStripLeading(v === true)}
              />
              <Label htmlFor="ns-strip" className="text-xs font-normal">
                Strip leading
              </Label>
            </div>
          </Field>
          <Field label="Sort by field">
            <div className="flex h-9 items-center gap-2">
              <Checkbox
                id="ns-field"
                checked={useField}
                onCheckedChange={(v) => setUseField(v === true)}
              />
              <Label htmlFor="ns-field" className="text-xs font-normal">
                Use a column
              </Label>
            </div>
          </Field>
          {useField && (
            <>
              <Field label="Delimiter">
                <Input
                  value={delimiter}
                  onChange={(e) => setDelimiter(e.target.value)}
                  className="w-[90px]"
                  placeholder=","
                />
              </Field>
              <Field label="Field index (0-based)">
                <Input
                  value={fieldIndex}
                  onChange={(e) => setFieldIndex(e.target.value)}
                  className="w-[110px]"
                  inputMode="numeric"
                />
              </Field>
            </>
          )}
        </>
      }
    />
  );
}
