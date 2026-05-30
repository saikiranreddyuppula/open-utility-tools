'use client';

import { useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';

import { Panel, PanelHeader, OptionsBar, Field, StatBar } from '@/components/tools/panel';
import { CopyButton } from '@/components/tools/copy-button';
import { DownloadButton } from '@/components/tools/download-button';
import { ErrorBanner } from '@/components/tools/error-banner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

type OutFormat = 'array' | 'ndjson';

interface Rng {
  next(): number;
  int(min: number, max: number): number;
  pick<T>(arr: T[]): T | undefined;
}

/** mulberry32 PRNG seeded from a string. */
function makeRng(seedStr: string): Rng {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int(min, max) {
      if (max < min) return min;
      return min + Math.floor(next() * (max - min + 1));
    },
    pick<T>(arr: T[]): T | undefined {
      if (arr.length === 0) return undefined;
      return arr[Math.floor(next() * arr.length)];
    },
  };
}

const WORDS = [
  'lorem',
  'ipsum',
  'dolor',
  'sit',
  'amet',
  'alpha',
  'bravo',
  'delta',
  'echo',
  'nova',
  'orbit',
  'pixel',
  'quartz',
  'river',
];
const FIRST = ['Alex', 'Sam', 'Jordan', 'Casey', 'Riley', 'Morgan', 'Taylor', 'Jamie'];
const LAST = ['Smith', 'Lee', 'Patel', 'Garcia', 'Kim', 'Brown', 'Nguyen', 'Olsen'];

function hex(rng: Rng, n: number): string {
  let s = '';
  for (let i = 0; i < n; i++) s += rng.int(0, 15).toString(16);
  return s;
}

function fakeFormat(format: string, rng: Rng): string | null {
  switch (format) {
    case 'email': {
      const f = (rng.pick(FIRST) ?? 'user').toLowerCase();
      return `${f}.${rng.int(1, 999)}@example.com`;
    }
    case 'uuid':
      return `${hex(rng, 8)}-${hex(rng, 4)}-4${hex(rng, 3)}-${(8 + rng.int(0, 3)).toString(16)}${hex(rng, 3)}-${hex(rng, 12)}`;
    case 'date-time': {
      const y = rng.int(2015, 2025);
      const mo = String(rng.int(1, 12)).padStart(2, '0');
      const d = String(rng.int(1, 28)).padStart(2, '0');
      const hh = String(rng.int(0, 23)).padStart(2, '0');
      const mm = String(rng.int(0, 59)).padStart(2, '0');
      const ss = String(rng.int(0, 59)).padStart(2, '0');
      return `${y}-${mo}-${d}T${hh}:${mm}:${ss}Z`;
    }
    case 'date':
      return `${rng.int(2015, 2025)}-${String(rng.int(1, 12)).padStart(2, '0')}-${String(rng.int(1, 28)).padStart(2, '0')}`;
    case 'ipv4':
      return `${rng.int(1, 254)}.${rng.int(0, 255)}.${rng.int(0, 255)}.${rng.int(1, 254)}`;
    case 'uri':
    case 'url':
      return `https://example.com/${rng.pick(WORDS) ?? 'path'}/${rng.int(1, 9999)}`;
    case 'hostname':
      return `${rng.pick(WORDS) ?? 'host'}.example.com`;
    default:
      return null;
  }
}

/** Best-effort string sampler for a simple regex pattern (literals + a few classes). */
function sampleFromPattern(pattern: string, rng: Rng): string | null {
  // Strip anchors.
  let p = pattern.replace(/^\^/, '').replace(/\$$/, '');
  let out = '';
  let i = 0;
  let guard = 0;
  while (i < p.length && guard++ < 200) {
    const ch = p[i] ?? '';
    if (ch === '\\') {
      const nxt = p[i + 1] ?? '';
      if (nxt === 'd') out += String(rng.int(0, 9));
      else if (nxt === 'w') out += (rng.pick('abcdefghijklmnopqrstuvwxyz0123456789'.split('')) ?? 'a');
      else out += nxt;
      i += 2;
      continue;
    }
    if (ch === '[') {
      const close = p.indexOf(']', i);
      if (close === -1) return null;
      const cls = p.slice(i + 1, close);
      // Expand a-z / 0-9 ranges crudely.
      let pool = '';
      let k = 0;
      while (k < cls.length) {
        const a = cls[k] ?? '';
        if (cls[k + 1] === '-' && cls[k + 2]) {
          const start = a.charCodeAt(0);
          const end = (cls[k + 2] ?? '').charCodeAt(0);
          for (let c = start; c <= end && pool.length < 64; c++) pool += String.fromCharCode(c);
          k += 3;
        } else {
          pool += a;
          k += 1;
        }
      }
      out += rng.pick(pool.split('')) ?? 'a';
      i = close + 1;
      // Handle a following quantifier roughly.
      const q = p[i] ?? '';
      if (q === '+' || q === '*') {
        const extra = rng.int(q === '+' ? 1 : 0, 5);
        for (let e = 0; e < extra; e++) out += rng.pick(pool.split('')) ?? 'a';
        i += 1;
      } else if (q === '{') {
        const cb = p.indexOf('}', i);
        if (cb !== -1) {
          const spec = p.slice(i + 1, cb);
          const min = Number(spec.split(',')[0]) || 0;
          for (let e = 1; e < min; e++) out += rng.pick(pool.split('')) ?? 'a';
          i = cb + 1;
        }
      }
      continue;
    }
    if (ch === '.') {
      out += rng.pick('abcdefghijklmnopqrstuvwxyz'.split('')) ?? 'a';
      i += 1;
      continue;
    }
    // Literal char (ignore other meta chars).
    if ('()|?+*'.includes(ch)) {
      i += 1;
      continue;
    }
    out += ch;
    i += 1;
  }
  return out || null;
}

interface JsonSchema {
  type?: string | string[];
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  format?: string;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

function asSchema(v: unknown): JsonSchema {
  if (v && typeof v === 'object') return v as JsonSchema;
  return {};
}

function randomString(rng: Rng, minLen: number, maxLen: number): string {
  const target = rng.int(Math.max(0, minLen), Math.max(minLen, Math.min(maxLen, 40)));
  let s = '';
  while (s.length < target) {
    if (s.length > 0) s += ' ';
    s += rng.pick(WORDS) ?? 'lorem';
  }
  if (s.length > maxLen) s = s.slice(0, maxLen);
  if (s.length < minLen) s = s.padEnd(minLen, 'x');
  return s;
}

function sample(schema: JsonSchema, rng: Rng, depth: number): unknown {
  if (depth > 6) return null;

  if ('const' in schema && schema.const !== undefined) return schema.const;
  if (Array.isArray(schema.enum) && schema.enum.length > 0) {
    return rng.pick(schema.enum);
  }

  let type = schema.type;
  if (Array.isArray(type)) type = rng.pick(type) ?? type[0];
  if (!type) {
    // Infer from presence of keywords.
    if (schema.properties) type = 'object';
    else if (schema.items) type = 'array';
    else type = 'string';
  }

  switch (type) {
    case 'object': {
      const props = schema.properties ?? {};
      const required = Array.isArray(schema.required) ? schema.required : [];
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(props)) {
        // Always include required; include optional ~70% of the time.
        if (required.includes(key) || rng.next() < 0.7) {
          out[key] = sample(asSchema(child), rng, depth + 1);
        }
      }
      return out;
    }
    case 'array': {
      const itemSchema = asSchema(schema.items ?? {});
      const min = schema.minItems ?? 1;
      const max = schema.maxItems ?? Math.max(min, 3);
      const n = rng.int(Math.max(0, min), Math.max(min, Math.min(max, 10)));
      const arr: unknown[] = [];
      for (let i = 0; i < n; i++) arr.push(sample(itemSchema, rng, depth + 1));
      return arr;
    }
    case 'integer': {
      const min = schema.minimum ?? 0;
      const max = schema.maximum ?? min + 1000;
      return rng.int(Math.ceil(min), Math.floor(max));
    }
    case 'number': {
      const min = schema.minimum ?? 0;
      const max = schema.maximum ?? min + 1000;
      const v = min + rng.next() * (max - min);
      return Math.round(v * 100) / 100;
    }
    case 'boolean':
      return rng.next() < 0.5;
    case 'null':
      return null;
    case 'string': {
      if (schema.format) {
        const f = fakeFormat(schema.format, rng);
        if (f !== null) return f;
      }
      if (schema.pattern) {
        const p = sampleFromPattern(schema.pattern, rng);
        if (p !== null) return p;
      }
      return randomString(rng, schema.minLength ?? 3, schema.maxLength ?? 12);
    }
    default:
      return null;
  }
}

const SAMPLE_SCHEMA = `{
  "type": "object",
  "required": ["id", "email", "role"],
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "email": { "type": "string", "format": "email" },
    "name": { "type": "string", "minLength": 4, "maxLength": 20 },
    "role": { "enum": ["admin", "editor", "viewer"] },
    "age": { "type": "integer", "minimum": 18, "maximum": 99 },
    "active": { "type": "boolean" },
    "createdAt": { "type": "string", "format": "date-time" },
    "tags": {
      "type": "array",
      "minItems": 1,
      "maxItems": 4,
      "items": { "type": "string" }
    }
  }
}`;

interface BuildResult {
  output: string;
  error: string | null;
  produced: number;
}

function build(schemaText: string, count: number, format: OutFormat, seed: string): BuildResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(schemaText);
  } catch (e) {
    return {
      output: '',
      error: `Invalid JSON Schema: ${e instanceof Error ? e.message : 'parse error'}`,
      produced: 0,
    };
  }
  const schema = asSchema(parsed);
  const n = Math.max(1, Math.min(count, 1000));
  const instances: unknown[] = [];
  for (let i = 0; i < n; i++) {
    const rng = makeRng(`${seed}#${i}`);
    instances.push(sample(schema, rng, 0));
  }
  const output =
    format === 'ndjson'
      ? instances.map((x) => JSON.stringify(x)).join('\n')
      : JSON.stringify(instances, null, 2);
  return { output, error: null, produced: n };
}

export default function JsonSchemaFakerTool() {
  const [schemaText, setSchemaText] = useState(SAMPLE_SCHEMA);
  const [count, setCount] = useState('5');
  const [format, setFormat] = useState<OutFormat>('array');
  const [seed, setSeed] = useState('schema-faker');
  const [nonce, setNonce] = useState(0);

  const result = useMemo<BuildResult>(() => {
    const c = Number(count);
    if (!Number.isInteger(c) || c < 1) {
      return { output: '', error: 'Count must be a positive integer.', produced: 0 };
    }
    const effective = nonce === 0 ? seed : `${seed}~${nonce}`;
    return build(schemaText, c, format, effective);
  }, [schemaText, count, format, seed, nonce]);

  return (
    <div className="flex flex-col gap-3">
      <OptionsBar>
        <Field label="Count">
          <Input
            value={count}
            onChange={(e) => setCount(e.target.value)}
            inputMode="numeric"
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Seed" hint="Same seed → same data.">
          <Input value={seed} onChange={(e) => setSeed(e.target.value)} className="w-44 font-mono" />
        </Field>
        <Field label="Output as NDJSON">
          <div className="flex h-8 items-center gap-2">
            <Switch
              checked={format === 'ndjson'}
              onCheckedChange={(c) => setFormat(c ? 'ndjson' : 'array')}
              id="jsf-ndjson"
            />
            <Label htmlFor="jsf-ndjson" className="text-xs text-muted-foreground">
              {format === 'ndjson' ? 'NDJSON (one per line)' : 'JSON array'}
            </Label>
          </div>
        </Field>
        <div className="flex items-end">
          <Button variant="secondary" size="sm" onClick={() => setNonce((n) => n + 1)}>
            <RefreshCw className="size-3.5" /> Regenerate
          </Button>
        </div>
      </OptionsBar>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel>
          <PanelHeader title="JSON Schema (draft-07 subset)" />
          <Textarea
            value={schemaText}
            onChange={(e) => setSchemaText(e.target.value)}
            spellCheck={false}
            rows={20}
            className="min-h-[420px] rounded-none border-0 font-mono text-xs"
          />
        </Panel>

        <div className="flex flex-col gap-3">
          <ErrorBanner error={result.error} />
          {!result.error && (
            <Panel>
              <PanelHeader title="Generated instances">
                <CopyButton value={() => result.output} label="Copy" disabled={!result.output} />
                <DownloadButton
                  data={() => result.output}
                  filename={format === 'ndjson' ? 'fake-data.ndjson' : 'fake-data.json'}
                  disabled={!result.output}
                />
              </PanelHeader>
              <pre className="max-h-[420px] overflow-auto p-3 font-mono text-xs leading-relaxed">
                {result.output}
              </pre>
              <StatBar
                items={[
                  `${result.produced} instance${result.produced === 1 ? '' : 's'}`,
                  format,
                  'enums, formats, min/max, items handled',
                ]}
              />
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
