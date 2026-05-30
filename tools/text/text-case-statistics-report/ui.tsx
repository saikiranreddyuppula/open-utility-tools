'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Checkbox } from '@/components/ui/checkbox';

const SAMPLE = `The quick Brown Fox jumps over 13 LAZY dogs!
Visit https://example.com for 100% pure data.`;

type Counts = {
  upper: number;
  lower: number;
  digit: number;
  whitespace: number;
  punct: number;
  other: number;
};

export default function TextCaseStatisticsReport() {
  const [includeWhitespace, setIncludeWhitespace] = useState(true);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';

      const c: Counts = {
        upper: 0,
        lower: 0,
        digit: 0,
        whitespace: 0,
        punct: 0,
        other: 0,
      };

      // Iterate by code point so astral characters are classified once.
      for (const ch of input) {
        if (/\s/u.test(ch)) {
          c.whitespace += 1;
        } else if (/\p{Lu}/u.test(ch)) {
          c.upper += 1;
        } else if (/\p{Ll}/u.test(ch)) {
          c.lower += 1;
        } else if (/\p{Nd}/u.test(ch)) {
          c.digit += 1;
        } else if (/[\p{P}\p{S}]/u.test(ch)) {
          c.punct += 1;
        } else {
          c.other += 1;
        }
      }

      const total = [...input].length;
      const denom = includeWhitespace ? total : Math.max(0, total - c.whitespace);

      const pct = (n: number): string => {
        if (denom <= 0) return '0.00%';
        return `${((n / denom) * 100).toFixed(2)}%`;
      };

      const letters = c.upper + c.lower;
      const words = (input.match(/\S+/gu) ?? []).length;
      const lines = input.split(/\r\n?|\n/u).length;

      const rows: Array<[string, number]> = [
        ['Uppercase letters', c.upper],
        ['Lowercase letters', c.lower],
        ['Digits', c.digit],
        ['Punctuation / symbols', c.punct],
        ['Whitespace', c.whitespace],
        ['Other', c.other],
      ];

      const labelW = Math.max(...rows.map(([l]) => l.length), 'Class'.length);
      const countW = Math.max(
        ...rows.map(([, n]) => String(n).length),
        'Count'.length
      );

      const header = `${'Class'.padEnd(labelW)}  ${'Count'.padStart(
        countW
      )}  Percent`;
      const sep = '-'.repeat(header.length);
      const body = rows
        .map(
          ([label, n]) =>
            `${label.padEnd(labelW)}  ${String(n).padStart(countW)}  ${pct(n)}`
        )
        .join('\n');

      const summary = [
        '',
        `Total characters     : ${total}`,
        `Letters (upper+lower): ${letters}`,
        `Words                : ${words}`,
        `Lines                : ${lines}`,
        `Percent denominator  : ${denom} ${
          includeWhitespace ? '(all characters)' : '(whitespace excluded)'
        }`,
      ].join('\n');

      return `${header}\n${sep}\n${body}\n${summary}`;
    },
    [includeWhitespace]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[includeWhitespace]}
      inputLabel="Text"
      outputLabel="Statistics report"
      sample={SAMPLE}
      downloadName="case-statistics.txt"
      options={
        <Field label="Percentages">
          <label className="flex h-8 items-center gap-1.5 text-xs">
            <Checkbox
              checked={includeWhitespace}
              onCheckedChange={(v) => setIncludeWhitespace(v === true)}
            />
            Include whitespace in denominator
          </label>
        </Field>
      }
    />
  );
}
