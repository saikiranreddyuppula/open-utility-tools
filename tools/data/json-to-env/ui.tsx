'use client';

import { useCallback, useState } from 'react';
import { TextToolLayout } from '@/components/tools/text-tool';
import { Field } from '@/components/tools/panel';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type ArrayStyle = 'index' | 'underscore';

const SAMPLE = `{
  "db": {
    "host": "localhost",
    "port": 5432,
    "ssl": true
  },
  "appName": "My App",
  "tags": ["alpha", "beta"],
  "secret": null
}`;

function isPlainObject(v: Json): v is { [key: string]: Json } {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface Options {
  separator: string;
  upper: boolean;
  quoteAll: boolean;
  arrayStyle: ArrayStyle;
}

// Sanitize a key segment into a valid env var fragment.
function normalizeSegment(seg: string, opt: Options): string {
  const cleaned = seg.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const base = cleaned.length > 0 ? cleaned : 'KEY';
  return opt.upper ? base.toUpperCase() : base;
}

function needsQuoting(s: string): boolean {
  return /[\s"'#=$\\`]/.test(s) || s.length === 0 || /^\s|\s$/.test(s);
}

function formatValue(v: Exclude<Json, Json[] | { [key: string]: Json }>, opt: Options): string {
  if (v === null) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : '';
  // string
  if (opt.quoteAll || needsQuoting(v)) {
    const escaped = v.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
    return `"${escaped}"`;
  }
  return v;
}

function flatten(value: Json, path: string[], lines: string[], opt: Options): void {
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      const child = value[key];
      if (child === undefined) continue;
      flatten(child, [...path, normalizeSegment(key, opt)], lines, opt);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      // 'index' -> appended as its own segment (DB_HOSTS_0); 'underscore' -> N-prefixed (DB_HOSTS_N0)
      const idxSeg = opt.arrayStyle === 'index' ? String(i) : `N${i}`;
      flatten(item, [...path, idxSeg], lines, opt);
    });
    return;
  }
  const name = path.join(opt.separator);
  lines.push(`${name}=${formatValue(value, opt)}`);
}

function generate(data: Json, opt: Options): string {
  if (!isPlainObject(data) && !Array.isArray(data)) {
    throw new Error('Top-level JSON must be an object or array to flatten into .env lines.');
  }
  const sep = opt.separator.length > 0 ? opt.separator : '_';
  const lines: string[] = [];
  flatten(data, [], lines, { ...opt, separator: sep });
  if (lines.length === 0) throw new Error('No scalar values found to convert.');
  return lines.join('\n') + '\n';
}

export default function JsonToEnvTool() {
  const [separator, setSeparator] = useState('_');
  const [upper, setUpper] = useState(true);
  const [quoteAll, setQuoteAll] = useState(false);
  const [arrayStyle, setArrayStyle] = useState<ArrayStyle>('index');

  const transform = useCallback(
    (input: string) => {
      if (!input.trim()) return '';
      let parsed: Json;
      try {
        parsed = JSON.parse(input) as Json;
      } catch (e) {
        throw new Error(`Invalid JSON: ${(e as Error).message}`);
      }
      return generate(parsed, { separator, upper, quoteAll, arrayStyle });
    },
    [separator, upper, quoteAll, arrayStyle]
  );

  return (
    <TextToolLayout
      transform={transform}
      deps={[separator, upper, quoteAll, arrayStyle]}
      inputLabel="JSON"
      outputLabel=".env"
      inputPlaceholder="Paste a JSON object..."
      sample={SAMPLE}
      downloadName=".env"
      downloadMime="text/plain"
      options={
        <>
          <Field label="Separator" className="max-w-[120px]">
            <Input
              value={separator}
              onChange={(e) => setSeparator(e.target.value)}
              placeholder="_"
              className="h-8 font-mono"
            />
          </Field>
          <Field label="Array style" className="min-w-[170px]">
            <Select value={arrayStyle} onValueChange={(v) => setArrayStyle(v as ArrayStyle)}>
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="index">Numeric index</SelectItem>
                <SelectItem value="underscore">Underscore index</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Uppercase keys">
            <Switch checked={upper} onCheckedChange={setUpper} />
          </Field>
          <Field label="Quote all values">
            <Switch checked={quoteAll} onCheckedChange={setQuoteAll} />
          </Field>
        </>
      }
    />
  );
}
