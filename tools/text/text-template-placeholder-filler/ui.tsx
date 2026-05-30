'use client';

import { useCallback, useState } from 'react';

import { Field } from '@/components/tools/panel';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Delim = 'curly' | 'dollar';
type Missing = 'keep' | 'blank' | 'error';

const SAMPLE = `Hi {{name}},

Your order {{order_id}} totalling {{amount}} ships to {{city}}.
Thanks for shopping with {{store}}!`;

const SAMPLE_VARS = `name = Alex
order_id = A-1029
amount = $42.50
store = Utility Tools`;

// Parse substitutions from either a JSON object or key=value lines.
function parseVars(
  raw: string,
  caseInsensitive: boolean
): { map: Map<string, string> } | { error: string } {
  const trimmed = raw.trim();
  const map = new Map<string, string>();
  const norm = (k: string): string => (caseInsensitive ? k.toLowerCase() : k);

  if (trimmed.startsWith('{')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return { error: 'Substitutions look like JSON but are not valid JSON.' };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { error: 'JSON substitutions must be a plain object.' };
    }
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      map.set(norm(k), v === null || v === undefined ? '' : String(v));
    }
    return { map };
  }

  for (const line of trimmed.split(/\r\n?|\n/u)) {
    if (line.trim() === '') continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (key === '') continue;
    map.set(norm(key), val);
  }
  return { map };
}

export default function TemplatePlaceholderFiller() {
  const [vars, setVars] = useState(SAMPLE_VARS);
  const [delim, setDelim] = useState<Delim>('curly');
  const [missing, setMissing] = useState<Missing>('keep');
  const [caseInsensitive, setCaseInsensitive] = useState(false);

  const transform = useCallback(
    (input: string): string => {
      if (!input) return '';

      const parsed = parseVars(vars, caseInsensitive);
      if ('error' in parsed) throw new Error(parsed.error);
      const map = parsed.map;

      const re =
        delim === 'curly'
          ? /\{\{\s*([\w.-]+)\s*\}\}/gu
          : /\$\{\s*([\w.-]+)\s*\}/gu;

      const used = new Set<string>();
      const missingKeys = new Set<string>();

      const norm = (k: string): string =>
        caseInsensitive ? k.toLowerCase() : k;

      const filled = input.replace(re, (whole, rawKey: string) => {
        const key = norm(rawKey);
        if (map.has(key)) {
          used.add(key);
          return map.get(key) ?? '';
        }
        missingKeys.add(rawKey);
        if (missing === 'blank') return '';
        if (missing === 'error') return whole; // collected below, error thrown later
        return whole; // keep
      });

      if (missing === 'error' && missingKeys.size > 0) {
        throw new Error(
          `Missing values for: ${[...missingKeys].join(', ')}`
        );
      }

      const unused = [...map.keys()].filter((k) => !used.has(k));
      const notes: string[] = [];
      if (missingKeys.size > 0) {
        notes.push(`# Unresolved placeholders: ${[...missingKeys].join(', ')}`);
      }
      if (unused.length > 0) {
        notes.push(`# Unused keys: ${unused.join(', ')}`);
      }

      return notes.length > 0 ? `${filled}\n\n${notes.join('\n')}` : filled;
    },
    [vars, delim, missing, caseInsensitive]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[vars, delim, missing, caseInsensitive]}
      inputLabel="Template"
      outputLabel="Filled output"
      sample={SAMPLE}
      downloadName="filled.txt"
      options={
        <>
          <Field label="Placeholder style">
            <Select value={delim} onValueChange={(v) => setDelim(v as Delim)}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="curly">{'{{ key }}'}</SelectItem>
                <SelectItem value="dollar">{'${ key }'}</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Missing key">
            <Select value={missing} onValueChange={(v) => setMissing(v as Missing)}>
              <SelectTrigger className="h-8 w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keep">Keep placeholder</SelectItem>
                <SelectItem value="blank">Replace with blank</SelectItem>
                <SelectItem value="error">Raise error</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Keys">
            <label className="flex h-8 items-center gap-1.5 text-xs">
              <Checkbox
                checked={caseInsensitive}
                onCheckedChange={(v) => setCaseInsensitive(v === true)}
              />
              Case-insensitive
            </label>
          </Field>
          <Field label="Substitutions (key=value or JSON)" className="min-w-[260px] flex-1">
            <Textarea
              value={vars}
              onChange={(e) => setVars(e.target.value)}
              spellCheck={false}
              className="h-24 font-mono text-xs"
            />
          </Field>
        </>
      }
    />
  );
}
