'use client';

import { useMemo, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

type OutMode = 'matching' | 'non-matching' | 'annotated';

const SAMPLE = [
  'error: disk full on /dev/sda1',
  'info: backup completed at 02:00',
  'error: timeout connecting to db',
  'warning: low memory',
  'info: 42 users online',
].join('\n');

const FLAG_DEFS: { key: string; label: string }[] = [
  { key: 'i', label: 'i (ignore case)' },
  { key: 'm', label: 'm (multiline ^$)' },
  { key: 's', label: 's (dotall)' },
  { key: 'u', label: 'u (unicode)' },
];

export default function RegexMatchLinesTool() {
  const [pattern, setPattern] = useState('error: (.+)');
  const [flags, setFlags] = useState<Record<string, boolean>>({
    i: false,
    m: false,
    s: false,
    u: false,
  });
  const [mode, setMode] = useState<OutMode>('annotated');

  const flagString = useMemo(
    () =>
      FLAG_DEFS.filter((f) => flags[f.key] === true)
        .map((f) => f.key)
        .join(''),
    [flags],
  );

  const transform = useMemo(
    () => (input: string) => {
      if (!input) return '';
      if (!pattern) throw new Error('Enter a regex pattern.');

      let re: RegExp;
      try {
        re = new RegExp(pattern, flagString);
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : 'Invalid regular expression.');
      }

      const lines = input.split('\n');
      const out: string[] = [];
      const groupRows: string[] = [];
      let groupCount = 0;
      let matched = 0;

      lines.forEach((line, idx) => {
        re.lastIndex = 0;
        const m = re.exec(line);
        const hit = m !== null;
        if (hit) {
          matched += 1;
          if (m.length - 1 > groupCount) groupCount = m.length - 1;
          if (m.length > 1) {
            const groups = m
              .slice(1)
              .map((g, gi) => `$${gi + 1}=${g === undefined ? '(none)' : g}`)
              .join('  ');
            groupRows.push(`line ${idx + 1}: ${groups}`);
          }
        }

        if (mode === 'matching') {
          if (hit) out.push(line);
        } else if (mode === 'non-matching') {
          if (!hit) out.push(line);
        } else {
          const mark = hit ? '✓' : '✗';
          out.push(`${mark} ${idx + 1}\t${line}`);
        }
      });

      let result = out.join('\n');

      if (groupCount > 0 && groupRows.length > 0) {
        result += `\n\n--- Captured groups (${matched} matching line${matched === 1 ? '' : 's'}) ---\n`;
        result += groupRows.join('\n');
      }

      if (result === '') {
        const noun =
          mode === 'matching'
            ? 'matching'
            : mode === 'non-matching'
              ? 'non-matching'
              : '';
        return `(no ${noun} lines)`;
      }
      return result;
    },
    [pattern, flagString, mode],
  );

  const options = (
    <div className="flex flex-wrap items-end gap-4">
      <Field label="Pattern" className="min-w-[260px] flex-1">
        <Input
          value={pattern}
          onChange={(e) => setPattern(e.target.value)}
          placeholder="e.g. error: (.+)"
          className="font-mono"
          spellCheck={false}
        />
      </Field>
      <Field label="Flags">
        <div className="flex flex-wrap gap-3">
          {FLAG_DEFS.map((f) => (
            <label key={f.key} className="flex items-center gap-1.5 text-xs">
              <Checkbox
                checked={flags[f.key] === true}
                onCheckedChange={(c) =>
                  setFlags((prev) => ({ ...prev, [f.key]: c === true }))
                }
              />
              <span className="font-mono">{f.label}</span>
            </label>
          ))}
        </div>
      </Field>
      <Field label="Output">
        <RadioGroup
          value={mode}
          onValueChange={(v) => setMode(v as OutMode)}
          className="flex flex-wrap gap-3"
        >
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="matching" id="rml-m" />
            <Label htmlFor="rml-m" className="text-xs">Matching only</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="non-matching" id="rml-n" />
            <Label htmlFor="rml-n" className="text-xs">Non-matching only</Label>
          </div>
          <div className="flex items-center gap-1.5">
            <RadioGroupItem value="annotated" id="rml-a" />
            <Label htmlFor="rml-a" className="text-xs">Annotated</Label>
          </div>
        </RadioGroup>
      </Field>
    </div>
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[pattern, flagString, mode]}
      inputLabel="Text"
      outputLabel="Lines"
      inputPlaceholder="Paste text, one record per line…"
      sample={SAMPLE}
      downloadName="matches.txt"
      options={options}
    />
  );
}
