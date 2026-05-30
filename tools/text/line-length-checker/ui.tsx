'use client';

import { useCallback, useState } from 'react';

import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

const SAMPLE = [
  'This line is short.',
  'This particular line is intentionally written to be quite long so that it will exceed the eighty character column limit set by many style guides.',
  '\tindented with a tab then some text following the tab character here',
  'fits',
].join('\n');

// Expand tabs to the next multiple of tabWidth, like a real terminal/editor.
function displayLength(line: string, tabWidth: number): number {
  let col = 0;
  for (const ch of line) {
    if (ch === '\t') {
      const advance = tabWidth - (col % tabWidth);
      col += advance > 0 ? advance : tabWidth;
    } else {
      col += 1;
    }
  }
  return col;
}

export default function LineLengthCheckerTool() {
  const [maxWidth, setMaxWidth] = useState('80');
  const [tabWidth, setTabWidth] = useState('4');
  const [annotateAll, setAnnotateAll] = useState(false);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';
      const max = Number(maxWidth);
      const limit = Number.isFinite(max) && max > 0 ? Math.floor(max) : 80;
      const tw = Number(tabWidth);
      const tab = Number.isFinite(tw) && tw >= 1 ? Math.floor(tw) : 4;

      const lines = input.split('\n');
      const lengths = lines.map((l) => displayLength(l, tab));

      let overCount = 0;
      let longest = 0;
      let longestLine = 0;
      let total = 0;
      const overReport: string[] = [];

      lengths.forEach((len, i) => {
        total += len;
        if (len > longest) {
          longest = len;
          longestLine = i + 1;
        }
        if (len > limit) {
          overCount += 1;
          overReport.push(`Line ${i + 1}: ${len} chars (+${len - limit} over)`);
        }
      });

      const avg = lines.length > 0 ? (total / lines.length).toFixed(1) : '0';

      const summary = [
        `Max width: ${limit} · tab width: ${tab}`,
        `Total lines: ${lines.length}`,
        `Over limit: ${overCount}`,
        `Longest: ${longest} chars (line ${longestLine || 0})`,
        `Average length: ${avg}`,
      ].join('\n');

      const parts: string[] = [summary];

      if (overReport.length > 0) {
        parts.push(`\n--- Over-length lines ---\n${overReport.join('\n')}`);
      } else {
        parts.push('\nAll lines are within the limit.');
      }

      if (annotateAll) {
        const annotated = lines
          .map((l, i) => {
            const len = lengths[i] ?? 0;
            const flag = len > limit ? ' <<< OVER' : '';
            return `${String(i + 1).padStart(4, ' ')} [${String(len).padStart(3, ' ')}] ${l}${flag}`;
          })
          .join('\n');
        parts.push(`\n--- Annotated ---\n${annotated}`);
      }

      return parts.join('\n');
    },
    [maxWidth, tabWidth, annotateAll]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[maxWidth, tabWidth, annotateAll]}
      sample={SAMPLE}
      inputLabel="Text"
      outputLabel="Report"
      downloadName="line-length-report.txt"
      options={
        <>
          <Field label="Max width">
            <Input className="w-24" value={maxWidth} inputMode="numeric" onChange={(e) => setMaxWidth(e.target.value)} />
          </Field>
          <Field label="Tab width">
            <Input className="w-24" value={tabWidth} inputMode="numeric" onChange={(e) => setTabWidth(e.target.value)} />
          </Field>
          <Field label="Annotate">
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <Switch checked={annotateAll} onCheckedChange={setAnnotateAll} /> show every line length
            </label>
          </Field>
        </>
      }
    />
  );
}
