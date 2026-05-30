'use client';

import { useCallback, useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';

type Mode = 'escape' | 'unescape';
type Delim = 'comma' | 'semicolon' | 'tab' | 'pipe';

const DELIM_CHAR: Record<Delim, string> = {
  comma: ',',
  semicolon: ';',
  tab: '\t',
  pipe: '|',
};

function escapeField(field: string, delim: string, always: boolean): string {
  const needs =
    always ||
    field.includes(delim) ||
    field.includes('"') ||
    field.includes('\n') ||
    field.includes('\r');
  if (!needs) return field;
  return `"${field.replace(/"/g, '""')}"`;
}

/** Parses a single RFC 4180 field, unwrapping quotes if present. */
function unescapeField(raw: string): string {
  const trimmed = raw.replace(/\r$/, '');
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"');
  }
  return trimmed;
}

/** Splits one CSV line into fields, honoring quoted sections. */
function splitCsvLine(line: string, delim: string): string[] {
  const fields: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i] ?? '';
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

function run(
  input: string,
  mode: Mode,
  delim: string,
  always: boolean,
  splitOnDelim: boolean,
): string {
  if (mode === 'escape') {
    const lines = input.split('\n');
    return lines
      .map((line) => {
        if (!splitOnDelim) return escapeField(line, delim, always);
        return line
          .split(delim)
          .map((f) => escapeField(f, delim, always))
          .join(delim);
      })
      .join('\n');
  }
  // unescape
  const lines = input.split('\n');
  return lines
    .map((line) => {
      if (!splitOnDelim) return unescapeField(line);
      return splitCsvLine(line, delim).join(delim);
    })
    .join('\n');
}

export default function CsvFieldEscapeTool() {
  const [mode, setMode] = useState<Mode>('escape');
  const [delim, setDelim] = useState<Delim>('comma');
  const [always, setAlways] = useState(false);
  const [splitOnDelim, setSplitOnDelim] = useState(false);

  const transform = useCallback(
    (input: string) => {
      if (!input) return '';
      return run(input, mode, DELIM_CHAR[delim], always, splitOnDelim);
    },
    [mode, delim, always, splitOnDelim],
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[mode, delim, always, splitOnDelim]}
      inputLabel={mode === 'escape' ? 'Value(s)' : 'CSV field(s)'}
      outputLabel={mode === 'escape' ? 'CSV-safe' : 'Raw value'}
      inputPlaceholder={mode === 'escape' ? 'O\'Brien, "Bob"' : '"O\'Brien, ""Bob"""'}
      sample={
        mode === 'escape'
          ? 'O\'Brien, "Bob"\nLine 1\nLine 2\nplain value'
          : '"O\'Brien, ""Bob"""\n"Line 1\nLine 2"\nplain value'
      }
      downloadName="csv-field.txt"
      options={
        <>
          <Field label="Mode">
            <Tabs value={mode} onValueChange={(v) => setMode(v as Mode)}>
              <TabsList>
                <TabsTrigger value="escape">Escape</TabsTrigger>
                <TabsTrigger value="unescape">Unescape</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Delimiter">
            <Tabs value={delim} onValueChange={(v) => setDelim(v as Delim)}>
              <TabsList>
                <TabsTrigger value="comma">,</TabsTrigger>
                <TabsTrigger value="semicolon">;</TabsTrigger>
                <TabsTrigger value="tab">Tab</TabsTrigger>
                <TabsTrigger value="pipe">|</TabsTrigger>
              </TabsList>
            </Tabs>
          </Field>
          <Field label="Per-line handling">
            <div className="flex items-center gap-2">
              <Checkbox
                id="csv-split"
                checked={splitOnDelim}
                onCheckedChange={(c) => setSplitOnDelim(c === true)}
              />
              <Label htmlFor="csv-split">Split each line on delimiter</Label>
            </div>
          </Field>
          {mode === 'escape' && (
            <Field label="Quoting">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="csv-always"
                  checked={always}
                  onCheckedChange={(c) => setAlways(c === true)}
                />
                <Label htmlFor="csv-always">Always quote</Label>
              </div>
            </Field>
          )}
        </>
      }
    />
  );
}
